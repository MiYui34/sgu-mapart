import { Router } from 'express'
import invitationController from '../controllers/invitationController.js'
import { isAdmin, validateToken } from '../middleware/auth.js'

const router = Router()

router.post('/', validateToken, isAdmin, invitationController.createInvitation)
router.get('/', validateToken, isAdmin, invitationController.listInvitations)
router.delete('/:code', validateToken, isAdmin, invitationController.deleteInvitation)

export default router
