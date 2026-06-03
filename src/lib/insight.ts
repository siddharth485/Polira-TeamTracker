import type { Employee } from '../types'
import type { EmployeeMetrics } from './metrics'

// ── Rule-based performance insight (LLM-ready) ──────────────────────────────
// `localInsight` produces a sharp, data-driven paragraph with zero cost.
// `fetchInsight` calls the server hook (POST /api/insight) which returns Claude
// output if an API key is configured, otherwise the same local text — so we can
// upgrade to a real LLM later with a single backend change.

export function localInsight(emp: Employee, m: EmployeeMetrics): string {
  if (m.total === 0) {
    return `${emp.name} has no assigned work items yet. Once tickets are assigned, this space will surface completion velocity, resolution times, and where ${emp.name} is spending effort.`
  }

  const parts: string[] = []
  const firstName = emp.name.split(' ')[0]

  parts.push(
    `${firstName} is carrying ${m.total} work item${m.total === 1 ? '' : 's'} with a ${m.completionRate}% completion rate (${m.done} done, ${m.inProgress} in progress).`,
  )

  if (m.avgResolutionHours !== null) {
    const days = m.avgResolutionHours / 24
    const speed = m.avgResolutionHours <= 48 ? 'fast' : m.avgResolutionHours <= 120 ? 'steady' : 'on the slower side'
    parts.push(
      `Average turnaround is ${days < 1.5 ? `${Math.round(m.avgResolutionHours)} hours` : `${days.toFixed(1)} days`} per task — ${speed} for this kind of work.`,
    )
  }

  const totalDated = m.onTime + m.late
  if (totalDated > 0) {
    const pct = Math.round((m.onTime / totalDated) * 100)
    parts.push(
      pct >= 80
        ? `Deadline reliability is strong at ${pct}% on-time.`
        : pct >= 50
          ? `Deadline reliability is mixed at ${pct}% on-time — a few slipped past due.`
          : `Deadline reliability needs attention: only ${pct}% landed on time.`,
    )
  }

  const topType = [...m.typeMix].sort((a, b) => b.value - a.value)[0]
  if (topType) {
    parts.push(`Most effort is going into ${topType.label.toLowerCase()}s (${topType.value} of ${m.total}).`)
  }

  // A forward-looking nudge.
  if (m.completionRate >= 80) {
    parts.push(`Recommendation: ${firstName} is delivering well — a good candidate for higher-stakes or cross-team work.`)
  } else if (m.inProgress > m.done) {
    parts.push(`Recommendation: work-in-progress is piling up — consider focusing on closing items before taking on new ones.`)
  } else {
    parts.push(`Recommendation: keep the cadence steady and watch the items nearing their due dates.`)
  }

  return parts.join(' ')
}

export async function fetchInsight(emp: Employee, m: EmployeeMetrics): Promise<string> {
  try {
    const res = await fetch('/api/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee: emp, metrics: m }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.insight) return data.insight as string
    }
  } catch {
    /* fall through to local */
  }
  return localInsight(emp, m)
}
