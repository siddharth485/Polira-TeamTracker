import { motion } from 'framer-motion'
import type { DragEvent } from 'react'
import {
  PRIORITY_META,
  TEAM_COLORS,
  WORK_ITEMS,
} from '../../config/workItems'
import { formatDate, isOverdue } from '../../lib/format'
import { ticketHeat } from '../../lib/heat'
import type { Ticket } from '../../types'
import { Avatar } from '../Avatar'

type Props = {
  ticket: Ticket
  onOpen: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  dragging: boolean
}

export function TicketCard({ ticket, onOpen, onDragStart, onDragEnd, dragging }: Props) {
  const type = WORK_ITEMS[ticket.type]
  const team = TEAM_COLORS[ticket.team] ?? 'var(--brand)'
  const prio = PRIORITY_META[ticket.priority]
  const overdue = isOverdue(ticket.dueDate, ticket.status === 'Done')
  const heat = ticketHeat(ticket)

  return (
    <motion.article
      className="ticket-card"
      draggable
      title={heat.tip}
      onClick={() => onOpen(ticket.id)}
      onDragStart={(e) => {
        const ev = e as unknown as DragEvent<HTMLElement>
        ev.dataTransfer.setData('text/plain', ticket.id)
        ev.dataTransfer.effectAllowed = 'move'
        onDragStart(ticket.id)
      }}
      onDragEnd={onDragEnd}
      whileHover={{ y: -3 }}
      animate={{ opacity: dragging ? 0.5 : 1 }}
      style={{ background: heat.bg, boxShadow: dragging ? 'var(--shadow-lg)' : undefined }}
    >
      <span className="stub" style={{ background: team }} />

      <div className="tc-top">
        <span className="tc-id">{ticket.id}</span>
        <span
          className="tc-type"
          style={{ background: `${type.accent}22`, color: type.accent }}
        >
          {type.icon} {type.label}
        </span>
      </div>

      <h4 className="tc-title">{ticket.title}</h4>
      {ticket.description && <p className="tc-desc">{ticket.description}</p>}

      <div className="tc-tags">
        <span className="badge" style={{ background: prio.bg, color: prio.color }}>
          {ticket.priority}
        </span>
        <span className="badge badge-soft">{ticket.team}{ticket.subTeam ? ` · ${ticket.subTeam}` : ''}</span>
        {ticket.source === 'WhatsApp' && <span className="badge badge-soft">✳ WhatsApp</span>}
      </div>

      <div className="tc-foot">
        <span className={`due ${overdue ? 'overdue' : ''}`}>
          {ticket.dueDate ? `Due ${formatDate(ticket.dueDate)}` : 'No due date'}
        </span>
        {ticket.assignee && (
          <span className="assignee">
            <Avatar name={ticket.assignee} size={26} />
          </span>
        )}
      </div>
    </motion.article>
  )
}
