import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader, Button, ConfirmDialog, EmptyState, Kbd, Logo, MenuDivider, MenuItem, PeerDots, cn, onColor, personColor, useHotkey, useToast } from 'lightweight-ui'
import { ArrowLeft, ChatCircleText, DownloadSimple, HandsClapping, Play, Plus, Smiley, Trash, UploadSimple } from 'lightweight-ui/icons'
import { HeaderActions, LiveBanner } from '../components/Chrome'
import { SessionEngagement, SlideEngagement } from '../components/Engagement'
import { slideEngagement } from '../lib/engagement'
import { EditCtx, Scaled, ScaleCtx, SLIDE_H, SLIDE_W, SlideView, slideKey, slidesOf, type SlideEdit, type SlideRef } from '../components/Slides'
import { isBoard, isStep, realProjects, steps, type Deck } from '../lib/deck'
import type { Peer } from '../lib/ops'
import { useDeckRoom, type DeckRoom, type LibraryRoom } from '../lib/room'
import { BoardInspector, DeckInspector, ProjectInspector, StepInspector } from './Inspector'
import { Presenter } from './Presenter'

type Props = { lib: LibraryRoom; deckId: string; watch: string | null; onRename: () => void }

export function Editor(props: Props) {
  const room = useDeckRoom(props.lib, props.deckId)
  if (!room.deck)
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          title="This session is gone"
          description="It may have been deleted, or the link is wrong."
          action={<Button onClick={() => (location.hash = '#/')}>Back home</Button>}
        />
      </div>
    )
  return <EditorBody {...props} room={room as DeckRoom & { deck: Deck }} />
}

