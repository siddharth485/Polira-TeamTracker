import { useMemo, useState } from 'react'
import {
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_COLORS,
  TEAMS,
  WORK_ITEMS,
} from '../../config/workItems'
import { useStore } from '../../lib/storeContext'
import { can } from '../../lib/permissions'
import { formatDate } from '../../lib/format'
import type { Priority, Status, Team } from '../../types'

type Props = {
  query: string
  onOpenTicket: (id: string) => void
}

type ArchiveFilter = 'live' | 'archived' | 'all'

export function TicketsTable({ query, onOpenTicket }: Props) {
  const { tickets, requests, currentUser, unarchiveTicket, createRequest } = useStore()
  const [status, setStatus] = useState<Status | 'All'>('All')
  const [priority, setPriority] = useState<Priority | 'All'>('All')
  const [team, setTeam] = useState<Team | 'All'>('All')
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all')

  const canUnarchive = can(currentUser, 'ticket.unarchive')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((t) => {
      if (archiveFilter === 'live' && t.archived) return false
      if (archiveFilter === 'archived' && !t.archived) return false
      if (status !== 'All' && t.status !== status) return false
      if (priority !== 'All' && t.priority !== priority) return false
      if (team !== 'All' && t.team !== team) return false
      if (q && !`${t.title} ${t.description} ${t.id} ${t.assignee}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [tickets, status, priority, team, query, archiveFilter])

  const pendingFor = (ticketId: string) =>
    requests.some((r) => r.type === 'unarchive' && r.ticketId === ticketId && r.status === 'pending')

  const requestUnarchive = (ticketId: string, title: string) => {
    if (!currentUser) return
    createRequest({
      type: 'unarchive',
      ticketId,
      employeeId: currentUser.id,
      targetTeam: '',
      targetManagerId: '',
      requestedBy: currentUser.name,
      note: `Requesting to bring "${title}" back to the live board.`,
    })
  }

  return (
    <>
      <div className="filters">
        <select className="select-pill" value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}>
          <option value="all">All tickets</option>
          <option value="live">Live board</option>
          <option value="archived">Archived</option>
        </select>
        <select className="select-pill" value={status} onChange={(e) => setStatus(e.target.value as Status | 'All')}>
          <option value="All">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select-pill" value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'All')}>
          <option value="All">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select-pill" value={team} onChange={(e) => setTeam(e.target.value as Team | 'All')}>
          <option value="All">All teams</option>
          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Team</th>
              <th>Due</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const meta = WORK_ITEMS[t.type]
              const prio = PRIORITY_META[t.priority]
              return (
                <tr key={t.id} onClick={() => onOpenTicket(t.id)}>
                  <td className="cell-id">{t.id}</td>
                  <td><strong>{t.title}</strong></td>
                  <td>{meta.icon} {meta.label}</td>
                  <td>
                    <span className="status-dot">
                      <span className="dot" style={{ background: STATUS_COLORS[t.status] }} />
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: prio.bg, color: prio.color }}>{t.priority}</span>
                  </td>
                  <td>{t.assignee || '—'}</td>
                  <td>{t.team}{t.subTeam ? ` · ${t.subTeam}` : ''}</td>
                  <td className="cell-muted">{formatDate(t.dueDate)}</td>
                  <td>
                    {t.archived
                      ? <span className="badge" style={{ background: 'rgba(148,163,184,.18)', color: '#64748b' }}>Archived</span>
                      : <span className="cell-muted">Live</span>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {t.archived && canUnarchive && (
                      <button className="btn btn-ghost btn-sm" onClick={() => unarchiveTicket(t.id)}>↩ Unarchive</button>
                    )}
                    {t.archived && !canUnarchive && (
                      <button className="btn btn-ghost btn-sm" disabled={pendingFor(t.id)} onClick={() => requestUnarchive(t.id, t.title)}>
                        {pendingFor(t.id) ? 'Requested ✓' : 'Request'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="col-empty">No tickets match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
