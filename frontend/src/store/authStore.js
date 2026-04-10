import { create } from 'zustand'
import { toast } from 'sonner'
import { apiRequest } from '../lib/api.js'

const STORAGE_KEY = 'edutrack-auth'

const readStoredAuth = () => {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return { token: null, user: null }
  }

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return { token: null, user: null }
  }
}

const persistAuth = (token, user) => {
  if (!token || !user) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
}

const initialAuth = readStoredAuth()

export const useAuthStore = create((set, get) => ({
  token: initialAuth.token,
  user: initialAuth.user,
  isLoading: false,
  error: '',
  isAuthenticated: Boolean(initialAuth.token),
  async login(email, password) {
    set({ isLoading: true, error: '' })

    try {
      const payload = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        successMessage: 'Signed in successfully.',
        showSuccessToast: true,
      })

      persistAuth(payload.access_token, payload.user)

      set({
        token: payload.access_token,
        user: payload.user,
        isLoading: false,
        error: '',
        isAuthenticated: true,
      })

      return payload.user
    } catch (error) {
      set({
        isLoading: false,
        error: error.message,
        isAuthenticated: false,
      })
      throw error
    }
  },
  async fetchMe() {
    const token = get().token

    if (!token) {
      return null
    }

    try {
      const user = await apiRequest('/api/v1/auth/me', {
        showErrorToast: false,
      })
      persistAuth(token, user)
      set({ user, isAuthenticated: true })
      return user
    } catch {
      get().logout()
      return null
    }
  },
  logout() {
    persistAuth(null, null)
    toast.success('Signed out.')
    set({
      token: null,
      user: null,
      isLoading: false,
      error: '',
      isAuthenticated: false,
    })
  },
}))
