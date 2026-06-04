import { google } from 'googleapis'
import dotenv from 'dotenv'
dotenv.config()

const clientId = process.env.GOOGLE_CLIENT_ID
const o = new google.auth.OAuth2(clientId, process.env.GOOGLE_CLIENT_SECRET)
o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

console.log('local client_id:', clientId)
try {
  const sheets = google.sheets({ version: 'v4', auth: o })
  const r = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'spreadsheetId,properties.title',
  })
  console.log('SHEET OK:', r.data.properties?.title, '|', r.data.spreadsheetId)
} catch (e) {
  console.log('SHEET FAIL:', e.message)
}
