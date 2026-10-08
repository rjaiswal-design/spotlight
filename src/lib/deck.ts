export type Status = 'shipped' | 'live' | 'experiment' | 'in-progress'

export interface Metric {
  id: string
  value: string
  label: string
}

/** One tile on a showcase slide: a live prototype, or a project card. */
export interface ShowItem {
  id: string
  type: 'prototype' | 'project'
  title: string
  /** prototype: the page to embed. project: where the card links to */
  url: string
  author: string
  /** project cards only, downscaled data URL */
  image?: string
  /** prototypes only: the viewport it was designed for */
  frame: 'phone' | 'browser'
  bg: string
}

export interface Project {
  id: string
  /**
   * 'board' is a showcase slide: no project name, just a grid of prototypes and projects.
   * 'step' is one step of a masterclass: an instruction, a prompt to copy, a tip and a demo.
   */
  kind?: 'board' | 'step'
  items?: ShowItem[]
  /** the story behind a project; any of these adds a "Behind the project" slide */
  process?: string
  outcome?: string
  challenges?: string
  personal?: string
  /** steps: the prompt or command to copy */
  snippet?: string
  /** steps: a tip under the instruction */
  tip?: string
  /** steps: how the demo in `link` is framed */
  frame?: 'phone' | 'browser'
  title: string
  tagline: string
  summary: string
  author: string
  role: string
  team: string
  /** comma separated in the editor, stored as names */
  contributors: string[]
  status: Status
  impact: string
  metrics: Metric[]
  /** a Lightweight UI backdrop preset ('g-violet', 's-ink'…) or a hex */
  bg: string
  /** downscaled data URL */
  image?: string
  link?: string
}

export type DeckType = 'spotlight' | 'masterclass'

/** A chat line in present mode: text, a sticker, an image, or appreciation for a project's author. */
export interface ChatMsg {
  id: string
  from: string
  at: number
  /** slideKey it was sent on */
  slide: string
  text?: string
  sticker?: string
  image?: string
  kudos?: { project: string; author: string }
}

export interface Deck {
  id: string
  type: DeckType
  /** spotlight: Monday of the week it covers, YYYY-MM-DD */
  week?: string
  /** masterclass: how long it runs, e.g. "30 min" */
  duration?: string
  title: string
  subtitle: string
  /** the label on the cover: "Week 41", "Live · Oct 15" */
  date: string
  /** spotlight: who hosts. masterclass: who narrates */
  host: string
  projects: Project[]
  chat?: ChatMsg[]
  /** reaction counts, by slideKey then emoji */
  reactions?: Record<string, Record<string, number>>
  /** who reacted: slideKey, then emoji, then name, then how many times */
  reactedBy?: Record<string, Record<string, Record<string, number>>>
}

export interface Library {
  decks: Deck[]
}

export const STATUS_LABEL: Record<Status, string> = {
  shipped: 'Shipped',
  live: 'Live',
  experiment: 'Pilot',
  'in-progress': 'Building',
}

export const STATUS_TONE = {
  shipped: 'open',
  live: 'open',
  experiment: 'draft',
  'in-progress': 'neutral',
} as const

export const uid = () => Math.random().toString(36).slice(2, 10)

export function blankProject(n: number): Project {
  const bgs = ['g-violet', 'g-ocean', 'g-mint', 'g-sunset', 'g-lagoon', 'g-berry', 'm-aurora', 'g-citrus']
  return {
    id: uid(),
    title: 'Untitled project',
    tagline: '',
    summary: '',
    author: '',
    role: '',
    team: '',
    contributors: [],
    status: 'shipped',
    impact: '',
    metrics: [
      { id: uid(), value: '', label: '' },
      { id: uid(), value: '', label: '' },
    ],
    bg: bgs[n % bgs.length],
  }
}

export const isBoard = (p: Project) => p.kind === 'board'
export const isStep = (p: Project) => p.kind === 'step'
export const realProjects = (d: Deck) => d.projects.filter((p) => !p.kind)
export const steps = (d: Deck) => d.projects.filter(isStep)
export const hasStory = (p: Project) => !p.kind && !!(p.process || p.outcome || p.challenges || p.personal)

export function blankStep(): Project {
  return { ...blankProject(Math.floor(Math.random() * 8)), kind: 'step', title: 'New step', snippet: '', tip: '', frame: 'browser', metrics: [] }
}

export function blankBoard(): Project {
  return { ...blankProject(0), kind: 'board', title: '', items: [blankItem('prototype', 0), blankItem('project', 1)] }
}

export function blankItem(type: ShowItem['type'], n: number): ShowItem {
  const bgs = ['g-ocean', 'g-violet', 'g-mint', 'g-sunset', 'm-aurora', 'g-lagoon']
  return { id: uid(), type, title: '', url: '', author: '', frame: 'phone', bg: bgs[n % bgs.length] }
}

/* ------------------------------------------------------------------ weeks */

