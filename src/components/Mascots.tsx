import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { MASCOTS } from '../config/mascots'

type Appearance = {
  key: number
  mascot: number
  quip: string
  side: 'left' | 'right'
}

const FIRST_DELAY = 6000 // ms before the first peek
const VISIBLE_MS = 8000 // how long a mascot stays
const GAP_MIN = 16000 // min idle gap between peeks
const GAP_RANGE = 22000 // + up to this much (randomised)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function Mascots() {
  const [current, setCurrent] = useState<Appearance | null>(null)
  // mascot indices the user dismissed this session (read only via the updater)
  const [, setHidden] = useState<number[]>([])
  const counter = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }

    const scheduleHide = () => {
      const t = window.setTimeout(() => {
        setCurrent(null)
        scheduleShow(GAP_MIN + Math.random() * GAP_RANGE)
      }, VISIBLE_MS)
      timers.current.push(t)
    }

    const scheduleShow = (delay: number) => {
      const t = window.setTimeout(() => {
        setHidden((h) => {
          const available = MASCOTS.map((_, i) => i).filter((i) => !h.includes(i))
          if (available.length === 0) return h
          const mascot = pick(available)
          // Only reveal a mascot once its image successfully loads — otherwise
          // skip this turn so we never show a stray text bubble with no character.
          const img = new Image()
          img.onload = () => {
            counter.current += 1
            setCurrent({
              key: counter.current,
              mascot,
              quip: pick(MASCOTS[mascot].quips),
              side: Math.random() > 0.5 ? 'right' : 'left',
            })
            scheduleHide()
          }
          img.onerror = () => {
            // image not present yet → quietly try again later, show nothing
            scheduleShow(GAP_MIN + Math.random() * GAP_RANGE)
          }
          img.src = MASCOTS[mascot].src
          return h
        })
      }, delay)
      timers.current.push(t)
    }

    scheduleShow(FIRST_DELAY)
    return clearTimers
  }, [])

  const dismiss = (mascotIndex: number) => {
    setCurrent(null)
    setHidden((h) => (h.includes(mascotIndex) ? h : [...h, mascotIndex]))
  }

  return (
    <div className="mascot-layer" aria-hidden>
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.key}
            className={`mascot mascot-${current.side}`}
            initial={{ y: 160, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 160, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="mascot-bubble">
              <span>{current.quip}</span>
              <button
                className="mascot-x"
                onClick={() => dismiss(current.mascot)}
                aria-label="Dismiss mascot"
              >
                ✕
              </button>
            </div>
            <motion.img
              src={MASCOTS[current.mascot].src}
              alt=""
              className="mascot-img"
              draggable={false}
              onError={(e) => {
                // If the image isn't there yet, just hide gracefully.
                ;(e.currentTarget.closest('.mascot') as HTMLElement | null)?.style.setProperty('display', 'none')
              }}
              whileHover={{ rotate: [0, -4, 4, 0] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
