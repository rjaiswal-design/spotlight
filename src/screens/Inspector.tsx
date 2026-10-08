import { useState } from 'react'
import {
  Button,
  ConfirmDialog,
  Dropzone,
  Field,
  IconButton,
  Input,
  SegmentedControl,
  Swatch,
  Textarea,
  HERO_GRADIENTS,
  HERO_SOLIDS,
  useToast,
} from 'lightweight-ui'
import { ArrowDown, ArrowUp, Browser, Copy, DeviceMobile, Plus, SquaresFour, Trash, X } from 'lightweight-ui/icons'
import { blankItem, fileToDataUrl, mondayOf, parseDay, uid, weekLabel, type Deck, type Project, type ShowItem, type Status } from '../lib/deck'

const STATUSES: { value: Status; label: string }[] = [
  { value: 'shipped', label: 'Shipped' },
  { value: 'live', label: 'Live' },
  { value: 'experiment', label: 'Pilot' },
  { value: 'in-progress', label: 'Building' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="mb-3 font-sans text-label font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function DeckInspector({ deck, patch }: { deck: Deck; patch: (p: Partial<Omit<Deck, 'projects' | 'id'>>) => void }) {
  const master = deck.type === 'masterclass'
  return (
    <>
      <Section title={master ? 'Masterclass' : 'This week'}>
        <Field label="Title">
          <Input value={deck.title} onChange={(e) => patch({ title: e.target.value })} placeholder={master ? 'Interaction & motion with Claude' : 'Design Spotlight'} />
        </Field>
        <Field label={master ? "What people will learn" : 'Subtitle'}>
          <Textarea autoGrow rows={2} value={deck.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
        </Field>
        {master ? (
          <>
            <Field label="Narrated by" hint="The person walking everyone through it.">
              <Input value={deck.host} onChange={(e) => patch({ host: e.target.value })} placeholder="Name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="When">
                <Input value={deck.date} onChange={(e) => patch({ date: e.target.value })} placeholder="Live · Oct 15" />
              </Field>
              <Field label="Length">
                <Input value={deck.duration ?? ''} onChange={(e) => patch({ duration: e.target.value })} placeholder="30 min" />
              </Field>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Week of">
                <Input
                  type="date"
                  value={deck.week ?? ''}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const week = mondayOf(parseDay(e.target.value))
                    patch({ week, date: weekLabel(week) })
                  }}
                />
              </Field>
              <Field label="Label">
                <Input value={deck.date} onChange={(e) => patch({ date: e.target.value })} placeholder="Week 41" />
              </Field>
            </div>
            <Field label="Hosted by">
              <Input value={deck.host} onChange={(e) => patch({ host: e.target.value })} />
            </Field>
          </>
        )}
      </Section>
      <Section title="Tip">
        <p className="text-label text-muted">
          {master
            ? 'Each step has an instruction, a prompt to copy and a tip. Paste a prototype or demo URL and it plays live on the slide.'
            : 'The cover and closing slides build themselves from your projects. Fill in the story behind a project and it gets a second slide.'}
        </p>
      </Section>
    </>
  )
}

