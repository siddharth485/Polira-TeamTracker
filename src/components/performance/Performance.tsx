import { useMemo } from 'react'
import { useStore } from '../../lib/storeContext'
import { can } from '../../lib/permissions'
import { Avatar } from '../Avatar'

function daysBetween(a: string, b: string): number | null {
  const start = new Date(a).getTime()
  const end = new Date(b).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return (end - start) / 86_400_000
}

type Props = {
  onOpenProfile: (id: string) => void
}

export function Performance({ onOpenProfile }: Props) {
  const { tickets, employees, currentUser } = useStore()

  // Only the people this viewer is allowed to see (admin: all, manager: reports + self, member: self).
  const visible = useMemo(
    () => employees.filter((e) => can(currentUser, 'profile.view', { target: e, employees })),
    [employees, currentUser],
  )

  const stats = useMemo(() => {
    const names = new Set(visible.map((e) => e.name))
    const scoped = tickets.filter((t) => names.has(t.assignee))
    const done = scoped.filter((t) => t.status === 'Done')
    const inProgress = scoped.filter((t) => t.status === 'In Progress')
    const resolutionDays = done
      .map((t) => daysBetween(t.createdAt, t.updatedAt))
      .filter((d): d is number => d !== null)
    const avg = resolutionDays.length
      ? resolutionDays.reduce((s, d) => s + d, 0) / resolutionDays.length
      : null

    const perEmployee = visible
      .map((e) => {
        const mine = tickets.filter((t) => t.assignee === e.name)
        const myDone = mine.filter((t) => t.status === 'Done')
        const myProg = mine.filter((t) => t.status === 'In Progress')
        const myRes = myDone
          .map((t) => daysBetween(t.createdAt, t.updatedAt))
          .filter((d): d is number => d !== null)
        return {
          ...e,
          total: mine.length,
          done: myDone.length,
          inProgress: myProg.length,
          completion: mine.length ? Math.round((myDone.length / mine.length) * 100) : 0,
          avgDays: myRes.length ? myRes.reduce((s, d) => s + d, 0) / myRes.length : null,
        }
      })
      .sort((a, b) => b.total - a.total)

    return {
      total: scoped.length,
      done: done.length,
      inProgress: inProgress.length,
      avg,
      perEmployee,
    }
  }, [tickets, visible])

  const scopeLabel =
    currentUser?.role === 'Admin' ? 'Whole organisation'
      : currentUser?.role === 'Manager' ? 'Your team'
        : 'You'

  const cards = [
    { label: 'Total tickets', value: stats.total, unit: '', accent: '#6d5efc' },
    { label: 'Completed', value: stats.done, unit: '', accent: '#22c55e' },
    { label: 'In Progress', value: stats.inProgress, unit: '', accent: '#f59e0b' },
    { label: 'Avg resolution', value: stats.avg !== null ? stats.avg.toFixed(1) : '—', unit: 'days', accent: '#0ea5e9' },
  ]

  return (
    <>
      <div className="metric-grid">
        {cards.map((c) => (
          <div className="metric-card" key={c.label} style={{ '--accent': c.accent } as React.CSSProperties}>
            <div className="label">{c.label}</div>
            <div className="value" style={{ color: c.accent }}>{c.value}</div>
            {c.unit && <div className="unit">{c.unit}</div>}
          </div>
        ))}
      </div>

      <h2 className="section-title">Per-employee breakdown · <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{scopeLabel}</span></h2>
      <div className="surface table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Team</th>
              <th>Total</th>
              <th>Done</th>
              <th>In Progress</th>
              <th>Completion</th>
              <th>Avg days</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stats.perEmployee.map((e) => (
              <tr key={e.id} onClick={() => onOpenProfile(e.id)} title="Open profile">
                <td>
                  <div className="with-avatar">
                    <Avatar name={e.name} size={32} />
                    <div>
                      <strong>{e.name}</strong>
                      <div className="cell-muted" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>{e.code}</div>
                    </div>
                  </div>
                </td>
                <td>{e.team}</td>
                <td>{e.total}</td>
                <td style={{ color: '#22c55e', fontWeight: 700 }}>{e.done}</td>
                <td style={{ color: '#f59e0b', fontWeight: 700 }}>{e.inProgress}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="progress"><span style={{ width: `${e.completion}%` }} /></div>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.completion}%</span>
                  </div>
                </td>
                <td className="cell-muted">{e.avgDays !== null ? e.avgDays.toFixed(1) : '—'}</td>
                <td className="cell-muted">View →</td>
              </tr>
            ))}
            {stats.perEmployee.length === 0 && (
              <tr><td colSpan={8} className="col-empty">No profiles to show.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
