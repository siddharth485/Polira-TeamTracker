import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CREATIVE_SUBTEAMS, TEAM_FILTERS } from '../config/workItems'
import type { TeamFilter } from '../types'

type SubTeamFilter = (typeof CREATIVE_SUBTEAMS)[number]

type Props = {
  value: TeamFilter
  onChange: (v: TeamFilter) => void
  subTeam: SubTeamFilter
  onSubTeamChange: (v: SubTeamFilter) => void
}

export function TeamSwitch({ value, onChange, subTeam, onSubTeamChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [glider, setGlider] = useState({ left: 4, width: 0 })

  useEffect(() => {
    const btn = btnRefs.current[value]
    const container = containerRef.current
    if (btn && container) {
      const cRect = container.getBoundingClientRect()
      const bRect = btn.getBoundingClientRect()
      setGlider({ left: bRect.left - cRect.left, width: bRect.width })
    }
  }, [value])

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      <div className="team-switch" ref={containerRef}>
        <motion.span
          className="glider"
          animate={{ left: glider.left, width: glider.width }}
          transition={{ type: 'spring', stiffness: 480, damping: 38 }}
        />
        {TEAM_FILTERS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              btnRefs.current[t] = el
            }}
            className={value === t ? 'active' : ''}
            onClick={() => onChange(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {value === 'Creative' && (
          <motion.div
            className="subteam-chips"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
          >
            {CREATIVE_SUBTEAMS.map((s) => (
              <button
                key={s}
                className={`chip ${subTeam === s ? 'active' : ''}`}
                onClick={() => onSubTeamChange(s)}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
