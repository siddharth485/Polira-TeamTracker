import type { Ticket } from '../types'

// ── Timeliness heatmap ──────────────────────────────────────────────────────
// Colours a ticket by how it's tracking against its due date:
//   green  → completed (on/ahead of time)
//   white  → on time, plenty of runway
//   →red   → ramps up as the due date approaches
//   red    → overdue / due work
// Tints are mixed into the card surface so they adapt to light & dark themes.

const DAY = 86_400_000
const RAMP_DAYS = 7 // how many days out the red starts ramping in

const GREEN = '#22c55e'
const RED = '#ef4444'

export type Heat = { bg: string; dot: string; tip: string }

export function ticketHeat(t: Ticket): Heat {
  if (t.status === 'Done') {
    return { bg: `color-mix(in srgb, ${GREEN} 16%, var(--surface-2))`, dot: GREEN, tip: 'Completed / on time' }
  }

  const due = t.dueDate ? new Date(t.dueDate).getTime() : NaN
  if (Number.isNaN(due)) {
    return { bg: 'var(--surface-2)', dot: 'var(--text-3)', tip: 'No due date' }
  }

  const daysLeft = (due - Date.now()) / DAY
  if (daysLeft < 0) {
    return {
      bg: `color-mix(in srgb, ${RED} 22%, var(--surface-2))`,
      dot: RED,
      tip: `Overdue by ${Math.ceil(-daysLeft)} day${Math.ceil(-daysLeft) === 1 ? '' : 's'}`,
    }
  }

  // 0 when far away → 1 as the due date approaches.
  const intensity = Math.max(0, Math.min(1, (RAMP_DAYS - daysLeft) / RAMP_DAYS))
  const pct = Math.round(intensity * 18)
  return {
    bg: pct <= 1 ? 'var(--surface-2)' : `color-mix(in srgb, ${RED} ${pct}%, var(--surface-2))`,
    dot: pct <= 1 ? 'var(--text-3)' : RED,
    tip: `Due in ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) === 1 ? '' : 's'}`,
  }
}
