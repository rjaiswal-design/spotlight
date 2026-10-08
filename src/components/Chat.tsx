import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Avatar, IconButton, Textarea, cn, timeAgo, useToast } from 'lightweight-ui'
import { HandsClapping, Image as ImageIcon, PaperPlaneRight, Smiley, X } from 'lightweight-ui/icons'
import { fileToDataUrl, type ChatMsg, type Deck } from '../lib/deck'
import { STICKERS, sticker } from '../lib/stickers'

export function StickerTile({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = sticker(id)
  if (!s) return null
  return (
    <span
      className={cn(
        'inline-flex select-none flex-col items-center justify-center rounded-[18px] border border-black/5 text-[#18191d]',
        size === 'lg' ? 'size-36 gap-2' : size === 'md' ? 'size-28 gap-1.5' : 'size-[72px] gap-0.5 rounded-[14px]',
      )}
      style={{ backgroundColor: s.bg, rotate: size === 'sm' ? undefined : `${(id.charCodeAt(0) % 7) - 3}deg` }}
    >
      <span className={size === 'lg' ? 'text-[56px] leading-none' : size === 'md' ? 'text-[44px] leading-none' : 'text-[28px] leading-none'}>{s.emoji}</span>
      <span className={cn('font-pixel leading-none', size === 'sm' ? 'text-[10px]' : 'text-[15px]')}>{s.label}</span>
    </span>
  )
}

/**
 * The room's side channel while someone presents: comments tied to the slide
 * they were sent on, stickers, pasted images and appreciation for authors.
 */
export function ChatPanel({
  deck,
  slideLabel,
  me,
  onSend,
  onJump,
  onClose,
}: {
  deck: Deck
  slideLabel: (key: string) => string | null
  me: string
  onSend: (m: Pick<ChatMsg, 'text' | 'sticker' | 'image'>) => void
  onJump?: (key: string) => void
  onClose: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [tray, setTray] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const chat = deck.chat ?? []
  const [, tick] = useState(0)

  // keep "2m ago" fresh
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [])
  // follow new messages, unless you've scrolled up to read
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [chat.length])

  async function sendImage(f: File) {
    try {
      onSend({ image: await fileToDataUrl(f, 900) })
    } catch {
      toast('Could not read that image')
    }
  }
  function send() {
    const t = text.trim()
    if (!t) return
    onSend({ text: t })
    setText('')
  }

  return (
    <aside className="flex h-full w-[340px] flex-none flex-col border-s border-line bg-card" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-ui font-semibold">
          Chat <span className="font-normal text-muted tabular-nums">{chat.length || ''}</span>
        </p>
        <IconButton label="Close chat (C)" size="sm" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>

      <div
        ref={list}
        className="sp-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {chat.length === 0 && (
          <div className="m-auto max-w-[24ch] text-center">
            <p className="text-ui font-medium">Say something nice</p>
            <p className="mt-1 text-label text-muted">Comments, questions and stickers land here for everyone in the session.</p>
          </div>
        )}
        {chat.map((m, i) => {
          const prev = chat[i - 1]
          const grouped = prev && prev.from === m.from && m.at - prev.at < 120_000 && !m.kudos && !prev.kudos
          const where = slideLabel(m.slide)
          if (m.kudos)
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-2xl bg-wash-1 px-3 py-2.5 text-label">
                <HandsClapping size={18} weight="fill" className="flex-none text-draft" aria-hidden />
                <p className="min-w-0">
                  <span className="font-semibold">{m.from === me ? 'You' : m.from.split(' ')[0]}</span> appreciated{' '}
                  <span className="font-semibold">{m.kudos.author.split(' ')[0]}</span>
                  {where && <span className="text-muted"> · {where}</span>}
                </p>
              </div>
            )
          return (
            <div key={m.id} className={cn('flex gap-2.5', grouped && '-mt-2.5')}>
              <div className="w-7 flex-none">{!grouped && <Avatar person={m.from} size="sm" />}</div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="flex items-baseline gap-1.5 text-label">
                    <span className="font-semibold">{m.from === me ? 'You' : m.from}</span>
                    <span className="text-caption text-muted">{timeAgo(m.at)}</span>
                    {where && (
                      <button
                        type="button"
                        onClick={() => onJump?.(m.slide)}
                        disabled={!onJump}
                        className="ms-auto rounded-md px-1 text-caption text-muted enabled:hover:bg-wash-2 enabled:hover:text-ink"
                      >
                        {where}
                      </button>
                    )}
                  </p>
                )}
                {m.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-ui">{m.text}</p>}
                {m.sticker && (
                  <div className="mt-1">
                    <StickerTile id={m.sticker} size="md" />
                  </div>
                )}
                {m.image && (
                  <a href={m.image} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-xl border border-line">
                    <img src={m.image} alt="" className="block max-h-56 w-full object-cover" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-line p-3">
        {tray && (
          <div className="u-pop mb-3 grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-bg p-2">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.label}
                className="grid place-items-center rounded-[14px] transition-transform duration-150 active:scale-95 [@media(hover:hover)]:hover:scale-105"
                onClick={() => {
                  onSend({ sticker: s.id })
                  setTray(false)
                }}
              >
                <StickerTile id={s.id} size="sm" />
              </button>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-line-control bg-field focus-within:border-ink">
          <Textarea
            autoGrow
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comment on this slide"
            className="!border-0 !bg-transparent !shadow-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            onPaste={(e) => {
              const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/'))
              if (f) {
                e.preventDefault()
                sendImage(f)
              }
            }}
          />
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            <IconButton label="Stickers" size="sm" pressed={tray} onClick={() => setTray((t) => !t)}>
              <Smiley size={17} />
            </IconButton>
            <IconButton label="Send an image" size="sm" onClick={() => fileIn.current?.click()}>
              <ImageIcon size={17} />
            </IconButton>
            <input
              ref={fileIn}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) sendImage(f)
                e.target.value = ''
              }}
            />
            <span className="ms-auto text-caption text-muted">Paste images too</span>
            <IconButton label="Send" size="sm" variant="solid" disabled={!text.trim()} onClick={send}>
              <PaperPlaneRight size={15} weight="fill" />
            </IconButton>
          </div>
        </div>
      </div>
    </aside>
  )
}
