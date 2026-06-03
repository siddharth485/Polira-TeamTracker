import { useState } from 'react'
import { STATUSES, STATUS_COLORS } from '../../config/workItems'
import { useStore } from '../../lib/storeContext'
import type { Status, Ticket } from '../../types'
import { TicketCard } from './TicketCard'

type Props = {
  tickets: Ticket[]
  onOpenTicket: (id: string) => void
  onAddCard: (status: Status) => void
}

export function KanbanBoard({ tickets, onOpenTicket, onAddCard }: Props) {
  const { moveTicket } = useStore()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)

  return (
    <div className="board">
      {STATUSES.map((status) => {
        const cards = tickets.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className={`kanban-column ${overCol === status ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(status)
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain')
              if (id) moveTicket(id, status)
              setOverCol(null)
              setDragId(null)
            }}
          >
            <div className="col-head">
              <span className="col-stripe" style={{ background: STATUS_COLORS[status] }} />
              <span className="col-name">{status}</span>
              <span className="col-count">{cards.length}</span>
            </div>

            <div className="col-cards">
              {cards.map((t) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  onOpen={onOpenTicket}
                  onDragStart={setDragId}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverCol(null)
                  }}
                  dragging={dragId === t.id}
                />
              ))}
              {cards.length === 0 && <div className="col-empty">Drop a ticket here</div>}
            </div>

            <button className="add-card" onClick={() => onAddCard(status)}>
              + Add card
            </button>
          </div>
        )
      })}
    </div>
  )
}
