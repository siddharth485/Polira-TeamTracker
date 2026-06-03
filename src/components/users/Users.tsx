import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TEAMS } from '../../config/workItems'
import { useStore } from '../../lib/storeContext'
import { downloadCsv } from '../../lib/csv'
import type { Employee, Gender, Role, Team } from '../../types'
import { Avatar } from '../Avatar'

const ROLES: Role[] = ['Admin', 'Manager', 'Member', 'Viewer']

type Props = { query: string }

export function Users({ query }: Props) {
  const { employees, addEmployee, toggleEmployeeActive } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    code: '',
    email: '',
    team: 'Research' as Team,
    role: 'Member' as Role,
    gender: 'male' as Gender,
    managerId: '',
  })

  const q = query.trim().toLowerCase()
  const rows = employees.filter(
    (e) => !q || `${e.name} ${e.code} ${e.email} ${e.team}`.toLowerCase().includes(q),
  )
  const managers = employees.filter((e) => e.role === 'Manager' || e.role === 'Admin')

  const exportEmployees = () => {
    const managerName = (id: string) => employees.find((m) => m.id === id)?.name ?? ''
    downloadCsv<Employee>('polira-employees.csv', employees, [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'email', label: 'Email' },
      { key: 'team', label: 'Team' },
      { key: 'role', label: 'Role' },
      { key: 'active', label: 'Active', get: (e) => (e.active ? 'Active' : 'Inactive') },
      { key: 'gender', label: 'Gender' },
      { key: 'managerId', label: 'Reports to', get: (e) => managerName(e.managerId) },
    ])
  }

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) return
    addEmployee({ ...form, active: true })
    setForm({ name: '', code: '', email: '', team: 'Research', role: 'Member', gender: 'male', managerId: '' })
    setOpen(false)
  }

  return (
    <>
      <div className="screen-head" style={{ marginBottom: 0 }}>
        <span />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={exportEmployees}>⤓ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Add user</button>
        </div>
      </div>

      <div className="surface table-wrap" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Email</th>
              <th>Role</th>
              <th>Team</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} style={{ cursor: 'default' }}>
                <td>
                  <div className="with-avatar">
                    <Avatar name={e.name} size={32} />
                    <strong>{e.name}</strong>
                  </div>
                </td>
                <td className="cell-muted" style={{ fontFamily: 'var(--font-mono)' }}>{e.code}</td>
                <td className="cell-muted">{e.email}</td>
                <td>{e.role}</td>
                <td>{e.team}</td>
                <td>
                  <span className="status-dot">
                    <span className="dot" style={{ background: e.active ? '#22c55e' : '#94a3b8' }} />
                    {e.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleEmployeeActive(e.id)}>
                    {e.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="modal"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <h2>Add user</h2>
                  <div className="sub">New Pacwin team member</div>
                </div>
                <button className="icon-btn" onClick={() => setOpen(false)}>✕</button>
              </div>

              <div className="form-grid">
                <div className="full">
                  <label className="field">Name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <label className="field">Code</label>
                  <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PR013" />
                </div>
                <div>
                  <label className="field">Email</label>
                  <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@pacwinindia.com" />
                </div>
                <div>
                  <label className="field">Team</label>
                  <select className="select" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value as Team })}>
                    {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field">Role</label>
                  <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field">Gender</label>
                  <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="field">Reports to</label>
                  <select className="select" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                    <option value="">— None —</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={submit}>Add user</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
