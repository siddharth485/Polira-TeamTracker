import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_COLORS,
  TEAMS,
  WORK_ITEMS,
  WORK_ITEM_TYPES,
} from '../config/workItems'
import { useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { useToast } from '../lib/toastContext'
import { formatDate, relativeTime } from '../lib/format'
import type { Priority, Status, SubTeam, Team, WorkItemType } from '../types'
import { Avatar } from './Avatar'

type Props = {
  ticketId: string
  onClose: () => void
}

const DENY = 'Members can only comment — ask a manager to change ticket details.'

export function TicketDetail({ ticketId, onClose }: Props) {
  const {
    tickets, projects, comments, employees, requests, currentUser,
    updateTicket, addComment, editComment, deleteComment, archiveTicket, unarchiveTicket, createRequest,
  } = useStore()
  const { showToast } = useToast()
  const ticket = tickets.find((t) => t.id === ticketId)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => ticket && ({
    title: ticket.title, description: ticket.description, type: ticket.type,
    team: ticket.team, subTeam: ticket.subTeam, assignee: ticket.assignee,
    priority: ticket.priority, dueDate: ticket.dueDate,
  }))

  if (!ticket || !form) return null

  const type = WORK_ITEMS[ticket.type]
  const prio = PRIORITY_META[ticket.priority]
  const project = projects.find((p) => p.id === ticket.projectId)
  const thread = comments.filter((c) => c.ticketId === ticket.id)

  const canEdit = can(currentUser, 'ticket.edit', { ticket, employees })
  const canComment = can(currentUser, 'comment.add', { ticket })
  const canDeleteComment = can(currentUser, 'comment.delete')
  const canArchive = can(currentUser, 'ticket.archive')
  const canUnarchive = can(currentUser, 'ticket.unarchive')
  const pendingUnarchive = requests.some(
    (r) => r.type === 'unarchive' && r.ticketId === ticket.id && r.status === 'pending',
  )

  const deny = () => showToast(DENY, 'deny')

  const requestUnarchive = () => {
    if (!currentUser) return
    createRequest({
      type: 'unarchive', ticketId: ticket.id, employeeId: currentUser.id,
      targetTeam: '', targetManagerId: '', requestedBy: currentUser.name,
      note: `Requesting to bring "${ticket.title}" back to the live board.`,
    })
    showToast('Request sent to your manager and admin.', 'info')
  }

  const startEdit = () => { if (canEdit) { setForm({ title: ticket.title, description: ticket.description, type: ticket.type, team: ticket.team, subTeam: ticket.subTeam, assignee: ticket.assignee, priority: ticket.priority, dueDate: ticket.dueDate }); setEditing(true) } else deny() }
  const saveEdit = () => {
    updateTicket(ticket.id, {
      title: form.title.trim() || ticket.title, description: form.description, type: form.type,
      team: form.team, subTeam: form.team === 'Creative' ? form.subTeam : '',
      assignee: form.assignee, priority: form.priority, dueDate: form.dueDate,
    })
    setEditing(false)
    showToast('Ticket updated.', 'info')
  }

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal wide" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="cell-id" style={{ fontSize: 12 }}>{ticket.id}</div>
            <h2 style={{ marginTop: 4 }}>{type.icon} {ticket.title}</h2>
            <div className="sub">{type.label}{project ? ` · ${project.name}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!ticket.archived && !editing && (
              <button className="btn btn-ghost btn-sm" onClick={startEdit}>✎ Edit</button>
            )}
            {ticket.archived && canUnarchive && (
              <button className="btn btn-ghost btn-sm" onClick={() => unarchiveTicket(ticket.id)}>↩ Unarchive</button>
            )}
            {ticket.archived && !canUnarchive && (
              <button className="btn btn-ghost btn-sm" onClick={requestUnarchive} disabled={pendingUnarchive}>
                {pendingUnarchive ? 'Requested ✓' : 'Request un-archive'}
              </button>
            )}
            {!ticket.archived && (
              <button className="btn btn-ghost btn-sm" onClick={() => { if (canArchive) { archiveTicket(ticket.id); onClose() } else showToast('Only admins can archive tickets.', 'deny') }}>🗄 Archive</button>
            )}
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {editing ? (
          <div className="form-grid" style={{ marginTop: 4 }}>
            <div className="full">
              <label className="field">Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="full">
              <label className="field">Description / task</label>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="field">Type</label>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WorkItemType })}>
                {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{WORK_ITEMS[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="field">Team</label>
              <select className="select" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value as Team })}>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.team === 'Creative' && (
              <div>
                <label className="field">Sub-team</label>
                <select className="select" value={form.subTeam} onChange={(e) => setForm({ ...form, subTeam: e.target.value as SubTeam | '' })}>
                  <option value="">— Any —</option>
                  <option value="Content">Content</option>
                  <option value="Visuals">Visuals</option>
                </select>
              </div>
            )}
            <div>
              <label className="field">Priority</label>
              <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field">Assignee</label>
              <select className="select" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">— Unassigned —</option>
                {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.name}>{e.name} ({e.team})</option>)}
              </select>
            </div>
            <div>
              <label className="field">Due date</label>
              <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="full modal-foot" style={{ marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span className="badge" style={{ background: prio.bg, color: prio.color }}>{ticket.priority}</span>
              <span className="badge badge-soft">{ticket.team}{ticket.subTeam ? ` · ${ticket.subTeam}` : ''}</span>
              <span className="badge badge-soft">{ticket.source}</span>
              {ticket.archived && <span className="badge" style={{ background: 'rgba(148,163,184,.18)', color: '#64748b' }}>Archived</span>}
              {ticket.tags.map((t) => <span key={t} className="badge badge-soft">#{t}</span>)}
            </div>

            {ticket.description && <p style={{ color: 'var(--text-2)', lineHeight: 1.55, fontSize: 14 }}>{ticket.description}</p>}

            <label className="field" style={{ marginTop: 14 }}>Status{!canEdit && ' · members can’t move tickets'}</label>
            <div className="filters" style={{ marginBottom: 0 }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={`chip ${ticket.status === s ? 'active' : ''}`}
                  style={ticket.status === s ? { background: `${STATUS_COLORS[s]}22`, color: STATUS_COLORS[s], borderColor: 'transparent' } : undefined}
                  onClick={() => { if (canEdit) updateTicket(ticket.id, { status: s as Status }); else deny() }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="detail-meta">
              <div className="cell"><span>Assignee</span><strong>{ticket.assignee || 'Unassigned'}</strong></div>
              <div className="cell"><span>Reporter</span><strong>{ticket.reporter || '—'}</strong></div>
              <div className="cell" onClick={() => { if (!canEdit) deny() }} style={{ cursor: canEdit ? 'default' : 'pointer' }}>
                <span>Due date</span><strong>{formatDate(ticket.dueDate)}</strong>
              </div>
              <div className="cell"><span>Updated</span><strong>{relativeTime(ticket.updatedAt)}</strong></div>
            </div>
          </>
        )}

        <h4 className="section-title" style={{ marginTop: 8 }}>Comments · {thread.length}</h4>
        <div>
          {thread.map((c) => {
            const mineOrPriv = can(currentUser, 'comment.edit', { comment: c })
            return (
              <div className="comment" key={c.id}>
                <Avatar name={c.author} size={30} />
                <div className="body">
                  <strong>{c.author}</strong>
                  {editingId === c.id ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input className="input" value={editText} autoFocus
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { editComment(c.id, editText); setEditingId(null) }
                          if (e.key === 'Escape') setEditingId(null)
                        }} />
                      <button className="btn btn-primary btn-sm" onClick={() => { editComment(c.id, editText); setEditingId(null) }}>Save</button>
                    </div>
                  ) : (
                    <p>{c.text}</p>
                  )}
                  {(mineOrPriv || canDeleteComment) && editingId !== c.id && (
                    <div className="comment-actions">
                      {mineOrPriv && <button onClick={() => { setEditingId(c.id); setEditText(c.text) }}>Edit</button>}
                      {canDeleteComment && <button className="danger" onClick={() => deleteComment(c.id)}>Delete</button>}
                    </div>
                  )}
                </div>
                <span className="when">{relativeTime(c.createdAt)}</span>
              </div>
            )
          })}
          {thread.length === 0 && <p className="cell-muted" style={{ fontSize: 13 }}>No comments yet.</p>}
        </div>

        {canComment ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { addComment(ticket.id, draft); setDraft('') } }}
              placeholder="Add a comment…" />
            <button className="btn btn-primary" onClick={() => { if (draft.trim()) { addComment(ticket.id, draft); setDraft('') } }}>Post</button>
          </div>
        ) : (
          <p className="cell-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            You can only comment on tickets assigned to or reported by you.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
