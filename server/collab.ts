import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { applyLib, applyToDeck, type ClientMsg, type Peer, type ServerMsg } from '../src/lib/ops.ts'
import { MASTERCLASS_SEED, mondayOf, weekLabel, type Deck, type Library } from '../src/lib/deck.ts'

/**
 * The multiplayer room. Every deck (weekly spotlights and masterclasses), held
 * in memory and written to disk, shared by everyone who opens the app. Clients
 * send ops and presence; the server applies ops to its copy and relays both.
 */
export function attachCollab(http: Server, dataDir: string) {
  const file = path.join(dataDir, 'library.json')
  let library: Library | null = load()

  function load(): Library | null {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      /* fall through */
    }
    // the single-deck room from before the library: it becomes this week's spotlight
    try {
      const old = JSON.parse(fs.readFileSync(path.join(dataDir, 'deck.json'), 'utf8')) as Deck
      const week = mondayOf()
      return { decks: [{ ...old, id: old.id ?? 'w-seed', type: 'spotlight', week, date: old.date === 'Q3 2026' ? weekLabel(week) : old.date }, MASTERCLASS_SEED] }
    } catch {
      return null // first run: the first client seeds the room
    }
  }

  let writeTimer: NodeJS.Timeout | null = null
  const save = () => {
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(library, null, 2))
    }, 400)
  }

  /** the address teammates on the same network can open */
  const invite = () => {
    const addr = http.address()
    const port = typeof addr === 'object' && addr ? addr.port : 5360
    const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address
    return ip ? `http://${ip}:${port}` : null
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 })
  const peers = new Map<WebSocket, Peer>()

  const send = (ws: WebSocket, m: ServerMsg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m))
  const others = (self: WebSocket, m: ServerMsg) => {
    const s = JSON.stringify(m)
    for (const ws of wss.clients) if (ws !== self && ws.readyState === WebSocket.OPEN) ws.send(s)
  }

  http.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/collab')) return // leave Vite's HMR socket alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let m: ClientMsg
      try {
        m = JSON.parse(String(raw))
      } catch {
        return
      }
      if (m.k === 'hello') {
        const peer: Peer = { id: m.id, name: m.name, presence: { deck: null, slide: '', cursor: null, editing: null, presenting: false } }
        peers.set(ws, peer)
        send(ws, { k: 'init', library, peers: [...peers.values()].filter((p) => p !== peer), invite: invite() })
        others(ws, { k: 'peer', peer })
        return
      }
      const me = peers.get(ws)
      if (!me) return
      if (m.k === 'lib') {
        library = m.op.t === 'seed' ? m.op.library : library ? applyLib(library, m.op) : library
        save()
        others(ws, { k: 'lib', op: m.op, from: me.id })
      } else if (m.k === 'op') {
        if (library) library = applyToDeck(library, m.deck, m.op)
        save()
        others(ws, { k: 'op', deck: m.deck, op: m.op, from: me.id })
      } else if (m.k === 'presence') {
        me.presence = m.presence
        others(ws, { k: 'peer', peer: me })
      }
    })
    ws.on('close', () => {
      const me = peers.get(ws)
      peers.delete(ws)
      if (me) others(ws, { k: 'leave', id: me.id })
    })
  })

  return wss
}
