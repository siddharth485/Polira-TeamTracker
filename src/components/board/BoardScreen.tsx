import { useMemo, useState } from 'react'
import { PRIORITIES } from '../../config/workItems'
import { useStore } from '../../lib/storeContext'
import type { Priority, Status, TeamFilter } from '../../types'
import { TeamSwitch } from '../TeamSwitch'
import { KanbanBoard } from './KanbanBoard'

type SubTeamFilter = 'All' | 'Content' | 'Visuals'

type Props = {
  query: string
  onOpenTicket: (id: string) => void
  onAddCard: (status: Status) => void
}

export function BoardScreen({ query, onOpenTicket, onAddCard }: Props) {
  const { tickets } = useStore()
  const [team, setTeam] = useState<TeamFilter>('All')
  const [subTeam, setSubTeam] = useState<SubTeamFilter>('All')
  const [priority, setPriority] = useState<Priority | 'All'>('All')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((t) => {
      if (t.archived) return false
      if (team === 'Creative' && t.team !== 'Creative') return false
      if (team === 'Research' && t.team !== 'Research') return false
      if (team === 'Creative' && subTeam !== 'All' && t.subTeam !== subTeam) return false
      if (priority !== 'All' && t.priority !== priority) return false
      if (q && !`${t.title} ${t.description} ${t.id} ${t.assignee}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [tickets, team, subTeam, priority, query])

  return (
    <>
      <div className="filters">
        <TeamSwitch value={team} onChange={setTeam} subTeam={subTeam} onSubTeamChange={setSubTeam} />
        <span style={{ flex: 1 }} />
        <select
          className="select-pill"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | 'All')}
        >
          <option value="All">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <KanbanBoard tickets={filtered} onOpenTicket={onOpenTicket} onAddCard={onAddCard} />
    </>
  )
}
