import express from 'express'
import cookieSession from 'cookie-session'
import cors from 'cors'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { google } from 'googleapis'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const port = Number(process.env.PORT || 3001)
// Strip trailing slashes so redirects like `${origin}/?auth=success` don't
// produce a "//" path (which crashes history.replaceState in the browser).
const frontendOrigin = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '')

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
const spreadsheetId = process.env.GOOGLE_SHEET_ID || ''

// Behind Render's HTTPS proxy we must trust it so secure cookies are set.
app.set('trust proxy', 1)
app.use(cors({ origin: frontendOrigin, credentials: true }))
app.use(express.json())
// Stateless session stored in a signed, httpOnly cookie — survives restarts,
// redeploys and scaling with no server-side store (no MemoryStore, no DB).
app.use(
  cookieSession({
    name: 'polira.sid',
    keys: [process.env.SESSION_SECRET || 'polira-local-secret'],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd, // HTTPS-only in production
  })
)

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
]

const adminEmails = parseEmailList(process.env.PACWIN_ADMIN_EMAILS)
const managerEmails = parseEmailList(process.env.PACWIN_MANAGER_EMAILS)
const memberEmails = parseEmailList(process.env.PACWIN_MEMBER_EMAILS)
// Extra emails that may sign in (e.g. team members outside the @pacwinindia.com
// domain). Configurable via env, plus a built-in list for known external members.
const extraAllowedEmails = parseEmailList(process.env.EXTRA_ALLOWED_EMAILS)
// Known external (non-@pacwinindia.com) members. The Master tab also grants
// access to any email it lists, but baking the known externals in here keeps
// them working even if the Sheet read ever fails.
const builtinAllowedEmails = [
  'nikhilvns181@gmail.com',
  'gulatiaaditiya16@gmail.com',
  'imehaksoni@gmail.com',
]

function isAllowedEmail(email) {
  const e = String(email || '').toLowerCase()
  return (
    e.endsWith('@pacwinindia.com') ||
    adminEmails.includes(e) ||
    managerEmails.includes(e) ||
    memberEmails.includes(e) ||
    extraAllowedEmails.includes(e) ||
    builtinAllowedEmails.includes(e)
  )
}

// People recorded in the Sheet may sign in too — this is how external members
// (outside @pacwinindia.com) are granted access without an env change. We read
// with the server's own identity (the signing-in user isn't authorized yet)
// and cache the result briefly so the OAuth callback stays fast.
//
// We read TWO places:
//   • `Master` — a manually-maintained allowlist tab. The app NEVER overwrites
//     it (it only clears/rewrites the six known tabs), so hand-added members
//     here are permanent. Any cell that looks like an email is accepted, so the
//     column layout doesn't matter.
//   • `Employees` — the app-managed roster (col D = email, col G = active).
//     Note: rows added here BY HAND can be wiped when a client saves, because
//     the app rewrites this tab from its own state. Use `Master` for durable
//     manual entries; use the app's "add employee" for managed ones.
let sheetEmailCache = { at: 0, emails: new Set() }
const SHEET_EMAIL_TTL_MS = 60 * 1000
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

async function readEmailsFromTab(range, pick) {
  try {
    const res = await saSheets.spreadsheets.values.get({ spreadsheetId, range })
    return pick(res.data.values || [])
  } catch {
    return [] // tab may not exist (e.g. no Master yet) — ignore
  }
}

async function emailsAllowedFromSheet() {
  if (!saSheets || !spreadsheetId) return new Set()
  if (Date.now() - sheetEmailCache.at < SHEET_EMAIL_TTL_MS) return sheetEmailCache.emails
  try {
    const [masterEmails, employeeEmails] = await Promise.all([
      // Master: scan every cell, accept anything email-shaped (layout-agnostic).
      readEmailsFromTab('Master!A1:ZZ', (rows) =>
        rows.flat().map((v) => String(v || '').trim()).filter((v) => EMAIL_RE.test(v)),
      ),
      // Employees: col D = email, only if not deactivated (col G) or
      // tombstoned (col M = deleted).
      readEmailsFromTab('Employees!A1:ZZ', (rows) =>
        rows
          .slice(1)
          .filter(
            (row) =>
              row[0] &&
              String(row[6] || 'TRUE').toUpperCase() !== 'FALSE' &&
              String(row[12] || 'FALSE').toUpperCase() !== 'TRUE',
          )
          .map((row) => String(row[3] || '').trim())
          .filter(Boolean),
      ),
    ])
    const emails = new Set([...masterEmails, ...employeeEmails].map((e) => e.toLowerCase()))
    sheetEmailCache = { at: Date.now(), emails }
    return emails
  } catch {
    return sheetEmailCache.emails // fall back to last known good list
  }
}

