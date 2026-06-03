import { motion } from 'framer-motion'
import { useStore } from '../lib/storeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore()
  const dark = theme === 'dark'
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    >
      <motion.span
        className="knob"
        animate={{ left: dark ? 30 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      >
        {dark ? '🌙' : '☀️'}
      </motion.span>
    </button>
  )
}
