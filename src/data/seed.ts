import type { Comment, Employee, Feedback, Gender, Project, Request, Ticket } from '../types'
import { initials } from '../config/workItems'

// ── Pacwin India seed data ──────────────────────────────────────────────────
// Mirrors the real members + tickets shown in the reference screenshots so the
// app is fully demoable on first load without a Google login.

const emp = (
  name: string,
  code: string,
  email: string,
  team: Employee['team'],
  role: Employee['role'],
  managerId: string,
  gender: Gender,
): Employee => ({
  id: code,
  name,
  code,
  email,
  team,
  role,
  managerId,
  gender,
  active: true,
  avatar: initials(name),
  photo: `/employees/${code}.png`,
})

// Default reporting line:
//   Harsha Sharma (Management, top)
//     └ Sandhya (Management)
//         ├ Siddharth Misra      — Data lead
//         ├ Siddhansh Bakshi     — Research lead → Aditya, Nikhil
//         ├ Ranjani              — Research lead → Himanshu
//         ├ Rohit                — Research lead → Nidhi
//         └ Atul                 — Creative lead → Saikat, Naman, Harman, Nitish, Aryan
export const seedEmployees: Employee[] = [
  // Management (top)
  emp('Harsha Sharma', 'PM002', 'harsha@pacwinindia.com', 'Management', 'Admin', '', 'female'),
  emp('Sandhya', 'PM005', 'sandhya@pacwinindia.com', 'Management', 'Admin', 'PM002', 'female'),
  // Team leads → Sandhya
  emp('Siddharth Misra', 'PR002', 'siddharth@pacwinindia.com', 'Data', 'Admin', 'PM005', 'male'),
  emp('Siddhansh Bakshi', 'PR003', 'siddhansh@pacwinindia.com', 'Research', 'Manager', 'PM005', 'male'),
  emp('Ranjani', 'PR001', 'ranjani@pacwinindia.com', 'Research', 'Manager', 'PM005', 'female'),
  emp('Rohit', 'PR006', 'rohit@pacwinindia.com', 'Research', 'Manager', 'PM005', 'male'),
  emp('Atul', 'PF001', 'atul@pacwinindia.com', 'Creative', 'Manager', 'PM005', 'male'),
  // Research members → their leads
  emp('Aditya', 'PR004', 'aditya@pacwinindia.com', 'Research', 'Member', 'PR003', 'male'),
  emp('Nikhil', 'PR010', 'nikhilvns181@gmail.com', 'Research', 'Member', 'PR003', 'male'),
  emp('Himanshu', 'PR011', 'himanshu@pacwinindia.com', 'Research', 'Member', 'PR001', 'male'),
  emp('Nidhi', 'PR012', 'nidhi@pacwinindia.com', 'Research', 'Member', 'PR006', 'female'),
  // Creative members → Atul
  emp('Saikat', 'PC001', 'saikat@pacwinindia.com', 'Creative', 'Member', 'PF001', 'male'),
  emp('Naman', 'PC005', 'naman@pacwinindia.com', 'Creative', 'Member', 'PF001', 'male'),
  emp('Harman', 'PC004', 'harmanjot@pacwinindia.com', 'Creative', 'Member', 'PF001', 'male'),
  emp('Nitish', 'PC006', 'nitish@pacwinindia.com', 'Creative', 'Member', 'PF001', 'male'),
  emp('Aryan', 'PF002', 'aryan@pacwinindia.com', 'Creative', 'Member', 'PF001', 'male'),
]

export const seedProjects: Project[] = [
  {
    id: 'EPIC-001',
    name: 'Central Zone Campaign 2026',
    description: 'Flagship constituency push: messaging, ground surveys and creative rollout.',
    team: 'Management',
    owner: 'Harsha Sharma',
    status: 'Active',
    color: '#ec4899',
    dueDate: '2026-07-15',
    createdAt: '2026-05-01T09:00:00.000Z',
  },
  {
    id: 'EPIC-002',
    name: 'Voter Sentiment Intelligence',
    description: 'Continuous research reports, datasets and dashboards on shifting sentiment.',
    team: 'Research',
    owner: 'Siddharth Misra',
    status: 'Active',
    color: '#6366f1',
    dueDate: '2026-06-30',
    createdAt: '2026-05-05T09:00:00.000Z',
  },
  {
    id: 'EPIC-003',
    name: 'Ground Booth Mapping',
    description: 'Geospatial maps and booth-level datasets for field coordination.',
    team: 'Data',
    owner: 'Siddharth Misra',
    status: 'Active',
    color: '#0ea5e9',
    dueDate: '2026-06-20',
    createdAt: '2026-05-08T09:00:00.000Z',
  },
]

const t = (
  partial: Omit<Ticket, 'archived' | 'archivedBy' | 'archivedAt' | 'history'> &
    Partial<Pick<Ticket, 'archived' | 'archivedBy' | 'archivedAt' | 'history'>>,
): Ticket => ({
  archived: false,
  archivedBy: '',
  archivedAt: '',
  history: [{ at: partial.createdAt, by: partial.reporter, text: 'Created the ticket' }],
  ...partial,
})