export function ProjectInspector({
  project: p,
  patch,
  onDuplicate,
  onDelete,
}: {
  project: Project
  patch: (p: Partial<Project>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [crewText, setCrewText] = useState(p.contributors.join(', '))
  const [crewFor, setCrewFor] = useState(p.id)
  if (crewFor !== p.id) {
    setCrewFor(p.id)
    setCrewText(p.contributors.join(', '))
  }

  const setMetric = (id: string, k: 'value' | 'label', v: string) =>
    patch({ metrics: p.metrics.map((m) => (m.id === id ? { ...m, [k]: v } : m)) })

  async function onFiles(files: File[]) {
    const f = files[0]
    if (!f) return
    setBusy(true)
    try {
      patch({ image: await fileToDataUrl(f) })
    } catch {
      toast("Could not read that image")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Section title="Project">
        <Field label="Name">
          <Input value={p.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="One-liner" hint="What it is, in a sentence.">
          <Input value={p.tagline} onChange={(e) => patch({ tagline: e.target.value })} placeholder="One ranked list for every request." />
        </Field>
        <Field label="Story">
          <Textarea
            autoGrow
            rows={3}
            value={p.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="The problem, and what was built."
          />
        </Field>
        <Field label="Status">
          <SegmentedControl items={STATUSES} value={p.status} onChange={(status) => patch({ status })} label="Status" />
        </Field>
        <Field label="Link" subtle>
          <Input value={p.link ?? ''} onChange={(e) => patch({ link: e.target.value })} placeholder="priority.noon.team" />
        </Field>
      </Section>

      <Section title="Author">
        <Field label="Name">
          <Input value={p.author} onChange={(e) => patch({ author: e.target.value })} placeholder="Who led it" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Input value={p.role} onChange={(e) => patch({ role: e.target.value })} placeholder="Product Designer" />
          </Field>
          <Field label="Team">
            <Input value={p.team} onChange={(e) => patch({ team: e.target.value })} placeholder="Checkout" />
          </Field>
        </div>
        <Field label="With" hint="Contributors, separated by commas.">
          <Input
            value={crewText}
            onChange={(e) => {
              setCrewText(e.target.value)
              patch({ contributors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }}
          />
        </Field>
      </Section>

      <Section title="Impact">
        <Field label="Headline" hint="The change people should remember.">
          <Textarea autoGrow rows={2} value={p.impact} onChange={(e) => patch({ impact: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-label text-muted">Numbers · up to 3</p>
          {p.metrics.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Input size="sm" className="w-24 tabular-nums" value={m.value} onChange={(e) => setMetric(m.id, 'value', e.target.value)} placeholder="+31%" aria-label="Value" />
              <Input size="sm" className="min-w-0 flex-1" value={m.label} onChange={(e) => setMetric(m.id, 'label', e.target.value)} placeholder="Review completion" aria-label="Label" />
              <IconButton label="Remove number" size="sm" onClick={() => patch({ metrics: p.metrics.filter((x) => x.id !== m.id) })}>
                <X size={14} />
              </IconButton>
            </div>
          ))}
          {p.metrics.length < 3 && (
            <Button variant="ghost" size="sm" className="self-start" leadingIcon={<Plus size={14} />} onClick={() => patch({ metrics: [...p.metrics, { id: uid(), value: '', label: '' }] })}>
              Add number
            </Button>
          )}
        </div>
      </Section>

      <Section title="Behind the project">
        <p className="text-label text-muted">Optional. Anything here adds a second slide right after this one.</p>
        {(
          [
            ['process', 'Process', 'How you got there'],
            ['outcome', 'Outcome', 'What it changed'],
            ['challenges', 'Challenges', 'What got in the way'],
            ['personal', 'Personal note', "What you learned, who helped"],
          ] as const
        ).map(([k, label, ph]) => (
          <Field key={k} label={label} subtle>
            <Textarea autoGrow rows={2} value={p[k] ?? ''} onChange={(e) => patch({ [k]: e.target.value })} placeholder={ph} />
          </Field>
        ))}
      </Section>

      <Section title="Visual">
        {p.image ? (
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <img src={p.image} alt="" className="block max-h-40 w-full object-cover" />
            <div className="absolute end-2 top-2">
              <IconButton label="Remove image" variant="overlay" size="sm" onClick={() => patch({ image: undefined })}>
                <Trash size={14} />
              </IconButton>
            </div>
          </div>
        ) : (
          <Dropzone onFiles={onFiles} accept="image/*" busy={busy} title="Drop a screenshot" hint="PNG or JPG. Sits on the backdrop below." />
        )}
        <div>
          <p className="mb-2 text-label text-muted">Backdrop</p>
          <div className="flex flex-wrap gap-1.5">
            {[...HERO_GRADIENTS, ...HERO_SOLIDS].map((b) => (
              <Swatch key={b.value} background={b.css} label={b.label} size={26} selected={p.bg === b.value} onClick={() => patch({ bg: b.value })} />
            ))}
          </div>
        </div>
      </Section>

      <div className="flex gap-2 px-5 py-5">
        <Button variant="secondary" size="sm" leadingIcon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button variant="danger-outline" size="sm" leadingIcon={<Trash size={14} />} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Delete ${p.title || 'this project'}?`}
        body="The slide and its numbers go away. This can't be undone."
        confirmLabel="Delete project"
        tone="danger"
        onConfirm={() => {
          setConfirm(false)
          onDelete()
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}

const MAX_ITEMS = 6

function ItemEditor({
  item,
  index,
  count,
  set,
  move,
  remove,
}: {
  item: ShowItem
  index: number
  count: number
  set: (p: Partial<ShowItem>) => void
  move: (d: -1 | 1) => void
  remove: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const proto = item.type === 'prototype'
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-3">
      <div className="flex items-center gap-1">
        <span className="flex flex-1 items-center gap-1.5 text-label font-semibold">
          {proto ? <DeviceMobile size={14} aria-hidden /> : <SquaresFour size={14} aria-hidden />}
          {proto ? 'Prototype' : 'Project'} {index + 1}
        </span>
        <IconButton label="Move up" size="xs" disabled={index === 0} onClick={() => move(-1)}>
          <ArrowUp size={13} />
        </IconButton>
        <IconButton label="Move down" size="xs" disabled={index === count - 1} onClick={() => move(1)}>
          <ArrowDown size={13} />
        </IconButton>
        <IconButton label="Remove" size="xs" onClick={remove}>
          <X size={13} />
        </IconButton>
      </div>
      <Input size="sm" value={item.title} onChange={(e) => set({ title: e.target.value })} placeholder={proto ? 'Prototype name' : 'Project name'} aria-label="Name" />
      <Input
        size="sm"
        value={item.url}
        onChange={(e) => set({ url: e.target.value.trim() })}
        placeholder={proto ? 'https://your-prototype.vercel.app' : 'Link (optional)'}
        aria-label={proto ? 'Prototype URL' : 'Link'}
      />
      {proto ? (
        <SegmentedControl
          label="Frame"
          value={item.frame}
          onChange={(frame) => set({ frame })}
          items={[
            { value: 'phone', label: 'Phone', icon: <DeviceMobile size={14} /> },
            { value: 'browser', label: 'Browser', icon: <Browser size={14} /> },
          ]}
        />
      ) : (
        <>
          <Input size="sm" value={item.author} onChange={(e) => set({ author: e.target.value })} placeholder="Author" aria-label="Author" />
          {item.image ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              <img src={item.image} alt="" className="block max-h-28 w-full object-cover" />
              <div className="absolute end-2 top-2">
                <IconButton label="Remove image" variant="overlay" size="xs" onClick={() => set({ image: undefined })}>
                  <Trash size={13} />
                </IconButton>
              </div>
            </div>
          ) : (
            <Dropzone
              accept="image/*"
              busy={busy}
              title="Drop a cover"
              hint="PNG or JPG"
              onFiles={async ([f]) => {
                if (!f) return
                setBusy(true)
                try {
                  set({ image: await fileToDataUrl(f, 1000) })
                } catch {
                  toast('Could not read that image')
                } finally {
                  setBusy(false)
                }
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export function BoardInspector({
  board: b,
  patch,
  onDuplicate,
  onDelete,
}: {
  board: Project
  patch: (p: Partial<Project>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const items = b.items ?? []
  const setItems = (next: ShowItem[]) => patch({ items: next })
  const add = (type: ShowItem['type']) => setItems([...items, blankItem(type, items.length)])

  return (
    <>
      <Section title="Showcase">
        <p className="text-label text-muted">A slide without a project name. Line up live prototypes and project cards, up to {MAX_ITEMS}.</p>
        <Field label="Heading" subtle>
          <Input value={b.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Also shipped" />
        </Field>
        <Field label="Context" subtle>
          <Input value={b.tagline} onChange={(e) => patch({ tagline: e.target.value })} placeholder="Smaller bets from the quarter" />
        </Field>
      </Section>

      <Section title={`Items · ${items.length}/${MAX_ITEMS}`}>
        {items.map((it, i) => (
          <ItemEditor
            key={it.id}
            item={it}
            index={i}
            count={items.length}
            set={(p) => setItems(items.map((x) => (x.id === it.id ? { ...x, ...p } : x)))}
            move={(d) => {
              const next = [...items]
              const [x] = next.splice(i, 1)
              next.splice(i + d, 0, x)
              setItems(next)
            }}
            remove={() => setItems(items.filter((x) => x.id !== it.id))}
          />
        ))}
        {items.length < MAX_ITEMS && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" leadingIcon={<DeviceMobile size={14} />} onClick={() => add('prototype')}>
              Prototype
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<SquaresFour size={14} />} onClick={() => add('project')}>
              Project
            </Button>
          </div>
        )}
        <p className="text-caption text-muted">Prototypes load live on the slide. Some sites refuse to be embedded; Vercel and Figma prototype links work.</p>
      </Section>

      <div className="flex gap-2 px-5 py-5">
        <Button variant="secondary" size="sm" leadingIcon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button variant="danger-outline" size="sm" leadingIcon={<Trash size={14} />} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this showcase?"
        body="The slide and everything on it goes away. This can't be undone."
        confirmLabel="Delete slide"
        tone="danger"
        onConfirm={() => {
          setConfirm(false)
          onDelete()
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}

export function StepInspector({
  step: p,
  patch,
  onDuplicate,
  onDelete,
}: {
  step: Project
  patch: (p: Partial<Project>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Section title="Step">
        <Field label="Title">
          <Input value={p.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Instruction">
          <Textarea autoGrow rows={3} value={p.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="What to do, and why" />
        </Field>
        <Field label="Try this" hint="A prompt or command people can copy.">
          <Textarea autoGrow rows={2} className="font-mono" value={p.snippet ?? ''} onChange={(e) => patch({ snippet: e.target.value })} placeholder="/animate the …" />
        </Field>
        <Field label="Tip" subtle>
          <Textarea autoGrow rows={2} value={p.tip ?? ''} onChange={(e) => patch({ tip: e.target.value })} placeholder="A tip, or a mistake to avoid" />
        </Field>
      </Section>

      <Section title="Demo">
        <Field label="Live demo URL" hint="Plays on the slide. Leave empty to show an image instead.">
          <Input value={p.link ?? ''} onChange={(e) => patch({ link: e.target.value.trim() })} placeholder="https://your-prototype.vercel.app" />
        </Field>
        {p.link ? (
          <SegmentedControl
            label="Frame"
            value={p.frame ?? 'browser'}
            onChange={(frame) => patch({ frame })}
            items={[
              { value: 'browser', label: 'Browser', icon: <Browser size={14} /> },
              { value: 'phone', label: 'Phone', icon: <DeviceMobile size={14} /> },
            ]}
          />
        ) : p.image ? (
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <img src={p.image} alt="" className="block max-h-40 w-full object-cover" />
            <div className="absolute end-2 top-2">
              <IconButton label="Remove image" variant="overlay" size="sm" onClick={() => patch({ image: undefined })}>
                <Trash size={14} />
              </IconButton>
            </div>
          </div>
        ) : (
          <Dropzone
            accept="image/*"
            busy={busy}
            title="Drop a screenshot"
            hint="PNG or JPG"
            onFiles={async ([f]) => {
              if (!f) return
              setBusy(true)
              try {
                patch({ image: await fileToDataUrl(f) })
              } catch {
                toast('Could not read that image')
              } finally {
                setBusy(false)
              }
            }}
          />
        )}
      </Section>

      <div className="flex gap-2 px-5 py-5">
        <Button variant="secondary" size="sm" leadingIcon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button variant="danger-outline" size="sm" leadingIcon={<Trash size={14} />} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this step?"
        body="This can't be undone."
        confirmLabel="Delete step"
        tone="danger"
        onConfirm={() => {
          setConfirm(false)
          onDelete()
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
