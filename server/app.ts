// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 SGU Mapart contributors

import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import authRouter from './routes/auth.js'
import invitationRouter from './routes/invitation.js'
import worksRouter from './routes/works.js'
import { ensureSchema } from './config/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api/auth', authRouter)
app.use('/api/invitations', invitationRouter)
app.use('/api/works', worksRouter)

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ('code' in error && (error as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: '文件不能超过 8 MB' })
    return
  }
  console.error(error)
  res.status(500).json({ error: '服务器内部错误' })
})

export { app }

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3011
  ensureSchema()
    .then(() => {
      app.listen(port, () => {
        console.log(`SGU 地图画服务运行在 http://localhost:${port}`)
      })
    })
    .catch((error) => {
      console.error('数据库不可用，登录和市场暂不可用:', error)
      app.listen(port, () => {
        console.log(`SGU 地图画服务运行在 http://localhost:${port}（无数据库）`)
      })
    })
}
