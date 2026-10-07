import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'sgu_mapart',
}

export const pool: Pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
})

export async function ensureSchema(): Promise<void> {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  })
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await connection.query(`USE \`${dbConfig.database}\``)
  const schema = fs.readFileSync(path.resolve(__dirname, '../schema.sql'), 'utf8')
  await connection.query(schema)
  await connection.end()
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 AS ok')
  if (!rows[0]?.ok) throw new Error('数据库自检失败')
}