async function isAllowedToSignIn(email) {
  if (isAllowedEmail(email)) return true
  const sheetEmails = await emailsAllowedFromSheet()
  return sheetEmails.has(String(email || '').toLowerCase())
}

// ── Service account (Sheets persistence + Gmail via domain-wide delegation) ──
const mailUser = process.env.GMAIL_USER || 'sandhya@pacwinindia.com'

function loadServiceAccount() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8')
    const sa = JSON.parse(raw)
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    return sa.client_email && sa.private_key ? sa : null
  } catch {
    return null
  }
}

const serviceAccount = loadServiceAccount()

// The server's own Google identity, used to read/write the Sheet and send mail
// so persistence/email don't depend on each user's account. Two ways to provide
// it (service-account JSON, or — when org policy blocks SA keys — a dedicated
// account's OAuth refresh token):
const svcRefreshToken = process.env.GOOGLE_REFRESH_TOKEN
const svcOAuth =
  !serviceAccount && svcRefreshToken && clientId && clientSecret
    ? (() => {
        const o = buildOAuthClient()
        o.setCredentials({ refresh_token: svcRefreshToken })
        return o
      })()
    : null

const serviceIdentity = serviceAccount ? 'service-account' : svcOAuth ? 'refresh-token' : 'none'

const saSheets = serviceAccount
  ? google.sheets({
      version: 'v4',
      auth: new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      }),
    })
  : svcOAuth
    ? google.sheets({ version: 'v4', auth: svcOAuth })
    : null

const saGmail = serviceAccount
  ? google.gmail({
      version: 'v1',
      auth: new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        subject: mailUser, // domain-wide delegation impersonation
      }),
    })
  : svcOAuth
    ? google.gmail({ version: 'v1', auth: svcOAuth }) // sends as the token's own account
    : null

// Optional fallback: nodemailer via app password (only if no server identity).
const mailPass = process.env.GMAIL_APP_PASSWORD
const smtpMailer = !saGmail && mailPass
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: mailUser, pass: mailPass } })
  : null

const emailEnabled = Boolean(saGmail || smtpMailer)

