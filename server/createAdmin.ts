import 'dotenv/config'
import bcrypt from 'bcrypt'
import type { RowDataPacket } from 'mysql2'
import { ensureSchema, pool } from './config/database.js'

async function createAdminUser(): Promise<void> {
  await ensureSchema()
  const [existing] = await pool.query<RowDataPacket[]>("SELECT username FROM users WHERE role = 'admin'")
  if (existing.length > 0) {
    console.log('已有管理员:', existing.map((row) => row.username).join(', '))
    return
  }
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const hashed = await bcrypt.hash(password, 10)
  await pool.query(
    'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
    ['admin', hashed, 'admin@example.com', 'admin'],
  )
  console.log('管理员已创建')
  console.log('用户名: admin')
  console.log(`密码: ${password}`)
}

createAdminUser()
  .catch((error) => {
    console.error('创建管理员失败:', error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