function EditorBody({ lib, deckId, watch, onRename, room }: Props & { room: DeckRoom & { deck: Deck } }) {
  const { deck, peers } = room
  const toast = useToast()
  const master = deck.type === 'masterclass'
  const [sel, setSel] = useState<SlideRef>({ kind: 'cover' })
  const [presenting, setPresenting] = useState<number | null>(null)
  const [following, setFollowing] = useState<string | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const slides = slidesOf(deck)
  let selIndex = slides.findIndex((s) => slideKey(s) === slideKey(sel))
  if (selIndex < 0) selIndex = 0
  const current = slides[selIndex]
  const currentKey = slideKey(current)
  const project = current.kind === 'project' || current.kind === 'detail' ? deck.projects.find((p) => p.id === current.id) : undefined

  // tell the room where we are, and that we left when we go
  useEffect(() => room.setPresence({ deck: deckId, slide: currentKey }), [deckId, currentKey, room.setPresence])
  useEffect(() => () => room.setPresence({ deck: null, slide: '', cursor: null, editing: null, presenting: false }), [room.setPresence])

  // following: go wherever they go
  const leader = peers.find((p) => p.id === following)
  useEffect(() => {
    if (!following) return
    if (!leader) {
      setFollowing(null)
      return
    }
    const s = slides.find((x) => slideKey(x) === leader.presence.slide)
    if (s && slideKey(s) !== currentKey) setSel(s)
  }, [following, leader?.presence.slide]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (s: SlideRef) => {
    setFollowing(null)
    setSel(s)
  }

  useHotkey('mod+enter', () => setPresenting(selIndex), { enabled: presenting === null && !watch })
  useHotkey('p', () => setPresenting(selIndex), { enabled: presenting === null && !watch })
  useHotkey('arrowdown', () => choose(slides[Math.min(slides.length - 1, selIndex + 1)]), { enabled: presenting === null && !watch })
  useHotkey('arrowup', () => choose(slides[Math.max(0, selIndex - 1)]), { enabled: presenting === null && !watch })

  const where = (p: Peer) => {
    if (p.presence.presenting) return 'presenting'
    const i = slides.findIndex((s) => slideKey(s) === p.presence.slide)
    return i < 0 ? undefined : `on slide ${i + 1}`
  }

  const edit: SlideEdit = useMemo(() => {
    const remote: SlideEdit['remote'] = {}
    for (const p of peers) if (p.presence.editing) remote[p.presence.editing] = { name: p.name.split(' ')[0], color: personColor(p.name) }
    return {
      editable: true,
      patchDeck: room.patchDeck,
      patchProject: room.patchProject,
      onEditing: (field) => room.setPresence({ editing: field }),
      remote,
    }
  }, [peers, room.patchDeck, room.patchProject, room.setPresence])

  function add(kind?: 'board' | 'step') {
    const id = room.addProject(undefined, kind)
    choose({ kind: 'project', id })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(deck.title || 'spotlight').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importJson(f: File) {
    try {
      const d = JSON.parse(await f.text()) as Deck
      if (!Array.isArray(d.projects)) throw new Error('no projects')
      room.setDeck({ ...deck, ...d, id: deck.id, type: deck.type })
      choose({ kind: 'cover' })
      toast(`Imported ${d.projects.length} slides`)
    } catch {
      toast('That file is not a Spotlight deck')
    }
  }

  const removeSlide = (id: string) => {
    const prev = slides[selIndex - 1]
    room.removeProject(id)
    choose(prev && slideKey(prev) !== `${id}:story` ? prev : { kind: 'cover' })
  }
  const panelProps = (id: string) => ({
    patch: (p: Parameters<typeof room.patchProject>[1]) => room.patchProject(id, p),
    onDuplicate: () => room.duplicateProject(id),
    onDelete: () => removeSlide(id),
  })

  const count = master ? `${steps(deck).length} steps` : `${realProjects(deck).length} projects`
  const addKinds = master
    ? ([
        ['Step', 'step'],
        ['Showcase', 'board'],
      ] as const)
    : ([
        ['Project', undefined],
        ['Showcase', 'board'],
      ] as const)

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        brand={<Logo letter="S" name="Spotlight" href="#/" />}
        contained={false}
        nav={
          <span className="hidden min-w-0 items-center gap-3 text-ui text-muted md:flex">
            <span className="h-4 w-px flex-none bg-line" aria-hidden />
            <a href={master ? '#/masterclass' : '#/'} className="inline-flex flex-none items-center gap-1 hover:text-ink">
              <ArrowLeft size={14} aria-hidden /> {master ? 'Masterclass' : 'Weekly'}
            </a>
            <span aria-hidden>/</span>
            <span className="truncate text-ink">
              {master ? deck.title || 'Untitled masterclass' : `${deck.date} · ${deck.title || 'Untitled'}`}
            </span>
            <span className="flex-none">· {count}</span>
          </span>
        }
        actions={
          <HeaderActions
            lib={lib}
            peers={peers}
            selfWhere={`on slide ${selIndex + 1}`}
            where={where}
            following={following}
            onFollow={setFollowing}
            onRename={onRename}
            menu={
              <>
                <MenuItem icon={<DownloadSimple size={16} />} onSelect={exportJson}>
                  Export deck
                </MenuItem>
                <MenuItem icon={<UploadSimple size={16} />} onSelect={() => fileIn.current?.click()}>
                  Import deck
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  icon={<Trash size={16} />}
                  tone="danger"
                  onSelect={() => setConfirmDelete(true)}
                >
                  Delete session
                </MenuItem>
              </>
            }
          >
            <Button leadingIcon={<Play size={14} weight="fill" />} onClick={() => setPresenting(selIndex)}>
              Present
            </Button>
          </HeaderActions>
        }
      />
      <input
        ref={fileIn}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importJson(f)
          e.target.value = ''
        }}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[232px_1fr_340px]">
        {/* slide rail */}
        <aside className="sp-scroll flex min-h-0 flex-col gap-1 overflow-y-auto border-e border-line px-3 py-4">
          {slides.map((s, n) => {
            const pi = s.kind === 'project' ? deck.projects.findIndex((p) => p.id === s.id) : -1
            const movable = pi >= 0
            const here = peers.filter((p) => p.presence.slide === slideKey(s))
            return (
              <div
                key={slideKey(s)}
                draggable={movable}
                onDragStart={() => setDrag(pi)}
                onDragEnd={() => {
                  setDrag(null)
                  setOver(null)
                }}
                onDragOver={(e) => {
                  if (drag === null || !movable) return
                  e.preventDefault()
                  setOver(pi)
                }}
                onDrop={() => {
                  if (drag !== null && movable) room.moveProject(drag, pi)
                  setDrag(null)
                  setOver(null)
                }}
                className={cn('flex gap-2 rounded-xl p-1.5', movable && drag === pi && 'opacity-40', movable && over === pi && drag !== pi && 'bg-wash-2', s.kind === 'detail' && 'ps-5')}
              >
                <div className="flex w-5 flex-col items-end gap-1.5 pt-1">
                  <span className="font-mono text-micro text-muted tabular-nums">{n + 1}</span>
                  <PeerDots colors={here.map((p) => personColor(p.name))} label={here.length ? `${here.map((p) => p.name).join(', ')} here` : undefined} className="flex-col" />
                </div>
                <button
                  type="button"
                  data-static
                  onClick={() => choose(s)}
                  aria-current={n === selIndex}
                  className={cn(
                    'relative min-w-0 flex-1 overflow-hidden rounded-[10px] text-start outline-offset-2',
                    n === selIndex ? 'ring-2 ring-ink' : 'ring-1 ring-line [@media(hover:hover)]:hover:ring-line-strong',
                  )}
                >
                  <Scaled fit="width" className="pointer-events-none">
                    <SlideView deck={deck} slide={s} />
                  </Scaled>
                  <RailCounts deck={deck} slide={s} />
                </button>
              </div>
            )
          })}
          <div className="mt-2 grid flex-none grid-cols-2 gap-2">
            {addKinds.map(([label, kind]) => (
              <button
                key={label}
                type="button"
                onClick={() => add(kind)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-label font-medium text-muted transition-[background-color] duration-150 [@media(hover:hover)]:hover:bg-wash-1"
              >
                <Plus size={14} /> {label}
              </button>
            ))}
          </div>
        </aside>

        {/* stage */}
        <main className="sp-canvas relative flex min-h-0 min-w-0 flex-col">
          {leader && (
            <div className="pointer-events-none absolute inset-2 z-10 rounded-[18px]" style={{ boxShadow: `inset 0 0 0 2px ${personColor(leader.name)}` }} aria-hidden />
          )}
          <Scaled className="min-h-0 flex-1 p-10">
            <div
              className="relative h-full w-full"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                room.setPresence({ cursor: { x: ((e.clientX - r.left) / r.width) * SLIDE_W, y: ((e.clientY - r.top) / r.height) * SLIDE_H } })
              }}
              onPointerLeave={() => room.setPresence({ cursor: null })}
            >
              <EditCtx.Provider value={edit}>
                <SlideView deck={deck} slide={current} />
              </EditCtx.Provider>
              {peers
                .filter((p) => p.presence.slide === currentKey && p.presence.cursor)
                .map((p) => (
                  <Cursor key={p.id} name={p.name} x={p.presence.cursor!.x} y={p.presence.cursor!.y} />
                ))}
            </div>
          </Scaled>
          <div className="flex items-center justify-center gap-4 pb-4 text-label text-muted">
            <span>Click any text on the slide to edit it</span>
            <span>
              <Kbd>P</Kbd> present
            </span>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> move between slides
            </span>
          </div>
        </main>

        {/* inspector */}
        <aside className="sp-scroll min-h-0 overflow-y-auto border-s border-line bg-card">
          {current.kind === 'cover' ? <SessionEngagement deck={deck} slides={slides} onPick={choose} /> : <SlideEngagement deck={deck} slide={current} />}
          {project && isBoard(project) ? (
            <BoardInspector key={project.id} board={project} {...panelProps(project.id)} />
          ) : project && isStep(project) ? (
            <StepInspector key={project.id} step={project} {...panelProps(project.id)} />
          ) : project ? (
            <ProjectInspector key={project.id} project={project} {...panelProps(project.id)} />
          ) : current.kind === 'cover' ? (
            <DeckInspector deck={deck} patch={room.patchDeck} />
          ) : (
            <div className="px-5 py-5">
              <h3 className="mb-2 font-sans text-label font-semibold uppercase tracking-wide text-muted">Closing slide</h3>
              <p className="text-label text-muted">
                {master ? 'Recaps every step with its title.' : 'Lists every project with its author and the appreciation it got.'} It updates as you edit.
              </p>
            </div>
          )}
        </aside>
      </div>

      {presenting === null && !watch && <LiveBanner lib={lib} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${deck.title || 'this session'}?`}
        body="It goes away for everyone, with its slides, chat and reactions. This can't be undone."
        confirmLabel="Delete session"
        tone="danger"
        onConfirm={() => {
          setConfirmDelete(false)
          lib.deleteDeck(deck.id)
          location.hash = master ? '#/masterclass' : '#/'
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {(presenting !== null || watch) && (
        <Presenter
          room={room}
          start={presenting ?? 0}
          watch={watch}
          onExit={(at) => {
            setPresenting(null)
            if (watch) location.hash = `#/d/${deck.id}`
            else choose(slides[at] ?? { kind: 'cover' })
          }}
        />
      )}
    </div>
  )
}

