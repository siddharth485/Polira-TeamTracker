import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { relativeTime } from '../lib/format'

export function RequestsInbox() {
  const { requests, employees, currentUser, resolveRequest } = useStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isApprover = can(currentUser, 'request.approve')
  const pending = requests.filter((r) => r.status === 'pending')
  // Approvers see all pending; members see their own (any status).
  const visible = isApprover
    ? requests.filter((r) => r.status === 'pending')
    : requests.filter((r) => r.employeeId === currentUser?.id)
  const badge = isApprover ? pending.length : 0

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id

  return (
    <div className="popover-wrap" ref={wrapRef}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Requests" style={{ position: 'relative' }}>
        🔔
        {badge > 0 && <span className="bell-badge">{badge}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="popover"
            style={{ width: 360 }}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <h4>Requests</h4>
            <p className="sub">{isApprover ? `${pending.length} awaiting your decision` : 'Your requests'}</p>

            {visible.length === 0 && <p className="cell-muted" style={{ fontSize: 13 }}>Nothing here right now.</p>}

            {visible.map((r) => (
              <div key={r.id} className="req-row">
                <div className="req-body">
                  <strong>{r.type === 'unarchive' ? '↩ Un-archive' : '⇄ Team move'}</strong>
                  <p>{r.note}</p>
                  <span className="req-meta">{nameOf(r.employeeId)} · {relativeTime(r.createdAt)}</span>
                </div>
                {isApprover && r.status === 'pending' ? (
                  <div className="req-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => resolveRequest(r.id, true)}>Approve</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => resolveRequest(r.id, false)}>Reject</button>
                  </div>
                ) : (
                  <span className={`req-status ${r.status}`}>{r.status}</span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
