import type { ChatMsg, Deck } from './deck'
import { REACTIONS } from './stickers'

/**
 * How a session landed, counted one way everywhere: emoji reactions (per slide),
 * appreciation (a kudos to a project's author) and comments (chat lines).
 */
export interface Engagement {
  reactions: Record<string, number>
  reactionTotal: number
  kudos: ChatMsg[]
  comments: ChatMsg[]
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

export function slideEngagement(deck: Deck, key: string): Engagement {
  const reactions = deck.reactions?.[key] ?? {}
  const chat = (deck.chat ?? []).filter((m) => m.slide === key)
  return { reactions, reactionTotal: sum(reactions), kudos: chat.filter((m) => m.kudos), comments: chat.filter((m) => !m.kudos) }
}

export function deckEngagement(deck: Deck): Engagement {
  const reactions: Record<string, number> = {}
  for (const r of Object.values(deck.reactions ?? {})) for (const [e, n] of Object.entries(r)) reactions[e] = (reactions[e] ?? 0) + n
  const chat = deck.chat ?? []
  return { reactions, reactionTotal: sum(reactions), kudos: chat.filter((m) => m.kudos), comments: chat.filter((m) => !m.kudos) }
}

/** Appreciation for one project, wherever in the deck it was sent. */
export const projectKudos = (deck: Deck, id: string) => (deck.chat ?? []).filter((m) => m.kudos?.project === id).length

/** The fixed reaction set first, then anything else that was sent, so cells never reorder. */
export const reactionOrder = (r: Record<string, number>) => [...REACTIONS, ...Object.keys(r).filter((e) => !(REACTIONS as readonly string[]).includes(e))]

export interface Reactors {
  /** people, most reactions first */
  people: { name: string; n: number }[]
  /** reactions from before names were saved */
  earlier: number
  total: number
}

/** Who sent `emoji`, on one slide or (with `slide` null) across the whole deck. */
export function reactors(deck: Deck, slide: string | null, emoji: string): Reactors {
  const keys = slide ? [slide] : Object.keys(deck.reactions ?? {})
  const names: Record<string, number> = {}
  let total = 0
  for (const k of keys) {
    total += deck.reactions?.[k]?.[emoji] ?? 0
    for (const [name, n] of Object.entries(deck.reactedBy?.[k]?.[emoji] ?? {})) names[name] = (names[name] ?? 0) + n
  }
  const people = Object.entries(names)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  return { people, earlier: Math.max(0, total - people.reduce((a, p) => a + p.n, 0)), total }
}
