// ── Small formatting / id helpers ───────────────────────────────────────────

export function formatDate(date: string): string {
  if (!date) return '—'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isOverdue(date: string, done: boolean): boolean {
  if (done || !date) return false
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() < Date.now()
}

export function createId(prefix: string, length = 8): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 2 + length).toUpperCase()}`
}

export function relativeTime(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  const diff = Date.now() - parsed.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}
