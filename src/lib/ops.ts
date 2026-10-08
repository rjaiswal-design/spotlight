import type { ChatMsg, Deck, Library, Project } from './deck.ts'

/**
 * Every change to a deck is one of these. The client applies it straight away
 * and sends it; the server applies the same op to its copy and relays it, so
 * edits to different fields never overwrite each other (last write wins per field).
 */
export type Op =
  | { t: 'deck'; patch: Partial<Omit<Deck, 'projects' | 'id'>> }
  | { t: 'project'; id: string; patch: Partial<Project> }
  | { t: 'add'; project: Project; index: number }
  | { t: 'remove'; id: string }
  | { t: 'move'; id: string; to: number }
  | { t: 'replace'; deck: Deck }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'react'; slide: string; emoji: string; from: string }

/** Changes to the set of decks. */
export type LibOp = { t: 'create'; deck: Deck } | { t: 'delete'; id: string } | { t: 'seed'; library: Library }

const CHAT_MAX = 400

export function apply(deck: Deck, op: Op): Deck {
  switch (op.t) {
    case 'deck':
      return { ...deck, ...op.patch, id: deck.id, projects: deck.projects }
    case 'project':
      return { ...deck, projects: deck.projects.map((p) => (p.id === op.id ? { ...p, ...op.patch } : p)) }
    case 'add': {
      if (deck.projects.some((p) => p.id === op.project.id)) return deck
      const projects = [...deck.projects]
      projects.splice(Math.max(0, Math.min(op.index, projects.length)), 0, op.project)
      return { ...deck, projects }
    }
    case 'remove':
      return { ...deck, projects: deck.projects.filter((p) => p.id !== op.id) }
    case 'move': {
      const from = deck.projects.findIndex((p) => p.id === op.id)
      if (from < 0) return deck
      const projects = [...deck.projects]
      const [x] = projects.splice(from, 1)
      projects.splice(Math.max(0, Math.min(op.to, projects.length)), 0, x)
      return { ...deck, projects }
    }
    case 'replace':
      return { ...op.deck, id: deck.id }
    case 'chat': {
      const chat = deck.chat ?? []
      if (chat.some((m) => m.id === op.msg.id)) return deck
      return { ...deck, chat: [...chat, op.msg].slice(-CHAT_MAX) }
    }
    case 'react': {
      const all = deck.reactions ?? {}
      const here = all[op.slide] ?? {}
      const by = deck.reactedBy ?? {}
      const bySlide = by[op.slide] ?? {}
      const byEmoji = bySlide[op.emoji] ?? {}
      return {
        ...deck,
        reactions: { ...all, [op.slide]: { ...here, [op.emoji]: (here[op.emoji] ?? 0) + 1 } },
        reactedBy: { ...by, [op.slide]: { ...bySlide, [op.emoji]: { ...byEmoji, [op.from]: (byEmoji[op.from] ?? 0) + 1 } } },
      }
    }
  }
}

export function applyLib(lib: Library, op: LibOp): Library {
  switch (op.t) {
    case 'create':
      return lib.decks.some((d) => d.id === op.deck.id) ? lib : { decks: [...lib.decks, op.deck] }
    case 'delete':
      return { decks: lib.decks.filter((d) => d.id !== op.id) }
    case 'seed':
      return op.library
  }
}

export const applyToDeck = (lib: Library, id: string, op: Op): Library => ({
  decks: lib.decks.map((d) => (d.id === id ? apply(d, op) : d)),
})

/** Where someone is and what they're doing, sent many times a second. */
export interface Presence {
  /** the deck they have open, null on the home page */
  deck: string | null
  /** slideKey of the slide they have open */
  slide: string
  /** pointer in slide coordinates (1280×720), null when off the slide */
  cursor: { x: number; y: number } | null
  /** `${slideKey}:${field}` of the text they're typing in */
  editing: string | null
  presenting: boolean
}

export interface Peer {
  id: string
  name: string
  presence: Presence
}

export type ClientMsg =
  | { k: 'hello'; id: string; name: string }
  | { k: 'op'; deck: string; op: Op }
  | { k: 'lib'; op: LibOp }
  | { k: 'presence'; presence: Presence }

export type ServerMsg =
  | { k: 'init'; library: Library | null; peers: Peer[]; invite: string | null }
  | { k: 'op'; deck: string; op: Op; from: string }
  | { k: 'lib'; op: LibOp; from: string }
  | { k: 'peer'; peer: Peer }
  | { k: 'leave'; id: string }