/** Monday of the week `d` falls in, as YYYY-MM-DD (local time). */
export function mondayOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s: string, n: number) => {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return mondayOf(d)
}
/** ISO week number. */
export function weekNumber(s: string): number {
  const d = parseDay(s)
  d.setDate(d.getDate() + 3) // Thursday decides the year
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export function weekRange(s: string): string {
  const a = parseDay(s)
  const b = parseDay(s)
  b.setDate(b.getDate() + 4)
  return `${fmt(a)} to ${fmt(b)}`
}
export const weekLabel = (s: string) => `Week ${weekNumber(s)}`

export function blankDeck(type: DeckType, week?: string): Deck {
  if (type === 'masterclass')
    return { id: uid(), type, title: 'Untitled masterclass', subtitle: '', date: 'Live', host: '', duration: '30 min', projects: [blankStep()] }
  const w = week ?? mondayOf()
  return { id: uid(), type, week: w, title: 'Design Spotlight', subtitle: '', date: weekLabel(w), host: '', projects: [] }
}

export const SEED: Deck = {
  id: 'w-seed',
  type: 'spotlight',
  week: mondayOf(),
  title: 'Design Spotlight',
  subtitle: 'What we shipped this week, and what it moved.',
  date: weekLabel(mondayOf()),
  host: 'Rahul Jaiswal',
  projects: [
    {
      id: uid(),
      title: 'Priority',
      tagline: 'One ranked list for every team request.',
      summary:
        'Requests used to arrive through DMs, sheets and stand-ups. Priority puts them in a single ranked queue with live presence, so leads triage in one place and everyone can see where their ask sits.',
      author: 'Rahul Jaiswal',
      role: 'Product Designer',
      team: 'Design Systems',
      contributors: ['Mina Farouk', 'Alex Rivera'],
      status: 'live',
      impact: 'Triage moved from a weekly meeting to a 10 minute async pass.',
      metrics: [
        { id: uid(), value: '-62%', label: 'Time to triage' },
        { id: uid(), value: '14', label: 'Teams onboarded' },
        { id: uid(), value: '1.2k', label: 'Requests ranked' },
      ],
      bg: 'g-violet',
    },
    {
      id: uid(),
      title: 'RnR 2.0',
      tagline: 'Ratings and reviews that people actually finish.',
      summary:
        'We tested pills against checkboxes for review tags with a live A/B poll, then rebuilt the flow around the winner. Fewer steps, clearer prompts, photo upload up front.',
      author: 'Alex Rivera',
      role: 'Senior Designer',
      team: 'Customer Experience',
      contributors: ['Omar Haddad'],
      status: 'shipped',
      impact: 'More reviews with photos, and a faster path to submit.',
      metrics: [
        { id: uid(), value: '+31%', label: 'Review completion' },
        { id: uid(), value: '2.4x', label: 'Photo reviews' },
      ],
      bg: 'g-ocean',
    },
    {
      id: uid(),
      title: 'Handoff',
      tagline: 'Paste a prototype link, get a motion spec.',
      summary:
        'Designers record the flow from a Vercel prototype and Handoff writes the spec: springs, timings and haptics, with React Native values ready for devs to paste.',
      author: 'Mina Farouk',
      role: 'Design Engineer',
      team: 'Design Systems',
      contributors: ['Rahul Jaiswal'],
      status: 'experiment',
      impact: 'Motion specs no longer need to be written by hand.',
      metrics: [
        { id: uid(), value: '0', label: 'Hand-written specs' },
        { id: uid(), value: '3 min', label: 'Link to spec' },
      ],
      bg: 'm-aurora',
    },
  ],
}

export const MASTERCLASS_SEED: Deck = {
  id: 'm-motion',
  type: 'masterclass',
  title: 'Interaction & motion with Claude',
  subtitle: 'Use the animate skill to go from "make it feel alive" to motion you can ship.',
  date: 'Masterclass',
  host: 'Rahul Jaiswal',
  duration: '30 min',
  projects: [
    {
      ...blankProject(1),
      kind: 'step',
      title: 'Start from the moment, not the effect',
      tagline: '',
      summary:
        'Open Claude Code in your project and describe the interaction you want in plain words: what triggers it, what changes, and how it should feel. The skill decides whether it should animate at all before it picks a curve.',
      snippet: '/animate the bottom sheet that opens when you tap "Add to cart"',
      tip: 'Say how it should feel ("snappy", "calm") rather than naming durations. The skill picks the numbers.',
      frame: 'browser',
      metrics: [],
    },
    {
      ...blankProject(2),
      kind: 'step',
      title: 'Check purpose, curve and interruption',
      tagline: '',
      summary:
        'Claude walks through why the motion exists, which properties move, the spring or easing, and what happens if the user taps again mid-animation. Push back on anything that feels slow.',
      snippet: 'make the exit faster than the entrance and keep it interruptible',
      tip: 'Only transform and opacity should animate. If you see width or top moving, ask why.',
      frame: 'browser',
      metrics: [],
    },
    {
      ...blankProject(3),
      kind: 'step',
      title: 'See it running, then review it',
      tagline: '',
      summary:
        'Open the preview and try it like a user would: fast taps, back gestures, reduced motion on. Then ask for a review to catch timing and accessibility issues before handoff.',
      snippet: '/review-animations',
      tip: 'Turn on Reduce Motion once. The fades should stay and the movement should go.',
      frame: 'phone',
      metrics: [],
    },
  ],
}

export const SEED_LIBRARY: Library = { decks: [SEED, MASTERCLASS_SEED] }

/** Every person on the deck, authors first, without repeats. */
export function people(deck: Deck): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const authors = deck.projects.flatMap((p) => (isBoard(p) ? (p.items ?? []).map((i) => i.author) : [p.author]))
  for (const name of [...authors, ...deck.projects.flatMap((p) => p.contributors)]) {
    const n = name.trim()
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase())
      out.push(n)
    }
  }
  return out
}

/** Downscale an uploaded image so a deck of covers still fits in localStorage. */
export async function fileToDataUrl(file: File, max = 1400): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}
