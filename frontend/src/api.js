import { auth } from './firebase'
import { withGlobalLoading } from './globalLoading'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const GET_CACHE_TTL_MS = 5 * 60_000
const GET_CACHE_MAX_ENTRIES = 50
const PERMANENT_CACHE_PATHS = new Set(['/api/defaults', '/api/quotations/config'])
const PERMANENT_CACHE_VERSION = 2
const CACHE_DATABASE_NAME = 'vstms-browser-cache'
const CACHE_STORE_NAME = 'responses'
const HARD_REFRESH_MARKER = 'vstms:clear-cache-on-start'
const getResponseCache = new Map()
let cacheGeneration = 0
let cacheReady = Promise.resolve()
let persistentCacheDisabled = false

function openCacheDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = database.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' })
        store.createIndex('userId', 'userId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open browser data cache.'))
  })
}

async function readPersistentCache(id) {
  const database = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, 'readonly')
    const request = transaction.objectStore(CACHE_STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Unable to read browser data cache.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error || new Error('Unable to read browser data cache.'))
    }
  })
}

async function writePersistentCache(entry) {
  const database = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite')
    transaction.objectStore(CACHE_STORE_NAME).put(entry)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error || new Error('Unable to save browser data cache.'))
    }
  })
}

async function deletePersistentCache(id) {
  const database = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite')
    transaction.objectStore(CACHE_STORE_NAME).delete(id)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error || new Error('Unable to expire browser data cache.'))
    }
  })
}

async function clearPersistentCache(userId, preservePermanent = false) {
  const database = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(CACHE_STORE_NAME)
    const request = userId
      ? store.index('userId').openCursor(IDBKeyRange.only(userId))
      : store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      if (!preservePermanent || !cursor.value.permanent) cursor.delete()
      cursor.continue()
    }
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error || new Error('Unable to clear browser data cache.'))
    }
  })
}

function isPermanentCacheUrl(url) {
  return PERMANENT_CACHE_PATHS.has(new URL(url, 'http://localhost').pathname)
}

function clearMemoryCache(preservePermanent = false) {
  for (const [key, entry] of getResponseCache) {
    if (!preservePermanent || !entry.permanent) getResponseCache.delete(key)
  }
}

async function clearCachesForHardRefresh() {
  try {
    await clearPersistentCache()
  } catch (error) {
    persistentCacheDisabled = true
    console.warn('Unable to clear browser data cache for hard refresh.', error)
    return
  }
  getResponseCache.clear()
  try {
    sessionStorage.removeItem(HARD_REFRESH_MARKER)
  } catch (error) {
    console.warn('Unable to clear the hard-refresh marker.', error)
  }
}

function handleHardRefreshKeydown(event) {
  const isHardRefresh = (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') ||
    (event.ctrlKey && event.key === 'F5')
  if (!isHardRefresh) return

  getResponseCache.clear()
  try {
    sessionStorage.setItem(HARD_REFRESH_MARKER, '1')
  } catch (error) {
    console.warn('Unable to mark browser cache for hard-refresh clearing.', error)
  }
  cacheGeneration += 1
  cacheReady = clearCachesForHardRefresh()
}

if (typeof window !== 'undefined') {
  try {
    if (sessionStorage.getItem(HARD_REFRESH_MARKER)) {
      cacheReady = clearCachesForHardRefresh()
    }
  } catch (error) {
    console.warn('Unable to read the hard-refresh marker.', error)
  }
  window.addEventListener('keydown', handleHardRefreshKeydown)
}

export function apiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path
}

export async function apiErrorMessage(response, fallback) {
  const body = await response.json().catch(() => ({}))
  return body?.message || body?.detail || `${fallback} (${response.status}).`
}

async function authenticatedFetch(input, init, allowAnonymous) {
  const url = typeof input === 'string' && input.startsWith('/')
    ? apiUrl(input)
    : input
  const user = auth?.currentUser
  if (!user && allowAnonymous) {
    return fetch(url, init)
  }
  if (!user) {
    throw new Error('You must sign in with an authorized admin account to use the management API.')
  }

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
    throw new Error('The API did not authorize this account. Confirm the Firebase email is verified and listed in the backend ADMIN_EMAILS setting, and that the API and app use the same Firebase project. Google Sheets editor access does not grant API admin access.')
  }
  return refreshedResponse
}

