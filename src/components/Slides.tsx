import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { Avatar, AvatarStack, Backdrop, Badge, HeroPanel, cn, onColor, findHeroBg } from 'lightweight-ui'
import { ArrowUpRight, Browser, DeviceMobile, GraduationCap, HandsClapping, Lightbulb, Mountains, Path, Quotes, Sparkle, Target, TerminalWindow } from 'lightweight-ui/icons'
import { STATUS_LABEL, STATUS_TONE, hasStory, isBoard, isStep, people, realProjects, steps, type Deck, type Project, type ShowItem } from '../lib/deck'

export const SLIDE_W = 1280
export const SLIDE_H = 720

export type SlideRef = { kind: 'cover' } | { kind: 'project'; id: string } | { kind: 'detail'; id: string } | { kind: 'end' }

/** How much the slide is scaled on screen, for things that should stay a fixed size (cursors). */
export const ScaleCtx = createContext(1)

export interface SlideEdit {
  editable: boolean
  patchDeck: (p: Partial<Omit<Deck, 'projects'>>) => void
  patchProject: (id: string, p: Partial<Project>) => void
  /** tells the room which field this person is typing in */
  onEditing: (field: string | null) => void
  /** fields someone else is typing in, by field key */
  remote: Record<string, { name: string; color: string }>
}
const noop = () => {}
export const EditCtx = createContext<SlideEdit>({ editable: false, patchDeck: noop, patchProject: noop, onEditing: noop, remote: {} })

type Tag = 'span' | 'p' | 'h1' | 'h2'

/**
 * Text that is plain on a thumbnail and editable in place on the stage. The DOM
 * owns the text while you type, so remote edits to the same field land when you
 * leave it rather than moving your caret.
 */
function Editable({
  as: T = 'span',
  field,
  value,
  onChange,
  placeholder,
  fallback,
  multiline,
  className,
  style,
}: {
  as?: Tag
  field: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  fallback?: React.ReactNode
  multiline?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const ctx = useContext(EditCtx)
  const ref = useRef<HTMLElement>(null)
  const focused = useRef(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !focused.current && el.textContent !== value) el.textContent = value
  })
  if (!ctx.editable) return <T className={className} style={style}>{value || fallback}</T>
  const remote = ctx.remote[field]
  const Any = T as 'span'
  return (
    <Any
      ref={ref as React.RefObject<HTMLSpanElement>}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={placeholder}
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder}
      data-editor={remote?.name}
      className={cn('sp-edit', className)}
      style={{ ...style, ...(remote ? ({ '--ec': remote.color } as React.CSSProperties) : null) }}
      onFocus={() => {
        focused.current = true
        ctx.onEditing(field)
      }}
      onBlur={(e) => {
        focused.current = false
        ctx.onEditing(null)
        const v = (e.currentTarget.textContent ?? '').replace(/\s+$/, '')
        if (v !== value) onChange(v)
        else if (e.currentTarget.textContent !== value) e.currentTarget.textContent = value
      }}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && !multiline) || e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Fits a fixed 1280×720 slide into whatever box it is given. */
