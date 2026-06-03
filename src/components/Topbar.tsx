import type { Screen } from '../types'
import { useStore } from '../lib/storeContext'
import { AvatarStack } from './AvatarStack'
import { ThemeToggle } from './ThemeToggle'
import { RequestsInbox } from './RequestsInbox'

const TITLES: Record<Screen, string> = {
  Board: 'Board',
  Tickets: 'Tickets',
  Teams: 'Teams',
  Performance: 'Performance',
  Users: 'Users',
  WhatsApp: 'WhatsApp Import',
}

type Props = {
  screen: Screen
  query: string
  onQuery: (q: string) => void
  onNewTicket: () => void
}

export function Topbar({ screen, query, onQuery, onNewTicket }: Props) {
  const { syncState } = useStore()
  const syncLabel =
    syncState === 'synced' ? 'Live' : syncState === 'saving' ? 'Syncing…' : 'Local'

  return (
    <header className="topbar">
      <div className="title">{TITLES[screen]}</div>
      <div className="spacer" />

      <div className="search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search…"
        />
      </div>

      <div className="live-pill">
        <span className={`live-dot ${syncState === 'saving' ? 'saving' : syncState === 'synced' ? '' : 'local'}`} />
        {syncLabel}
      </div>

      <RequestsInbox />
      <AvatarStack />
      <ThemeToggle />

      <button className="btn btn-primary" onClick={onNewTicket}>
        + New ticket
      </button>
    </header>
  )
}
