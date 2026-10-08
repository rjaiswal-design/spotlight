import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEED, SEED_LIBRARY, MASTERCLASS_SEED, blankBoard, blankProject, blankStep, uid, type ChatMsg, type Deck, type Library, type Project } from './deck'
import { applyLib, applyToDeck, type ClientMsg, type LibOp, type Op, type Peer, type Presence, type ServerMsg } from './ops'

const CACHE = 'spotlight.library.v1'

function cached(): Library {
  try {
    const raw = localStorage.getItem(CACHE)
    if (raw) return JSON.parse(raw) as Library
    // the single-deck cache from before the library
    const old = localStorage.getItem('spotlight.deck.v1')
    if (old) return { decks: [{ ...SEED, ...(JSON.parse(old) as Deck), id: SEED.id, type: 'spotlight', week: SEED.week }, MASTERCLASS_SEED] }
  } catch {
    /* private mode or bad JSON */
  }
  return SEED_LIBRARY
}

/** One id per tab, so two tabs of the same person show up as two cursors. */
function tabId() {
  try {
    let id = sessionStorage.getItem('spotlight.tab')
    if (!id) sessionStorage.setItem('spotlight.tab', (id = uid()))
    return id
  } catch {
    return uid()
  }
}

export type RoomStatus = 'connecting' | 'live' | 'offline' | 'solo'

/**
 * Where the room lives. In dev it runs inside the Vite server at /collab. A
 * deployed static build has no server of its own, so it only connects when
 * VITE_COLLAB_URL points at one, and otherwise works solo in this browser.
 */
