import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import type { Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import type { AuthenticatedRequest } from '../types.js'
import { inspectMapartFile } from '../../shared/mapart/bundle.js'
import { MAX_MAPS } from '../../shared/mapart/palette.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadRoot = path.resolve(__dirname, '../uploads')

interface WorkPacket extends RowDataPacket {
  id: number
  user_id: number
  title: string
  description: string | null
  tags: string
  maps_x: number
  maps_y: number
  preview_path: string
  litematic_path: string
  settings_json: unknown
  downloads: number
  created_at: Date
  username: string
}

function publicWork(row: WorkPacket) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    mapsX: row.maps_x,
    mapsY: row.maps_y,
    previewUrl: `/uploads/${row.preview_path.replace(/\\/g, '/')}`,
    fileExt: row.litematic_path.endsWith('.zip') ? 'zip' : 'litematic',
    downloads: row.downloads,
    createdAt: new Date(row.created_at).toISOString(),
    author: row.username,
    settings: typeof row.settings_json === 'string' ? JSON.parse(row.settings_json) : row.settings_json,
  }
}

const SELECT_WORK = `
  SELECT w.*, u.username
  FROM works w
  JOIN users u ON u.id = w.user_id
`

const worksController = {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const q = String(req.query.q ?? '').trim()
    const sort = req.query.sort === 'downloads' ? 'downloads' : 'new'
    const order = sort === 'downloads' ? 'w.downloads DESC, w.created_at DESC' : 'w.created_at DESC'
    const like = `%${q}%`
    const [rows] = await pool.query<WorkPacket[]>(
      `${SELECT_WORK}
       WHERE (? = '' OR w.title LIKE ? OR w.description LIKE ? OR w.tags LIKE ? OR u.username LIKE ?)
       ORDER BY ${order}
       LIMIT 60`,
      [q, like, like, like, like],
    )
    res.json(rows.map(publicWork))
  },

  async getOne(req: AuthenticatedRequest, res: Response): Promise<void> {
    const [rows] = await pool.query<WorkPacket[]>(`${SELECT_WORK} WHERE w.id = ?`, [req.params.id])
    if (rows.length === 0) {
      res.status(404).json({ error: '作品不存在' })
      return
    }
    res.json(publicWork(rows[0]))
  },

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const preview = files?.preview?.[0]
    const litematic = files?.litematic?.[0]
    if (!preview || !litematic) {
      res.status(400).json({ error: '需要封面和投影文件' })
      return
    }
    if (!preview.mimetype.startsWith('image/')) {
      res.status(400).json({ error: '封面必须是图片' })
      return
    }
    const title = String(req.body.title ?? '').trim()
    const description = String(req.body.description ?? '').trim()
    const tags = String(req.body.tags ?? '')
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8)
    const mapsX = Number(req.body.mapsX)
    const mapsY = Number(req.body.mapsY)
    if (!title || title.length > 80) {
      res.status(400).json({ error: '标题需在 1–80 字之间' })
      return
    }
    if (!Number.isInteger(mapsX) || !Number.isInteger(mapsY) || mapsX < 1 || mapsY < 1 || mapsX > MAX_MAPS || mapsY > MAX_MAPS) {
      res.status(400).json({ error: '地图张数超出范围' })
      return
    }
    const inspected = inspectMapartFile(Uint8Array.from(litematic.buffer), mapsX, mapsY)
    if (!inspected.ok) {
      res.status(400).json({ error: inspected.error })
      return
    }

    let settings: unknown = {}
    try {
      settings = req.body.settings ? JSON.parse(String(req.body.settings)) : {}
    } catch {
      res.status(400).json({ error: '生成参数无法解析' })
      return
    }

    const id = randomUUID()
    const previewName = `previews/${id}.png`
    const litematicName = `litematics/${id}.${inspected.zip ? 'zip' : 'litematic'}`
    await fs.mkdir(path.join(uploadRoot, 'previews'), { recursive: true })
    await fs.mkdir(path.join(uploadRoot, 'litematics'), { recursive: true })
    await fs.writeFile(path.join(uploadRoot, 'previews', `${id}.png`), preview.buffer)
    await fs.writeFile(path.join(uploadRoot, litematicName), litematic.buffer)

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO works
        (user_id, title, description, tags, maps_x, maps_y, preview_path, litematic_path, settings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user!.id,
        title,
        description,
        tags.join(','),
        mapsX,
        mapsY,
        previewName,
        litematicName,
        JSON.stringify(settings),
      ],
    )
    res.status(201).json({ id: result.insertId, message: '已上架' })
  },

  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    const [rows] = await pool.query<WorkPacket[]>('SELECT * FROM works WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      res.status(404).json({ error: '作品不存在' })
      return
    }
    const work = rows[0]
    if (work.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: '只能下架自己的作品' })
      return
    }
    await pool.query('DELETE FROM works WHERE id = ?', [work.id])
    await fs.rm(path.join(uploadRoot, 'previews', path.basename(work.preview_path)), { force: true })
    await fs.rm(path.join(uploadRoot, 'litematics', path.basename(work.litematic_path)), { force: true })
    res.json({ message: '已下架' })
  },

  async download(req: AuthenticatedRequest, res: Response): Promise<void> {
    const [rows] = await pool.query<WorkPacket[]>('SELECT * FROM works WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      res.status(404).json({ error: '作品不存在' })
      return
    }
    const work = rows[0]
    await pool.query('UPDATE works SET downloads = downloads + 1 WHERE id = ?', [work.id])
    const filePath = path.join(uploadRoot, 'litematics', path.basename(work.litematic_path))
    const ext = work.litematic_path.endsWith('.zip') ? '.zip' : '.litematic'
    res.download(filePath, `${work.title}${ext}`)
  },
}

export default worksController
