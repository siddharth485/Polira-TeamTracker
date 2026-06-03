import type { Action, Comment, Employee, Ticket } from '../types'

// ── Single source of truth for role-based access ────────────────────────────
// `can(user, action, ctx)` is a pure function used by every gated control.

type Ctx = {
  ticket?: Ticket
  comment?: Comment
  target?: Employee // the employee being acted upon / viewed
  employees?: Employee[]
}

/** True if `manager` sits above `employeeId` anywhere in the reporting chain. */
export function managesEmployee(
  manager: Employee,
  employeeId: string,
  employees: Employee[],
): boolean {
  let cursor = employees.find((e) => e.id === employeeId)
  const guard = new Set<string>()
  while (cursor && cursor.managerId && !guard.has(cursor.id)) {
    if (cursor.managerId === manager.id) return true
    guard.add(cursor.id)
    cursor = employees.find((e) => e.id === cursor!.managerId)
  }
  return false
}

/** Does this ticket belong to the user (assignee or reporter)? Names are the key. */
export function ownsTicket(user: Employee, ticket: Ticket): boolean {
  return ticket.assignee === user.name || ticket.reporter === user.name
}

export function can(user: Employee | null, action: Action, ctx: Ctx = {}): boolean {
  if (!user) return false
  const isAdmin = user.role === 'Admin'
  const isManager = user.role === 'Manager'
  const isMember = user.role === 'Member'

  switch (action) {
    // ── Tickets ──────────────────────────────────────────────────────────
    case 'ticket.create.self':
      return isAdmin || isManager || isMember
    case 'ticket.create.others':
      return isAdmin || isManager

    // Editing ticket fields / status / dates: admin anywhere; manager only for
    // tickets owned by themselves or someone in their reporting line.
    case 'ticket.edit':
    case 'ticket.editDates': {
      if (isAdmin) return true
      if (!isManager) return false
      if (!ctx.ticket) return true // generic capability check (no specific ticket)
      const emps = ctx.employees ?? []
      if (ctx.ticket.assignee === user.name || ctx.ticket.reporter === user.name) return true
      const assignee = emps.find((e) => e.name === ctx.ticket!.assignee)
      const reporter = emps.find((e) => e.name === ctx.ticket!.reporter)
      return (
        (!!assignee && managesEmployee(user, assignee.id, emps)) ||
        (!!reporter && managesEmployee(user, reporter.id, emps))
      )
    }

    case 'ticket.archive':
    case 'ticket.delete':
      return isAdmin
    case 'ticket.unarchive':
    case 'request.approve':
      return isAdmin || isManager

    // ── Comments ─────────────────────────────────────────────────────────
    case 'comment.add':
      if (isAdmin || isManager) return true
      // Members may comment only on their own tickets.
      return isMember && !!ctx.ticket && ownsTicket(user, ctx.ticket)
    case 'comment.edit':
      if (isAdmin || isManager) return true
      // Members may edit only their own comments.
      return !!ctx.comment && ctx.comment.author === user.name
    case 'comment.delete':
      // Only managers and admins can delete comments.
      return isAdmin || isManager

    // ── Profiles ─────────────────────────────────────────────────────────
    // Everyone may VIEW profiles / the Teams + Performance tabs (read-only).
    // Editing powers (feedback, restructure, ticket edits) stay role-scoped.
    case 'profile.view':
      return true

    // ── Feedback ─────────────────────────────────────────────────────────
    case 'feedback.give':
      if (isAdmin) return true
      if (isManager && ctx.target && ctx.employees) {
        return managesEmployee(user, ctx.target.id, ctx.employees)
      }
      return false

    // ── Hierarchy / org ──────────────────────────────────────────────────
    case 'team.moveAnyone':
    case 'manager.nest':
    case 'user.remove':
      return isAdmin
    case 'team.pullToOwn':
      return isManager && !!ctx.target && ctx.target.id !== user.id
    case 'team.requestMove':
      return isMember

    default:
      return false
  }
}

/**
 * Can `user` restructure (drag/reassign) `target` in the org tree?
 * Only admins may edit the organisation hierarchy.
 */
export function canRestructure(user: Employee | null, target: Employee): boolean {
  if (!user || target.id === user.id) return false
  return user.role === 'Admin'
}

/** A member may only request a team move once all their assigned tickets are Done. */
export function canRequestMove(user: Employee, tickets: Ticket[]): boolean {
  const mine = tickets.filter((t) => t.assignee === user.name && !t.archived)
  return mine.length > 0 && mine.every((t) => t.status === 'Done')
}
