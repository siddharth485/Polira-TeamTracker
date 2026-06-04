// Fire-and-forget ticket notifications. The server composes & sends the email
// (via the configured GMAIL_USER); failures are ignored so the UI never blocks.

export type NotifyInput = {
  to: string
  kind: 'assigned' | 'updated'
  ticketId: string
  ticketTitle: string
  actorName: string
  detail?: string
}

export function sendNotify(input: NotifyInput): void {
  if (!input.to) return
  void fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => {
    /* notifications are best-effort */
  })
}
