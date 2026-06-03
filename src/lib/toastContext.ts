import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'deny'
export type ToastCtx = { showToast: (text: string, tone?: ToastTone) => void }

export const ToastContext = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext)
  if (!ctx) return { showToast: () => {} }
  return ctx
}
