import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { currentUser, runDailyJobs, useDB } from './lib/store'
import { useLook } from './ui/look'
import { PageSkeleton, Toaster } from './ui/kit'
import { RestBanner } from './ui/rest'
import { PagePush, Splash } from './ui/motion'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import { ClientShell, CoachShell } from './pages/Shell'
import SessionPage from './pages/SessionPage'
import ClientDetail from './pages/ClientDetail'
import { scheduleLocalReminder } from './lib/push'
import { useBoot, useHydrations } from './lib/remote'
const RecoveryPage = lazy(() => import('./pages/Recovery'))

export default function App() {
  const db = useDB()
  const me = currentUser(db)
  const loc = useLocation()
  useLook() // re-rend l'app quand le style change
  const boot = useBoot()

  useEffect(() => {
    const t = me?.theme
    document.documentElement.dataset.theme = t === 'clair' ? 'light' : t === 'sombre' ? 'dark' : ''
    if (!t || t === 'auto') delete document.documentElement.dataset.theme
  }, [me?.theme])

  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  const hydrations = useHydrations()
  // jamais sur le cache seul : on attend la version du serveur (sinon un appareil périmé écrase le programme)
  useEffect(() => { if (me && hydrations > 0) runDailyJobs() }, [me?.id, hydrations])
  useEffect(() => { if (me?.notifications) scheduleLocalReminder(me.id, me.reminderTime) }, [me?.id, me?.notifications, me?.reminderTime])

  if (boot === 'booting') return (<><div className="min-h-[100dvh] bg-bg" /><Splash /></>)
  if (!me) return (<><Routes><Route path="*" element={<Auth />} /></Routes><Toaster /><Splash /></>)

  const home = me.role === 'coach' ? '/coach' : me.onboarded ? '/app/today' : '/onboarding'
  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<PagePush><Onboarding /></PagePush>} />
        <Route path="/app/*" element={me.role === 'client' ? (me.onboarded ? <ClientShell /> : <Navigate to="/onboarding" replace />) : <Navigate to="/coach" replace />} />
        <Route path="/coach/client/:id" element={me.role === 'coach' ? <PagePush><ClientDetail /></PagePush> : <Navigate to="/app/today" replace />} />
        <Route path="/coach/*" element={me.role === 'coach' ? <CoachShell /> : <Navigate to="/app/today" replace />} />
        <Route path="/recovery/:id?" element={<PagePush><Suspense fallback={<div className="max-w-xl mx-auto px-4 pt-24"><PageSkeleton /></div>}><RecoveryPage /></Suspense></PagePush>} />
        <Route path="/session/:id" element={<PagePush><SessionPage /></PagePush>} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      <RestBanner />
      <Toaster />
      <Splash />
    </>
  )
}
