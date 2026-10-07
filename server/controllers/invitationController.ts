import crypto from 'crypto'
import type { Response } from 'express'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../config/database.js'
import type { AuthenticatedRequest } from '../types.js'
import {
  evaluateInvitation,
  generateInvitationCode,
  invitationStatus,
  normalizeCode,
  type CodeCheckResult,
} from '../../shared/mapart/invite.js'

interface InvitationPacket extends RowDataPacket {
  code: string
  created_by: number
  created_by_name: string
  expires_at: Date
  max_uses: number
  used_count: number
  created_at: Date
}

async function lockInvitation(connection: PoolConnection, code: string): Promise<InvitationPacket | null> {
  const [rows] = await connection.query<InvitationPacket[]>(
    'SELECT * FROM invitations WHERE code = ? FOR UPDATE',
    [code],
  )
  return rows[0] ?? null
}

export async function peekInvitation(connection: PoolConnection, code: string): Promise<CodeCheckResult> {
  const row = await lockInvitation(connection, code)
  if (!row) return { valid: false, error: '邀请码无效' }
  return evaluateInvitation({
    code: row.code,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count,
  })
}

export async function consumeInvitation(connection: PoolConnection, code: string): Promise<void> {
  await connection.query<ResultSetHeader>(
    'UPDATE invitations SET used_count = used_count + 1 WHERE code = ?',
    [code],
  )
}

const invitationController = {
  async createInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const expiresInHours = Number(req.body.expiresInHours ?? 24)
    const maxUses = Number(req.body.maxUses ?? 1)
    if (!Number.isFinite(expiresInHours) || expiresInHours <= 0 || expiresInHours > 720) {
      res.status(400).json({ error: '到期时间须在 1~720 小时之间' })
      return
    }
    if (!Number.isInteger(maxUses) || maxUses <= 0 || maxUses > 100) {
      res.status(400).json({ error: '最大使用次数须在 1~100 之间' })
      return
    }

    let code = generateInvitationCode(crypto.randomBytes(8))
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existing] = await pool.query<RowDataPacket[]>('SELECT code FROM invitations WHERE code = ?', [code])
      if (existing.length === 0) break
      code = generateInvitationCode(crypto.randomBytes(8))
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    await pool.query(
      `INSERT INTO invitations (code, created_by, created_by_name, expires_at, max_uses, used_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [code, req.user!.id, req.user!.username, expiresAt, maxUses],
    )
    res.status(201).json({
      message: '邀请码创建成功',
      invitation: {
        code,
        createdBy: req.user!.id,
        createdByName: req.user!.username,
        expiresAt: expiresAt.toISOString(),
        maxUses,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        status: 'active',
      },
    })
  },

  async listInvitations(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const [rows] = await pool.query<InvitationPacket[]>('SELECT * FROM invitations ORDER BY created_at DESC')
    res.json(
      rows.map((row) => {
        const plain = {
          code: row.code,
          expiresAt: row.expires_at,
          maxUses: row.max_uses,
          usedCount: row.used_count,
        }
        return {
          code: row.code,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          expiresAt: new Date(row.expires_at).toISOString(),
          maxUses: row.max_uses,
          usedCount: row.used_count,
          createdAt: new Date(row.created_at).toISOString(),
          status: invitationStatus(plain),
        }
      }),
    )
  },

  async deleteInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const code = normalizeCode(req.params.code)
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM invitations WHERE code = ?', [code])
    if (result.affectedRows === 0) {
      res.status(404).json({ error: '邀请码不存在' })
      return
    }
    res.json({ message: '邀请码已删除' })
  },
}

export default invitationController
