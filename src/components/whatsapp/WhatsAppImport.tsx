import { useState } from 'react'
import { WORK_ITEM_TYPES } from '../../config/workItems'
import { useStore } from '../../lib/storeContext'
import { parseWhatsApp } from '../../lib/whatsapp'
import type { ParsedTicket } from '../../lib/whatsapp'

const SAMPLE =
  '[12/05/2025, 10:30] Rahul: #ticket Booth turnout map for Ward 4 | priority: High | assign: PR002 | team: Data | type: Map | due: 20/05/2025 | tags: gis,field'

export function WhatsAppImport() {
  const { employees, createTicket } = useStore()
  const [message, setMessage] = useState('')
  const [bulk, setBulk] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const resolveAssignee = (token: string): string => {
    const t = token.trim().toLowerCase()
    const match = employees.find(
      (e) => e.code.toLowerCase() === t || e.name.toLowerCase() === t || e.email.toLowerCase() === t,
    )
    return match?.name ?? token.trim()
  }

  const createFromParsed = (p: ParsedTicket | null): boolean => {
    if (!p) return false
    createTicket({ ...p, source: 'WhatsApp' })
    return true
  }

  const handleSingle = () => {
    const parsed = parseWhatsApp(message, resolveAssignee)
    if (!parsed) {
      setResult({ ok: false, text: 'No #ticket found in the message. Make sure it contains #ticket.' })
      return
    }
    createFromParsed(parsed)
    setResult({ ok: true, text: `Created "${parsed.title}" → ${parsed.team}, ${parsed.priority} priority.` })
    setMessage('')
  }

  const handleBulk = () => {
    const lines = bulk.split('\n').filter((l) => /#ticket/i.test(l))
    let created = 0
    for (const line of lines) {
      if (createFromParsed(parseWhatsApp(line, resolveAssignee))) created += 1
    }
    setResult(
      created
        ? { ok: true, text: `Parsed ${lines.length} message(s) and created ${created} ticket(s).` }
        : { ok: false, text: 'No messages containing #ticket were found.' },
    )
    if (created) setBulk('')
  }

  return (
    <>
      <div className="wa-card">
        <h3>📑 Bulk import — chat export</h3>
        <p className="hint">
          Paste a WhatsApp conversation below. Any message containing <strong>#ticket</strong> becomes
          a ticket automatically. (Phase 2 will run this through an n8n + LLM pipeline for free-form messages.)
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 140 }}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder="Paste exported chat here…"
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleBulk}>⚡ Parse WhatsApp inbox</button>
        </div>
      </div>

      <div className="wa-card">
        <h3>✉ Single message import</h3>
        <p className="hint">Paste one WhatsApp message containing <strong>#ticket</strong> here.</p>
        <label className="field">WhatsApp message</label>
        <textarea
          className="textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={SAMPLE}
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSingle}>Create ticket</button>
        </div>

        {result && <div className={`wa-result ${result.ok ? 'ok' : 'err'}`}>{result.text}</div>}

        <div className="code-hint">
{`Supported format:
[DD/MM/YYYY, HH:MM] Sender: #ticket <Title> | priority: High | assign: PR002
   | team: Data | type: Map | due: 30/05/2025 | tags: gis,field

Fields after | are optional. Priority: Low / Medium / High / Critical.
Type: ${WORK_ITEM_TYPES.join(' / ')}`}
        </div>
      </div>
    </>
  )
}
