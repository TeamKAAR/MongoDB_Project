import { create } from 'zustand'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
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
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.detail ?? 'Unable to sign in.')
      }

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

    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      get().logout()
      return null
    }

    const user = await response.json()

    if (!response.ok) {
      throw new Error(user.detail ?? 'Unable to fetch session.')
    }

    persistAuth(token, user)
    set({ user, isAuthenticated: true })
    return user
  },
  logout() {
    persistAuth(null, null)
    set({
      token: null,
      user: null,
      isLoading: false,
      error: '',
      isAuthenticated: false,
    })
  },
}))
