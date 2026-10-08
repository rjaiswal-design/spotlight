import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Button, CountBadge, Kbd, cn } from 'lightweight-ui'
import { CaretLeft, CaretRight, ChatCircleText, CornersIn, HandsClapping, SquaresFour } from 'lightweight-ui/icons'
import { ChatPanel, StickerTile } from '../components/Chat'
import { Scaled, SlideView, slideKey, slidesOf } from '../components/Slides'
import { isBoard, type Deck } from '../lib/deck'
import { projectKudos } from '../lib/engagement'
import type { DeckRoom } from '../lib/room'
import { REACTIONS } from '../lib/stickers'

type Flyer = { id: number; emoji?: string; sticker?: string; from: string; x: number; dur: number; sway: number; swayDur: number }

/**
 * Present mode. As the presenter you drive the slides and everyone who joins
 * follows you. As the audience (`watch`) you follow the presenter until you
 * move on your own. Either way: reactions float up, chat runs alongside.
 */
export function Presenter({ room, start, watch, onExit }: { room: DeckRoom & { deck: Deck }; start: number; watch: string | null; onExit: (at: number) => void }) {
  const { deck } = room
  const slides = slidesOf(deck)
  const me = room.name ?? 'Someone'
  const [i, setI] = useState(Math.min(start, slides.length - 1))
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [grid, setGrid] = useState(false)
  const [idle, setIdle] = useState(false)
  const [chatOpen, setChatOpen] = useState(!!watch)
  const [seen, setSeen] = useState((deck.chat ?? []).length)
  const [following, setFollowing] = useState(!!watch)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const root = useRef<HTMLDivElement>(null)
  const wentFull = useRef(false)

  const leader = watch ? room.peers.find((p) => p.id === watch) : undefined
  const leaderLive = !!leader?.presence.presenting

  const go = useCallback(
    (to: number, byHand = true) => {
      const n = Math.max(0, Math.min(slides.length - 1, to))
      if (byHand) setFollowing(false)
      setDir(n >= i ? 'next' : 'prev')
      setI(n)
    },
    [i, slides.length],
  )
  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    onExit(i)
  }, [i, onExit])
  const onExitRef = useRef(exit)
  onExitRef.current = exit

  // audience: go where the presenter goes
  useEffect(() => {
    if (!following || !leader) return
    const n = slides.findIndex((s) => slideKey(s) === leader.presence.slide)
    if (n >= 0 && n !== i) go(n, false)
  }, [following, leader?.presence.slide]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen on open. Leaving fullscreen (Esc in most browsers) leaves present mode too.
  useEffect(() => {
    root.current?.requestFullscreen?.().then(() => (wentFull.current = true)).catch(() => {})
    const onChange = () => {
      if (!document.fullscreenElement && wentFull.current) onExitRef.current()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const slide = slides[i]
  const key = slideKey(slide)

  // tell the room: presenting (or watching) this slide
  useEffect(() => {
    room.setPresence({ slide: key, presenting: !watch, cursor: null, editing: null })
  }, [key, watch, room.setPresence])
  useEffect(() => () => room.setPresence({ presenting: false }), [room.setPresence])

  // floating reactions and stickers, for everyone on this slide
  const nextId = useRef(0)
  const fly = useCallback((f: Pick<Flyer, 'emoji' | 'sticker' | 'from'>) => {
    const id = nextId.current++
    // vary each one a little so a burst of reactions doesn't move in lockstep
    const dur = 2400 + Math.random() * 600
    const sway = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10)
    setFlyers((all) => [...all.slice(-30), { ...f, id, x: 6 + Math.random() * 16, dur, sway, swayDur: 1100 + Math.random() * 500 }])
    window.setTimeout(() => setFlyers((all) => all.filter((x) => x.id !== id)), dur + 100)
  }, [])
  useEffect(
    () =>
      room.onReaction((e) => {
        if (e.deck === deck.id && e.slide === key) fly({ emoji: e.emoji, from: e.from })
      }),
    [room.onReaction, deck.id, key, fly],
  )
  const chatLen = (deck.chat ?? []).length
  const lastLen = useRef(chatLen)
  useEffect(() => {
    const fresh = (deck.chat ?? []).slice(lastLen.current)
    lastLen.current = chatLen
    for (const m of fresh) if (m.sticker && m.slide === key) fly({ sticker: m.sticker, from: m.from })
    if (chatOpen) setSeen(chatLen)
  }, [chatLen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return
      const k = e.key
      if (grid) {
        if (k === 'Escape' || k === 'g' || k === 'G') setGrid(false)
        return
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'l', 'j'].includes(k)) go(i + 1)
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'h', 'k'].includes(k)) go(i - 1)
      else if (k === 'Home') go(0)
      else if (k === 'End') go(slides.length - 1)
      else if (k === 'g' || k === 'G') setGrid(true)
      else if (k === 'c' || k === 'C') toggleChat()
      else if (k === 'f' || k === 'F') watch && setFollowing(true)
      else if (k === 'Escape') exit()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Hide the cursor and controls after a moment of stillness.
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 2600)
    const wake = () => {
      setIdle(false)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdle(true), 2600)
    }
    window.addEventListener('pointermove', wake)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointermove', wake)
    }
  }, [])

  function toggleChat() {
    setChatOpen((o) => !o)
    setSeen(chatLen)
  }

  const project = slide.kind === 'project' || slide.kind === 'detail' ? deck.projects.find((p) => p.id === slide.id) : undefined
  const interactive = !!project && slide.kind === 'project' && (isBoard(project) || (project.kind === 'step' && !!project.link))
  const canAppreciate = !!project && !project.kind && !!project.author
  const counts = deck.reactions?.[key] ?? {}
  const kudos = project ? projectKudos(deck, project.id) : 0
  const unread = chatOpen ? 0 : Math.max(0, chatLen - seen)
  const progress = slides.length > 1 ? i / (slides.length - 1) : 1
  const slideLabel = (k: string) => {
    const n = slides.findIndex((s) => slideKey(s) === k)
    return n < 0 ? null : `slide ${n + 1}`
  }
  const lead = leader?.name.split(' ')[0]

  return (
    <div ref={root} className={cn('fixed inset-0 z-50 flex bg-bg', idle && !grid && 'sp-idle')}>
      <div className="relative flex min-w-0 flex-1 flex-col">
        {grid ? (
          <div className="sp-scroll flex-1 overflow-auto p-10">
            <div className="mx-auto mb-6 flex max-w-[1400px] items-center justify-between">
              <p className="text-ui font-medium text-muted">{slides.length} slides · pick one to jump there</p>
              <p className="text-label text-muted">
                <Kbd>G</Kbd> or <Kbd>Esc</Kbd> to close
              </p>
            </div>
            <div className="mx-auto grid max-w-[1400px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
              {slides.map((s, n) => (
                <button
                  key={slideKey(s)}
                  type="button"
                  data-static
                  onClick={() => {
                    go(n)
                    setGrid(false)
                  }}
                  className={cn(
                    'group rounded-[18px] p-1 text-start outline-offset-2 transition-[transform] duration-150 [@media(hover:hover)]:hover:-translate-y-0.5',
                    n === i ? 'ring-2 ring-ink' : 'ring-1 ring-transparent',
                  )}
                >
                  <Scaled fit="width" className="pointer-events-none rounded-[14px]">
                    <SlideView deck={deck} slide={s} />
                  </Scaled>
                  <p className="mt-2 px-1 font-mono text-caption text-muted tabular-nums">{String(n + 1).padStart(2, '0')}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <Scaled className="h-full w-full p-[2.5vmin] pb-[calc(2.5vmin+76px)]">
              <div key={key} className={cn('h-full w-full', dir === 'next' ? 'sp-enter-next' : 'sp-enter-prev')}>
                <SlideView deck={deck} slide={slide} live />
              </div>
            </Scaled>
            {/* tap zones: left third back, the rest forward. Live demos keep only thin edges, so they stay clickable. */}
            <button type="button" aria-label="Previous slide" data-static className={cn('absolute inset-y-0 start-0 cursor-w-resize opacity-0', interactive ? 'w-[3vw]' : 'w-1/3')} onClick={() => go(i - 1)} />
            <button type="button" aria-label="Next slide" data-static className={cn('absolute inset-y-0 end-0 cursor-e-resize opacity-0', interactive ? 'w-[3vw]' : 'w-2/3')} onClick={() => go(i + 1)} />

            {/* reactions rise from the bottom right */}
            <div className="pointer-events-none absolute inset-y-0 end-0 w-1/3 overflow-hidden" aria-hidden>
              {flyers.map((f) => (
                <div
                  key={f.id}
                  className="sp-fly absolute bottom-24"
                  style={{ insetInlineEnd: `${f.x}%`, '--dur': `${f.dur}ms`, '--sway': `${f.sway}px`, '--sway-dur': `${f.swayDur}ms` } as React.CSSProperties}
                >
                  <div className="sp-fly-sway">
                    <div className="sp-fly-pop flex flex-col items-center gap-1">
                      {f.sticker ? <StickerTile id={f.sticker} size="lg" /> : <span className="text-[56px] leading-none">{f.emoji}</span>}
                      <span className="rounded-full bg-card px-2 py-0.5 text-caption font-semibold shadow-pill">{f.from.split(' ')[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* following pill */}
        {watch && !grid && (
          <div className="absolute inset-x-0 top-4 z-10 flex justify-center">
            {leaderLive && following ? (
              <span className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pe-3 ps-1 text-label shadow-pill">
                {leader && <Avatar person={leader.name} size="xs" />}
                Following {lead}
                <button type="button" className="ms-1 text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setFollowing(false)}>
                  Stop
                </button>
              </span>
            ) : leaderLive ? (
              <Button size="sm" variant="secondary" onClick={() => setFollowing(true)}>
                Back to {lead}'s slide <Kbd className="ms-1">F</Kbd>
              </Button>
            ) : (
              <span className="rounded-full border border-line bg-card px-3 py-1 text-label text-muted shadow-pill">
                {lead ? `${lead} stopped presenting` : 'The presenter left'}. You can look around.
              </span>
            )}
          </div>
        )}

        {!grid && (
          <div className="sp-chrome pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4 transition-[opacity] duration-300">
            {/* one fixed dock: same cells, same width, on every slide */}
            <div className="pointer-events-auto flex h-14 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-card/95 shadow-toast backdrop-blur">
              <div className="flex divide-x divide-line">
                <DockButton label="Previous" onClick={() => go(i - 1)} disabled={i === 0}>
                  <CaretLeft size={16} />
                </DockButton>
                <span className="grid w-[72px] place-items-center font-mono text-caption text-muted tabular-nums">
                  {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </span>
                <DockButton label="Next" onClick={() => go(i + 1)} disabled={i === slides.length - 1}>
                  <CaretRight size={16} />
                </DockButton>
              </div>

              <div className="flex divide-x divide-line" role="group" aria-label="Reactions on this slide">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => room.react(key, emoji)}
                    aria-label={`React ${emoji}, ${counts[emoji] ?? 0} on this slide`}
                    className="group flex w-12 flex-col items-center justify-center gap-0.5 transition-[background-color] duration-150 [@media(hover:hover)]:hover:bg-wash-2"
                  >
                    <span className="text-[20px] leading-none transition-transform duration-150 group-active:scale-90">{emoji}</span>
                    <span key={counts[emoji] ?? 0} className={cn('font-mono text-[11px] leading-none tabular-nums', counts[emoji] ? 'u-pop text-ink' : 'text-muted/60')}>
                      {counts[emoji] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!canAppreciate}
                onClick={() => {
                  room.chat({ slide: key, kudos: { project: project!.id, author: project!.author } })
                  room.react(key, '👏')
                }}
                aria-label={canAppreciate ? `Appreciate ${project!.author}, ${kudos} so far` : 'Appreciate (no author on this slide)'}
                className="flex w-[184px] items-center gap-3 px-4 text-start transition-[background-color] duration-150 enabled:[@media(hover:hover)]:hover:bg-wash-2 disabled:opacity-40"
              >
                <HandsClapping size={20} weight="fill" className="flex-none" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold leading-tight">Appreciate</span>
                  <span className="block truncate text-caption leading-tight text-muted">{canAppreciate ? project!.author.split(' ')[0] : 'No author here'}</span>
                </span>
                <span key={kudos} className={cn('font-mono text-ui tabular-nums', kudos ? 'u-pop text-ink' : 'text-muted/60')}>
                  {kudos}
                </span>
              </button>

              <div className="flex divide-x divide-line">
                <DockButton label="All slides (G)" onClick={() => setGrid(true)}>
                  <SquaresFour size={17} />
                </DockButton>
                <DockButton label="Chat (C)" onClick={toggleChat} pressed={chatOpen}>
                  <ChatCircleText size={18} />
                  {unread > 0 && <CountBadge className="absolute end-1.5 top-1.5">{unread}</CountBadge>}
                </DockButton>
                <DockButton label="Exit (Esc)" onClick={exit}>
                  <CornersIn size={17} />
                </DockButton>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 h-[3px] bg-wash-2" aria-hidden>
          <div className="h-full origin-left bg-ink transition-[transform] duration-500 ease-out" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          deck={deck}
          me={me}
          slideLabel={slideLabel}
          onSend={(m) => room.chat({ ...m, slide: key })}
          onJump={(k) => {
            const n = slides.findIndex((s) => slideKey(s) === k)
            if (n >= 0) go(n)
          }}
          onClose={toggleChat}
        />
      )}
    </div>
  )
}


function DockButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative grid w-12 place-items-center transition-[background-color] duration-150 enabled:[@media(hover:hover)]:hover:bg-wash-2 disabled:opacity-35',
        pressed && 'bg-wash-3',
      )}
    >
      {children}
    </button>
  )
}