export function Scaled({ children, className, fit = 'contain' }: { children: React.ReactNode; className?: string; fit?: 'contain' | 'width' }) {
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setK(fit === 'width' ? width / SLIDE_W : Math.min(width / SLIDE_W, height / SLIDE_H))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  return (
    <div ref={box} className={cn('relative grid place-items-center overflow-hidden', className)} style={fit === 'width' ? { aspectRatio: '16 / 9' } : undefined}>
      <div style={{ width: SLIDE_W * k, height: SLIDE_H * k }} className="relative">
        <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${k})`, transformOrigin: '0 0' }} className="absolute left-0 top-0">
          <ThumbCtx.Provider value={fit === 'width'}>
            <ScaleCtx.Provider value={k}>{k > 0 && children}</ScaleCtx.Provider>
          </ThumbCtx.Provider>
        </div>
      </div>
    </div>
  )
}

function Frame({ children, live, className }: { children: React.ReactNode; live?: boolean; className?: string }) {
  return (
    <div
      data-theme-surface
      className={cn('relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-line bg-card text-ink', live && 'sp-live', className)}
    >
      {children}
    </div>
  )
}

const r = (i: number) => ({ className: 'sp-r', style: { '--i': i } as React.CSSProperties })

function TopBar({ deck, right }: { deck: Deck; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-16 pt-12 text-[15px] font-medium text-muted">
      <span className="flex items-center gap-2">
        {deck.type === 'masterclass' ? (
          <GraduationCap size={17} weight="fill" className="text-ink" aria-hidden />
        ) : (
          <Sparkle size={16} weight="fill" className="text-ink" aria-hidden />
        )}
        <span className="text-ink">{deck.type === 'masterclass' ? 'Masterclass' : 'Spotlight'}</span>
        <span aria-hidden>·</span>
        <span>{deck.title || 'Untitled deck'}</span>
      </span>
      <span className="font-mono tabular-nums">{right}</span>
    </div>
  )
}

export function CoverSlide({ deck, live }: { deck: Deck; live?: boolean }) {
  const { editable, patchDeck } = useContext(EditCtx)
  const crew = people(deck)
  return (
    <Frame live={live}>
      <TopBar deck={deck} right={deck.date} />
      <div className="grid flex-1 grid-cols-[1.25fr_1fr] gap-12 px-16 pb-16 pt-10">
        <div className="flex min-w-0 flex-col">
          <div {...r(0)}>
            <Editable
              field="cover:date"
              value={deck.date}
              onChange={(date) => patchDeck({ date })}
              placeholder="Q3 2026"
              className="text-[15px] font-semibold uppercase tracking-wide text-muted"
            />
          </div>
          <Editable
            as="h1"
            field="cover:title"
            value={deck.title}
            onChange={(title) => patchDeck({ title })}
            placeholder="Deck title"
            fallback="Untitled deck"
            multiline
            className="sp-r mt-5 text-[88px] leading-[0.95] tracking-tight [overflow-wrap:anywhere]"
            style={{ '--i': 1 } as React.CSSProperties}
          />
          {(deck.subtitle || editable) && (
            <Editable
              as="p"
              field="cover:subtitle"
              value={deck.subtitle}
              onChange={(subtitle) => patchDeck({ subtitle })}
              placeholder="A line about this round"
              multiline
              className="sp-r mt-6 max-w-[34ch] text-[26px] leading-snug text-muted"
              style={{ '--i': 2 } as React.CSSProperties}
            />
          )}
          {deck.type === 'masterclass' ? (
            <div {...r(3)} className="sp-r mt-auto flex items-center gap-4">
              <Avatar person={deck.host || '?'} size="lg" className="!size-14 !text-[20px]" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Narrated by</p>
                <Editable field="cover:host" value={deck.host} onChange={(host) => patchDeck({ host })} placeholder="Narrator" fallback="Narrator" className="text-[22px] font-semibold" />
              </div>
              <p className="ms-6 border-s border-line ps-6 text-[18px] text-muted">
                <span className="font-semibold text-ink tabular-nums">{steps(deck).length}</span> steps
                {deck.duration && <> · {deck.duration}</>}
              </p>
            </div>
          ) : (
          <div {...r(3)} className="sp-r mt-auto flex items-center gap-5">
            {crew.length > 0 && <AvatarStack people={crew.map((p) => ({ person: p }))} max={7} size="lg" ring="card" />}
            <p className="text-[18px] text-muted">
              <span className="font-semibold text-ink tabular-nums">{realProjects(deck).length}</span> projects ·{' '}
              <span className="font-semibold text-ink tabular-nums">{crew.length}</span> people
              {(deck.host || editable) && (
                <>
                  {' '}· hosted by{' '}
                  <Editable field="cover:host" value={deck.host} onChange={(host) => patchDeck({ host })} placeholder="Name" className="font-medium text-ink" />
                </>
              )}
            </p>
          </div>
          )}
        </div>
        <div {...r(2)} className="sp-r relative overflow-hidden rounded-[22px] border border-line">
          <Backdrop bg={deck.type === 'masterclass' ? 'm-nebula' : 'm-aurora'} className="h-full w-full">
            <div className="absolute inset-0 grid place-items-center">
              {deck.type === 'masterclass' ? (
                <GraduationCap size={176} weight="fill" className="text-white/90" aria-hidden />
              ) : (
                <Sparkle size={168} weight="fill" className="text-white/90" aria-hidden />
              )}
            </div>
          </Backdrop>
        </div>
      </div>
    </Frame>
  )
}

export function ProjectSlide({ deck, project: p, index, live }: { deck: Deck; project: Project; index: number; live?: boolean }) {
  const { editable, patchProject } = useContext(EditCtx)
  const set = (patch: Partial<Project>) => patchProject(p.id, patch)
  const f = (name: string) => `${p.id}:${name}`
  const metrics = (editable ? p.metrics : p.metrics.filter((m) => m.value.trim() || m.label.trim())).slice(0, 3)
  const setMetric = (id: string, k: 'value' | 'label', v: string) => set({ metrics: p.metrics.map((m) => (m.id === id ? { ...m, [k]: v } : m)) })
  const crew = p.contributors.filter(Boolean)
  const total = deck.projects.length
  const bgHex = findHeroBg(p.bg)?.family === 'solid' || p.bg.startsWith('#') ? (findHeroBg(p.bg)?.css ?? p.bg) : null
  const letterColor = bgHex ? onColor(bgHex) : '#fff'
  const clamp = (c: string) => (editable ? '' : c)

  return (
    <Frame live={live}>
      <TopBar deck={deck} right={`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`} />

      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-12 px-16 pt-8">
        <div className="flex min-w-0 flex-col">
          <div {...r(0)} className="sp-r flex items-center gap-2">
            <Badge tone={STATUS_TONE[p.status]} dot>
              {STATUS_LABEL[p.status]}
            </Badge>
            {p.team && <Badge tone="outline">{p.team}</Badge>}
          </div>
          <Editable
            as="h2"
            field={f('title')}
            value={p.title}
            onChange={(title) => set({ title })}
            placeholder="Project name"
            fallback="Untitled project"
            className={cn('sp-r mt-5 text-[64px] leading-[1] tracking-tight [overflow-wrap:anywhere]', clamp('line-clamp-2'))}
            style={{ '--i': 1 } as React.CSSProperties}
          />
          {(p.tagline || editable) && (
            <Editable
              as="p"
              field={f('tagline')}
              value={p.tagline}
              onChange={(tagline) => set({ tagline })}
              placeholder="What it is, in a sentence"
              className={cn('sp-r mt-4 text-[24px] font-medium leading-snug', clamp('line-clamp-2'))}
              style={{ '--i': 2 } as React.CSSProperties}
            />
          )}
          {(p.summary || editable) && (
            <Editable
              as="p"
              field={f('summary')}
              value={p.summary}
              onChange={(summary) => set({ summary })}
              placeholder="The problem, and what was built"
              multiline
              className={cn('sp-r mt-4 max-w-[52ch] text-[18px] leading-relaxed text-muted', clamp('line-clamp-4'))}
              style={{ '--i': 3 } as React.CSSProperties}
            />
          )}

          <div {...r(4)} className="sp-r mt-auto flex items-center gap-4 pb-2 pt-4">
            {p.author || editable ? (
              <>
                <Avatar person={p.author || '?'} size="lg" className="!size-14 !text-[20px]" />
                <div className="min-w-0">
                  <Editable
                    as="p"
                    field={f('author')}
                    value={p.author}
                    onChange={(author) => set({ author })}
                    placeholder="Author"
                    className="truncate text-[20px] font-semibold"
                  />
                  <p className="truncate text-[16px] text-muted">
                    {editable ? (
                      <>
                        <Editable field={f('role')} value={p.role} onChange={(role) => set({ role })} placeholder="Role" />
                        {' · '}
                        <Editable field={f('team')} value={p.team} onChange={(team) => set({ team })} placeholder="Team" />
                      </>
                    ) : (
                      [p.role, p.team].filter(Boolean).join(' · ') || 'Author'
                    )}
                  </p>
                </div>
                {crew.length > 0 && (
                  <div className="ms-4 flex items-center gap-3 border-s border-line ps-5">
                    <AvatarStack people={crew.map((c) => ({ person: c }))} max={4} size="md" ring="card" />
                    <p className="text-[15px] text-muted">
                      with {crew.length === 1 ? crew[0].split(' ')[0] : `${crew.length} others`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[18px] text-muted">Add an author</p>
            )}
          </div>
        </div>

        <div {...r(2)} className="sp-r relative min-h-0 overflow-hidden rounded-[22px] border border-line">
          {p.image ? (
            <HeroPanel bg={p.bg} src={p.image} alt={p.title} padding={28} className="h-full" />
          ) : (
            <Backdrop bg={p.bg} className="h-full w-full">
              <div className="absolute inset-0 grid place-items-center">
                <span className="font-pixel text-[220px] leading-none" style={{ color: letterColor, opacity: 0.92 }}>
                  {(p.title.trim()[0] ?? '?').toUpperCase()}
                </span>
              </div>
            </Backdrop>
          )}
          {p.link && (
            <span className="absolute bottom-4 start-4 inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full bg-shade/70 px-3 py-1.5 text-[13px] font-medium text-white">
              <span className="truncate">{p.link.replace(/^https?:\/\//, '')}</span>
              <ArrowUpRight size={13} weight="bold" aria-hidden />
            </span>
          )}
        </div>
      </div>

      <div {...r(5)} className="sp-r mx-16 mb-12 mt-8 grid grid-cols-[1fr_auto] items-end gap-10 border-t border-line pt-6">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Impact</p>
          <Editable
            as="p"
            field={f('impact')}
            value={p.impact}
            onChange={(impact) => set({ impact })}
            placeholder="What changed because of this?"
            fallback={<span className="text-muted">What changed because of this?</span>}
            multiline
            className={cn('mt-2 text-[22px] font-medium leading-snug', clamp('line-clamp-2'))}
          />
        </div>
        {metrics.length > 0 && (
          <div className="flex">
            {metrics.map((m, i) => (
              <div key={m.id} className={cn('min-w-[150px] px-7', i > 0 && 'border-s border-line', i === metrics.length - 1 && 'pe-0')}>
                <Editable
                  as="p"
                  field={f(`m:${m.id}:value`)}
                  value={m.value}
                  onChange={(v) => setMetric(m.id, 'value', v)}
                  placeholder="+0%"
                  fallback="·"
                  className="font-pixel text-[52px] leading-none tracking-tight tabular-nums"
                />
                <Editable
                  as="p"
                  field={f(`m:${m.id}:label`)}
                  value={m.label}
                  onChange={(v) => setMetric(m.id, 'label', v)}
                  placeholder="What it measures"
                  className="mt-2 max-w-[18ch] text-[14px] text-muted"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  )
}

/** Thumbnails draw a stand-in instead of loading live prototypes. */
export const ThumbCtx = createContext(false)

const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')
const href = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`)

