import { describe, expect, it } from 'vitest'
import { evaluateInvitation, generateInvitationCode, normalizeCode } from './invite.js'

describe('邀请码', () => {
  const future = new Date('2030-01-01T00:00:00Z')
  const now = new Date('2026-10-07T00:00:00Z')

  it('拒绝不存在的邀请码', () => {
    expect(evaluateInvitation(null, now)).toEqual({ valid: false, error: '邀请码无效' })
  })

  it('拒绝过期的邀请码', () => {
    const result = evaluateInvitation(
      { code: 'ABCD2345', expiresAt: '2020-01-01T00:00:00Z', maxUses: 1, usedCount: 0 },
      now,
    )
    expect(result).toEqual({ valid: false, error: '邀请码已过期' })
  })

  it('拒绝已经用尽的邀请码', () => {
    const result = evaluateInvitation(
      { code: 'ABCD2345', expiresAt: future, maxUses: 1, usedCount: 1 },
      now,
    )
    expect(result).toEqual({ valid: false, error: '邀请码已达使用上限' })
  })

  it('接受仍然有效的邀请码', () => {
    const result = evaluateInvitation(
      { code: 'abcd2345', expiresAt: future, maxUses: 2, usedCount: 1 },
      now,
    )
    expect(result.valid).toBe(true)
    expect(normalizeCode(' abcd2345 ')).toBe('ABCD2345')
    expect(generateInvitationCode(new Uint8Array(8).fill(1))).toHaveLength(8)
  })
})
