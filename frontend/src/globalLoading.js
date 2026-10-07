let requestCount = 0
let initialLoading = true
let loadingSnapshot = true
const listeners = new Set()

function publishIfChanged() {
  const nextSnapshot = initialLoading || requestCount > 0
  if (nextSnapshot === loadingSnapshot) return
  loadingSnapshot = nextSnapshot
  listeners.forEach((listener) => listener())
}

export function showLoading() {
  requestCount += 1
  publishIfChanged()
}

export function hideLoading() {
  requestCount = Math.max(0, requestCount - 1)
  publishIfChanged()
}

export function finishInitialLoading() {
  initialLoading = false
  publishIfChanged()
}

export async function withGlobalLoading(operation) {
  showLoading()
  try {
    return await operation()
  } finally {
    hideLoading()
  }
}

export function subscribeToLoading(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLoadingSnapshot() {
  return loadingSnapshot
}