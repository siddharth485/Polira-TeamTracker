import type { Screen } from '../types'
import { useStore } from '../lib/storeContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'

const WORKSPACE: { key: Screen; label: string; icon: string }[] = [
  { key: 'Board', label: 'Board', icon: '▦' },
  { key: 'Tickets', label: 'Tickets', icon: '☰' },
  { key: 'Performance', label: 'Performance', icon: '◎' },
]

const ADMIN: { key: Screen; label: string; icon: string }[] = [
  { key: 'Users', label: 'Users', icon: '◑' },
  { key: 'WhatsApp', label: 'WhatsApp', icon: '✳' },
]

type Props = {
  screen: Screen
  onNavigate: (s: Screen) => void
  onOpenProfile: (employeeId: string) => void
}

export function Sidebar({ screen, onNavigate, onOpenProfile }: Props) {
  const { realUser, currentUser, employees, viewAsId, setViewAs } = useStore()
  const name = currentUser?.name ?? 'Siddharth'
  const role = currentUser?.role ?? 'Admin'
  // The switcher is an admin-only control: shown only while acting as an admin.
  const canViewAs = currentUser?.role === 'Admin'
  // An admin previewing a non-admin can exit back to themselves (no lockout).
  const isPreviewing = realUser?.role === 'Admin' && currentUser?.id !== realUser?.id

  const item = (entry: { key: Screen; label: string; icon: string }) => (
    <button
      key={entry.key}
      className={`nav-item ${screen === entry.key ? 'active' : ''}`}
      onClick={() => onNavigate(entry.key)}
    >
      <span className="nav-icon">{entry.icon}</span>
      <span>{entry.label}</span>
    </button>
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><Logo size={34} /></div>
        <div className="brand-name">Polira</div>
      </div>

      <div className="nav-group-label">WORKSPACE</div>
      {WORKSPACE.map(item)}

      <div className="nav-group-label">ADMIN</div>
      {ADMIN.map(item)}

      <div className="sidebar-bottom">
        {canViewAs && (
          <div className="viewas">
            <label className="field" style={{ marginBottom: 4 }}>Viewing as (admin)</label>
            <select className="select-pill viewas-select" value={viewAsId || realUser?.id || ''} onChange={(e) => setViewAs(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {e.role}</option>
              ))}
            </select>
          </div>
        )}
        {!canViewAs && isPreviewing && realUser && (
          <button className="viewas-exit" onClick={() => setViewAs(realUser.id)}>
            ↩ Exit preview (back to {realUser.name})
          </button>
        )}

        <button
          className="sidebar-foot sidebar-foot-btn"
          onClick={() => currentUser && onOpenProfile(currentUser.id)}
          title="Open my profile"
        >
          <Avatar name={name} size={36} />
          <div className="who">
            <strong>{name}</strong>
            <br />
            <span>{role} · my profile →</span>
          </div>
        </button>
      </div>
    </aside>
  )
}
