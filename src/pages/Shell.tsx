import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { allSessions } from '@/engine/adapt'
import { clientsOf, currentUser, summarizeClient, programOf, useDB } from '@/lib/store'
import { Page, PageSkeleton, Segmented, TabBar } from '@/ui/kit'
import { PageFade } from '@/ui/motion'
import { BellButton, NotificationsSheet } from '@/ui/parts'
import { ProfileView } from './ProfilePage'
import TodayPage, { TodayView } from './Today'
import { ProgramView } from './ProgramPage'
const ProgressView = lazy(() => import('./Progress').then((m) => ({ default: m.ProgressView })))
import { AlertsPage, ClientsPage } from './Coach'

export function ClientShell() {
  const db = useDB()
  const me = currentUser(db)!
  return (
    <>
      <PageFade><Routes>
        <Route path="today" element={<TodayPage clientId={me.id} />} />
        <Route path="program" element={<Page title="Programme"><ProgramView clientId={me.id} /></Page>} />
        <Route path="progress" element={<Page title="Progrès"><Suspense fallback={<PageSkeleton />}><ProgressView clientId={me.id} /></Suspense></Page>} />
        <Route path="profile" element={<Page title="Profil"><ProfileView userId={me.id} /></Page>} />
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes></PageFade>
      <TabBar tabs={[
        { to: '/app/today', label: 'Aujourd\'hui', icon: 'today' },
        { to: '/app/program', label: 'Programme', icon: 'program' },
        { to: '/app/progress', label: 'Progrès', icon: 'progress' },
        { to: '/app/profile', label: 'Profil', icon: 'profile' },
      ]} />
    </>
  )
}

function MyTraining({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'today' | 'program' | 'progress'>('today')
  const [bell, setBell] = useState(false)
  return (
    <Page title="Mon entraînement" right={<BellButton userId={userId} onClick={() => setBell(true)} />}>
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'today', label: 'Aujourd\'hui' }, { value: 'program', label: 'Programme' }, { value: 'progress', label: 'Progrès' }]} /></div>
      {tab === 'today' && <TodayView clientId={userId} onboardPath="/onboarding" />}
      {tab === 'program' && <ProgramView clientId={userId} />}
      {tab === 'progress' && <Suspense fallback={<PageSkeleton />}><ProgressView clientId={userId} /></Suspense>}
      <NotificationsSheet open={bell} onClose={() => setBell(false)} userId={userId} />
    </Page>
  )
}

export function CoachShell() {
  const db = useDB()
  const me = currentUser(db)!
  const alerts = clientsOf(db).reduce((a, c) => a + summarizeClient(db, c).alerts.length, 0)
  void allSessions; void programOf; void useNavigate
  return (
    <>
      <PageFade><Routes>
        <Route index element={<ClientsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="me" element={<MyTraining userId={me.id} />} />
        <Route path="profile" element={<Page title="Profil"><ProfileView userId={me.id} /></Page>} />
        <Route path="*" element={<Navigate to="/coach" replace />} />
      </Routes></PageFade>
      <TabBar tabs={[
        { to: '/coach', label: 'Clients', icon: 'users' },
        { to: '/coach/alerts', label: 'Alertes', icon: 'alert', badge: alerts || undefined },
        { to: '/coach/me', label: 'Mon entraînement', icon: 'today' },
        { to: '/coach/profile', label: 'Profil', icon: 'profile' },
      ]} />
    </>
  )
}
