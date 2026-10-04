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

  const url = typeof input === 'string' && input.startsWith('/')
    ? apiUrl(input)
    : input
  const requestWithToken = async (forceRefresh) => {
    const token = await user.getIdToken(forceRefresh)
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }

  const response = await requestWithToken(false)
  if (response.status !== 401) return response

  const refreshedResponse = await requestWithToken(true)
  if (refreshedResponse.status === 401) {
    throw new Error('The API rejected your refreshed admin session. Sign out and back in with the verified, authorized admin account.')
  }
  return refreshedResponse
}
