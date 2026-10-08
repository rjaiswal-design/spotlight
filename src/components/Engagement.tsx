import { useState } from 'react'
import { Avatar, cn, timeAgo } from 'lightweight-ui'
import { ChatCircleText, HandsClapping, Smiley } from 'lightweight-ui/icons'
import type { Deck } from '../lib/deck'
import { deckEngagement, reactionOrder, reactors, slideEngagement, type Engagement } from '../lib/engagement'
import { StickerTile } from './Chat'
import { slideKey, type SlideRef } from './Slides'

/** Who sent a reaction: faces, names and how many times, with older unnamed ones summed up. */
export function ReactorsCard({ deck, slide, emoji, className, style }: { deck: Deck; slide: string | null; emoji: string; className?: string; style?: React.CSSProperties }) {
  const r = reactors(deck, slide, emoji)
  return (
    <div role="tooltip" style={style} className={cn('sp-tip pointer-events-none w-56 rounded-xl border border-line bg-card p-3 text-start shadow-menu', className)}>
      <p className="flex items-center justify-between text-label font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="text-[16px] leading-none">{emoji}</span> {r.total ? `${r.total} ${r.total === 1 ? 'reaction' : 'reactions'}` : 'No reactions yet'}
        </span>
        {slide === null && <span className="font-normal text-caption text-muted">whole session</span>}
      </p>
      {r.people.length > 0 && (
        <ul className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-hidden">
          {r.people.slice(0, 8).map((p) => (
            <li key={p.name} className="flex items-center gap-2 text-label">
              <Avatar person={p.name} size="xs" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.n > 1 && <span className="font-mono text-caption text-muted tabular-nums">×{p.n}</span>}
            </li>
          ))}
          {r.people.length > 8 && <li className="text-caption text-muted">and {r.people.length - 8} more</li>}
        </ul>
      )}
      {r.earlier > 0 && (
        <p className="mt-2 border-t border-line pt-2 text-caption text-muted">
          {r.earlier} earlier, before names were saved
        </p>
      )}
      {!r.total && <p className="mt-1 text-caption text-muted">Be the first.</p>}
    </div>
  )
}

