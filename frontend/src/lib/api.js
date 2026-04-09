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
  const token = getStoredToken()
  const headers = new Headers(options.headers ?? {})

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null
        ? payload.detail ?? 'Request failed.'
        : payload || 'Request failed.'
    throw new Error(message)
  }

  return payload
}

export { API_URL, apiRequest }
