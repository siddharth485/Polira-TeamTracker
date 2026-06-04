// ── Core domain types for Polira ───────────────────────────────────────────
// Projects act as Epics. Every ticket is a typed work-item that belongs to a
// project and a team (optionally a Creative sub-team).

export type Role = 'Admin' | 'Manager' | 'Member' | 'Viewer'

export type Team = 'Creative' | 'Research' | 'Data' | 'Survey' | 'Management'

export type SubTeam = 'Content' | 'Visuals'

export type Status = 'Backlog' | 'Todo' | 'In Progress' | 'Review' | 'Done'

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

export type WorkItemType =
  | 'ResearchReport'
  | 'Dataset'
  | 'Dashboard'
  | 'Script'
  | 'Map'
  | 'Video'
  | 'Survey'
  | 'Campaign'

export type TicketSource = 'Manual' | 'WhatsApp'

export type ProjectStatus = 'Active' | 'Paused' | 'Done'

export type TicketEvent = {
  at: string
  by: string
  text: string
}

export type Project = {
  id: string
  name: string
  description: string
  team: Team
  owner: string
  status: ProjectStatus
  color: string
  dueDate: string
  createdAt: string
}

export type Ticket = {
  id: string
  title: string
  description: string
  type: WorkItemType
  projectId: string
  team: Team
  subTeam: SubTeam | ''
  status: Status
  priority: Priority
  dueDate: string
  assignee: string
  reporter: string
  source: TicketSource
  tags: string[]
  archived: boolean
  archivedBy: string
  archivedAt: string
  history: TicketEvent[]
  createdAt: string
  updatedAt: string
  // Soft-delete tombstone: kept in the Sheet (hidden in the UI) so a delete
  // survives the server-side merge and can't be resurrected by a stale client.
  deleted?: boolean
}

export type Gender = 'male' | 'female'

export type Employee = {
  id: string
  name: string
  code: string
  email: string
  team: Team
  role: Role
  active: boolean
  avatar: string
  managerId: string
  gender: Gender
  photo?: string
  // Stamped on every mutation so the server merge can pick the newest version.
  updatedAt?: string
  // Soft-delete tombstone (see Ticket.deleted).
  deleted?: boolean
}

export type RequestType = 'unarchive' | 'team-move'

export type RequestStatus = 'pending' | 'approved' | 'rejected'

export type Request = {
  id: string
  type: RequestType
  ticketId: string
  employeeId: string
  targetTeam: Team | ''
  targetManagerId: string
  requestedBy: string
  status: RequestStatus
  note: string
  createdAt: string
  resolvedBy: string
  resolvedAt: string
}

export type Feedback = {
  id: string
  employeeId: string
  author: string
  points: number
  comment: string
  createdAt: string
}

export type Comment = {
  id: string
  ticketId: string
  author: string
  text: string
  createdAt: string
  // Stamped on every mutation so the server merge can pick the newest version.
  updatedAt?: string
  // Soft-delete tombstone (see Ticket.deleted).
  deleted?: boolean
}

export type AuthUser = {
  email: string
  name: string
  picture: string
  role: Role
}

export type SyncState = 'idle' | 'saving' | 'synced' | 'local'

export type Screen = 'Board' | 'Tickets' | 'Teams' | 'Performance' | 'Users' | 'WhatsApp'

// Actions gated by the permission system (see lib/permissions.ts).
export type Action =
  | 'ticket.create.self'
  | 'ticket.create.others'
  | 'ticket.edit'
  | 'ticket.editDates'
  | 'ticket.archive'
  | 'ticket.unarchive'
  | 'ticket.delete'
  | 'request.approve'
  | 'comment.add'
  | 'comment.edit'
  | 'comment.delete'
  | 'profile.view'
  | 'feedback.give'
  | 'team.moveAnyone'
  | 'team.pullToOwn'
  | 'team.requestMove'
  | 'manager.nest'
  | 'user.remove'

// Primary 3-part team switch. 'All' is the catch-all (incl. Data + Survey).
export type TeamFilter = 'Creative' | 'Research' | 'All'