/** Reactions as a strip of equal cells, emoji over count: the same geometry as the present-mode dock. Hover one to see who. */
function ReactionCells({ e, deck, slide }: { e: Engagement; deck: Deck; slide: string | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const order = reactionOrder(e.reactions).slice(0, 6)
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <div className="grid grid-cols-6 divide-x divide-line overflow-hidden rounded-xl border border-line">
        {order.map((emoji, i) => (
          <button
            key={emoji}
            type="button"
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${emoji}: ${e.reactions[emoji] ?? 0}. Show who reacted`}
            className="flex cursor-default flex-col items-center gap-1 py-2 transition-[background-color] duration-150 [@media(hover:hover)]:hover:bg-wash-1"
          >
            <span className="text-[18px] leading-none">{emoji}</span>
            <span className={cn('font-mono text-[11px] leading-none tabular-nums', e.reactions[emoji] ? 'text-ink' : 'text-muted/60')}>{e.reactions[emoji] ?? 0}</span>
          </button>
        ))}
      </div>
      {hover !== null && (
        <ReactorsCard
          deck={deck}
          slide={slide}
          emoji={order[hover]}
          className="absolute end-0 top-full z-20 mt-2"
        />
      )}
    </div>
  )
}

function Totals({ e }: { e: Engagement }) {
  const cells = [
    { icon: Smiley, label: 'Reactions', n: e.reactionTotal },
    { icon: HandsClapping, label: 'Appreciation', n: e.kudos.length },
    { icon: ChatCircleText, label: 'Comments', n: e.comments.length },
  ]
  return (
    <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line">
      {cells.map((c) => (
        <div key={c.label} className="px-3 py-2.5">
          <p className="flex items-center gap-1 text-caption text-muted">
            <c.icon size={12} weight="fill" aria-hidden /> {c.label}
          </p>
          <p className="mt-0.5 font-mono text-title font-semibold leading-tight tabular-nums">{c.n}</p>
        </div>
      ))}
    </div>
  )
}

/** What people sent on the slide you have open. */
export function SlideEngagement({ deck, slide }: { deck: Deck; slide: SlideRef }) {
  const e = slideEngagement(deck, slideKey(slide))
  const empty = !e.reactionTotal && !e.kudos.length && !e.comments.length
  return (
    <section className="border-b border-line px-5 py-5">
      <h3 className="mb-3 font-sans text-label font-semibold uppercase tracking-wide text-muted">Engagement · this slide</h3>
      {empty ? (
        <p className="text-label text-muted">Nothing yet. Reactions, appreciation and comments sent in present mode show up here, live.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Totals e={e} />
          <ReactionCells e={e} deck={deck} slide={slideKey(slide)} />
          {e.kudos.length > 0 && (
            <p className="text-label text-muted">
              <span className="font-medium text-ink">{[...new Set(e.kudos.map((m) => m.from.split(' ')[0]))].join(', ')}</span> appreciated{' '}
              {e.kudos[0].kudos!.author.split(' ')[0]}
            </p>
          )}
          {e.comments.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {e.comments
                .slice(-8)
                .reverse()
                .map((m) => (
                  <li key={m.id} className="flex gap-2.5 px-3 py-2.5">
                    <Avatar person={m.from} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-1.5 text-caption">
                        <span className="font-semibold">{m.from}</span>
                        <span className="text-muted">{timeAgo(m.at)}</span>
                      </p>
                      {m.text && <p className="text-label">{m.text}</p>}
                      {m.sticker && <StickerTile id={m.sticker} size="sm" />}
                      {m.image && <img src={m.image} alt="" className="mt-1 max-h-24 rounded-lg border border-line" />}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/** The whole session, slide by slide. Shown on the cover. */
export function SessionEngagement({ deck, slides, onPick }: { deck: Deck; slides: SlideRef[]; onPick: (s: SlideRef) => void }) {
  const total = deckEngagement(deck)
  const rows = slides.map((s, n) => ({ s, n, e: slideEngagement(deck, slideKey(s)) }))
  const max = Math.max(1, ...rows.map((r) => r.e.reactionTotal + r.e.kudos.length))
  const title = (s: SlideRef) => {
    if (s.kind === 'cover') return 'Cover'
    if (s.kind === 'end') return 'Closing'
    const p = deck.projects.find((x) => x.id === s.id)
    const t = p?.title || (p?.kind === 'board' ? 'Showcase' : 'Untitled')
    return s.kind === 'detail' ? `Behind ${t}` : t
  }
  return (
    <section className="border-b border-line px-5 py-5">
      <h3 className="mb-3 font-sans text-label font-semibold uppercase tracking-wide text-muted">Engagement · whole session</h3>
      <div className="flex flex-col gap-3">
        <Totals e={total} />
        <ReactionCells e={total} deck={deck} slide={null} />
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[1fr_44px_44px_44px] border-b border-line bg-wash-1 px-3 py-1.5 text-caption text-muted">
            <span>Slide</span>
            <Smiley size={13} weight="fill" className="justify-self-end" aria-label="Reactions" />
            <HandsClapping size={13} weight="fill" className="justify-self-end" aria-label="Appreciation" />
            <ChatCircleText size={13} weight="fill" className="justify-self-end" aria-label="Comments" />
          </div>
          {rows.map(({ s, n, e }) => (
            <button
              key={slideKey(s)}
              type="button"
              onClick={() => onPick(s)}
              className="relative grid w-full grid-cols-[1fr_44px_44px_44px] items-center px-3 py-2 text-start text-label transition-[background-color] duration-150 [@media(hover:hover)]:hover:bg-wash-1"
            >
              {/* a hairline bar under each row: how much it landed, relative to the best slide */}
              <span className="absolute bottom-0 start-0 h-[2px] bg-ink/70" style={{ width: `${((e.reactionTotal + e.kudos.length) / max) * 100}%` }} aria-hidden />
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 flex-none font-mono text-caption text-muted tabular-nums">{n + 1}</span>
                <span className="truncate">{title(s)}</span>
              </span>
              {[e.reactionTotal, e.kudos.length, e.comments.length].map((v, k) => (
                <span key={k} className={cn('text-end font-mono tabular-nums', v ? 'text-ink' : 'text-muted/50')}>
                  {v}
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
