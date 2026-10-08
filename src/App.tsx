import { useEffect, useState } from 'react'
import { NameDialog } from './components/Chrome'
import { useLibrary } from './lib/room'
import { Editor } from './screens/Editor'
import { Home, type Tab } from './screens/Home'

const NAME_KEY = 'spotlight.name'
function savedName() {
  try {
    return localStorage.getItem(NAME_KEY)
  } catch {
    return null
  }
}

type Route = { page: 'home'; tab: Tab } | { page: 'deck'; id: string; watch: string | null }

/** #/ · #/masterclass · #/d/<id> · #/d/<id>?watch=<peer> */
function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'd' && parts[1]) return { page: 'deck', id: parts[1], watch: new URLSearchParams(query).get('watch') }
  return { page: 'home', tab: parts[0] === 'masterclass' ? 'masterclass' : 'weekly' }
}

export default function App() {
  const [name, setName] = useState<string | null>(savedName)
  const [askName, setAskName] = useState(!name)
  const [route, setRoute] = useState(() => parse(location.hash))
  const lib = useLibrary(name)

  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const rename = () => setAskName(true)

  return (
    <>
      {route.page === 'deck' ? (
        <Editor key={route.id} lib={lib} deckId={route.id} watch={route.watch} onRename={rename} />
      ) : (
        <Home lib={lib} tab={route.tab} onRename={rename} />
      )}
      <NameDialog
        open={askName}
        initial={name ?? ''}
        canClose={!!name}
        onClose={() => setAskName(false)}
        onSave={(n) => {
          try {
            localStorage.setItem(NAME_KEY, n)
          } catch {
            /* fine, it lasts for this visit */
          }
          setName(n)
          setAskName(false)
        }}
      />
    </>
  )
}
