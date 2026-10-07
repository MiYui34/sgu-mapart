import { createHash } from 'crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'

export interface AuthPayload {
  id: number
  username: string
  role: string
}

export function jweKey(secret: string): Uint8Array {
  const raw = Buffer.from(secret, 'base64')
  if (raw.length === 32 && /^[A-Za-z0-9+/]+=*$/.test(secret)) return raw
  return createHash('sha256').update(secret).digest()
}

export async function createJWE(
  payload: AuthPayload,
  secret: string,
  issuer: string,
  expiresIn: string,
): Promise<string> {
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(expiresIn)
    .encrypt(jweKey(secret))
}

export async function verifyJWE(
  token: string,
  secret: string,
  issuer: string,
): Promise<{ payload?: AuthPayload; error?: string }> {
  try {
    const { payload } = await jwtDecrypt(token, jweKey(secret), { issuer })
    return {
      payload: {
        id: Number(payload.id),
        username: String(payload.username),
        role: String(payload.role),
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '无效的认证令牌' }
  }
}
