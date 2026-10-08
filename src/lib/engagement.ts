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
