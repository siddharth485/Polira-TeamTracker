import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { StoreContext } from './storeContext'
import type { Store } from './storeContext'
import {
  seedComments,
  seedEmployees,
  seedFeedback,
  seedProjects,
  seedRequests,
  seedTickets,
} from '../data/seed'
import type {
  AuthUser,
  Comment,
  Employee,
  Feedback,
  Project,
  Request,
  Role,
  SyncState,
  Team,
  Ticket,
} from '../types'
import { createId } from './format'
import { initials } from '../config/workItems'
import { sendNotify } from './notify'

const STORAGE_KEY = 'polira-cache-v7'
const THEME_KEY = 'polira-theme'

type CachedState = {
  projects: Project[]
  tickets: Ticket[]
  employees: Employee[]
  comments: Comment[]
  requests: Request[]
  feedback: Feedback[]
}

function loadCache(): CachedState {
  const fallback: CachedState = {
    projects: seedProjects,
    tickets: seedTickets,
    employees: seedEmployees,
    comments: seedComments,
    requests: seedRequests,
    feedback: seedFeedback,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<CachedState>
    return {
      projects: parsed.projects?.length ? parsed.projects : seedProjects,
      tickets: parsed.tickets?.length ? parsed.tickets : seedTickets,
      employees: parsed.employees?.length ? parsed.employees : seedEmployees,
      comments: parsed.comments ?? seedComments,
      requests: parsed.requests ?? seedRequests,
      feedback: parsed.feedback ?? seedFeedback,
    }
  } catch {
    return fallback
  }
}

function persistCache(state: CachedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

// Human-readable history entries for the fields changed in a ticket update.
const TRACKED: { key: keyof Ticket; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'team', label: 'Team' },
  { key: 'subTeam', label: 'Sub-team' },
  { key: 'type', label: 'Type' },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
]

function describeChanges(prev: Ticket, patch: Partial<Ticket>, by: string): import('../types').TicketEvent[] {
  const at = new Date().toISOString()
  const out: import('../types').TicketEvent[] = []
  for (const { key, label } of TRACKED) {
    if (!(key in patch)) continue
    const before = String(prev[key] ?? '')
    const after = String(patch[key as keyof typeof patch] ?? '')
    if (before === after) continue
    if (key === 'description' || key === 'title') out.push({ at, by, text: `Edited the ${label.toLowerCase()}` })
    else out.push({ at, by, text: `${label}: ${before || '—'} → ${after || '—'}` })
  }
  return out
}

