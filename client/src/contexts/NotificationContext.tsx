import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'info' | 'success' | 'error'

const NotificationContext = createContext<(message: string, type?: Kind) => void>(() => {})

export function useNotification() {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Array<{ id: number; message: string; type: Kind }>>([])
  const show = useCallback((message: string, type: Kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 3600)
  }, [])
  return (
    <NotificationContext.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {items.map((item) => (
          <div key={item.id} className="toast" style={{ color: item.type === 'error' ? 'var(--error)' : item.type === 'success' ? 'var(--success)' : 'inherit' }}>
            {item.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
