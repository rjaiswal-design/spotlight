import { useEffect, useMemo, useState } from 'react'
import { AppHeader, Avatar, AvatarStack, Badge, Button, Card, Logo, StatTile, UnderlineNav, cn } from 'lightweight-ui'
import { ChatCircleText, GraduationCap, HandsClapping, Plus, Smiley, Sparkle } from 'lightweight-ui/icons'
import { HeaderActions, LiveBanner } from '../components/Chrome'
import { CoverSlide, Scaled } from '../components/Slides'
import { addDays, blankDeck, mondayOf, people, realProjects, steps, weekLabel, weekNumber, weekRange, type Deck } from '../lib/deck'
import { deckEngagement } from '../lib/engagement'
import type { Peer } from '../lib/ops'
import type { LibraryRoom } from '../lib/room'

export type Tab = 'weekly' | 'masterclass'

const appreciation = (d: Deck) => deckEngagement(d).kudos.length
const reactionsOf = (d: Deck) => deckEngagement(d).reactionTotal

export function Home({ lib, tab, onRename }: { lib: LibraryRoom; tab: Tab; onRename: () => void }) {
  const decks = lib.library.decks
  useEffect(() => lib.setPresence({ deck: null, slide: '', cursor: null, editing: null, presenting: false }), [lib.setPresence])

  const where = (p: Peer) => {
    const d = decks.find((x) => x.id === p.presence.deck)
    if (!d) return 'on the home page'
    return `${p.presence.presenting ? 'presenting' : 'in'} ${d.type === 'masterclass' ? d.title : d.date}`
  }
  const liveIn = (id: string) => lib.peers.find((p) => p.presence.deck === id && p.presence.presenting)
  const hereIn = (id: string) => lib.peers.filter((p) => p.presence.deck === id)

  function create(type: Deck['type']) {
    let deck: Deck
    if (type === 'spotlight') {
      // the first week from this one on that doesn't have a session yet
      const taken = new Set(decks.filter((d) => d.type === 'spotlight').map((d) => d.week))
      let w = mondayOf()
      while (taken.has(w)) w = addDays(w, 7)
      deck = blankDeck('spotlight', w)
      const prev = decks.filter((d) => d.type === 'spotlight').sort((a, b) => (b.week ?? '').localeCompare(a.week ?? ''))[0]
      if (prev) deck = { ...deck, title: prev.title, host: prev.host }
    } else deck = blankDeck('masterclass')
    lib.createDeck(deck)
    location.hash = `#/d/${deck.id}`
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        brand={<Logo letter="S" name="Spotlight" href="#/" />}
        contained={false}
        nav={
          <UnderlineNav
            label="Sections"
            value={tab}
            items={[
              { value: 'weekly', label: 'Weekly spotlight', href: '#/', icon: <Sparkle size={15} weight="fill" /> },
              { value: 'masterclass', label: 'Masterclass', href: '#/masterclass', icon: <GraduationCap size={16} weight="fill" /> },
            ]}
          />
        }
        actions={<HeaderActions lib={lib} peers={lib.peers} selfWhere="on the home page" where={where} onRename={onRename} />}
      />
      <main className="sp-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="u-view mx-auto max-w-[1180px] px-6 pb-24 pt-10">
          {tab === 'weekly' ? (
            <Weekly decks={decks} onCreate={() => create('spotlight')} liveIn={liveIn} hereIn={hereIn} />
          ) : (
            <Masterclasses decks={decks} onCreate={() => create('masterclass')} liveIn={liveIn} hereIn={hereIn} />
          )}
        </div>
      </main>
      <LiveBanner lib={lib} />
    </div>
  )
}

type ListProps = { decks: Deck[]; onCreate: () => void; liveIn: (id: string) => Peer | undefined; hereIn: (id: string) => Peer[] }

