import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StoreProvider } from './lib/store'
import { useStore } from './lib/storeContext'
import type { Screen, Status } from './types'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { BoardScreen } from './components/board/BoardScreen'
import { TicketsTable } from './components/tickets/TicketsTable'
import { Performance } from './components/performance/Performance'
import { Users } from './components/users/Users'
import { WhatsAppImport } from './components/whatsapp/WhatsAppImport'
import { NewTicketModal } from './components/NewTicketModal'
import { TicketDetail } from './components/TicketDetail'
import { ProfileView } from './components/profile/ProfileView'
import { Mascots } from './components/Mascots'
import { ToastProvider } from './components/Toast'
import { Logo } from './components/Logo'
import { Login } from './components/Login'

function Workspace() {
  const { authLoading, auth } = useStore()
  const [screen, setScreen] = useState<Screen>('Board')
  const [query, setQuery] = useState('')
  const [openTicket, setOpenTicket] = useState<string | null>(null)
  const [openProfile, setOpenProfile] = useState<string | null>(null)
  const [newTicket, setNewTicket] = useState<{ open: boolean; status: Status }>({ open: false, status: 'Backlog' })

  if (authLoading) {
    return (
      <div className="boot-shell">
        <motion.div
          className="boot-logo"
          animate={{ scale: [1, 1.14, 1, 1.09, 1] }}
          transition={{ duration: 1.4, times: [0, 0.15, 0.3, 0.45, 0.7], repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size={96} />
        </motion.div>
        <motion.div
          className="boot-word"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Polira
        </motion.div>
      </div>
    )
  }

  // Identity comes only from a signed-in account — no session, no access.
  if (!auth) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onNavigate={setScreen} onOpenProfile={setOpenProfile} />

      <div className="content">
        <Topbar
          screen={screen}
          query={query}
          onQuery={setQuery}
          onNewTicket={() => setNewTicket({ open: true, status: 'Backlog' })}
        />

        <main className="screen">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {screen === 'Board' && (
                <BoardScreen
                  query={query}
                  onOpenTicket={setOpenTicket}
                  onAddCard={(status) => setNewTicket({ open: true, status })}
                />
              )}
              {screen === 'Tickets' && <TicketsTable query={query} onOpenTicket={setOpenTicket} />}
              {screen === 'Performance' && <Performance onOpenProfile={setOpenProfile} />}
              {screen === 'Users' && <Users query={query} />}
              {screen === 'WhatsApp' && <WhatsAppImport />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {newTicket.open && (
          <NewTicketModal
            initialStatus={newTicket.status}
            onClose={() => setNewTicket((s) => ({ ...s, open: false }))}
            onCreated={(id) => {
              setNewTicket((s) => ({ ...s, open: false }))
              setOpenTicket(id)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openTicket && <TicketDetail ticketId={openTicket} onClose={() => setOpenTicket(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {openProfile && <ProfileView employeeId={openProfile} onClose={() => setOpenProfile(null)} />}
      </AnimatePresence>

      <Mascots />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Workspace />
      </ToastProvider>
    </StoreProvider>
  )
}
