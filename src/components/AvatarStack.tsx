import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { TEAMS, TEAM_COLORS } from '../config/workItems'
import { useStore } from '../lib/storeContext'
import type { Team } from '../types'
import { Avatar } from './Avatar'

export function AvatarStack() {
  const { employees } = useStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const active = employees.filter((e) => e.active)
  const shown = active.slice(0, 5)
  const extra = active.length - shown.length

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const byTeam = TEAMS.map((team) => ({
    team,
    members: employees.filter((e) => e.team === team),
  })).filter((g) => g.members.length > 0)

  return (
    <div className="popover-wrap" ref={wrapRef}>
      <button className="avatar-stack" onClick={() => setOpen((o) => !o)} aria-label="View team members">
        {shown.map((e) => (
          <Avatar key={e.id} name={e.name} size={32} />
        ))}
        {extra > 0 && <span className="avatar more" style={{ width: 32, height: 32 }}>+{extra}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="popover"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <h4>Team members</h4>
            <p className="sub">{employees.length} people across {byTeam.length} teams</p>
            {byTeam.map((group) => (
              <div className="team-group" key={group.team}>
                <div className="team-group-head">
                  <span className="team-dot" style={{ background: TEAM_COLORS[group.team as Team] }} />
                  {group.team} · {group.members.length}
                </div>
                {group.members.map((m) => (
                  <div className="member-row" key={m.id}>
                    <Avatar name={m.name} size={30} />
                    <div>
                      <div className="name">{m.name}</div>
                      <div className="meta">{m.code} · {m.email}</div>
                    </div>
                    <span className="role-tag">{m.role}</span>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
