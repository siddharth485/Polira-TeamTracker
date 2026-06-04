// One-time helper: mint a GOOGLE_REFRESH_TOKEN for the server's "bot" identity
// (used when org policy blocks service-account keys).
//
// Usage:
//   1) Add this redirect URI to your Google OAuth client's "Authorized redirect URIs":
//        http://localhost:5555/callback
//   2) Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in your .env
//   3) Run:  node scripts/get-refresh-token.js
//   4) Open the printed URL, sign in as the SENDER account (e.g. sandhya@pacwinindia.com),
//      approve Sheets + Gmail. The terminal prints GOOGLE_REFRESH_TOKEN=...
//   5) Paste that into Render env vars. (You can remove the localhost redirect afterwards.)

import http from 'node:http'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const redirect = process.env.OAUTH_LOCAL_REDIRECT || 'http://localhost:5555/callback'

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (put them in .env).')
  process.exit(1)
}

const url = new URL(redirect)
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirect)
const scopes = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
]
const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes })

console.log('\n── Polira refresh-token setup ──────────────────────────────')
console.log('Redirect URI (must be registered on your OAuth client):\n  ' + redirect)
console.log('\nOpen this URL, sign in as the SENDER account (e.g. sandhya@pacwinindia.com), approve:\n\n' + authUrl + '\n')

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith(url.pathname)) {
    res.writeHead(404)
    res.end()
    return
  }
  const code = new URL(req.url, redirect).searchParams.get('code')
  if (!code) {
    res.writeHead(400)
    res.end('Missing ?code')
    return
  }
  try {
    const { tokens } = await oauth2.getToken(code)
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<h2>Done. Your refresh token is printed in the terminal — you can close this tab.</h2>')
    if (tokens.refresh_token) {
      console.log('\n✅ Copy this into Render (Environment):\n')
      console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n')
    } else {
      console.log('\n⚠ No refresh_token returned. Remove the app at https://myaccount.google.com/permissions and run again (prompt=consent forces it).\n')
    }
    setTimeout(() => process.exit(0), 400)
  } catch (e) {
    res.writeHead(500)
    res.end('Error: ' + e.message)
    console.error(e)
    process.exit(1)
  }
})

server.listen(Number(url.port) || 80, () => {
  console.log('Waiting for Google to redirect back to ' + redirect + ' …  (Ctrl+C to cancel)')
})