/** Someone else's pointer, drawn in slide space but kept at screen size. */
function Cursor({ name, x, y }: { name: string; x: number; y: number }) {
  const k = useContext(ScaleCtx)
  const color = personColor(name)
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-30 transition-transform duration-100 ease-out"
      style={{ transform: `translate(${x}px, ${y}px) scale(${1 / k})`, transformOrigin: '0 0' }}
      aria-hidden
    >
      <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-sm">
        <path d="M1.5 1.5 16 9.2l-6.4 1.6-3.3 6.9z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute left-3.5 top-4 whitespace-nowrap rounded-md rounded-tl-sm px-1.5 py-0.5 text-[12px] font-semibold leading-tight"
        style={{ backgroundColor: color, color: onColor(color) }}
      >
        {name.split(' ')[0]}
      </span>
    </div>
  )
}

/** Reactions, appreciation and comments on a slide, tucked into its thumbnail's corner. */
function RailCounts({ deck, slide }: { deck: Deck; slide: SlideRef }) {
  const e = slideEngagement(deck, slideKey(slide))
  const cells = [
    { icon: Smiley, n: e.reactionTotal, label: 'reactions' },
    { icon: HandsClapping, n: e.kudos.length, label: 'appreciation' },
    { icon: ChatCircleText, n: e.comments.length, label: 'comments' },
  ].filter((c) => c.n > 0)
  if (!cells.length) return null
  return (
    <span className="absolute bottom-1 end-1 flex divide-x divide-line overflow-hidden rounded-md border border-line bg-card/95 text-[10px] leading-none">
      {cells.map((c) => (
        <span key={c.label} className="flex items-center gap-0.5 px-1 py-[3px] font-mono tabular-nums" aria-label={`${c.n} ${c.label}`}>
          <c.icon size={9} weight="fill" aria-hidden />
          {c.n}
        </span>
      ))}
    </span>
  )
}
