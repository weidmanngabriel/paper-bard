import { useEffect, useState } from 'react'
import { BookOpen, Library, Mic2, Music2, Settings, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useApp } from './app/AppContext'
import { SessionView } from './views/SessionView'
import { LibraryView } from './views/LibraryView'
import { RecordView } from './views/RecordView'
import { SettingsView } from './views/SettingsView'

type Route = 'session' | 'library' | 'record' | 'settings'

const ROUTES: { id: Route; label: string; icon: typeof Music2 }[] = [
  { id: 'session', label: 'Session', icon: Music2 },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'record', label: 'Aufnahme', icon: Mic2 },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
]

function currentRoute(): Route {
  const route = window.location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.some((entry) => entry.id === route) ? route : 'session'
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute)
  const { loading, message, setMessage } = useApp()
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    const update = () => setRoute(currentRoute())
    window.addEventListener('hashchange', update)
    if (!window.location.hash) window.history.replaceState(null, '', '#/session')
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(undefined), 4500)
    return () => window.clearTimeout(timeout)
  }, [message, setMessage])

  if (loading) return <div className="app-loading"><BookOpen /><span>Paper Bard lädt …</span></div>

  return (
    <div className="app-shell">
      <header className="brand-bar"><a href="#/session" className="brand"><span className="brand-mark">PB</span><span>Paper Bard</span></a><span className="offline-badge">lokal · offline</span></header>

      {route === 'session' && <SessionView />}
      {route === 'library' && <LibraryView />}
      {route === 'record' && <RecordView />}
      {route === 'settings' && <SettingsView />}

      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {ROUTES.map(({ id, label, icon: Icon }) => <a key={id} href={`#/${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}><Icon /><span>{label}</span></a>)}
      </nav>

      {message && <div className="toast" role="status"><span>{message}</span><button onClick={() => setMessage(undefined)} aria-label="Hinweis schließen"><X /></button></div>}
      {needRefresh && <div className="update-banner" role="status"><span>Eine neue Version ist bereit.</span><button onClick={() => { void updateServiceWorker(true) }}>Jetzt laden</button><button aria-label="Später" onClick={() => setNeedRefresh(false)}><X /></button></div>}
    </div>
  )
}
