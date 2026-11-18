import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { create } from 'zustand'

interface ToastState {
  text: string | null
  n: number
  show: (text: string) => void
}

export const useToast = create<ToastState>((set) => ({
  text: null,
  n: 0,
  show: (text) => set((s) => ({ text, n: s.n + 1 })),
}))

export function Toaster() {
  const { text, n } = useToast()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!text) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 1800)
    return () => clearTimeout(t)
  }, [text, n])
  return (
    <div className={visible ? 'toast is-visible' : 'toast'} role="status" aria-live="polite">
      {text && (
        <>
          <Check size={16} />
          <span>{text}</span>
        </>
      )}
    </div>
  )
}

export async function copyText(text: string, what: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (!ok) return false
  }
  useToast.getState().show(`Copied ${what}`)
  return true
}