async function sendEmail({ to, subject, text, html }) {
  if (saGmail) {
    const message = [
      `From: Polira <${mailUser}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ].join('\r\n')
    const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await saGmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return
  }
  if (smtpMailer) {
    await smtpMailer.sendMail({ from: `Polira <${mailUser}>`, to, subject, text, html })
  }
}

function parseEmailList(value) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isPlaceholder(value) {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()
  return normalized.includes('your_') || normalized.includes('replace') || normalized.includes('your-google')
}

function hasRealGoogleConfig() {
  return Boolean(clientId && clientSecret && !isPlaceholder(clientId) && !isPlaceholder(clientSecret))
}

function hasRealSheetConfig() {
  return Boolean(spreadsheetId && !isPlaceholder(spreadsheetId))
}

function resolveRole(email) {
  const normalized = email.toLowerCase()

  if (adminEmails.includes(normalized) || normalized.includes('admin')) {
    return 'Admin'
  }

  if (managerEmails.includes(normalized) || normalized.includes('manager') || normalized.includes('lead') || normalized.includes('director')) {
    return 'Manager'
  }

  if (memberEmails.includes(normalized) || normalized.includes('member') || normalized.includes('consultant')) {
    return 'Member'
  }

  return 'Viewer'
}

function buildOAuthClient() {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

function getAuthorizedSheetsClient(user) {
  // Prefer the service account so persistence works for every user (incl.
  // external members whose own account can't access the Sheet).
  if (saSheets) return saSheets

  if (!user || !user.tokens) {
    throw new Error('Session is missing Google OAuth tokens')
  }

  const oauthClient = buildOAuthClient()
  oauthClient.setCredentials(user.tokens)
  return google.sheets({ version: 'v4', auth: oauthClient })
}

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}

function flattenProjects(projects) {
  return [
    ['id', 'name', 'description', 'team', 'owner', 'status', 'color', 'dueDate', 'createdAt'],
    ...projects.map((project) => [
      project.id,
      project.name,
      project.description,
      project.team,
      project.owner,
      project.status,
      project.color,
      project.dueDate || '',
      project.createdAt || '',
    ]),
  ]
}

function flattenTickets(tickets) {
  return [
    ['id', 'title', 'description', 'type', 'projectId', 'team', 'subTeam', 'status', 'priority', 'dueDate', 'assignee', 'reporter', 'source', 'tags', 'archived', 'archivedBy', 'archivedAt', 'createdAt', 'updatedAt', 'history', 'deleted'],
    ...tickets.map((ticket) => [
      ticket.id,
      ticket.title,
      ticket.description,
      ticket.type || 'ResearchReport',
      ticket.projectId || '',
      ticket.team,
      ticket.subTeam || '',
      ticket.status,
      ticket.priority,
      ticket.dueDate,
      ticket.assignee,
      ticket.reporter,
      ticket.source || 'Manual',
      Array.isArray(ticket.tags) ? ticket.tags.join(',') : (ticket.tags || ''),
      ticket.archived ? 'TRUE' : 'FALSE',
      ticket.archivedBy || '',
      ticket.archivedAt || '',
      ticket.createdAt || '',
      ticket.updatedAt || '',
      JSON.stringify(ticket.history || []),
      ticket.deleted ? 'TRUE' : 'FALSE',
    ]),
  ]
}

function flattenEmployees(employees) {
  return [
    ['id', 'name', 'code', 'email', 'team', 'role', 'active', 'avatar', 'managerId', 'gender', 'photo', 'updatedAt', 'deleted'],
    ...employees.map((employee) => [
      employee.id,
      employee.name,
      employee.code || '',
      employee.email,
      employee.team,
      employee.role,
      employee.active === false ? 'FALSE' : 'TRUE',
      employee.avatar,
      employee.managerId || '',
      employee.gender || 'male',
      employee.photo || '',
      employee.updatedAt || '',
      employee.deleted ? 'TRUE' : 'FALSE',
    ]),
  ]
}

function flattenComments(comments) {
  return [
    ['id', 'ticketId', 'author', 'text', 'createdAt', 'updatedAt', 'deleted'],
    ...comments.map((comment) => [
      comment.id,
      comment.ticketId,
      comment.author,
      comment.text,
      comment.createdAt,
      comment.updatedAt || '',
      comment.deleted ? 'TRUE' : 'FALSE',
    ]),
  ]
}

function flattenRequests(requests) {
  return [
    ['id', 'type', 'ticketId', 'employeeId', 'targetTeam', 'targetManagerId', 'requestedBy', 'status', 'note', 'createdAt', 'resolvedBy', 'resolvedAt'],
    ...requests.map((r) => [
      r.id, r.type, r.ticketId || '', r.employeeId || '', r.targetTeam || '', r.targetManagerId || '',
      r.requestedBy || '', r.status || 'pending', r.note || '', r.createdAt || '', r.resolvedBy || '', r.resolvedAt || '',
    ]),
  ]
}

function flattenFeedback(feedback) {
  return [
    ['id', 'employeeId', 'author', 'points', 'comment', 'createdAt'],
    ...feedback.map((f) => [
      f.id, f.employeeId, f.author, String(f.points ?? 0), f.comment || '', f.createdAt || '',
    ]),
  ]
}

function parseProjects(rows) {
  if (!rows || rows.length === 0) {
    return []
  }

  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    name: String(row[1] || ''),
    description: String(row[2] || ''),
    team: String(row[3] || ''),
    owner: String(row[4] || ''),
    status: String(row[5] || 'Active'),
    color: String(row[6] || '#6366f1'),
    dueDate: String(row[7] || ''),
    createdAt: String(row[8] || ''),
  }))
}

function parseTickets(rows) {
  if (!rows || rows.length === 0) {
    return []
  }

  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    title: String(row[1] || ''),
    description: String(row[2] || ''),
    type: String(row[3] || 'ResearchReport'),
    projectId: String(row[4] || ''),
    team: String(row[5] || ''),
    subTeam: String(row[6] || ''),
    status: String(row[7] || 'Backlog'),
    priority: String(row[8] || 'Medium'),
    dueDate: String(row[9] || ''),
    assignee: String(row[10] || ''),
    reporter: String(row[11] || ''),
    source: String(row[12] || 'Manual'),
    tags: String(row[13] || '').split(',').map((t) => t.trim()).filter(Boolean),
    archived: String(row[14] || 'FALSE').toUpperCase() === 'TRUE',
    archivedBy: String(row[15] || ''),
    archivedAt: String(row[16] || ''),
    createdAt: String(row[17] || ''),
    updatedAt: String(row[18] || ''),
    history: parseJsonArray(row[19]),
    deleted: String(row[20] || 'FALSE').toUpperCase() === 'TRUE',
  }))
}

function parseJsonArray(value) {
  try {
    const v = JSON.parse(String(value || '[]'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function parseEmployees(rows) {
  if (!rows || rows.length === 0) {
    return []
  }

  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    name: String(row[1] || ''),
    code: String(row[2] || ''),
    email: String(row[3] || ''),
    team: String(row[4] || ''),
    role: String(row[5] || 'Viewer'),
    active: String(row[6] || 'TRUE').toUpperCase() !== 'FALSE',
    avatar: String(row[7] || ''),
    managerId: String(row[8] || ''),
    gender: String(row[9] || 'male'),
    photo: String(row[10] || ''),
    updatedAt: String(row[11] || ''),
    deleted: String(row[12] || 'FALSE').toUpperCase() === 'TRUE',
  }))
}

function parseComments(rows) {
  if (!rows || rows.length === 0) {
    return []
  }

  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    ticketId: String(row[1] || ''),
    author: String(row[2] || ''),
    text: String(row[3] || ''),
    createdAt: String(row[4] || ''),
    updatedAt: String(row[5] || ''),
    deleted: String(row[6] || 'FALSE').toUpperCase() === 'TRUE',
  }))
}

function parseRequests(rows) {
  if (!rows || rows.length === 0) return []
  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    type: String(row[1] || 'unarchive'),
    ticketId: String(row[2] || ''),
    employeeId: String(row[3] || ''),
    targetTeam: String(row[4] || ''),
    targetManagerId: String(row[5] || ''),
    requestedBy: String(row[6] || ''),
    status: String(row[7] || 'pending'),
    note: String(row[8] || ''),
    createdAt: String(row[9] || ''),
    resolvedBy: String(row[10] || ''),
    resolvedAt: String(row[11] || ''),
  }))
}

function parseFeedback(rows) {
  if (!rows || rows.length === 0) return []
  return rows.slice(1).filter((row) => row[0]).map((row) => ({
    id: String(row[0] || ''),
    employeeId: String(row[1] || ''),
    author: String(row[2] || ''),
    points: Number(row[3] || 0),
    comment: String(row[4] || ''),
    createdAt: String(row[5] || ''),
  }))
}

async function ensureSheets(sheetsClient) {
  const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId })
  const existingSheets = new Set((spreadsheet.data.sheets || []).map((sheet) => sheet.properties?.title))
  const missing = ['Projects', 'Tickets', 'Employees', 'Comments', 'Requests', 'Feedback'].filter((sheet) => !existingSheets.has(sheet))

  if (!missing.length) {
    return
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: missing.map((title) => ({
        addSheet: {
          properties: { title },
        },
      })),
    },
  })
}

async function restoreFromSheets(req, res) {
  if (!spreadsheetId) {
    return res.status(503).json({ error: 'GOOGLE_SHEET_ID is not configured' })
  }

  try {
    const sheetsClient = getAuthorizedSheetsClient(req.session.user)
    await ensureSheets(sheetsClient)

    const [projectsResponse, ticketsResponse, employeesResponse, commentsResponse, requestsResponse, feedbackResponse] = await Promise.all([
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Projects!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Tickets!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Employees!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Comments!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Requests!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Feedback!A1:ZZ' }),
    ])

    const payload = {
      projects: parseProjects(projectsResponse.data.values || []),
      tickets: stripSeed(parseTickets(ticketsResponse.data.values || []), SEED_TICKET_IDS),
      employees: parseEmployees(employeesResponse.data.values || []),
      comments: stripSeed(parseComments(commentsResponse.data.values || []), SEED_COMMENT_IDS),
      requests: parseRequests(requestsResponse.data.values || []),
      feedback: stripSeed(parseFeedback(feedbackResponse.data.values || []), SEED_FEEDBACK_IDS),
    }

    return res.json(payload)
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to read Google Sheets data',
    })
  }
}

// ── Seed/test data purge ────────────────────────────────────────────────────
// Older buggy builds wrote the app's demo records into the real Sheet. Because
// the merge keeps every row already in the Sheet, those test rows would live
// forever. We strip them on every READ and WRITE so they can never reappear, no
// matter what a stale client pushes. IDs mirror src/data/seed.ts (tickets +
// their comments + demo feedback). Employees/projects are left alone — the seed
// roster IDs may be the team's real records.
const SEED_TICKET_IDS = new Set([
  'TKT-MPKRIVUC', 'TKT-MPKRMINA', 'TKT-MPL49J1M', 'TKT-CONTENT1', 'TKT-DATA0001', 'TKT-SURVEY01', 'TKT-REPORT01',
])
const SEED_COMMENT_IDS = new Set(['CMT-001', 'CMT-002'])
const SEED_FEEDBACK_IDS = new Set(['FB-001'])

function stripSeed(records, idSet) {
  return (records || []).filter((r) => !(r && idSet.has(r.id)))
}

// Merge an incoming collection into what's already in the Sheet, keyed by id.
// Records the caller never knew about (present in the Sheet, absent from the
// payload) are KEPT — this is what stops one client from wiping another's data.
// On conflict (same id in both) the version with the newer `updatedAt` wins; if
// neither carries a timestamp, the incoming version wins (it's the active edit).
function mergeById(existing, incoming) {
  const byId = new Map()
  for (const rec of existing) if (rec && rec.id) byId.set(rec.id, rec)
  for (const rec of incoming) {
    if (!rec || !rec.id) continue
    const prev = byId.get(rec.id)
    if (!prev) {
      byId.set(rec.id, rec)
      continue
    }
    const a = String(rec.updatedAt || '')
    const b = String(prev.updatedAt || '')
    // Newer timestamp wins; with no timestamps, the incoming edit wins.
    if (!a && !b ? true : a >= b) byId.set(rec.id, rec)
  }
  return [...byId.values()]
}

async function persistToSheets(req, res) {
  if (!spreadsheetId) {
    return res.status(503).json({ error: 'GOOGLE_SHEET_ID is not configured' })
  }

  try {
    const { projects = [], tickets = [], employees = [], comments = [], requests = [], feedback = [] } = req.body
    const sheetsClient = getAuthorizedSheetsClient(req.session.user)
    await ensureSheets(sheetsClient)

    // Read the current Sheet first and merge, so a client can only ADD or UPDATE
    // records — never silently drop ones it didn't have. Deletes still propagate
    // because they arrive as tombstones (deleted=true with a fresh updatedAt).
    const [curProjects, curTickets, curEmployees, curComments, curRequests, curFeedback] = await Promise.all([
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Projects!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Tickets!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Employees!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Comments!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Requests!A1:ZZ' }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'Feedback!A1:ZZ' }),
    ])

    const mergedProjects = mergeById(parseProjects(curProjects.data.values || []), projects)
    // Strip the demo/test rows on write too, so they're purged from the Sheet
    // the first time anyone saves and can never be resurrected by a stale client.
    const mergedTickets = stripSeed(mergeById(parseTickets(curTickets.data.values || []), tickets), SEED_TICKET_IDS)
    const mergedEmployees = mergeById(parseEmployees(curEmployees.data.values || []), employees)
    const mergedComments = stripSeed(mergeById(parseComments(curComments.data.values || []), comments), SEED_COMMENT_IDS)
    const mergedRequests = mergeById(parseRequests(curRequests.data.values || []), requests)
    const mergedFeedback = stripSeed(mergeById(parseFeedback(curFeedback.data.values || []), feedback), SEED_FEEDBACK_IDS)

    await Promise.all([
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Projects' }),
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Tickets' }),
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Employees' }),
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Comments' }),
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Requests' }),
      sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: 'Feedback' }),
    ])

    await sheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'RAW',
        data: [
          { range: 'Projects!A1', values: flattenProjects(mergedProjects) },
          { range: 'Tickets!A1', values: flattenTickets(mergedTickets) },
          { range: 'Employees!A1', values: flattenEmployees(mergedEmployees) },
          { range: 'Comments!A1', values: flattenComments(mergedComments) },
          { range: 'Requests!A1', values: flattenRequests(mergedRequests) },
          { range: 'Feedback!A1', values: flattenFeedback(mergedFeedback) },
        ],
      },
    })

    return res.json({ ok: true })
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to save Google Sheets data',
    })
  }
}

app.get('/api/config', async (_req, res) => {
  // Probe whether the service account can actually reach the Sheet — this is the
  // usual cause of "changes don't persist for everyone".
  let sheetAccess = 'untested'
  let tabs
  if (saSheets && spreadsheetId) {
    try {
      const meta = await saSheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' })
      sheetAccess = 'ok'
      tabs = (meta.data.sheets || []).map((s) => s.properties?.title)
    } catch (error) {
      sheetAccess = `denied: ${error?.message?.slice(0, 80) || 'error'}`
    }
  }

  // ?debug=1 — show what the app actually reads from the canonical tabs, so a
  // tab-name mismatch or lingering seed rows are obvious. Metadata only.
  let debug
  if (_req.query?.debug === '1' && saSheets && spreadsheetId) {
    try {
      const [t, e] = await Promise.all([
        saSheets.spreadsheets.values.get({ spreadsheetId, range: 'Tickets!A1:ZZ' }),
        saSheets.spreadsheets.values.get({ spreadsheetId, range: 'Employees!A1:ZZ' }),
      ])
      const trows = (t.data.values || []).slice(1).filter((r) => r[0])
      const erows = (e.data.values || []).slice(1).filter((r) => r[0])
      // Aggregate counts only — never expose names/emails on this public endpoint.
      debug = {
        ticketsTabRows: trows.length,
        seedTicketsStillPresent: trows.filter((r) => SEED_TICKET_IDS.has(String(r[0]))).map((r) => String(r[0])),
        employeeRows: erows.length,
        employeesTombstoned: erows.filter((r) => String(r[12] || '').toUpperCase() === 'TRUE').length,
      }
    } catch (error) {
      debug = { error: error?.message?.slice(0, 120) || 'read failed' }
    }
  }

  // ?checkEmail=foo@bar.com — does the SERVER allow this account to sign in, and
  // via which path? If allowed:true but the user still can't get in, the block
  // is Google's OAuth screen (test users / publishing), not Polira.
  let emailCheck
  const toCheck = _req.query?.checkEmail
  if (toCheck) {
    const em = String(toCheck).trim().toLowerCase()
    let masterOrEmployeesTab = false
    try {
      masterOrEmployeesTab = (await emailsAllowedFromSheet()).has(em)
    } catch {
      /* ignore */
    }
    emailCheck = {
      email: em,
      allowedToSignIn: await isAllowedToSignIn(em),
      via: {
        pacwinDomain: em.endsWith('@pacwinindia.com'),
        builtin: builtinAllowedEmails.includes(em),
        envLists: [...adminEmails, ...managerEmails, ...memberEmails, ...extraAllowedEmails].includes(em),
        masterOrEmployeesTab,
      },
    }
  }

  res.json({
    sheetConfigured: hasRealSheetConfig(),
    googleConfigured: hasRealGoogleConfig(),
    serverIdentity: serviceIdentity, // 'service-account' | 'refresh-token' | 'none'
    persistsForEveryone: Boolean(saSheets),
    email: emailEnabled,
    sheetAccess,
    tabs, // every tab title in the spreadsheet — confirms naming the app expects
    debug,
    emailCheck,
    frontendOrigin,
  })
})

app.get('/api/auth/google', (_req, res) => {
  if (!hasRealGoogleConfig()) {
    return res.redirect(
      `${frontendOrigin}/?auth=error&message=Google+OAuth+is+not+configured.+Replace+the+placeholder+GOOGLE_CLIENT_ID+and+GOOGLE_CLIENT_SECRET+values+in+.env`
    )
  }

  const oauthClient = buildOAuthClient()
  const redirectUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  return res.redirect(redirectUrl)
})

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code

  if (!code) {
    return res.redirect(`${frontendOrigin}/?auth=error&message=Missing+Google+authentication+code`)
  }

  try {
    const oauthClient = buildOAuthClient()
    const { tokens } = await oauthClient.getToken(String(code))
    oauthClient.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient })
    const userInfo = await oauth2.userinfo.get()
    const email = String(userInfo.data.email || '')

    if (!(await isAllowedToSignIn(email))) {
      return res.redirect(`${frontendOrigin}/?auth=error&message=This+Google+account+is+not+a+registered+Polira+team+member`)
    }

    // Keep only the tokens needed for Sheets API calls; drop the large id_token
    // so the whole session fits comfortably inside the cookie's ~4KB limit.
    const { access_token, refresh_token, expiry_date, token_type, scope } = tokens
    req.session.user = {
      email,
      name: String(userInfo.data.name || email.split('@')[0]),
      picture: String(userInfo.data.picture || ''),
      role: resolveRole(email),
      tokens: { access_token, refresh_token, expiry_date, token_type, scope },
    }

    return res.redirect(`${frontendOrigin}/?auth=success`)
  } catch (error) {
    return res.redirect(`${frontendOrigin}/?auth=error&message=Google+login+failed`)
  }
})

app.get('/api/auth/session', (req, res) => {
  res.json({ user: req.session.user || null })
})

app.post('/api/auth/logout', (req, res) => {
  req.session = null // cookie-session: clearing the session removes the cookie
  res.json({ ok: true })
})

app.get('/api/data', requireAuth, restoreFromSheets)
app.post('/api/data', requireAuth, persistToSheets)

// ── Ticket notifications ────────────────────────────────────────────────────
// The frontend posts a structured event; the server composes & sends the email
// (so the body can't be set by the caller). Recipients must be allowed members.
app.post('/api/notify', requireAuth, async (req, res) => {
  if (!emailEnabled) {
    return res.json({ sent: false, reason: 'email-not-configured' })
  }
  try {
    const { to, kind, ticketId, ticketTitle, actorName, detail } = req.body || {}
    if (!to || !(await isAllowedToSignIn(to))) {
      return res.status(400).json({ sent: false, reason: 'invalid-recipient' })
    }

    const title = String(ticketTitle || 'a ticket')
    const id = String(ticketId || '')
    const actor = String(actorName || 'A teammate')
    const appUrl = frontendOrigin
    const assigned = kind === 'assigned'
    const subject = assigned
      ? `[Polira] You've been assigned: ${title}${id ? ` (${id})` : ''}`
      : `[Polira] Update on ${title}${id ? ` (${id})` : ''}`
    const headline = assigned
      ? `${actor} assigned you a ticket`
      : `${actor} updated a ticket assigned to you`
    const detailLine = detail ? `<p style="margin:8px 0;color:#475569">${String(detail)}</p>` : ''

    const html = `
      <div style="font-family:Inter,Segoe UI,system-ui,sans-serif;max-width:520px">
        <p style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#ec4899;margin:0 0 6px">POLIRA · PACWIN INDIA</p>
        <h2 style="margin:0 0 4px;color:#1e2438">${headline}</h2>
        <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#1e2438">${title}</p>
        ${id ? `<p style="margin:0 0 8px;font-family:monospace;color:#94a3b8;font-size:12px">${id}</p>` : ''}
        ${detailLine}
        <a href="${appUrl}" style="display:inline-block;margin-top:12px;background:#6d5efc;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Open Polira</a>
        <p style="margin-top:18px;font-size:12px;color:#94a3b8">You're receiving this because you're assigned to or reported this ticket in Polira.</p>
      </div>`
    const text = `${headline}\n${title}${id ? ` (${id})` : ''}\n${detail || ''}\n\nOpen Polira: ${appUrl}`

    await sendEmail({ to, subject, text, html })
    return res.json({ sent: true })
  } catch (error) {
    return res.json({ sent: false, reason: 'send-failed' })
  }
})

