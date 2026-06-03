import type {
  Priority,
  Status,
  Team,
  TeamFilter,
  WorkItemType,
} from '../types'

// ── Work-item type catalog ──────────────────────────────────────────────────
// Each typed work-item (the thing a ticket *is*) carries an icon, a label and
// an accent colour. Centralised so cards, tables and the new-ticket modal stay
// consistent.

export type WorkItemMeta = {
  label: string
  icon: string
  accent: string
  defaultTeam: Team
}

export const WORK_ITEMS: Record<WorkItemType, WorkItemMeta> = {
  ResearchReport: { label: 'Research Report', icon: '📄', accent: '#6366f1', defaultTeam: 'Research' },
  Dataset: { label: 'Dataset', icon: '🗃️', accent: '#0ea5e9', defaultTeam: 'Data' },
  Dashboard: { label: 'Dashboard', icon: '📊', accent: '#14b8a6', defaultTeam: 'Data' },
  Script: { label: 'Script', icon: '📜', accent: '#a855f7', defaultTeam: 'Creative' },
  Map: { label: 'Map', icon: '🗺️', accent: '#22c55e', defaultTeam: 'Data' },
  Video: { label: 'Video', icon: '🎬', accent: '#f43f5e', defaultTeam: 'Creative' },
  Survey: { label: 'Survey', icon: '📋', accent: '#f59e0b', defaultTeam: 'Survey' },
  Campaign: { label: 'Campaign', icon: '📣', accent: '#ec4899', defaultTeam: 'Creative' },
}

export const WORK_ITEM_TYPES = Object.keys(WORK_ITEMS) as WorkItemType[]

// ── Teams ─────────────────────────────────────────────────────────────────
export const TEAMS: Team[] = ['Creative', 'Research', 'Data', 'Survey', 'Management']

export const TEAM_COLORS: Record<Team, string> = {
  Creative: '#ec4899',
  Research: '#6366f1',
  Data: '#0ea5e9',
  Survey: '#f59e0b',
  Management: '#14b8a6',
}

// Primary 3-part switch. Creative reveals Content / Visuals sub-team chips.
export const TEAM_FILTERS: TeamFilter[] = ['Creative', 'Research', 'All']
export const CREATIVE_SUBTEAMS = ['All', 'Content', 'Visuals'] as const

// ── Statuses (kanban columns, left→right) ───────────────────────────────────
export const STATUSES: Status[] = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done']

export const STATUS_COLORS: Record<Status, string> = {
  Backlog: '#8b5cf6',
  Todo: '#3b82f6',
  'In Progress': '#f59e0b',
  Review: '#ec4899',
  Done: '#22c55e',
}

// ── Priorities ──────────────────────────────────────────────────────────────
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical']

export const PRIORITY_META: Record<Priority, { color: string; bg: string }> = {
  Low: { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.14)' },
  Medium: { color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  High: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.16)' },
  Critical: { color: '#e11d48', bg: 'rgba(225, 29, 72, 0.16)' },
}

// Stable avatar gradient from a name/string.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #0ea5e9, #14b8a6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #22c55e, #0d9488)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #14b8a6, #0ea5e9)',
  'linear-gradient(135deg, #f43f5e, #ec4899)',
]

export function avatarGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
