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
  const { syncState, auth } = useStore()
  // Signed in but failing to sync = changes aren't reaching the shared Sheet.
  const notSynced = Boolean(auth) && syncState === 'local'
  const syncLabel = notSynced
    ? 'Not saved'
    : syncState === 'synced' ? 'Live' : syncState === 'saving' ? 'Syncing…' : 'Local'

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

      <div className={`live-pill ${notSynced ? 'not-synced' : ''}`} title={notSynced ? 'Your changes are NOT saving to the shared sheet — only on this device.' : ''}>
        <span className={`live-dot ${notSynced ? 'error' : syncState === 'saving' ? 'saving' : syncState === 'synced' ? '' : 'local'}`} />
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
