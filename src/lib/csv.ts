// ── CSV export ──────────────────────────────────────────────────────────────
// Builds an Excel-friendly CSV (UTF-8 BOM + CRLF) and triggers a browser
// download. No dependencies, works fully offline / in demo mode.

export type Column<T> = { key: keyof T | string; label: string; get?: (row: T) => unknown }

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = Array.isArray(value) ? value.join('; ') : String(value)
  // Quote if it contains a comma, quote, or newline; double internal quotes.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key as string]))
      .join(','),
  )
  return [header, ...body].join('\r\n')
}

export function downloadCsv<T>(filename: string, rows: T[], columns: Column<T>[]): void {
  const csv = '﻿' + toCsv(rows, columns) // BOM so Excel reads UTF-8 (emoji, ₹, accents)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
