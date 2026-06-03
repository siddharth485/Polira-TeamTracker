import { createContext, useContext } from 'react'
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

export type Store = {
  theme: 'light' | 'dark'
  toggleTheme: () => void

  auth: AuthUser | null
  authLoading: boolean
  syncState: SyncState
  statusMessage: string
  login: () => void
  logout: () => Promise<void>

  // Acting identity (View-as in demo, real signed-in person when logged in).
  currentUser: Employee | null
  role: Role
  viewAsId: string
  setViewAs: (id: string) => void

  projects: Project[]
  tickets: Ticket[]
  employees: Employee[]
  comments: Comment[]
  requests: Request[]
  feedback: Feedback[]

  createTicket: (input: Partial<Ticket> & Pick<Ticket, 'title' | 'type' | 'team'>) => Ticket
  updateTicket: (id: string, patch: Partial<Ticket>) => void
  moveTicket: (id: string, status: Ticket['status']) => void
  addComment: (ticketId: string, text: string) => void
  editComment: (id: string, text: string) => void
  deleteComment: (id: string) => void
  archiveTicket: (id: string) => void
  unarchiveTicket: (id: string) => void
  createProject: (input: Partial<Project> & Pick<Project, 'name' | 'team'>) => Project
  addEmployee: (input: Omit<Employee, 'id' | 'avatar'> & { id?: string }) => void
  toggleEmployeeActive: (id: string) => void

  createRequest: (input: Omit<Request, 'id' | 'status' | 'createdAt' | 'resolvedBy' | 'resolvedAt'>) => void
  resolveRequest: (id: string, approve: boolean) => void
  addFeedback: (employeeId: string, points: number, comment: string) => void
  moveEmployee: (id: string, team: Team, managerId: string) => void
  setEmployeeManager: (id: string, managerId: string) => void
  removeEmployee: (id: string) => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
