import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Field,
  IconButton,
  Input,
  Menu,
  MenuDivider,
  MenuItem,
  PresenceBar,
  ThemeSwitch,
  Tooltip,
  useToast,
} from 'lightweight-ui'
import { DotsThree, LinkSimple, UserCircle } from 'lightweight-ui/icons'
import type { Peer } from '../lib/ops'
import type { LibraryRoom } from '../lib/room'

/** Presence, invite, theme and the overflow menu: the right side of every header. */
export function HeaderActions({
  lib,
  peers,
  selfWhere,
  where,
  following,
  onFollow,
  onRename,
  menu,
  children,
}: {
  lib: LibraryRoom
  peers: Peer[]
  selfWhere?: string
  where?: (p: Peer) => string | undefined
  following?: string | null
  onFollow?: (id: string | null) => void
  onRename: () => void
  menu?: React.ReactNode
  children?: React.ReactNode
}) {
  const toast = useToast()
  const name = lib.name
  const leader = peers.find((p) => p.id === following)

  async function copyInvite() {
    const url = lib.invite ?? location.origin
    try {
      await navigator.clipboard.writeText(url)
      toast(`Invite link copied · ${url.replace(/^https?:\/\//, '')}`)
    } catch {
      toast(url)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {lib.saveError && <span className="text-label text-danger">Not cached. Images may be too large.</span>}
      {lib.status === 'live' ? (
        <PresenceBar
          peers={[
            { person: name ?? 'You', self: true, where: selfWhere },
            // one face per person, even when someone has two tabs open
            ...peers
              .filter((p, i, all) => p.name !== name && all.findIndex((q) => q.name === p.name) === i)
              .map((p) => ({ person: p.name, where: where?.(p) })),
          ]}
          following={leader?.name ?? null}
          onFollow={onFollow ? (person) => onFollow(peers.find((p) => p.name === person)?.id ?? null) : undefined}
          onStopFollowing={() => onFollow?.(null)}
          max={5}
        />
      ) : (
        <Tooltip
          label={
            lib.status === 'solo'
              ? 'This copy saves to your browser only. Live sessions run on the team server.'
              : lib.status === 'offline'
                ? 'Edits stay in this browser until the room is back'
                : 'Joining the room'
          }
        >
          <Badge tone={lib.status === 'connecting' ? 'neutral' : 'draft'} dot>
            {lib.status === 'solo' ? 'Solo' : lib.status === 'offline' ? 'Offline' : 'Connecting'}
          </Badge>
        </Tooltip>
      )}
      <Button variant="secondary" size="sm" leadingIcon={<LinkSimple size={14} />} onClick={copyInvite}>
        Invite
      </Button>
      <ThemeSwitch />
      <Menu
        align="end"
        trigger={
          <IconButton label="More">
            <DotsThree size={18} weight="bold" />
          </IconButton>
        }
      >
        <MenuItem icon={<UserCircle size={16} />} onSelect={onRename}>
          Change your name
        </MenuItem>
        {menu && <MenuDivider />}
        {menu}
      </Menu>
      {children}
    </div>
  )
}

/** "Rahul is presenting Week 41 · Join", floating at the bottom whenever someone else is live. */
export function LiveBanner({ lib }: { lib: LibraryRoom }) {
  const live = lib.peers.filter((p) => p.presence.presenting && p.presence.deck && p.id !== lib.me)
  // one per deck
  const byDeck = live.filter((p, i) => live.findIndex((q) => q.presence.deck === p.presence.deck) === i)
  if (!byDeck.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-2">
      {byDeck.map((p) => {
        const deck = lib.library.decks.find((d) => d.id === p.presence.deck)
        if (!deck) return null
        return (
          <div key={p.id} className="u-rise pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-card py-1.5 pe-1.5 ps-2 shadow-toast">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-solid opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-danger-solid" />
            </span>
            <Avatar person={p.name} size="sm" />
            <p className="text-ui">
              <span className="font-semibold">{p.name.split(' ')[0]}</span> <span className="text-muted">is presenting</span>{' '}
              <span className="font-medium">{deck.type === 'masterclass' ? deck.title : `${deck.date} · ${deck.title}`}</span>
            </p>
            <Button size="sm" onClick={() => (location.hash = `#/d/${deck.id}?watch=${p.id}`)}>
              Join
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export function NameDialog({
  open,
  initial,
  canClose,
  onClose,
  onSave,
}: {
  open: boolean
  initial: string
  canClose: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [v, setV] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setV(initial)
  }, [open, initial])
  const ok = v.trim().length > 0
  return (
    <Dialog open={open} onClose={() => canClose && onClose()} size="sm" initialFocus={input} label="Your name">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onSave(v.trim())
        }}
      >
        <DialogHeader title="Join the spotlight" description="Your name shows on your cursor, the fields you edit and your chat messages." hideClose={!canClose} />
        <DialogBody>
          <Field label="Your name">
            <Input ref={input} value={v} onChange={(e) => setV(e.target.value)} placeholder="Rahul Jaiswal" autoComplete="name" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={!ok}>
            {canClose ? 'Save' : 'Join'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
