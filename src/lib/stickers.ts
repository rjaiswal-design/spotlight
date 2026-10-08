/** Quick reactions: float up over the slide for everyone, and count per slide. */
export const REACTIONS = ['👏', '🔥', '😍', '🤯', '💯', '🎉'] as const

/** Chat stickers: a big emoji and a short line, drawn as a tile. */
export const STICKERS: { id: string; emoji: string; label: string; bg: string }[] = [
  { id: 'ship', emoji: '🚀', label: 'Ship it', bg: '#e8f0ff' },
  { id: 'chef', emoji: '🤌', label: "Chef's kiss", bg: '#fff1e6' },
  { id: 'fire', emoji: '🔥', label: 'On fire', bg: '#ffe9e3' },
  { id: 'brain', emoji: '🧠', label: 'Big brain', bg: '#fbe9f5' },
  { id: 'pixel', emoji: '🎯', label: 'Pixel perfect', bg: '#e9f7ef' },
  { id: 'smooth', emoji: '🧈', label: 'Buttery', bg: '#fff8db' },
  { id: 'wow', emoji: '🤯', label: 'Mind blown', bg: '#efe9ff' },
  { id: 'love', emoji: '💖', label: 'Love this', bg: '#ffe8ef' },
  { id: 'clap', emoji: '👏', label: 'Bravo', bg: '#fff3dc' },
  { id: 'q', emoji: '🙋', label: 'Question', bg: '#e7f6fb' },
  { id: 'steal', emoji: '🥷', label: 'Stealing this', bg: '#eceef2' },
  { id: 'more', emoji: '🍿', label: 'Tell me more', bg: '#fdf0e3' },
]

export const sticker = (id?: string) => STICKERS.find((s) => s.id === id)
