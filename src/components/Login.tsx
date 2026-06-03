import { motion } from 'framer-motion'
import { useStore } from '../lib/storeContext'
import { Logo } from './Logo'

export function Login() {
  const { login, statusMessage } = useStore()
  return (
    <div className="auth-shell">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="boot-logo" style={{ margin: '0 auto 18px', width: 64 }}>
          <Logo size={64} />
        </div>
        <p className="eyebrow">PACWIN INDIA</p>
        <h1>Sign in to Polira</h1>
        <p>
          Polira is restricted to the Pacwin India team. Sign in with your{' '}
          <strong>@pacwinindia.com</strong> Google account — your access is set by your role
          (Admin, Manager or Member).
        </p>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={login}>
          Continue with Google
        </button>
        <p className="note">{statusMessage}</p>
      </motion.div>
    </div>
  )
}
