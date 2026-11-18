import { create } from 'zustand'

export type ViewMode = '3d' | 'flat'

interface ViewState {
  mode: ViewMode
  rx: number
  ry: number
  zoom: number
  dragging: boolean
  setMode: (m: ViewMode) => void
  orbit: (rx: number, ry: number) => void
  setZoom: (z: number) => void
  reset: () => void
  setDragging: (d: boolean) => void
}

export const DEFAULT_RX = 14
export const DEFAULT_RY = -20
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 1.6

export const useView = create<ViewState>((set) => ({
  mode: 'flat',
  rx: DEFAULT_RX,
  ry: DEFAULT_RY,
  zoom: 1,
  dragging: false,
  setMode: (mode) => set(mode === '3d' ? { mode, rx: DEFAULT_RX, ry: DEFAULT_RY } : { mode }),
  orbit: (rx, ry) =>
    set({ mode: '3d', rx: Math.max(-12, Math.min(40, rx)), ry: Math.max(-50, Math.min(50, ry)) }),
  setZoom: (z) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100)) }),
  reset: () => set({ mode: 'flat', rx: DEFAULT_RX, ry: DEFAULT_RY, zoom: 1 }),
  setDragging: (dragging) => set({ dragging }),
}))
