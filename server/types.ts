import type { Request } from 'express'
import type { AuthPayload } from './utils/JWEUtils.js'

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload
}