function initialStatusMessage(): string {
  const params = new URLSearchParams(window.location.search)
  if (params.get('auth') === 'error') {
    return decodeURIComponent(params.get('message') || 'Google login failed')
  }
  return 'Local demo data is ready'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [auth, setAuth] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncState, setSyncState] = useState<SyncState>('local')
  const [statusMessage, setStatusMessage] = useState(initialStatusMessage)

  const [data, setData] = useState<CachedState>(loadCache)
  const { projects, requests, feedback } = data

  // Tombstoned records stay in `data` (so they persist to the Sheet and survive
  // the server merge) but must never be shown. Filter them out once here — every
  // UI consumer reads these via the store, so this is the single choke point.
  const tickets = useMemo(() => data.tickets.filter((t) => !t.deleted), [data.tickets])
  const comments = useMemo(() => data.comments.filter((c) => !c.deleted), [data.comments])
  const employees = useMemo(() => data.employees.filter((e) => !e.deleted), [data.employees])

  // Empty = act as yourself. Only an admin's explicit selection previews someone else.
  // Not persisted, so every login starts as the real signed-in person.
  const [viewAsId, setViewAsId] = useState<string>('')

  // When true, the next data-change effect skips pushing to the server (used
  // right after we hydrate FROM the server, to avoid echoing it straight back).
  const skipNextPush = useRef(false)

  // Becomes true only AFTER the first successful read from the Sheet. Until
  // then we must never push: logging in flips `auth`, which fires the push
  // effect while `data` is still the stale localStorage cache (or seed data) —
  // pushing it would clobber the Sheet (wiping other people's tickets and
  // resurrecting deleted ones) before we've even read the real data.
  const hasHydrated = useRef(false)

  // The real operator. Identity ONLY comes from a signed-in Google account —
  // no login means no access (handled by the login gate in App). A signed-in
  // @pacwinindia.com email maps to its employee record (role from there);
  // an unrecognised but valid account falls back to the role the server
  // resolved from the email, with no team placement.
  const realUser = useMemo<Employee | null>(() => {
    if (!auth) return null
    const match = employees.find((e) => !e.deleted && e.email.toLowerCase() === auth.email.toLowerCase())
    if (match) return match
    return {
      id: auth.email,
      name: auth.name || auth.email,
      code: '',
      email: auth.email,
      team: 'Management',
      role: auth.role,
      active: true,
      avatar: initials(auth.name || auth.email),
      managerId: '',
      gender: 'male',
    }
  }, [auth, employees])

  // Acting identity. Everyone defaults to THEMSELVES (the signed-in person).
  // An admin may explicitly preview another user via the view-as switcher.
  const currentUser = useMemo<Employee | null>(() => {
    if (!realUser) return null
    if (realUser.role === 'Admin' && viewAsId && viewAsId !== realUser.id) {
      return employees.find((e) => e.id === viewAsId) ?? realUser
    }
    return realUser
  }, [realUser, employees, viewAsId])

  const role: Role = currentUser?.role ?? 'Viewer'

  const setViewAs = useCallback((id: string) => {
    setViewAsId(id)
  }, [])

  // Acting user's display name, read inside action handlers (never in render).
  const authNameRef = useRef('You')
  useEffect(() => {
    authNameRef.current = currentUser?.name ?? auth?.name ?? 'You'
  }, [currentUser, auth])

  // Latest data snapshot for use inside action handlers (e.g. email lookups).
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  const emailForName = (name: string): string =>
    dataRef.current.employees.find((e) => !e.deleted && e.name === name)?.email ?? ''

  // ── Theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  // ── Clean the auth query params from the URL once on mount ─────────────────
  useEffect(() => {
    try {
      // Collapse accidental double slashes (e.g. from a trailing-slash origin):
      // passing "//" to replaceState is read as a protocol-relative URL and throws.
      const clean = window.location.pathname.replace(/\/{2,}/g, '/') || '/'
      window.history.replaceState({}, '', clean)
    } catch {
      /* never let URL cleanup crash the app */
    }
  }, [])

  // ── Session hydration ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function hydrate() {
      try {
        const res = await fetch('/api/auth/session')
        const payload = res.ok ? await res.json() : { user: null }
        if (!mounted) return

        if (!payload.user) {
          setAuth(null)
          setSyncState('local')
          setStatusMessage('Demo mode — sign in with @pacwinindia.com for live sync.')
          return
        }

        setAuth(payload.user)
        setStatusMessage(`Signed in as ${payload.user.name}`)

        const dataRes = await fetch('/api/data')
        if (dataRes.ok && mounted) {
          const fresh = await dataRes.json()
          skipNextPush.current = true
          hasHydrated.current = true
          // Once signed in, the Sheet is the ONLY source of truth. Trust it
          // verbatim for every collection — never fall back to seed/cache data,
          // or we'd resurrect deleted tickets and re-push old test rows.
          setData({
            projects: Array.isArray(fresh.projects) ? fresh.projects : [],
            tickets: Array.isArray(fresh.tickets) ? fresh.tickets : [],
            employees: Array.isArray(fresh.employees) ? fresh.employees : [],
            comments: Array.isArray(fresh.comments) ? fresh.comments : [],
            requests: Array.isArray(fresh.requests) ? fresh.requests : [],
            feedback: Array.isArray(fresh.feedback) ? fresh.feedback : [],
          })
          setSyncState('synced')
          setStatusMessage(`Synced to Google Sheets for ${payload.user.name}`)
        }
      } catch {
        if (mounted) {
          setSyncState('local')
          setStatusMessage('Sheets not configured — using local cache.')
        }
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    void hydrate()
    return () => {
      mounted = false
    }
  }, [])

  // ── Persist to localStorage + push to Sheets whenever data changes ─────────
  useEffect(() => {
    persistCache(data)
    if (!auth) return
    // Never push before we've read the Sheet — otherwise the auth change that
    // happens at login pushes our stale local cache over everyone else's data.
    if (!hasHydrated.current) return
    if (skipNextPush.current) {
      skipNextPush.current = false
      return
    }

    let cancelled = false
    setSyncState('saving')
    ;(async () => {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!cancelled) setSyncState(res.ok ? 'synced' : 'local')
      } catch {
        if (!cancelled) setSyncState('local')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [data, auth])

  // ── Actions (all functional updates → safe in sync loops) ──────────────────
  const createTicket = useCallback<Store['createTicket']>((input) => {
    const now = new Date().toISOString()
    const ticket: Ticket = {
      id: createId('TKT'),
      title: input.title,
      description: input.description ?? '',
      type: input.type,
      projectId: input.projectId ?? '',
      team: input.team,
      subTeam: input.subTeam ?? '',
      status: input.status ?? 'Backlog',
      priority: input.priority ?? 'Medium',
      dueDate: input.dueDate ?? '',
      assignee: input.assignee ?? '',
      reporter: input.reporter ?? authNameRef.current,
      source: input.source ?? 'Manual',
      tags: input.tags ?? [],
      archived: false,
      archivedBy: '',
      archivedAt: '',
      history: [{ at: now, by: input.reporter ?? authNameRef.current, text: 'Created the ticket' }],
      createdAt: now,
      updatedAt: now,
    }
    setData((prev) => ({ ...prev, tickets: [ticket, ...prev.tickets] }))
    // Notify the assignee (unless they assigned it to themselves).
    if (ticket.assignee && ticket.assignee !== authNameRef.current) {
      sendNotify({
        to: emailForName(ticket.assignee),
        kind: 'assigned',
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        actorName: authNameRef.current,
      })
    }
    return ticket
  }, [])

  const archiveTicket = useCallback<Store['archiveTicket']>((id) => {
    const now = new Date().toISOString()
    const by = authNameRef.current
    setData((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) =>
        t.id === id
          ? { ...t, archived: true, archivedBy: by, archivedAt: now, updatedAt: now, history: [...t.history, { at: now, by, text: 'Archived the ticket' }] }
          : t,
      ),
    }))
  }, [])

  const unarchiveTicket = useCallback<Store['unarchiveTicket']>((id) => {
    const now = new Date().toISOString()
    const by = authNameRef.current
    setData((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) =>
        t.id === id
          ? { ...t, archived: false, archivedBy: '', archivedAt: '', updatedAt: now, history: [...t.history, { at: now, by, text: 'Restored to the live board' }] }
          : t,
      ),
    }))
  }, [])

  const updateTicket = useCallback<Store['updateTicket']>((id, patch) => {
    const by = authNameRef.current
    const prev = dataRef.current.tickets.find((t) => t.id === id)
    setData((s) => ({
      ...s,
      tickets: s.tickets.map((t) =>
        t.id === id
          ? { ...t, ...patch, updatedAt: new Date().toISOString(), history: [...t.history, ...describeChanges(t, patch, by)] }
          : t,
      ),
    }))
    // Email the affected assignee on meaningful changes (skip self-changes).
    if (prev) {
      const title = patch.title ?? prev.title
      if (patch.assignee && patch.assignee !== prev.assignee && patch.assignee !== by) {
        sendNotify({ to: emailForName(patch.assignee), kind: 'assigned', ticketId: id, ticketTitle: title, actorName: by })
      } else {
        const statusChanged = patch.status !== undefined && patch.status !== prev.status
        const dueChanged = patch.dueDate !== undefined && patch.dueDate !== prev.dueDate
        const assignee = patch.assignee ?? prev.assignee
        if ((statusChanged || dueChanged) && assignee && assignee !== by) {
          const detail = statusChanged
            ? `Status changed to “${patch.status}”.`
            : `Due date changed to ${patch.dueDate || '—'}.`
          sendNotify({ to: emailForName(assignee), kind: 'updated', ticketId: id, ticketTitle: title, actorName: by, detail })
        }
      }
    }
  }, [])

  const moveTicket = useCallback<Store['moveTicket']>(
    (id, status) => updateTicket(id, { status }),
    [updateTicket],
  )

  const addComment = useCallback<Store['addComment']>((ticketId, text) => {
    if (!text.trim()) return
    const now = new Date().toISOString()
    const by = authNameRef.current
    const comment: Comment = { id: createId('CMT'), ticketId, author: by, text: text.trim(), createdAt: now, updatedAt: now }
    setData((prev) => ({
      ...prev,
      comments: [...prev.comments, comment],
      tickets: prev.tickets.map((t) =>
        t.id === ticketId ? { ...t, history: [...t.history, { at: now, by, text: 'Added a comment' }] } : t,
      ),
    }))
  }, [])

  const editComment = useCallback<Store['editComment']>((id, text) => {
    if (!text.trim()) return
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === id ? { ...c, text: text.trim(), updatedAt: now } : c)),
    }))
  }, [])

  const deleteComment = useCallback<Store['deleteComment']>((id) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === id ? { ...c, deleted: true, updatedAt: now } : c)),
    }))
  }, [])

  const deleteTicket = useCallback<Store['deleteTicket']>((id) => {
    const now = new Date().toISOString()
    // Soft-delete (tombstone) instead of dropping the row, so the server merge
    // keeps the deletion and a stale client can't resurrect the ticket.
    setData((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) => (t.id === id ? { ...t, deleted: true, updatedAt: now } : t)),
      comments: prev.comments.map((c) => (c.ticketId === id ? { ...c, deleted: true, updatedAt: now } : c)), // cascade
    }))
  }, [])

  const createProject = useCallback<Store['createProject']>((input) => {
    const project: Project = {
      id: createId('EPIC', 4),
      name: input.name,
      description: input.description ?? '',
      team: input.team,
      owner: input.owner ?? 'You',
      status: input.status ?? 'Active',
      color: input.color ?? '#6366f1',
      dueDate: input.dueDate ?? '',
      createdAt: new Date().toISOString(),
    }
    setData((prev) => ({ ...prev, projects: [project, ...prev.projects] }))
    return project
  }, [])

  const addEmployee = useCallback<Store['addEmployee']>((input) => {
    const employee: Employee = {
      ...input,
      id: input.id || createId('USR', 4),
      avatar: input.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      updatedAt: new Date().toISOString(),
    }
    setData((prev) => ({ ...prev, employees: [...prev.employees, employee] }))
  }, [])

  const toggleEmployeeActive = useCallback<Store['toggleEmployeeActive']>((id) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, active: !e.active, updatedAt: now } : e)),
    }))
  }, [])

  const createRequest = useCallback<Store['createRequest']>((input) => {
    const request: Request = {
      ...input,
      id: createId('REQ', 5),
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedBy: '',
      resolvedAt: '',
    }
    setData((prev) => ({ ...prev, requests: [request, ...prev.requests] }))
  }, [])

  const resolveRequest = useCallback<Store['resolveRequest']>((id, approve) => {
    const now = new Date().toISOString()
    const by = authNameRef.current
    setData((prev) => {
      const req = prev.requests.find((r) => r.id === id)
      let tickets = prev.tickets
      let employees = prev.employees
      if (req && approve) {
        if (req.type === 'unarchive' && req.ticketId) {
          tickets = tickets.map((t) =>
            t.id === req.ticketId ? { ...t, archived: false, archivedBy: '', archivedAt: '', updatedAt: now } : t,
          )
        }
        if (req.type === 'team-move' && req.employeeId) {
          employees = employees.map((e) =>
            e.id === req.employeeId
              ? { ...e, team: (req.targetTeam || e.team) as Team, managerId: req.targetManagerId || e.managerId, updatedAt: now }
              : e,
          )
        }
      }
      return {
        ...prev,
        tickets,
        employees,
        requests: prev.requests.map((r) =>
          r.id === id ? { ...r, status: approve ? 'approved' : 'rejected', resolvedBy: by, resolvedAt: now } : r,
        ),
      }
    })
  }, [])

  const addFeedback = useCallback<Store['addFeedback']>((employeeId, points, comment) => {
    const fb: Feedback = {
      id: createId('FB', 5),
      employeeId,
      author: authNameRef.current,
      points,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    }
    setData((prev) => ({ ...prev, feedback: [fb, ...prev.feedback] }))
  }, [])

  const moveEmployee = useCallback<Store['moveEmployee']>((id, team, managerId) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, team, managerId, updatedAt: now } : e)),
    }))
  }, [])

  const setEmployeeManager = useCallback<Store['setEmployeeManager']>((id, managerId) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, managerId, updatedAt: now } : e)),
    }))
  }, [])

  const removeEmployee = useCallback<Store['removeEmployee']>((id) => {
    const now = new Date().toISOString()
    setData((prev) => {
      const grandparent = prev.employees.find((m) => m.id === id)?.managerId ?? ''
      return {
        ...prev,
        // Tombstone the removed person (kept for the server merge) and re-parent
        // anyone reporting to them up one level.
        employees: prev.employees.map((e) =>
          e.id === id
            ? { ...e, deleted: true, updatedAt: now }
            : e.managerId === id
              ? { ...e, managerId: grandparent, updatedAt: now }
              : e,
        ),
      }
    })
  }, [])

  const login = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setAuth(null)
      setSyncState('local')
      setStatusMessage('Signed out — local cache still available.')
    }
  }, [])

  const value = useMemo<Store>(
    () => ({
      theme,
      toggleTheme,
      auth,
      authLoading,
      syncState,
      statusMessage,
      login,
      logout,
      realUser,
      currentUser,
      role,
      viewAsId,
      setViewAs,
      projects,
      tickets,
      employees,
      comments,
      requests,
      feedback,
      createTicket,
      updateTicket,
      moveTicket,
      addComment,
      editComment,
      deleteComment,
      archiveTicket,
      unarchiveTicket,
      deleteTicket,
      createProject,
      addEmployee,
      toggleEmployeeActive,
      createRequest,
      resolveRequest,
      addFeedback,
      moveEmployee,
      setEmployeeManager,
      removeEmployee,
    }),
    [
      theme,
      toggleTheme,
      auth,
      authLoading,
      syncState,
      statusMessage,
      login,
      logout,
      realUser,
      currentUser,
      role,
      viewAsId,
      setViewAs,
      projects,
      tickets,
      employees,
      comments,
      requests,
      feedback,
      createTicket,
      updateTicket,
      moveTicket,
      addComment,
      editComment,
      deleteComment,
      archiveTicket,
      unarchiveTicket,
      deleteTicket,
      createProject,
      addEmployee,
      toggleEmployeeActive,
      createRequest,
      resolveRequest,
      addFeedback,
      moveEmployee,
      setEmployeeManager,
      removeEmployee,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