// ── AI insight hook ─────────────────────────────────────────────────────────
// Returns a Claude-generated insight when ANTHROPIC_API_KEY is configured;
// otherwise returns { insight: null } so the client uses its rule-based text.
const anthropicKey = process.env.ANTHROPIC_API_KEY
const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

app.post('/api/insight', async (req, res) => {
  if (!anthropicKey || isPlaceholder(anthropicKey)) {
    return res.json({ insight: null })
  }
  try {
    const { employee, metrics } = req.body || {}
    const prompt =
      `You are an analytics coach for a political-consulting firm. In 3-4 sentences, give a sharp, ` +
      `specific, encouraging performance insight for this team member. Use the numbers; end with one ` +
      `concrete recommendation.\n\nEmployee: ${JSON.stringify(employee)}\nMetrics: ${JSON.stringify(metrics)}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) return res.json({ insight: null })
    const data = await response.json()
    const insight = data?.content?.[0]?.text || null
    return res.json({ insight })
  } catch {
    return res.json({ insight: null })
  }
})

// ── Serve the built frontend (single-service deploy) ────────────────────────
// In production the Vite build lives in ../dist; serve it and fall back to
// index.html for client-side routes (anything that isn't an /api/* call).
const distDir = path.resolve(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Polira server listening on port ${port}`)
})
