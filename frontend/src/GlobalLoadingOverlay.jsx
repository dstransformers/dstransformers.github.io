import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { getLoadingSnapshot, subscribeToLoading } from './globalLoading'
import './GlobalLoadingOverlay.css'

export default function GlobalLoadingOverlay() {
  const isLoading = useSyncExternalStore(subscribeToLoading, getLoadingSnapshot, getLoadingSnapshot)
  const overlayRef = useRef(null)
  const previousOverflow = useRef('')
  const previousFocus = useRef(null)

  useLayoutEffect(() => {
    const application = document.getElementById('application-content')
    if (!application) return

    if (isLoading) {
      previousOverflow.current = document.body.style.overflow
      previousFocus.current = document.activeElement
      application.inert = true
      application.setAttribute('aria-busy', 'true')
      document.body.style.overflow = 'hidden'
      overlayRef.current?.focus()
      return
    }

    application.inert = false
    application.removeAttribute('aria-busy')
    document.body.style.overflow = previousOverflow.current
    if (previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected) {
      previousFocus.current.focus()
    }
    previousFocus.current = null
  }, [isLoading])

  useLayoutEffect(() => () => {
    const application = document.getElementById('application-content')
    if (application) {
      application.inert = false
      application.removeAttribute('aria-busy')
    }
    document.body.style.overflow = previousOverflow.current
  }, [])

  useLayoutEffect(() => {
    if (!isLoading) return undefined

    const blockKeyboardInteraction = (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const blockedEvents = ['keydown', 'keypress', 'keyup', 'beforeinput', 'submit']
    blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockKeyboardInteraction, true))
    return () => {
      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockKeyboardInteraction, true))
    }
  }, [isLoading])

  if (!isLoading) return null

  return (
    <div className="global-loading-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div className="global-loading-overlay__content" tabIndex={-1} ref={overlayRef}>
        <span className="global-loading-overlay__spinner" aria-hidden="true" />
        <span className="global-loading-overlay__message">Loading...</span>
      </div>
    </div>
  )
}