function PageHead({ title, sub, action }: { title: string; sub: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-display leading-none tracking-tight">{title}</h1>
        <p className="mt-3 max-w-[60ch] text-body text-muted">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function LiveTag({ peer }: { peer?: Peer }) {
  if (!peer) return null
  return (
    <Badge tone="danger" dot>
      Live · {peer.name.split(' ')[0]}
    </Badge>
  )
}

function Thumb({ deck }: { deck: Deck }) {
  return (
    <Scaled fit="width" className="pointer-events-none overflow-hidden rounded-[12px]">
      <CoverSlide deck={deck} />
    </Scaled>
  )
}

/* ------------------------------------------------------------------ weekly */

function Weekly({ decks, onCreate, liveIn, hereIn }: ListProps) {
  const weeks = decks.filter((d) => d.type === 'spotlight').sort((a, b) => (b.week ?? '').localeCompare(a.week ?? ''))
  const thisWeek = mondayOf()
  const allPeople = new Set(weeks.flatMap((d) => people(d).map((p) => p.toLowerCase())))
  const shown = weeks.reduce((n, d) => n + realProjects(d).length, 0)
  const held = weeks.filter((d) => (d.week ?? '') <= thisWeek).length

  return (
    <>
      <PageHead
        title="Weekly spotlight"
        sub="One session a week. Who shipped what, and what it moved. Each week gets its own deck."
        action={
          <Button leadingIcon={<Plus size={15} />} onClick={onCreate}>
            New week
          </Button>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Sessions held" value={held} sub={`${weeks.length - held} coming up`} />
        <StatTile label="Projects shown" value={shown} sub={held ? `${(shown / Math.max(held, 1)).toFixed(1)} a week` : 'None yet'} />
        <StatTile label="People featured" value={allPeople.size} sub="Authors and contributors" />
        <StatTile
          label="Appreciation"
          value={weeks.reduce((n, d) => n + appreciation(d), 0)}
          sub={`${weeks.reduce((n, d) => n + reactionsOf(d), 0)} reactions · ${weeks.reduce((n, d) => n + deckEngagement(d).comments.length, 0)} comments`}
        />
      </div>

      <WeeklyChart weeks={weeks} />

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-sans text-title font-semibold">All weeks</h2>
        <p className="text-label text-muted">{weeks.length} sessions</p>
      </div>
      {weeks.length === 0 ? (
        <Card variant="dashed" padding="lg" className="mt-4 text-center">
          <p className="text-ui font-medium">No weeks yet</p>
          <p className="mt-1 text-label text-muted">Start this week's session and add the projects people want to show.</p>
          <Button className="mt-4" size="sm" onClick={onCreate}>
            Start this week
          </Button>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {weeks.map((d) => {
            const w = d.week ?? thisWeek
            const status = w === thisWeek ? 'This week' : w > thisWeek ? 'Upcoming' : 'Done'
            const crew = people(d)
            const here = hereIn(d.id)
            return (
              <a
                key={d.id}
                href={`#/d/${d.id}`}
                className={cn(
                  'group grid grid-cols-[180px_1fr_auto] items-center gap-6 rounded-[20px] border bg-card p-3 pe-6 transition-[border-color] duration-150',
                  w === thisWeek ? 'border-line-strong' : 'border-line [@media(hover:hover)]:hover:border-line-strong',
                )}
              >
                <Thumb deck={d} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-pixel text-title leading-none">{weekLabel(w)}</span>
                    <span className="text-label text-muted">{weekRange(w)}</span>
                    <Badge tone={status === 'This week' ? 'open' : status === 'Upcoming' ? 'draft' : 'neutral'}>{status}</Badge>
                    <LiveTag peer={liveIn(d.id)} />
                  </div>
                  <p className="mt-2 truncate text-body font-medium">{d.title || 'Untitled'}</p>
                  <p className="mt-0.5 truncate text-label text-muted">
                    {realProjects(d)
                      .map((p) => p.title)
                      .filter(Boolean)
                      .join(' · ') || 'No projects yet'}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  {crew.length > 0 && <AvatarStack people={crew.map((p) => ({ person: p }))} max={4} size="sm" ring="card" />}
                  <Fact label="projects" value={realProjects(d).length} />
                  <Fact label={<Smiley size={14} weight="fill" aria-label="reactions" />} value={reactionsOf(d)} />
                  <Fact label={<HandsClapping size={14} weight="fill" aria-label="appreciation" />} value={appreciation(d)} />
                  <Fact label={<ChatCircleText size={14} aria-label="comments" />} value={(d.chat ?? []).filter((m) => !m.kudos).length} />
                  {here.length > 0 && <span className="text-label text-muted">{here.length} here</span>}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}

function Fact({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-label text-muted">
      <span className="font-semibold text-ink tabular-nums">{value}</span>
      {label}
    </span>
  )
}

/** Projects shown per week over the last 12 weeks, with this week marked. */
function WeeklyChart({ weeks }: { weeks: Deck[] }) {
  const thisWeek = mondayOf()
  const slots = useMemo(() => Array.from({ length: 12 }, (_, i) => addDays(thisWeek, (i - 10) * 7)), [thisWeek])
  const data = slots.map((w) => {
    const d = weeks.find((x) => x.week === w)
    return { w, deck: d, n: d ? realProjects(d).length : 0, love: d ? appreciation(d) : 0 }
  })
  const max = Math.max(4, Math.ceil(Math.max(...data.map((x) => x.n)) / 2) * 2)
  const [hover, setHover] = useState<number | null>(null)
  const H = 140

  return (
    <Card padding="none" className="mt-3 px-6 pb-4 pt-5">
      <div className="flex items-baseline justify-between">
        <p className="text-ui font-semibold">Projects per week</p>
        <p className="text-label text-muted">The last 10 weeks, this week and next</p>
      </div>
      <div className="relative mt-5" style={{ height: H + 28 }} onPointerLeave={() => setHover(null)}>
        {/* recessive gridlines */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line" style={{ top: H - f * H }} aria-hidden>
            <span className="absolute -top-2 end-full me-2 text-caption text-muted tabular-nums">{Math.round(f * max)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 top-0 grid gap-[2px]" style={{ height: H, gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((x, i) => (
            <a
              key={x.w}
              href={x.deck ? `#/d/${x.deck.id}` : undefined}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${weekLabel(x.w)}: ${x.deck ? `${x.n} projects` : 'no session'}`}
              className="relative flex h-full items-end justify-center px-[18%]"
            >
              {x.deck ? (
                <span
                  className={cn('block w-full rounded-t-[4px] transition-[opacity] duration-150', x.w === thisWeek ? 'bg-ink' : 'bg-ink/45', hover !== null && hover !== i && 'opacity-60')}
                  style={{ height: Math.max(3, (x.n / max) * H) }}
                />
              ) : (
                <span className="block h-[3px] w-full rounded-full bg-wash-4" />
              )}
            </a>
          ))}
        </div>
        <div className="absolute inset-x-0 grid" style={{ top: H + 8, gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((x) => (
            <span key={x.w} className={cn('text-center text-caption tabular-nums', x.w === thisWeek ? 'font-semibold text-ink' : 'text-muted')}>
              W{weekNumber(x.w)}
            </span>
          ))}
        </div>
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-line bg-card px-3 py-2 text-label shadow-tooltip"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%`, bottom: 28 + Math.max(3, (data[hover].n / max) * H) + 10 }}
          >
            <p className="font-semibold">
              {weekLabel(data[hover].w)} <span className="font-normal text-muted">· {weekRange(data[hover].w)}</span>
            </p>
            <p className="mt-0.5 text-muted">
              {data[hover].deck ? `${data[hover].n} projects · ${data[hover].love} appreciation · ${reactionsOf(data[hover].deck!)} reactions` : 'No session'}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- masterclass */

function Masterclasses({ decks, onCreate, liveIn, hereIn }: ListProps) {
  const list = decks.filter((d) => d.type === 'masterclass')
  return (
    <>
      <PageHead
        title="Masterclass"
        sub="Guided tutorials and guest lectures. Someone from the team walks everyone through a skill, step by step, live."
        action={
          <Button leadingIcon={<Plus size={15} />} onClick={onCreate}>
            New masterclass
          </Button>
        }
      />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => {
          const here = hereIn(d.id)
          return (
            <a
              key={d.id}
              href={`#/d/${d.id}`}
              className="group flex flex-col gap-4 rounded-[22px] border border-line bg-card p-3 pb-5 transition-[border-color,transform] duration-150 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-line-strong"
            >
              <Thumb deck={d} />
              <div className="px-2">
                <div className="flex items-center gap-2">
                  <LiveTag peer={liveIn(d.id)} />
                  <span className="text-label text-muted">
                    {steps(d).length} steps{d.duration ? ` · ${d.duration}` : ''}
                    {here.length > 0 && ` · ${here.length} here`}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-title font-semibold leading-snug">{d.title || 'Untitled masterclass'}</p>
                {d.subtitle && <p className="mt-1 line-clamp-2 text-label text-muted">{d.subtitle}</p>}
                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar person={d.host || '?'} size="sm" />
                  <p className="text-label">
                    <span className="text-muted">Narrated by</span> <span className="font-medium">{d.host || 'someone'}</span>
                  </p>
                </div>
              </div>
            </a>
          )
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-line-strong text-muted transition-[background-color] duration-150 [@media(hover:hover)]:hover:bg-wash-1"
        >
          <Plus size={20} />
          <span className="text-ui font-medium">New masterclass</span>
          <span className="max-w-[26ch] text-center text-label">A guided tutorial or a guest lecture, with steps people can follow.</span>
        </button>
      </div>
    </>
  )
}
