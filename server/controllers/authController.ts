import bcrypt from 'bcrypt'
import type { Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import type { AuthenticatedRequest } from '../types.js'
import { createJWE } from '../utils/JWEUtils.js'
import { normalizeCode } from '../../shared/mapart/invite.js'
import { consumeInvitation, peekInvitation } from './invitationController.js'

function validUsername(username: string): boolean {
  return /^[\u4e00-\u9fa5A-Za-z0-9_]{3,16}$/.test(username)
}

const authController = {
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const username = String(req.body.username ?? '').trim()
    const email = String(req.body.email ?? '').trim()
    const password = String(req.body.password ?? '')
    const invitationCode = normalizeCode(req.body.invitationCode)

    if (!validUsername(username)) {
      res.status(400).json({ error: '用户名需为 3–16 位字母、数字、下划线或中文' })
      return
    }
    if (!email.includes('@') || email.length > 255) {
      res.status(400).json({ error: '邮箱格式不正确' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: '密码至少 6 位' })
      return
    }
    if (!invitationCode) {
      res.status(400).json({ error: '请提供邀请码' })
      return
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const peeked = await peekInvitation(connection, invitationCode)
      if (!peeked.valid) {
        await connection.rollback()
        res.status(400).json({ error: peeked.error })
        return
      }

      const [existing] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? OR email = ? FOR UPDATE',
        [username, email],
      )
      if (existing.length > 0) {
        await connection.rollback()
        res.status(400).json({ error: '用户名或邮箱已存在' })
        return
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, email, 'user'],
      )
      await consumeInvitation(connection, invitationCode)
      await connection.commit()
      res.status(201).json({ message: '注册成功', userId: result.insertId })
    } catch (error) {
      await connection.rollback()
      console.error('注册失败:', error)
      res.status(500).json({ error: '注册失败' })
    } finally {
      connection.release()
    }
  },

  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const username = String(req.body.username ?? '').trim()
    const password = String(req.body.password ?? '')
    try {
      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id, username, password, email, role FROM users WHERE username = ?',
        [username],
      )
      if (users.length === 0) {
        res.status(401).json({ error: '用户名或密码错误' })
        return
      }
      const user = users[0]
      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        res.status(401).json({ error: '用户名或密码错误' })
        return
      }
      const token = await createJWE(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'dev-sgu-mapart-secret',
        process.env.JWT_ISSUER || 'sgu-mapart',
        process.env.JWT_EXPIRES_IN || '24h',
      )
      res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      })
    } catch (error) {
      console.error('登录失败:', error)
      res.status(500).json({ error: '登录失败' })
    }
  },

  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [req.user!.id],
    )
    if (users.length === 0) {
      res.status(404).json({ error: '用户不存在' })
      return
    }
    res.json(users[0])
  },
}

export default authController
