import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../../lib/storeContext'
import { can, canRequestMove, canRestructure } from '../../lib/permissions'
import { TEAM_COLORS } from '../../config/workItems'
import type { Employee } from '../../types'
import { Avatar } from '../Avatar'

type TreeNode = { emp: Employee; children: TreeNode[] }

type Props = {
  onOpenProfile: (id: string) => void
}

export function TeamsScreen({ onOpenProfile }: Props) {
  const { employees, tickets, currentUser, moveEmployee, removeEmployee, createRequest } = useStore()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Centre the (often wider-than-viewport) tree in view on load.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [])

  // Build a forest that ALWAYS includes every employee exactly once, even if the
  // data has a cycle or an orphan (manager pointing at a missing/looping id).
  const forest = useMemo<TreeNode[]>(() => {
    const byId = new Map(employees.map((e) => [e.id, e]))
    const kids = new Map<string, Employee[]>()
    for (const e of employees) {
      const valid = e.managerId && e.managerId !== e.id && byId.has(e.managerId)
      const key = valid ? e.managerId : ''
      const arr = kids.get(key) ?? []
      arr.push(e)
      kids.set(key, arr)
    }
    const seen = new Set<string>()
    const build = (e: Employee): TreeNode => {
      seen.add(e.id)
      const children = (kids.get(e.id) ?? []).filter((c) => !seen.has(c.id)).map(build)
      return { emp: e, children }
    }
    const roots = (kids.get('') ?? []).filter((e) => !seen.has(e.id)).map(build)
    // Any employee never reached (part of a cycle) becomes its own root so it still shows.
    for (const e of employees) if (!seen.has(e.id)) roots.push(build(e))
    return roots
  }, [employees])

  const isAdmin = currentUser?.role === 'Admin'
  const isManager = currentUser?.role === 'Manager'

  // Is `maybeDescendantId` somewhere below `ancestorId`? (prevents cycles)
  const isDescendant = (ancestorId: string, maybeDescendantId: string): boolean => {
    let cursor = employees.find((e) => e.id === maybeDescendantId)
    const guard = new Set<string>()
    while (cursor && cursor.managerId && !guard.has(cursor.id)) {
      if (cursor.managerId === ancestorId) return true
      guard.add(cursor.id)
      cursor = employees.find((e) => e.id === cursor!.managerId)
    }
    return false
  }

  const dropAllowed = (targetId: string): boolean => {
    if (!dragId || dragId === targetId) return false
    if (isDescendant(dragId, targetId)) return false // can't move under your own report
    if (isAdmin) return true
    // Managers shuffle members only, and a member must land under a manager/admin —
    // dropping one under another member would create new hierarchy (admin-only).
    const target = employees.find((e) => e.id === targetId)
    return !!target && (target.role === 'Manager' || target.role === 'Admin')
  }

  const handleDrop = (target: Employee) => {
    if (!dragId || !dropAllowed(target.id)) return
    moveEmployee(dragId, target.team, target.id)
    setDragId(null)
    setOverId(null)
  }

  const renderNode = (node: TreeNode): React.ReactNode => {
    const emp = node.emp
    const kids = node.children
    const teamColor = TEAM_COLORS[emp.team] ?? '#6d5efc'
    const isSelf = currentUser?.id === emp.id
    const draggable = canRestructure(currentUser, emp)
    const viewable = can(currentUser, 'profile.view', { target: emp, employees })
    const canSelfRequest = isSelf && currentUser?.role === 'Member'
    const showMenuBtn = (isAdmin && !isSelf) || canSelfRequest
    const isOver = overId === emp.id && dropAllowed(emp.id)

    return (
      <li key={emp.id}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`org-node ${dragId === emp.id ? 'dragging' : ''} ${isOver ? 'drop-target' : ''}`}
          style={{ ['--team' as string]: teamColor }}
        >
          <div
            className={`org-card ${draggable ? 'grabbable' : ''} ${viewable ? '' : 'locked'}`}
            draggable={draggable}
            onDragStart={() => setDragId(emp.id)}
            onDragEnd={() => { setDragId(null); setOverId(null) }}
            onDragOver={(e) => { if (dropAllowed(emp.id)) { e.preventDefault(); setOverId(emp.id) } }}
            onDragLeave={() => setOverId((o) => (o === emp.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); handleDrop(emp) }}
            onClick={() => viewable && onOpenProfile(emp.id)}
            title={viewable ? 'View profile' : 'You can only view your own and your team’s profiles'}
            role="button"
          >
            {draggable && <span className="org-grip">⠿</span>}
            <Avatar name={emp.name} size={40} />
            <div className="org-meta">
              <strong>{emp.name}</strong>
              <span>{emp.role} · {emp.team}</span>
            </div>
            {kids.length > 0 && <span className="org-reports">{kids.length} report{kids.length > 1 ? 's' : ''}</span>}
            {!viewable && <span className="org-lock">🔒</span>}
          </div>

          {showMenuBtn && (
            <button className="org-menu-btn" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === emp.id ? null : emp.id) }}>⋯</button>
          )}

          <AnimatePresence>
            {menuFor === emp.id && (
              <motion.div className="org-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                {isAdmin && (
                  <button className="org-menu-item danger" onClick={() => { removeEmployee(emp.id); setMenuFor(null) }}>
                    Remove from org
                  </button>
                )}
                {canSelfRequest && currentUser && (
                  <SelfMoveMenu
                    employees={employees}
                    disabled={!canRequestMove(currentUser, tickets)}
                    onRequest={(managerId, team) => {
                      createRequest({
                        type: 'team-move', ticketId: '', employeeId: currentUser.id,
                        targetTeam: team, targetManagerId: managerId, requestedBy: currentUser.name,
                        note: `${currentUser.name} requests to move to ${team}.`,
                      })
                      setMenuFor(null)
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {kids.length > 0 && <ul>{kids.map((k) => renderNode(k))}</ul>}
      </li>
    )
  }

  const helpText = isAdmin
    ? 'Drag anyone (⠿) onto another person to re-assign them — shuffle resources across teams and projects. Use ⋯ to remove someone.'
    : isManager
      ? 'Drag a member (⠿) onto a manager to move them across teams. Only an admin can restructure the management hierarchy.'
      : 'This is the organisation hierarchy (view only). Use ⋯ on your own card to request a move once your tasks are done.'

  return (
    <>
      <div className="teams-help">
        <span className="teams-help-icon">🌳</span>
        <div>
          <strong>Organisation hierarchy</strong>
          <p>{helpText}</p>
        </div>
      </div>
      <div className="orgtree-wrap" ref={wrapRef}>
        <div className="orgtree">
          <ul>{forest.map((r) => renderNode(r))}</ul>
        </div>
      </div>
    </>
  )
}

function SelfMoveMenu({
  employees, disabled, onRequest,
}: {
  employees: Employee[]
  disabled: boolean
  onRequest: (managerId: string, team: Employee['team']) => void
}) {
  const managers = employees.filter((e) => e.role === 'Manager' || e.role === 'Admin')
  const [managerId, setManagerId] = useState(managers[0]?.id ?? '')
  const target = employees.find((e) => e.id === managerId)
  return (
    <div className="admin-menu">
      {disabled ? (
        <p className="cell-muted" style={{ fontSize: 12 }}>You can request a move only when all your tasks are Done.</p>
      ) : (
        <>
          <label className="field">Move under</label>
          <select className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.team}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }}
            onClick={() => target && onRequest(target.id, target.team)}>
            Request move
          </button>
        </>
      )}
    </div>
  )
}
