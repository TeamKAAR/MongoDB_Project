import { toast } from 'sonner'
import { useUiStore } from '../store/uiStore.js'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const STORAGE_KEY = 'edutrack-auth'

function getStoredToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return stored?.token ?? null
  } catch {
    return null
  }
}

async function apiRequest(path, options = {}) {
  const {
    successMessage = '',
    errorMessage = '',
    showSuccessToast = false,
    showErrorToast = true,
    skipLoader = false,
    ...fetchOptions
  } = options
  const token = getStoredToken()
  const headers = new Headers(fetchOptions.headers ?? {})
  const beginRequest = useUiStore.getState().beginRequest
  const endRequest = useUiStore.getState().endRequest

  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!skipLoader) {
    beginRequest()
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const message =
        errorMessage ||
        (typeof payload === 'object' && payload !== null
          ? payload.detail ?? 'Request failed.'
          : payload || 'Request failed.')
      if (showErrorToast) {
        toast.error(message)
      }
      throw new Error(message)
    }

    if (showSuccessToast && successMessage) {
      toast.success(successMessage)
    }

    return payload
  } finally {
    if (!skipLoader) {
      endRequest()
    }
  }
}

export { API_URL, apiRequest }
