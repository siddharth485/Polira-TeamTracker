import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/storeContext'
import { can } from '../../lib/permissions'
import { employeeMetrics } from '../../lib/metrics'
import { localInsight, fetchInsight } from '../../lib/insight'
import { TEAM_COLORS } from '../../config/workItems'
import { relativeTime } from '../../lib/format'
import { Avatar } from '../Avatar'

const ProfileCharts = lazy(() => import('./ProfileCharts').then((m) => ({ default: m.ProfileCharts })))

type Props = {
  employeeId: string
  onClose: () => void
}

export function ProfileView({ employeeId, onClose }: Props) {
  const { employees, tickets, feedback, currentUser, addFeedback } = useStore()
  const employee = employees.find((e) => e.id === employeeId)

  const metrics = useMemo(
    () => (employee ? employeeMetrics(tickets, employee.name) : null),
    [employee, tickets],
  )

  const [insight, setInsight] = useState(() =>
    employee && metrics ? localInsight(employee, metrics) : '',
  )

  useEffect(() => {
    if (!employee || !metrics) return
    let alive = true
    void fetchInsight(employee, metrics).then((text) => {
      if (alive) setInsight(text)
    })
    return () => {
      alive = false
    }
  }, [employee, metrics])

  const [points, setPoints] = useState(7)
  const [note, setNote] = useState('')

  if (!employee || !metrics) return null

  const teamColor = TEAM_COLORS[employee.team] ?? '#6d5efc'
  const canGive = can(currentUser, 'feedback.give', { target: employee, employees })
  const myFeedback = feedback.filter((f) => f.employeeId === employee.id)
  const totalPoints = myFeedback.reduce((s, f) => s + f.points, 0)
  const onTimePct = metrics.onTime + metrics.late > 0
    ? Math.round((metrics.onTime / (metrics.onTime + metrics.late)) * 100)
    : null

  const stats = [
    { label: 'Total tasks', value: metrics.total },
    { label: 'Completed', value: metrics.done },
    { label: 'Completion', value: `${metrics.completionRate}%` },
    {
      label: 'Avg resolution',
      value: metrics.avgResolutionHours !== null ? `${(metrics.avgResolutionHours / 24).toFixed(1)}d` : '—',
    },
    { label: 'On-time', value: onTimePct !== null ? `${onTimePct}%` : '—' },
    { label: 'Kudos points', value: totalPoints },
  ]

  const submitFeedback = () => {
    if (!note.trim()) return
    addFeedback(employee.id, points, note)
    setNote('')
  }

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="profile-modal"
        initial={{ scale: 0.96, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn profile-close" onClick={onClose}>✕</button>

        <div className="profile-hero" style={{ ['--team' as string]: teamColor }}>
          <div className="profile-3d">
            <Avatar name={employee.name} size={96} />
          </div>
          <div className="profile-id">
            <span className="eyebrow" style={{ color: teamColor }}>{employee.team} team · {employee.role}</span>
            <h2>{employee.name}</h2>
            <p className="profile-code">{employee.code} · {employee.email}</p>
            <div className="profile-stats">
              {stats.map((s) => (
                <div className="pstat" key={s.label}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-insight">
          <div className="insight-badge">✦ AI insight</div>
          <p>{insight}</p>
        </div>

        <Suspense fallback={<div className="chart-loading">Loading charts…</div>}>
          <ProfileCharts m={metrics} />
        </Suspense>

        <div className="feedback-section">
          <h3 className="section-title">Manager feedback · {myFeedback.length}</h3>
          {canGive && (
            <div className="feedback-form">
              <div className="points-pick">
                <label className="field">Points</label>
                <input type="range" min={1} max={10} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
                <span className="points-val">{points}</span>
              </div>
              <textarea
                className="textarea"
                placeholder={`Add a note for ${employee.name.split(' ')[0]}…`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn btn-primary" onClick={submitFeedback}>Give feedback</button>
            </div>
          )}
          <div className="feedback-list">
            {myFeedback.map((f) => (
              <div className="feedback-row" key={f.id}>
                <Avatar name={f.author} size={30} />
                <div className="fb-body">
                  <strong>{f.author}</strong>
                  <p>{f.comment}</p>
                  <span>{relativeTime(f.createdAt)}</span>
                </div>
                <span className="fb-points">+{f.points}</span>
              </div>
            ))}
            {myFeedback.length === 0 && <p className="cell-muted" style={{ fontSize: 13 }}>No feedback yet.</p>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
