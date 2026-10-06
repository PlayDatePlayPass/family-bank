export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      Offline. Changes need a connection.
    </div>
  )
}
