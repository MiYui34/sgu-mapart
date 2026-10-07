import type { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from '../types.js'
import { verifyJWE } from '../utils/JWEUtils.js'

function secret(): { secret: string; issuer: string } {
  return {
    secret: process.env.JWT_SECRET || 'dev-sgu-mapart-secret',
    issuer: process.env.JWT_ISSUER || 'sgu-mapart',
  }
}

export async function validateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: '未提供认证令牌' })
    return
  }
  const { secret: key, issuer } = secret()
  const decoded = await verifyJWE(token, key, issuer)
  if (!decoded.payload) {
    res.status(401).json({ error: '无效的认证令牌' })
    return
  }
  req.user = decoded.payload
  next()
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    next()
    return
  }
  const { secret: key, issuer } = secret()
  const decoded = await verifyJWE(token, key, issuer)
  if (decoded.payload) req.user = decoded.payload
  next()
}

export function isAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' })
    return
  }
  next()
}
