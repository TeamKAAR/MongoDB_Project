import { create } from 'zustand'

export const useUiStore = create((set) => ({
  pendingRequests: 0,
  mobileNavOpen: false,
  beginRequest() {
    set((state) => ({ pendingRequests: state.pendingRequests + 1 }))
  },
  endRequest() {
    set((state) => ({ pendingRequests: Math.max(0, state.pendingRequests - 1) }))
  },
  openMobileNav() {
    set({ mobileNavOpen: true })
  },
  closeMobileNav() {
    set({ mobileNavOpen: false })
  },
  toggleMobileNav() {
    set((state) => ({ mobileNavOpen: !state.mobileNavOpen }))
  },
}))
