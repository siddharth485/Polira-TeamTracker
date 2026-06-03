import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  PRIORITIES,
  TEAMS,
  WORK_ITEMS,
  WORK_ITEM_TYPES,
} from '../config/workItems'
import { useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import type { Priority, Status, SubTeam, Team, WorkItemType } from '../types'

type Props = {
  initialStatus?: Status
  onClose: () => void
  onCreated: (id: string) => void
}

export function NewTicketModal({ initialStatus = 'Backlog', onClose, onCreated }: Props) {
  const { projects, employees, createTicket, currentUser } = useStore()
  // Members can only create tickets assigned to themselves.
  const canAssignOthers = can(currentUser, 'ticket.create.others')
  const [type, setType] = useState<WorkItemType>('ResearchReport')
  const [form, setForm] = useState({
    title: '',
    description: '',
    team: (currentUser?.team ?? WORK_ITEMS.ResearchReport.defaultTeam) as Team,
    subTeam: '' as SubTeam | '',
    projectId: projects[0]?.id ?? '',
    priority: 'Medium' as Priority,
    assignee: canAssignOthers ? '' : currentUser?.name ?? '',
    dueDate: '',
  })

  const pickType = (t: WorkItemType) => {
    setType(t)
    setForm((f) => ({ ...f, team: WORK_ITEMS[t].defaultTeam }))
  }

  const submit = () => {
    if (!form.title.trim()) return
    const ticket = createTicket({
      title: form.title.trim(),
      description: form.description.trim(),
      type,
      team: form.team,
      subTeam: form.team === 'Creative' ? form.subTeam : '',
      projectId: form.projectId,
      priority: form.priority,
      assignee: form.assignee,
      dueDate: form.dueDate,
      status: initialStatus,
      source: 'Manual',
    })
    onCreated(ticket.id)
  }

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal wide"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>New ticket</h2>
            <div className="sub">Create a typed work-item under a project</div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <label className="field">Work-item type</label>
        <div className="type-grid" style={{ marginBottom: 16 }}>
          {WORK_ITEM_TYPES.map((t) => (
            <button key={t} className={`type-tile ${type === t ? 'active' : ''}`} onClick={() => pickType(t)}>
              <span className="ico">{WORK_ITEMS[t].icon}</span>
              {WORK_ITEMS[t].label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="full">
            <label className="field">Title</label>
            <input className="input" value={form.title} autoFocus
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing?" />
          </div>
          <div className="full">
            <label className="field">Description</label>
            <textarea className="textarea" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add context, links, requirements…" />
          </div>

          <div>
            <label className="field">Project (epic)</label>
            <select className="select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            <label className="field">Assignee{!canAssignOthers && ' (you)'}</label>
            <select
              className="select"
              value={form.assignee}
              disabled={!canAssignOthers}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
            >
              {canAssignOthers ? (
                <>
                  <option value="">— Unassigned —</option>
                  {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.name}>{e.name} ({e.team})</option>)}
                </>
              ) : (
                <option value={currentUser?.name ?? ''}>{currentUser?.name ?? 'You'}</option>
              )}
            </select>
          </div>
          <div>
            <label className="field">Due date</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!form.title.trim()}>Create ticket</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
