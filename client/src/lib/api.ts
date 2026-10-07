export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user' | string
}

export interface Invitation {
  code: string
  createdBy: number
  createdByName: string
  expiresAt: string
  maxUses: number
  usedCount: number
  createdAt: string
  status: 'active' | 'expired' | 'used_up'
}

export interface WorkSummary {
  id: number
  userId: number
  title: string
  description: string
  tags: string[]
  mapsX: number
  mapsY: number
  previewUrl: string
  fileExt: 'zip' | 'litematic' | string
  downloads: number
  createdAt: string
  author: string
  settings: Record<string, unknown>
}

const API_BASE = '/api'

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}))
  return (data as { error?: string }).error || response.statusText || '请求失败'
}

export const api = {
  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('jwt_token')
    const headers = new Headers(options.headers)
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
    if (!response.ok) throw new Error(await parseError(response))
    return response.json() as Promise<T>
  },
  auth: {
    login(username: string, password: string) {
      return api.fetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
    },
    register(username: string, email: string, password: string, invitationCode: string) {
      return api.fetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, invitationCode }),
      })
    },
    me() {
      return api.fetch<User>('/auth/me')
    },
  },
  invitations: {
    list() {
      return api.fetch<Invitation[]>('/invitations')
    },
    create(expiresInHours: number, maxUses: number) {
      return api.fetch<{ invitation: Invitation }>('/invitations', {
        method: 'POST',
        body: JSON.stringify({ expiresInHours, maxUses }),
      })
    },
    remove(code: string) {
      return api.fetch(`/invitations/${encodeURIComponent(code)}`, { method: 'DELETE' })
    },
  },
  works: {
    list(q: string, sort: 'new' | 'downloads') {
      return api.fetch<WorkSummary[]>(`/works?q=${encodeURIComponent(q)}&sort=${sort}`)
    },
    get(id: string) {
      return api.fetch<WorkSummary>(`/works/${id}`)
    },
    async publish(form: FormData) {
      const token = localStorage.getItem('jwt_token')
      const response = await fetch(`${API_BASE}/works`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!response.ok) throw new Error(await parseError(response))
      return response.json() as Promise<{ id: number }>
    },
    remove(id: number) {
      return api.fetch(`/works/${id}`, { method: 'DELETE' })
    },
  },
}

export function currentUser(): User | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}
