import { WORK_ITEMS, WORK_ITEM_TYPES } from '../config/workItems'
import type { Priority, Team, Ticket, WorkItemType } from '../types'

// ── WhatsApp message → structured ticket fields ─────────────────────────────
// Phase-1 deterministic parser. Phase 2 swaps this for an n8n + LLM pipeline
// that handles free-form messages.

const TEAM_ALIASES: Record<string, Team> = {
  creative: 'Creative',
  research: 'Research',
  data: 'Data',
  survey: 'Survey',
  management: 'Management',
}

function parseDMY(value: string): string {
  const m = value.trim().match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!m) return ''
  const [, d, mo, y] = m
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function guessType(text: string): WorkItemType {
  const t = text.toLowerCase()
  const found = WORK_ITEM_TYPES.find(
    (k) => t.includes(WORK_ITEMS[k].label.toLowerCase()) || t.includes(k.toLowerCase()),
  )
  return found ?? 'ResearchReport'
}

export type ParsedTicket = {
  title: string
  priority: Priority
  team: Team
  subTeam: Ticket['subTeam']
  type: WorkItemType
  assignee: string
  dueDate: string
  tags: string[]
}

export function parseWhatsApp(
  message: string,
  resolveAssignee: (token: string) => string,
): ParsedTicket | null {
  if (!/#ticket/i.test(message)) return null

  // Strip a leading "[date, time] Sender:" prefix, then the #ticket marker.
  let body = message.replace(/^\s*\[[^\]]*\]\s*[^:]*:\s*/, '')
  body = body.replace(/#ticket/i, '').trim()

  const parts = body.split('|').map((p) => p.trim())
  const title = parts.shift() || 'Untitled ticket'

  const fields: Record<string, string> = {}
  for (const part of parts) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    fields[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim()
  }

  const priMap: Record<string, Priority> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
  const priority = priMap[(fields.priority || '').toLowerCase()] ?? 'Medium'
  const team = TEAM_ALIASES[(fields.team || '').toLowerCase()] ?? 'Research'

  let type = guessType(`${title} ${fields.type || ''}`)
  const explicitType = WORK_ITEM_TYPES.find(
    (k) => k.toLowerCase() === (fields.type || '').toLowerCase().replace(/\s/g, ''),
  )
  if (explicitType) type = explicitType

  return {
    title,
    priority,
    team,
    subTeam: '',
    type,
    assignee: fields.assign ? resolveAssignee(fields.assign) : '',
    dueDate: fields.due ? parseDMY(fields.due) : '',
    tags: fields.tags ? fields.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
  }
}
