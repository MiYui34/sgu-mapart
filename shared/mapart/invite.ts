export interface InvitationRow {
  code: string
  expiresAt: Date | string
  maxUses: number
  usedCount: number
}

export interface CodeCheckResult {
  valid: boolean
  error?: string
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeCode(code: string | undefined | null): string {
  return (code ?? '').trim().toUpperCase()
}

export function generateInvitationCode(bytes: Uint8Array): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

export function evaluateInvitation(row: InvitationRow | null, now = new Date()): CodeCheckResult {
  if (!row) return { valid: false, error: '邀请码无效' }
  const expires = new Date(row.expiresAt)
  if (Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime()) {
    return { valid: false, error: '邀请码已过期' }
  }
  if (row.usedCount >= row.maxUses) return { valid: false, error: '邀请码已达使用上限' }
  return { valid: true }
}

export function invitationStatus(row: InvitationRow, now = new Date()): 'active' | 'expired' | 'used_up' {
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return 'expired'
  if (row.usedCount >= row.maxUses) return 'used_up'
  return 'active'
}