/** A prototype at its real viewport, zoomed to fit the tile, like a device on a desk. */
function FitFrame({ item }: { item: ShowItem }) {
  const thumb = useContext(ThumbCtx)
  const box = useRef<HTMLDivElement>(null)
  const [sz, setSz] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSz({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const phone = item.frame === 'phone'
  const vw = phone ? 390 : 1440
  const vh = phone ? 844 : 900
  const bar = phone ? 0 : 30
  const k = sz ? Math.min(sz.w / vw, (sz.h - bar) / vh) : 0
  const live = !!item.url && !thumb

  return (
    <div ref={box} className="relative grid min-h-0 flex-1 place-items-center">
      {k > 0 && (
        <div
          className={cn('relative flex flex-col overflow-hidden border border-line-strong bg-white', phone ? '' : 'rounded-[14px]')}
          style={{ width: vw * k, height: vh * k + bar, ...(phone ? { borderRadius: 54 * k } : null) }}
        >
          {!phone && (
            <div className="flex h-[30px] flex-none items-center gap-1.5 border-b border-line bg-raised px-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="u-circle size-2.5 rounded-full bg-wash-5" />
              ))}
              <span className="ms-3 truncate rounded-md bg-wash-2 px-2 py-0.5 font-mono text-[11px] text-muted">{item.url ? host(item.url) : 'prototype url'}</span>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {live ? (
              <iframe
                src={href(item.url)}
                title={item.title || 'Prototype'}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                allow="fullscreen; clipboard-write"
                referrerPolicy="no-referrer"
                className="absolute left-0 top-0 block border-0 bg-white"
                style={{ width: vw, height: vh, transform: `scale(${k})`, transformOrigin: '0 0' }}
              />
            ) : (
              <Backdrop bg={item.bg} className="h-full w-full">
                <div className="absolute inset-0 grid place-items-center text-white/90">
                  {phone ? <DeviceMobile size={56} aria-hidden /> : <Browser size={56} aria-hidden />}
                </div>
              </Backdrop>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ShowTile({ item, set }: { item: ShowItem; set: (p: Partial<ShowItem>) => void }) {
  const f = (k: string) => `${item.id}:${k}`
  const caption = (
    <div className="flex min-w-0 items-center gap-3">
      {item.type === 'project' && item.author && <Avatar person={item.author} size="md" />}
      <div className="min-w-0 flex-1">
        <Editable
          as="p"
          field={f('title')}
          value={item.title}
          onChange={(title) => set({ title })}
          placeholder={item.type === 'prototype' ? 'Prototype name' : 'Project name'}
          fallback={item.type === 'prototype' ? 'Prototype' : 'Project'}
          className="truncate text-[18px] font-semibold leading-tight"
        />
        <p className="mt-0.5 truncate text-[14px] text-muted">
          {item.type === 'project' ? (
            <Editable field={f('author')} value={item.author} onChange={(author) => set({ author })} placeholder="Author" fallback={item.url ? host(item.url) : ''} />
          ) : item.url ? (
            host(item.url)
          ) : (
            'Add a URL in the panel'
          )}
        </p>
      </div>
      {item.url && <ArrowUpRight size={16} weight="bold" className="flex-none text-muted" aria-hidden />}
    </div>
  )

  if (item.type === 'prototype')
    return (
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <FitFrame item={item} />
        {caption}
      </div>
    )

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4 rounded-[22px] border border-line p-3 pb-4">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-line">
        {item.image ? (
          <HeroPanel bg={item.bg} src={item.image} alt={item.title} padding={18} className="h-full" />
        ) : (
          <Backdrop bg={item.bg} className="h-full w-full">
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-pixel text-[120px] leading-none text-white/90">{(item.title.trim()[0] ?? '?').toUpperCase()}</span>
            </div>
          </Backdrop>
        )}
      </div>
      <div className="px-1">{caption}</div>
    </div>
  )
}

export function BoardSlide({ deck, board: b, index, live }: { deck: Deck; board: Project; index: number; live?: boolean }) {
  const { editable, patchProject } = useContext(EditCtx)
  const set = (patch: Partial<Project>) => patchProject(b.id, patch)
  const items = (b.items ?? []).slice(0, 6)
  const setItem = (id: string, p: Partial<ShowItem>) => set({ items: (b.items ?? []).map((i) => (i.id === id ? { ...i, ...p } : i)) })
  const n = items.length
  const cols = n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : 3
  const total = deck.projects.length
  const hasHead = b.title || b.tagline || editable

  return (
    <Frame live={live}>
      <TopBar deck={deck} right={`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`} />
      <div className="flex min-h-0 flex-1 flex-col px-16 pb-12 pt-6">
        {hasHead && (
          <div {...r(0)} className="sp-r mb-6 flex items-baseline gap-5">
            <Editable
              as="h2"
              field={`${b.id}:title`}
              value={b.title}
              onChange={(title) => set({ title })}
              placeholder="Heading (optional)"
              className="text-[40px] leading-none tracking-tight"
            />
            <Editable
              as="p"
              field={`${b.id}:tagline`}
              value={b.tagline}
              onChange={(tagline) => set({ tagline })}
              placeholder="A line of context (optional)"
              className="min-w-0 truncate text-[18px] text-muted"
            />
          </div>
        )}
        {n === 0 ? (
          <div className="grid flex-1 place-items-center rounded-[22px] border border-dashed border-line-strong text-[18px] text-muted">
            Add prototypes or projects from the panel
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
            {items.map((it, i) => (
              <div key={it.id} {...r(1 + i)} className="sp-r flex min-h-0 min-w-0">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col [&>*]:flex-1">
                  <ShowTile item={it} set={(p) => setItem(it.id, p)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  )
}

const STORY = [
  { key: 'process', label: 'Process', icon: Path, hint: 'How you got there' },
  { key: 'outcome', label: 'Outcome', icon: Target, hint: 'What it changed' },
  { key: 'challenges', label: 'Challenges', icon: Mountains, hint: 'What got in the way' },
] as const

/** The story behind a project: process, outcome, challenges, and a personal note from the author. */
export function DetailSlide({ deck, project: p, live }: { deck: Deck; project: Project; live?: boolean }) {
  const { editable, patchProject } = useContext(EditCtx)
  const set = (patch: Partial<Project>) => patchProject(p.id, patch)
  const shown = STORY.filter((s) => editable || p[s.key])
  return (
    <Frame live={live}>
      <TopBar deck={deck} right="Behind the project" />
      <div className="flex min-h-0 flex-1 flex-col px-16 pb-12 pt-6">
        <div {...r(0)} className="sp-r flex items-end justify-between gap-8">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold uppercase tracking-wide text-muted">Behind</p>
            <h2 className="mt-2 truncate text-[56px] leading-none tracking-tight">{p.title || 'Untitled project'}</h2>
          </div>
          {p.author && (
            <div className="flex flex-none items-center gap-3">
              <Avatar person={p.author} size="lg" />
              <div>
                <p className="text-[17px] font-semibold">{p.author}</p>
                <p className="text-[14px] text-muted">{[p.role, p.team].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 grid min-h-0 flex-1 gap-6" style={{ gridTemplateColumns: `repeat(${Math.max(shown.length, 1)}, minmax(0, 1fr))` }}>
          {shown.map((s, i) => (
            <div key={s.key} {...r(1 + i)} className="sp-r flex min-h-0 flex-col rounded-[22px] border border-line p-6">
              <p className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wide text-muted">
                <s.icon size={18} aria-hidden /> {s.label}
              </p>
              <Editable
                as="p"
                field={`${p.id}:${s.key}`}
                value={p[s.key] ?? ''}
                onChange={(v) => set({ [s.key]: v })}
                placeholder={s.hint}
                multiline
                className={cn('mt-4 text-[19px] leading-relaxed', !editable && 'line-clamp-[9]')}
              />
            </div>
          ))}
        </div>
        {(p.personal || editable) && (
          <div {...r(5)} className="sp-r mt-6 flex items-start gap-4 border-t border-line pt-6">
            <Quotes size={30} weight="fill" className="flex-none text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <Editable
                as="p"
                field={`${p.id}:personal`}
                value={p.personal ?? ''}
                onChange={(personal) => set({ personal })}
                placeholder="A personal note: what you learned, who helped, what you'd do again"
                multiline
                className={cn('text-[22px] font-medium leading-snug', !editable && 'line-clamp-2')}
              />
              {p.author && <p className="mt-2 text-[15px] text-muted">{p.author}</p>}
            </div>
          </div>
        )}
      </div>
    </Frame>
  )
}

/** One step of a masterclass: do this, type this, watch for this. */
export function StepSlide({ deck, project: p, live }: { deck: Deck; project: Project; live?: boolean }) {
  const { editable, patchProject } = useContext(EditCtx)
  const set = (patch: Partial<Project>) => patchProject(p.id, patch)
  const all = steps(deck)
  const n = all.findIndex((s) => s.id === p.id) + 1
  const demo: ShowItem = { id: p.id, type: 'prototype', title: p.title, url: p.link ?? '', author: '', frame: p.frame ?? 'browser', bg: p.bg }
  return (
    <Frame live={live}>
      <TopBar deck={deck} right={`Step ${String(n).padStart(2, '0')} / ${String(all.length).padStart(2, '0')}`} />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-12 px-16 pb-12 pt-8">
        <div className="flex min-w-0 flex-col">
          <p {...r(0)} className="sp-r font-pixel text-[64px] leading-none text-muted tabular-nums">
            {String(n).padStart(2, '0')}
          </p>
          <Editable
            as="h2"
            field={`${p.id}:title`}
            value={p.title}
            onChange={(title) => set({ title })}
            placeholder="What this step is"
            fallback="Untitled step"
            multiline
            className={cn('sp-r mt-4 text-[44px] leading-[1.05] tracking-tight', !editable && 'line-clamp-2')}
            style={{ '--i': 1 } as React.CSSProperties}
          />
          {(p.summary || editable) && (
            <Editable
              as="p"
              field={`${p.id}:summary`}
              value={p.summary}
              onChange={(summary) => set({ summary })}
              placeholder="Explain the step in a few sentences"
              multiline
              className={cn('sp-r mt-4 text-[18px] leading-relaxed text-muted', !editable && 'line-clamp-4')}
              style={{ '--i': 2 } as React.CSSProperties}
            />
          )}
          {(p.snippet || editable) && (
            <div {...r(3)} className="sp-r mt-6 rounded-2xl border border-line bg-wash-1 px-5 py-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                <TerminalWindow size={16} aria-hidden /> Try this
              </p>
              <Editable
                as="p"
                field={`${p.id}:snippet`}
                value={p.snippet ?? ''}
                onChange={(snippet) => set({ snippet })}
                placeholder="/animate the moment you want to bring to life"
                multiline
                className="mt-2 font-mono text-[18px] leading-snug [overflow-wrap:anywhere]"
              />
            </div>
          )}
          {(p.tip || editable) && (
            <div {...r(4)} className="sp-r mt-4 flex items-start gap-3">
              <Lightbulb size={22} weight="fill" className="mt-0.5 flex-none text-draft" aria-hidden />
              <Editable
                as="p"
                field={`${p.id}:tip`}
                value={p.tip ?? ''}
                onChange={(tip) => set({ tip })}
                placeholder="A tip, or a mistake to avoid"
                multiline
                className="min-w-0 flex-1 text-[16px] leading-snug"
              />
            </div>
          )}
          {deck.host && (
            <div {...r(5)} className="sp-r mt-auto flex items-center gap-3 pt-4">
              <Avatar person={deck.host} size="md" />
              <p className="text-[15px] text-muted">
                Narrated by <span className="font-medium text-ink">{deck.host}</span>
              </p>
            </div>
          )}
        </div>
        <div {...r(2)} className="sp-r flex min-h-0 flex-col">
          {p.link ? (
            <FitFrame item={demo} />
          ) : p.image ? (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-line">
              <HeroPanel bg={p.bg} src={p.image} alt={p.title} padding={24} className="h-full" />
            </div>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-line">
              <Backdrop bg={p.bg} className="h-full w-full">
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-pixel text-[200px] leading-none text-white/90 tabular-nums">{n}</span>
                </div>
              </Backdrop>
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

function MasterclassEnd({ deck, live }: { deck: Deck; live?: boolean }) {
  const all = steps(deck)
  return (
    <Frame live={live}>
      <TopBar deck={deck} right="Fin" />
      <div className="grid flex-1 grid-cols-[1fr_1fr] gap-12 px-16 pb-14 pt-10">
        <div className="flex flex-col">
          <h2 {...r(0)} className="sp-r text-[80px] leading-none tracking-tight">
            Your turn.
          </h2>
          <p {...r(1)} className="sp-r mt-5 max-w-[30ch] text-[24px] leading-snug text-muted">
            Try it on something you're working on this week. Questions go in the chat.
          </p>
          {deck.host && (
            <div {...r(2)} className="sp-r mt-auto flex items-center gap-4">
              <Avatar person={deck.host} size="lg" className="!size-14 !text-[20px]" />
              <div>
                <p className="text-[19px] font-semibold">{deck.host}</p>
                <p className="text-[15px] text-muted">Narrator{deck.duration ? ` · ${deck.duration}` : ''}</p>
              </div>
            </div>
          )}
        </div>
        <ol className="flex flex-col justify-end gap-0">
          {all.map((s, i) => (
            <li key={s.id} {...r(2 + Math.min(i, 8))} className="sp-r flex items-baseline gap-4 border-t border-line py-4">
              <span className="font-pixel text-[28px] leading-none text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate text-[20px] font-medium">{s.title || 'Untitled step'}</span>
            </li>
          ))}
        </ol>
      </div>
    </Frame>
  )
}

export function EndSlide({ deck, live }: { deck: Deck; live?: boolean }) {
  if (deck.type === 'masterclass') return <MasterclassEnd deck={deck} live={live} />
  const list = realProjects(deck).slice(0, 12)
  const kudos = (id: string) => (deck.chat ?? []).filter((m) => m.kudos?.project === id).length
  return (
    <Frame live={live}>
      <TopBar deck={deck} right="Fin" />
      <div className="flex flex-1 flex-col px-16 pb-14 pt-10">
        <h2 {...r(0)} className="sp-r text-[72px] leading-none tracking-tight">
          That's the spotlight.
        </h2>
        <p {...r(1)} className="sp-r mt-4 text-[22px] text-muted">
          {list.length} projects, and the people behind them.
        </p>
        <div className="mt-auto grid grid-cols-3 gap-x-10 gap-y-5">
          {list.map((p, i) => (
            <div key={p.id} {...r(2 + Math.min(i, 8))} className="sp-r flex min-w-0 items-center gap-3 border-t border-line pt-4">
              <Avatar person={p.author || p.title} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold">{p.title || 'Untitled project'}</p>
                <p className="truncate text-[14px] text-muted">{p.author || 'No author yet'}</p>
              </div>
              {kudos(p.id) > 0 && (
                <span className="ms-auto flex flex-none items-center gap-1 rounded-full bg-wash-2 px-2.5 py-1 text-[14px] font-semibold tabular-nums">
                  <HandsClapping size={15} weight="fill" aria-hidden /> {kudos(p.id)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function SlideView({ deck, slide, live }: { deck: Deck; slide: SlideRef; live?: boolean }) {
  if (slide.kind === 'cover') return <CoverSlide deck={deck} live={live} />
  if (slide.kind === 'end') return <EndSlide deck={deck} live={live} />
  const i = deck.projects.findIndex((p) => p.id === slide.id)
  if (i < 0) return <CoverSlide deck={deck} live={live} />
  const p = deck.projects[i]
  if (slide.kind === 'detail') return <DetailSlide deck={deck} project={p} live={live} />
  if (isStep(p)) return <StepSlide deck={deck} project={p} live={live} />
  if (isBoard(p)) return <BoardSlide deck={deck} board={p} index={i} live={live} />
  return <ProjectSlide deck={deck} project={p} index={i} live={live} />
}

export function slidesOf(deck: Deck): SlideRef[] {
  const out: SlideRef[] = [{ kind: 'cover' }]
  for (const p of deck.projects) {
    out.push({ kind: 'project', id: p.id })
    if (hasStory(p)) out.push({ kind: 'detail', id: p.id })
  }
  out.push({ kind: 'end' })
  return out
}

export const slideKey = (s: SlideRef) => (s.kind === 'project' ? s.id : s.kind === 'detail' ? `${s.id}:story` : s.kind)
