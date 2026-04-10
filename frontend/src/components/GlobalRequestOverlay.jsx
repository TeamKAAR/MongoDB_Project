import { useUiStore } from '../store/uiStore.js'

function GlobalRequestOverlay() {
  const pendingRequests = useUiStore((state) => state.pendingRequests)

  if (pendingRequests === 0) {
    return null
  }

  return (
    <div className="request-overlay" aria-live="polite" aria-busy="true">
      <div className="request-spinner" />
      <p>Loading latest data...</p>
    </div>
  )
}

export default GlobalRequestOverlay
