import { auth } from './firebase'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export function apiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path
}

export async function apiFetch(input, init = {}) {
  const user = auth?.currentUser
  if (!user) {
    throw new Error('You must sign in with an authorized admin account to use the management API.')
  }

  const token = await user.getIdToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  const url = typeof input === 'string' && input.startsWith('/')
    ? apiUrl(input)
    : input
  return fetch(url, { ...init, headers })
}