export const seedTickets: Ticket[] = [
  t({
    id: 'TKT-MPKRIVUC',
    title: 'Map work',
    description: 'Booth-level constituency map with turnout overlays for the central zone.',
    type: 'Map',
    projectId: 'EPIC-003',
    team: 'Data',
    subTeam: '',
    status: 'Done',
    priority: 'High',
    dueDate: '2026-05-28',
    assignee: 'Siddharth Misra',
    reporter: 'Harsha Sharma',
    source: 'Manual',
    tags: ['gis', 'turnout'],
    createdAt: '2026-05-20T09:00:00.000Z',
    updatedAt: '2026-05-28T16:00:00.000Z',
  }),
  t({
    id: 'TKT-MPKRMINA',
    title: 'Video',
    description: 'Hero launch video for the Central Zone campaign — 60s cut for social.',
    type: 'Video',
    projectId: 'EPIC-001',
    team: 'Creative',
    subTeam: 'Visuals',
    status: 'Backlog',
    priority: 'High',
    dueDate: '2026-05-29',
    assignee: 'Saikat',
    reporter: 'Harsha Sharma',
    source: 'Manual',
    tags: ['launch', 'social'],
    createdAt: '2026-05-21T09:00:00.000Z',
    updatedAt: '2026-05-21T09:00:00.000Z',
  }),
  t({
    id: 'TKT-MPL49J1M',
    title: 'Voter sentiment pulse',
    description: 'Weekly sentiment dashboard refresh with new polling inputs.',
    type: 'Dashboard',
    projectId: 'EPIC-002',
    team: 'Research',
    subTeam: '',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '2026-06-04',
    assignee: 'Ranjani',
    reporter: 'Siddharth Misra',
    source: 'Manual',
    tags: ['polling'],
    createdAt: '2026-05-22T09:00:00.000Z',
    updatedAt: '2026-05-22T09:00:00.000Z',
  }),
  t({
    id: 'TKT-CONTENT1',
    title: 'Manifesto long-form copy',
    description: 'Draft the 8-point manifesto narrative for print and web.',
    type: 'Campaign',
    projectId: 'EPIC-001',
    team: 'Creative',
    subTeam: 'Content',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-06-02',
    assignee: 'Naman',
    reporter: 'Sandhya',
    source: 'Manual',
    tags: ['copy', 'manifesto'],
    createdAt: '2026-05-23T09:00:00.000Z',
    updatedAt: '2026-05-25T09:00:00.000Z',
  }),
  t({
    id: 'TKT-DATA0001',
    title: 'Booth turnout dataset',
    description: 'Clean and merge 2019 + 2024 booth turnout into a single dataset.',
    type: 'Dataset',
    projectId: 'EPIC-003',
    team: 'Data',
    subTeam: '',
    status: 'In Progress',
    priority: 'Critical',
    dueDate: '2026-06-01',
    assignee: 'Aditya',
    reporter: 'Siddharth Misra',
    source: 'Manual',
    tags: ['etl', 'turnout'],
    createdAt: '2026-05-24T09:00:00.000Z',
    updatedAt: '2026-05-26T09:00:00.000Z',
  }),
  t({
    id: 'TKT-SURVEY01',
    title: 'Field perception survey',
    description: '500-sample field survey across 4 wards on local issues.',
    type: 'Survey',
    projectId: 'EPIC-001',
    team: 'Survey',
    subTeam: '',
    status: 'Review',
    priority: 'High',
    dueDate: '2026-05-30',
    assignee: 'Ranjani',
    reporter: 'Harsha Sharma',
    source: 'Manual',
    tags: ['field', 'wards'],
    createdAt: '2026-05-19T09:00:00.000Z',
    updatedAt: '2026-05-27T09:00:00.000Z',
  }),
  t({
    id: 'TKT-REPORT01',
    title: 'Weekly intelligence report',
    description: 'Synthesise the week’s research into a leadership-ready brief.',
    type: 'ResearchReport',
    projectId: 'EPIC-002',
    team: 'Research',
    subTeam: '',
    status: 'Done',
    priority: 'Medium',
    dueDate: '2026-05-26',
    assignee: 'Aditya',
    reporter: 'Siddharth Misra',
    source: 'Manual',
    tags: ['brief'],
    createdAt: '2026-05-18T09:00:00.000Z',
    updatedAt: '2026-05-26T09:00:00.000Z',
    archived: true,
    archivedBy: 'Siddharth Misra',
    archivedAt: '2026-05-29T10:00:00.000Z',
  }),
]

export const seedComments: Comment[] = [
  {
    id: 'CMT-001',
    ticketId: 'TKT-MPKRMINA',
    author: 'Sandhya',
    text: 'Please keep the first 3 seconds punchy — that’s what we’ll boost.',
    createdAt: '2026-05-22T10:15:00.000Z',
  },
  {
    id: 'CMT-002',
    ticketId: 'TKT-SURVEY01',
    author: 'Harsha Sharma',
    text: 'Approved the questionnaire. Field team can start Monday.',
    createdAt: '2026-05-27T08:55:00.000Z',
  },
]

export const seedRequests: Request[] = []

export const seedFeedback: Feedback[] = [
  {
    id: 'FB-001',
    employeeId: 'PR001',
    author: 'Aditya',
    points: 8,
    comment: 'Sharp turnaround on the sentiment dashboard. Keep the momentum.',
    createdAt: '2026-05-28T09:00:00.000Z',
  },
]