async function fetchWithGlobalLoading(input, init, allowAnonymous) {
  const method = (init.method || 'GET').toUpperCase()
  const url = typeof input === 'string' && input.startsWith('/')
    ? apiUrl(input)
    : String(input)
  const userId = auth?.currentUser?.uid || 'anonymous'
  const cacheKey = `${userId}:${allowAnonymous ? 'public' : 'admin'}:${url}`
  const useGetCache = method === 'GET' && init.cache !== 'no-store'

  if (useGetCache) {
    await cacheReady
    const permanentCache = isPermanentCacheUrl(url)
    let cached = getResponseCache.get(cacheKey)
    if (!cached && !persistentCacheDisabled) {
      try {
        cached = await readPersistentCache(cacheKey)
      } catch (error) {
        persistentCacheDisabled = true
        console.warn('Unable to read browser data cache; fetching fresh data.', error)
      }
    }
    if (permanentCache && cached && cached.cacheVersion !== PERMANENT_CACHE_VERSION) {
      getResponseCache.delete(cacheKey)
      cached = null
      if (!persistentCacheDisabled) {
        try {
          await deletePersistentCache(cacheKey)
        } catch (error) {
          persistentCacheDisabled = true
          console.warn('Unable to refresh browser data cache; fetching updated dropdown values.', error)
        }
      }
    }
    if (cached && (permanentCache || cached.expiresAt > Date.now())) {
      if (permanentCache && (!cached.permanent || cached.expiresAt !== null)) {
        cached = { ...cached, permanent: true, cacheVersion: PERMANENT_CACHE_VERSION, expiresAt: null }
        if (!persistentCacheDisabled) {
          try {
            await writePersistentCache(cached)
          } catch (error) {
            persistentCacheDisabled = true
            console.warn('Unable to save browser data cache; continuing with the server response.', error)
          }
        }
      }
      getResponseCache.delete(cacheKey)
      getResponseCache.set(cacheKey, cached)
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      })
    }
    if (cached) {
      getResponseCache.delete(cacheKey)
      if (!persistentCacheDisabled) {
        try {
          await deletePersistentCache(cacheKey)
        } catch (error) {
          persistentCacheDisabled = true
          console.warn('Unable to expire browser data cache; fetching fresh data.', error)
        }
      }
    }
  } else if (method !== 'GET') {
    await cacheReady
    clearMemoryCache(true)
    cacheGeneration += 1
    if (!persistentCacheDisabled) {
      try {
        await clearPersistentCache(undefined, true)
      } catch (error) {
        persistentCacheDisabled = true
        try {
          sessionStorage.setItem(HARD_REFRESH_MARKER, '1')
        } catch (markerError) {
          console.warn('Unable to mark browser cache for clearing after an update.', markerError)
        }
        console.warn('Unable to clear browser data cache before an update.', error)
      }
    }
  }

  const requestGeneration = cacheGeneration
  try {
    const response = await withGlobalLoading(() => authenticatedFetch(input, init, allowAnonymous))
    if (useGetCache && response.ok &&
      response.headers.get('content-type')?.includes('application/json') &&
      requestGeneration === cacheGeneration) {
      const entry = {
        id: cacheKey,
        userId,
        permanent: isPermanentCacheUrl(url),
        cacheVersion: isPermanentCacheUrl(url) ? PERMANENT_CACHE_VERSION : undefined,
        body: await response.clone().text(),
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        expiresAt: isPermanentCacheUrl(url) ? null : Date.now() + GET_CACHE_TTL_MS,
      }
      if (!persistentCacheDisabled) {
        try {
          await writePersistentCache(entry)
        } catch (error) {
          persistentCacheDisabled = true
          console.warn('Unable to save browser data cache; continuing with the server response.', error)
        }
      }
      getResponseCache.set(cacheKey, entry)
      while (getResponseCache.size > GET_CACHE_MAX_ENTRIES) {
        const oldestExpiringEntry = [...getResponseCache]
          .find(([, cachedEntry]) => !cachedEntry.permanent)
        if (!oldestExpiringEntry) break
        getResponseCache.delete(oldestExpiringEntry[0])
      }
    }
    return response
  } finally {
    if (method !== 'GET') {
      clearMemoryCache(true)
      cacheGeneration += 1
      if (!persistentCacheDisabled) {
        try {
          await clearPersistentCache(undefined, true)
        } catch (error) {
          persistentCacheDisabled = true
          try {
            sessionStorage.setItem(HARD_REFRESH_MARKER, '1')
          } catch (markerError) {
            console.warn('Unable to mark browser cache for clearing after an update.', markerError)
          }
          console.warn('Unable to clear browser data cache after an update.', error)
        }
      }
    }
  }
}

export function apiFetch(input, init = {}) {
  return fetchWithGlobalLoading(input, init, false)
}

export function publicApiFetch(input, init = {}) {
  return fetchWithGlobalLoading(input, init, true)
}
