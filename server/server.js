import express from 'express'
import session from 'express-session'
import cors from 'cors'
import dotenv from 'dotenv'
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
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'polira-local-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // HTTPS-only cookies in production
    },
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
    ['id', 'title', 'description', 'type', 'projectId', 'team', 'subTeam', 'status', 'priority', 'dueDate', 'assignee', 'reporter', 'source', 'tags', 'archived', 'archivedBy', 'archivedAt', 'createdAt', 'updatedAt', 'history'],
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
    ]),
  ]
}

function flattenEmployees(employees) {
  return [
    ['id', 'name', 'code', 'email', 'team', 'role', 'active', 'avatar', 'managerId', 'gender', 'photo'],
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
    ]),
  ]
}

function flattenComments(comments) {
  return [
    ['id', 'ticketId', 'author', 'text', 'createdAt'],
    ...comments.map((comment) => [
      comment.id,
      comment.ticketId,
      comment.author,
      comment.text,
      comment.createdAt,
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
      tickets: parseTickets(ticketsResponse.data.values || []),
      employees: parseEmployees(employeesResponse.data.values || []),
      comments: parseComments(commentsResponse.data.values || []),
      requests: parseRequests(requestsResponse.data.values || []),
      feedback: parseFeedback(feedbackResponse.data.values || []),
    }

    return res.json(payload)
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to read Google Sheets data',
    })
  }
}

async function persistToSheets(req, res) {
  if (!spreadsheetId) {
    return res.status(503).json({ error: 'GOOGLE_SHEET_ID is not configured' })
  }

  try {
    const { projects = [], tickets = [], employees = [], comments = [], requests = [], feedback = [] } = req.body
    const sheetsClient = getAuthorizedSheetsClient(req.session.user)
    await ensureSheets(sheetsClient)

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
          { range: 'Projects!A1', values: flattenProjects(projects) },
          { range: 'Tickets!A1', values: flattenTickets(tickets) },
          { range: 'Employees!A1', values: flattenEmployees(employees) },
          { range: 'Comments!A1', values: flattenComments(comments) },
          { range: 'Requests!A1', values: flattenRequests(requests) },
          { range: 'Feedback!A1', values: flattenFeedback(feedback) },
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

app.get('/api/config', (_req, res) => {
  res.json({
    sheetConfigured: hasRealSheetConfig(),
    googleConfigured: hasRealGoogleConfig(),
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

    if (!email.endsWith('@pacwinindia.com')) {
      return res.redirect(`${frontendOrigin}/?auth=error&message=Only+@pacwinindia.com+accounts+can+sign+in`)
    }

    req.session.user = {
      email,
      name: String(userInfo.data.name || email.split('@')[0]),
      picture: String(userInfo.data.picture || ''),
      role: resolveRole(email),
      tokens,
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
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

app.get('/api/data', requireAuth, restoreFromSheets)
app.post('/api/data', requireAuth, persistToSheets)

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
