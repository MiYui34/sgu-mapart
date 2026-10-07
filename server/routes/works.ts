import { Router } from 'express'
import multer from 'multer'
import worksController from '../controllers/worksController.js'
import { validateToken } from '../middleware/auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const router = Router()

router.get('/', worksController.list)
router.get('/:id', worksController.getOne)
router.get('/:id/download', worksController.download)
router.post(
  '/',
  validateToken,
  upload.fields([
    { name: 'preview', maxCount: 1 },
    { name: 'litematic', maxCount: 1 },
  ]),
  worksController.create,
)
router.delete('/:id', validateToken, worksController.remove)

export default router
