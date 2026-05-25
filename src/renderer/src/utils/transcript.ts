import { Cue } from '../types'

function toSeconds(ts: string): number {
  const normalized = ts.trim().replace(',', '.')
  const parts = normalized.split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
}

function parseBracket(lines: string[]): Cue[] {
  const regex = /^\[(\d{2}:\d{2}:\d{2}[\.,]\d+)\]\s*(?:([^:]+):)?\s*(.+)$/
  const raw: Array<{ start: number; speaker: string | null; text: string }> = []

  for (const line of lines) {
    const m = regex.exec(line.trim())
    if (!m) continue
    raw.push({
      start: toSeconds(m[1]),
      speaker: m[2]?.trim() ?? null,
      text: m[3].trim()
    })
  }

  return raw.map((r, i) => ({
    ...r,
    end: raw[i + 1]?.start ?? r.start + 4
  }))
}

function parseSRT(text: string): Cue[] {
  const blocks = text.trim().split(/\n\s*\n/)
  const raw: Array<{ start: number; end: number; text: string }> = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    const textLines = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()))
    if (!textLines.length) continue
    raw.push({
      start: toSeconds(startStr),
      end: toSeconds(endStr),
      text: textLines.join(' ').trim()
    })
  }

  return raw.map((r) => ({ ...r, speaker: null }))
}

export function parseTranscript(raw: string): Cue[] {
  if (!raw.trim()) return []
  const lines = raw.trim().split('\n')
  const isBracket = lines.some((l) => /^\[\d{2}:\d{2}:\d{2}/.test(l.trim()))
  return isBracket ? parseBracket(lines) : parseSRT(raw)
}