const COLLAB_URL: string | null =
  import.meta.env.VITE_COLLAB_URL || (import.meta.env.DEV ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/collab` : null)
export interface ReactionEvent {
  deck: string
  slide: string
  emoji: string
  from: string
}

/**
 * Every deck, shared. Edits apply locally first, then go to the room; edits
 * from everyone else arrive as ops. With no room to reach it keeps working
 * alone, cached in this browser.
 */
export function useLibrary(name: string | null) {
  const [library, setLibrary] = useState<Library>(cached)
  const [status, setStatus] = useState<RoomStatus>(COLLAB_URL ? 'connecting' : 'solo')
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [saveError, setSaveError] = useState(false)
  const [invite, setInvite] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const me = useMemo(tabId, [])
  const libRef = useRef(library)
  libRef.current = library
  const listeners = useRef(new Set<(e: ReactionEvent) => void>())
  const emit = (deck: string, op: Op) => {
    if (op.t === 'react') for (const fn of listeners.current) fn({ deck, slide: op.slide, emoji: op.emoji, from: op.from })
  }

  useEffect(() => {
    try {
      localStorage.setItem(CACHE, JSON.stringify(library))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [library])

  const raw = useCallback((m: ClientMsg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m))
  }, [])

  // presence: merged locally, sent at most ~30 times a second (a timer, not rAF, so background tabs still report)
  const presence = useRef<Presence>({ deck: null, slide: '', cursor: null, editing: null, presenting: false })
  const timer = useRef(0)
  const sendPresence = useCallback(() => raw({ k: 'presence', presence: presence.current }), [raw])
  const setPresence = useCallback(
    (p: Partial<Presence>) => {
      presence.current = { ...presence.current, ...p }
      if (timer.current) return
      timer.current = window.setTimeout(() => {
        timer.current = 0
        sendPresence()
      }, 33)
    },
    [sendPresence],
  )

  // connect, and keep reconnecting
  useEffect(() => {
    if (!name || !COLLAB_URL) return
    const url = COLLAB_URL
    let closed = false
    let retry = 0
    let t: number | undefined
    const open = () => {
      const sock = new WebSocket(url)
      ws.current = sock
      setStatus((s) => (s === 'live' ? 'connecting' : s))
      sock.onopen = () => {
        retry = 0
        sock.send(JSON.stringify({ k: 'hello', id: me, name } satisfies ClientMsg))
      }
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data) as ServerMsg
        if (m.k === 'init') {
          if (m.library) setLibrary(m.library)
          else sock.send(JSON.stringify({ k: 'lib', op: { t: 'seed', library: libRef.current } } satisfies ClientMsg))
          setPeers(Object.fromEntries(m.peers.map((p) => [p.id, p])))
          setInvite(m.invite)
          setStatus('live')
          sendPresence()
        } else if (m.k === 'op') {
          setLibrary((l) => applyToDeck(l, m.deck, m.op))
          emit(m.deck, m.op)
        } else if (m.k === 'lib') setLibrary((l) => applyLib(l, m.op))
        else if (m.k === 'peer') setPeers((p) => ({ ...p, [m.peer.id]: m.peer }))
        else if (m.k === 'leave')
          setPeers((p) => {
            const { [m.id]: _, ...rest } = p
            return rest
          })
      }
      sock.onclose = () => {
        if (closed) return
        setStatus('offline')
        setPeers({})
        t = window.setTimeout(open, Math.min(8000, 500 * 2 ** retry++))
      }
    }
    open()
    return () => {
      closed = true
      window.clearTimeout(t)
      ws.current?.close()
    }
  }, [name, me, sendPresence])

  const dispatch = useCallback(
    (deck: string, op: Op) => {
      setLibrary((l) => applyToDeck(l, deck, op))
      raw({ k: 'op', deck, op })
      emit(deck, op)
    },
    [raw],
  )
  const dispatchLib = useCallback(
    (op: LibOp) => {
      setLibrary((l) => applyLib(l, op))
      raw({ k: 'lib', op })
    },
    [raw],
  )
  const onReaction = useCallback((fn: (e: ReactionEvent) => void) => {
    listeners.current.add(fn)
    return () => void listeners.current.delete(fn)
  }, [])

  return {
    library,
    libRef,
    status,
    peers: Object.values(peers),
    me,
    name,
    invite,
    saveError,
    setPresence,
    dispatch,
    onReaction,
    createDeck: (deck: Deck) => dispatchLib({ t: 'create', deck }),
    deleteDeck: (id: string) => dispatchLib({ t: 'delete', id }),
  }
}

export type LibraryRoom = ReturnType<typeof useLibrary>

/** One deck's view of the room: its data, who's in it, and the edits you can make. */
export function useDeckRoom(lib: LibraryRoom, id: string) {
  const deck = lib.library.decks.find((d) => d.id === id) ?? null
  const { dispatch, libRef, name } = lib

  const actions = useMemo(() => {
    const cur = () => libRef.current.decks.find((d) => d.id === id)
    const go = (op: Op) => dispatch(id, op)
    return {
      setDeck: (deck: Deck) => go({ t: 'replace', deck }),
      patchDeck: (patch: Partial<Omit<Deck, 'projects' | 'id'>>) => go({ t: 'deck', patch }),
      patchProject: (pid: string, patch: Partial<Project>) => go({ t: 'project', id: pid, patch }),
      addProject: (after?: string, kind?: 'board' | 'step') => {
        const project = kind === 'board' ? blankBoard() : kind === 'step' ? blankStep() : blankProject(Math.floor(Math.random() * 8))
        const d = cur()
        const index = d && after ? d.projects.findIndex((p) => p.id === after) + 1 : (d?.projects.length ?? 0)
        go({ t: 'add', project, index })
        return project.id
      },
      duplicateProject: (pid: string) => {
        const d = cur()
        const i = d?.projects.findIndex((p) => p.id === pid) ?? -1
        if (!d || i < 0) return
        const src = d.projects[i]
        const project = { ...src, id: uid(), title: src.title && `${src.title} copy`, metrics: src.metrics.map((m) => ({ ...m, id: uid() })), items: src.items?.map((x) => ({ ...x, id: uid() })) }
        go({ t: 'add', project, index: i + 1 })
      },
      removeProject: (pid: string) => go({ t: 'remove', id: pid }),
      moveProject: (from: number, to: number) => {
        const p = cur()?.projects[from]
        if (p && from !== to) go({ t: 'move', id: p.id, to })
      },
      chat: (m: Omit<ChatMsg, 'id' | 'at' | 'from'>) => go({ t: 'chat', msg: { ...m, id: uid(), at: Date.now(), from: name ?? 'Someone' } }),
      react: (slide: string, emoji: string) => go({ t: 'react', slide, emoji, from: name ?? 'Someone' }),
    }
  }, [dispatch, id, name, libRef])

  return {
    deck,
    status: lib.status,
    peers: lib.peers.filter((p) => p.presence.deck === id),
    me: lib.me,
    name: lib.name,
    invite: lib.invite,
    saveError: lib.saveError,
    setPresence: lib.setPresence,
    onReaction: lib.onReaction,
    ...actions,
  }
}

export type DeckRoom = ReturnType<typeof useDeckRoom>
