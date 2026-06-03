import type { Ticket, WorkItemType } from '../types'
import { WORK_ITEMS } from '../config/workItems'

// ── Per-employee performance metrics, derived from ticket timestamps ─────────
// "Hours to solve" = (Done updatedAt − createdAt) in calendar hours.

const HOUR = 3_600_000

function hoursToSolve(t: Ticket): number | null {
  const start = new Date(t.createdAt).getTime()
  const end = new Date(t.updatedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return (end - start) / HOUR
}

/** ISO-ish week key: YYYY-Www based on the completion date. */
function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export type EmployeeMetrics = {
  total: number
  done: number
  inProgress: number
  backlog: number
  completionRate: number
  avgResolutionHours: number | null
  onTime: number
  late: number
  tasksOverTime: { label: string; completed: number }[]
  hoursPerWeek: { label: string; hours: number }[]
  hoursPerMonth: { label: string; hours: number }[]
  typeMix: { type: WorkItemType; label: string; value: number; color: string }[]
}

export function employeeMetrics(allTickets: Ticket[], employeeName: string): EmployeeMetrics {
  const mine = allTickets.filter((t) => t.assignee === employeeName)
  const done = mine.filter((t) => t.status === 'Done')

  const resolutions = done.map(hoursToSolve).filter((h): h is number => h !== null)
  const avgResolutionHours = resolutions.length
    ? resolutions.reduce((s, h) => s + h, 0) / resolutions.length
    : null

  // On-time vs late (completed on/before due date).
  let onTime = 0
  let late = 0
  for (const t of done) {
    if (!t.dueDate) continue
    const due = new Date(t.dueDate).getTime()
    const end = new Date(t.updatedAt).getTime()
    if (Number.isNaN(due) || Number.isNaN(end)) continue
    if (end <= due + 86_400_000) onTime += 1
    else late += 1
  }

  // Tasks completed over time (cumulative).
  const sortedDone = [...done].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  )
  let running = 0
  const tasksOverTime = sortedDone.map((t) => {
    running += 1
    return {
      label: new Date(t.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      completed: running,
    }
  })

  // Avg hours/task per week + per month.
  const bucket = (keyFn: (d: Date) => string) => {
    const map = new Map<string, number[]>()
    for (const t of done) {
      const h = hoursToSolve(t)
      if (h === null) continue
      const key = keyFn(new Date(t.updatedAt))
      const arr = map.get(key) ?? []
      arr.push(h)
      map.set(key, arr)
    }
    return Array.from(map.entries()).map(([label, hrs]) => ({
      label,
      hours: Math.round((hrs.reduce((s, h) => s + h, 0) / hrs.length) * 10) / 10,
    }))
  }

  // Work-type mix across all assigned tickets.
  const typeCounts = new Map<WorkItemType, number>()
  for (const t of mine) typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1)
  const typeMix = Array.from(typeCounts.entries()).map(([type, value]) => ({
    type,
    label: WORK_ITEMS[type].label,
    value,
    color: WORK_ITEMS[type].accent,
  }))

  return {
    total: mine.length,
    done: done.length,
    inProgress: mine.filter((t) => t.status === 'In Progress').length,
    backlog: mine.filter((t) => t.status === 'Backlog' || t.status === 'Todo').length,
    completionRate: mine.length ? Math.round((done.length / mine.length) * 100) : 0,
    avgResolutionHours,
    onTime,
    late,
    tasksOverTime,
    hoursPerWeek: bucket(weekKey),
    hoursPerMonth: bucket(monthKey),
    typeMix,
  }
}
