import type { Priority, Project } from '../types'

export const PRIO_COLOR: Record<Priority, string> = {
  high: '#c9807a',
  med: '#d9c07e',
  low: 'transparent',
}

export const INBOX_ID = 'inbox'

export const INBOX_META: Project = { id: INBOX_ID, name: 'Inbox', dot: '#9b9a97', order: -1 }

export function getListMeta(listId: string, projects: Project[]): Project {
  if (listId === INBOX_ID) return INBOX_META
  return projects.find((p) => p.id === listId) ?? INBOX_META
}

export const NEW_PROJECT_DOTS = ['#c9a3c4', '#7ba7c9', '#a3c1a3', '#d4c08a', '#c9807a', '#9b9a97']

interface ListChipPalette {
  bg: string
  fg: string
  bgDark: string
  fgDark: string
}

/** Per-list tag-chip palette (light/dark), matching the source design's
 * `chip`/`chipFg`/`chipD`/`chipFgD` tokens — this is where color denotes
 * *project*, distinct from the app's monotone chrome accent. */
const LIST_CHIPS: Record<string, ListChipPalette> = {
  inbox: { bg: '#eeedeb', fg: '#5c5b58', bgDark: 'rgba(155,154,151,.2)', fgDark: '#c6c4bf' },
  product: { bg: '#d3e5ef', fg: '#31607f', bgDark: 'rgba(123,167,201,.22)', fgDark: '#a8cbe2' },
  design: { bg: '#e8deee', fg: '#6b4b78', bgDark: 'rgba(201,163,196,.22)', fgDark: '#d9bad4' },
  personal: { bg: '#dbeddb', fg: '#3f6a3f', bgDark: 'rgba(163,193,163,.22)', fgDark: '#b6d3b6' },
  someday: { bg: '#fdecc8', fg: '#7a6122', bgDark: 'rgba(212,192,138,.22)', fgDark: '#e0cd9c' },
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Chip background/foreground for a task's list — built-in lists use their
 * fixed palette; custom projects derive a translucent tint from their dot. */
export function getChipColors(listId: string, dot: string, dark: boolean): { bg: string; fg: string } {
  const known = LIST_CHIPS[listId]
  if (known) return dark ? { bg: known.bgDark, fg: known.fgDark } : { bg: known.bg, fg: known.fg }
  return { bg: hexToRgba(dot, 0.22), fg: dark ? '#d6d4cf' : '#5c5b58' }
}

export function slugifyProjectName(name: string, existingIds: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  if (!existingIds.includes(base)) return base
  let i = 1
  while (existingIds.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}
