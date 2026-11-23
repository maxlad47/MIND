import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isLibre } from '@/engine/libre'
import { programOf, questionnaireOf, resetDB, setSuggestLoads, switchToLibre, updateProfile, useDB } from '@/lib/store'
import { signOut } from '@/lib/auth'
import { REMOTE } from '@/lib/supabase'
import { ensureSeed } from '@/lib/seed'
import { isIOS, isStandalone, pushState, requestPush, testNotification } from '@/lib/push'
import { DAY_NAMES, prettyDate } from '@/engine/utils'
import { Button, Card, Cover, Group, Icon, Page, Row, RowIcon, Sheet, Toggle, spring, toast } from '@/ui/kit'
import { motion } from 'framer-motion'
import { setLook, useLook, type Look } from '@/ui/look'
import { DIST_LABEL } from '@/engine/running'
import { setRestSound, useRest } from '@/lib/rest'

function InstallGuide({ open, onClose, onGranted }: { open: boolean; onClose: () => void; onGranted: () => void }) {
  const standalone = isStandalone()
  const steps = [
    ['Ouvre MIND dans Safari', 'Les notifications iPhone fonctionnent uniquement depuis l\'écran d\'accueil (iOS 16.4 ou plus).'],
    ['Touche le bouton Partager', 'L\'icône carrée avec une flèche vers le haut, en bas de Safari.'],
    ['« Sur l\'écran d\'accueil »', 'Fais défiler la liste, puis touche « Ajouter ».'],
    ['Ouvre MIND depuis l\'écran d\'accueil', 'Reviens ici et autorise les notifications.'],
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Activer les rappels" tall>
      <div className="flex flex-col gap-3">
        {steps.map(([t, s], i) => (
          <div key={i} className="flex gap-3.5 bg-surface2 rounded-[18px] p-3.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,var(--muscu),#FF9F0A)' }}>{i + 1}</div>
            <div><div className="font-semibold">{t}</div><div className="text-[14px] text-muted">{s}</div></div>
          </div>
        ))}
        {isIOS() && !standalone && <p className="text-[14px]" style={{ color: '#FF9F0A' }}>MIND n'est pas encore installée sur ton écran d'accueil : suis les étapes ci-dessus, puis reviens ici.</p>}
        <Button full onClick={async () => {
          const r = await requestPush()
          if (r === 'granted') { onGranted(); onClose(); toast('Notifications activées'); testNotification() }
          else if (r === 'unsupported') toast('Ton navigateur ne gère pas les notifications.')
          else toast('Autorisation refusée : tu peux la changer dans les réglages.')
        }}>Autoriser les notifications</Button>
      </div>
    </Sheet>
  )
}

export function ProfileView({ userId }: { userId: string }) {
  const db = useDB()
  const look = useLook()
  const nav = useNavigate()
  const me = db.profiles.find((p) => p.id === userId)!
  const q = questionnaireOf(db, userId)
  const program = programOf(db, userId)
  const [guide, setGuide] = useState(false)
  const [switching, setSwitching] = useState(false)
  const { sound } = useRest()
  const libre = isLibre(program)
  const edits = db.edits.filter((e) => e.clientId === userId).slice(0, 12)

  return (
    <div>
      <Cover seed={'profile-' + me.id} sports={me.role === 'coach' ? ['muscu', 'course'] : (program?.type === 'course' ? ['course'] : program?.type === 'mixte' ? ['muscu', 'course'] : ['muscu'])} className="rounded-[26px] mb-6" style={{ boxShadow: 'var(--shadow-cover)' }}>
        <div className="p-5 flex items-center gap-4 text-white min-h-[116px]">
          <div className="w-[68px] h-[68px] rounded-full glass-light border border-white/30 flex items-center justify-center text-[30px] font-extrabold shrink-0">{me.firstName[0]?.toUpperCase()}</div>
          <div className="min-w-0"><div className="text-[26px] leading-tight font-extrabold tracking-tight">{me.firstName}</div><div className="text-[14px] opacity-90 truncate">{me.email}</div>
            <span className="inline-block mt-1.5 rounded-full glass-dark px-2.5 py-0.5 text-[12px] font-bold">{me.role === 'coach' ? 'Coach' : 'Client'}</span></div>
        </div>
      </Cover>

      {program && q && libre && (<>
        <Group header="Mon carnet" footer="Désactivées, aucune charge cible n'est affichée. Activées, MIND propose ta prochaine charge (double progression) d'après ta dernière performance.">
          <Row><RowIcon name="bolt" color="#FF9F0A" /><div className="flex-1"><div className="font-semibold">Suggestions de charge</div><div className="text-[13px] text-muted">{program.libre?.suggestLoads ? 'Activées' : 'Désactivées'}</div></div>
            <Toggle checked={!!program.libre?.suggestLoads} label="Suggestions de charge" onChange={() => setSuggestLoads(program.id, !program.libre?.suggestLoads)} /></Row>
          <Row onClick={() => nav(`/onboarding?edit=1`)}><RowIcon name="edit" color="var(--accent)" /><div className="flex-1"><div className="font-semibold">Modifier mon formulaire</div><div className="text-[13px] text-muted">{program.type === 'mixte' ? `Muscu libre + plan de course MIND (${DIST_LABEL[q.run.distance]})` : 'Ajouter ou retirer un plan de course MIND'}</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
        </Group>
        <Group header="Mode" footer="Ton historique de séances et de charges est conservé dans les deux sens.">
          <Row onClick={() => nav('/onboarding?edit=1&switch=genere')}><RowIcon name="sparkle" color="var(--muscu)" /><div className="flex-1"><div className="font-semibold">Passer à un programme MIND</div><div className="text-[13px] text-muted">MIND crée ton programme</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
        </Group>
      </>)}
      {program && q && !libre && (<>
        <Group header="Mon programme" footer="Modifier le formulaire régénère la suite du programme en gardant ton historique.">
          <Row><RowIcon name="target" color="var(--muscu)" /><div className="flex-1"><div className="font-semibold">{program.type === 'muscu' ? 'Musculation' : program.type === 'course' ? 'Course à pied' : 'Musculation + course'}</div>
            <div className="text-[13px] text-muted">{program.type !== 'course' ? `${q.muscuSessions} séances de muscu · ${q.strength.goal}` : ''}{program.type === 'mixte' ? ' · ' : ''}{program.type !== 'muscu' ? `${DIST_LABEL[q.run.distance]}${program.raceDate ? ` le ${prettyDate(program.raceDate)}` : ''}` : ''}</div></div></Row>
          <Row onClick={() => nav(`/onboarding?edit=1`)}><RowIcon name="edit" color="var(--accent)" /><div className="flex-1 font-semibold">Modifier mon formulaire</div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
        </Group>
        {program.type !== 'course' && <Group header="Mode" footer="Tu suis déjà ton propre programme ? MIND peut devenir ton carnet d'entraînement. Ton historique est conservé.">
          <Row onClick={() => setSwitching(true)}><RowIcon name="edit" color="var(--muscu)" /><div className="flex-1"><div className="font-semibold">Passer en mode libre</div><div className="text-[13px] text-muted">J'ai déjà mon programme de musculation</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
        </Group>}
      </>)}

      <Group header="Minuteur de repos" footer="Le repos démarre tout seul quand tu valides une série, une partie ou un tour. Le son de fin ne retentit que si l'app est au premier plan.">
        <Row>
          <RowIcon name="clock" color="#30D158" />
          <div className="flex-1"><div className="font-semibold">Son de fin de repos</div><div className="text-[13px] text-muted">{sound ? 'Activé' : 'Coupé'}</div></div>
          <Toggle checked={sound} label="Son de fin de repos" onChange={() => setRestSound(!sound)} />
        </Row>
      </Group>

      <Group header="Rappels" footer={isIOS() && !isStandalone() ? 'Sur iPhone, ajoute d\'abord MIND à l\'écran d\'accueil.' : undefined}>
        <Row>
          <RowIcon name="bell" color="#FF453A" />
          <div className="flex-1"><div className="font-semibold">Rappel de séance</div><div className="text-[13px] text-muted">Le jour d'une séance</div></div>
          <Toggle checked={me.notifications} label="Rappel de séance"
            onChange={() => { if (me.notifications) updateProfile(me.id, { notifications: false }); else if (pushState() === 'granted') updateProfile(me.id, { notifications: true }); else setGuide(true) }} />
        </Row>
        <Row><RowIcon name="clock" color="#FF9F0A" /><div className="flex-1 font-semibold">Heure du rappel</div>
          <input type="time" value={me.reminderTime} onChange={(e) => updateProfile(me.id, { reminderTime: e.target.value })} className="bg-surface2 rounded-[10px] h-10 px-3 outline-none font-semibold num" /></Row>
        <Row onClick={() => setGuide(true)}><RowIcon name="home" color="#0A84FF" /><div className="flex-1 font-semibold">Ajouter MIND à l'écran d'accueil</div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
      </Group>

      <div className="mb-6">
        <div className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted font-medium">Apparence</div>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Apparence">
          {([['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']] as const).map(([v, label]) => {
            const on = me.theme === v
            const dark = { bg: '#000', bar: '#2c2c2e', line: '#3a3a3c' }, light = { bg: '#f2f2f7', bar: '#fff', line: '#d1d1d6' }
            return (
              <motion.button key={v} role="radio" aria-checked={on} aria-label={label} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => updateProfile(me.id, { theme: v })} className="flex flex-col items-center gap-2 rounded-[18px] bg-surface p-2.5 pb-3" style={{ boxShadow: on ? 'inset 0 0 0 2px var(--accent)' : 'var(--shadow-card)' }}>
                <div className="w-full h-[74px] rounded-[12px] overflow-hidden relative flex" style={{ border: '1px solid var(--sep)' }}>
                  {(v === 'auto' ? [light, dark] : [v === 'clair' ? light : dark]).map((t, i) => (
                    <div key={i} className="flex-1 p-1.5 flex flex-col gap-1" style={{ background: t.bg }}>
                      <div className="h-2 w-2/3 rounded-full" style={{ background: t.line }} />
                      <div className="flex-1 rounded-[5px]" style={{ background: t.bar }} />
                      <div className="h-1.5 rounded-full" style={{ background: i === 0 ? 'var(--accent)' : t.line, width: '40%' }} />
                    </div>
                  ))}
                </div>
                <span className="text-[14px] font-semibold flex items-center gap-1">{on && <span style={{ color: 'var(--accent)' }}><Icon name="check" size={14} strokeWidth={3.2} /></span>}{label}</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="mb-6">
        <div className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted font-medium">Style</div>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Style de l'interface">
          {([['feminin', 'Féminin', 'doux et rond', ['#F7BCA6', '#E63869', '#3A22DD']], ['masculin', 'Masculin', 'franc et net', ['#E88F30', '#A92A33', '#1A0A0C']]] as [Look, string, string, string[]][]).map(([v, label, sub, cols]) => {
            const on = look === v
            const masc = v === 'masculin'
            return (
              <motion.button key={v} role="radio" aria-checked={on} aria-label={`Style ${label}`} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => setLook(v)} className="flex flex-col items-center gap-2 rounded-[18px] bg-surface p-2.5 pb-3" style={{ boxShadow: on ? 'inset 0 0 0 2px var(--accent)' : 'var(--shadow-card)' }}>
                <div className="w-full h-[74px] overflow-hidden relative flex items-end p-1.5" style={{ borderRadius: masc ? 7 : 14, background: `linear-gradient(${masc ? 150 : 170}deg, ${cols[0]}, ${cols[1]} 55%, ${cols[2]})` }}>
                  <div className="w-full h-[26px]" style={{ background: 'rgba(0,0,0,.35)', borderRadius: masc ? 4 : 10 }} />
                </div>
                <span className="text-[14px] font-semibold flex items-center gap-1">{on && <span style={{ color: 'var(--accent)' }}><Icon name="check" size={14} strokeWidth={3.2} /></span>}{label}</span>
                <span className="text-[11.5px] text-muted -mt-1.5 leading-tight">{sub}</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {edits.length > 0 && (
        <Group header="Historique des modifications">
          {edits.map((e) => (
            <Row key={e.id}><div className="flex-1"><div className="text-[14.5px]">{e.text}</div>
              <div className="text-[12px] text-muted">{e.byName} ({e.by === 'coach' ? 'coach' : 'client'}) · {new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div></div></Row>
          ))}
        </Group>
      )}

      <Group>
        <Row onClick={async () => { await signOut(); nav('/') }}><RowIcon name="logout" color="#FF453A" /><div className="flex-1 font-semibold" style={{ color: '#FF453A' }}>Se déconnecter</div></Row>
        {!REMOTE && (        <Row onClick={() => { if (confirm('Réinitialiser toutes les données locales et recréer la démo ?')) { resetDB(); ensureSeed(); nav('/') } }}><RowIcon name="refresh" color="#8E8E93" /><div className="flex-1 text-muted">Réinitialiser les données de démo</div></Row>)}
      </Group>
      <p className="text-center text-[12px] text-faint pb-4">MIND · mode local · les données restent sur cet appareil</p>
      <Sheet open={switching} onClose={() => setSwitching(false)} title="Passer en mode libre">
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] text-muted leading-snug">MIND ne génère plus ta musculation : tu crées tes séances, tu les places dans ta semaine et tu notes tes charges. Ton plan de course MIND éventuel est conservé. Ton historique aussi.</p>
          <Button full color="var(--muscu)" onClick={() => { switchToLibre(userId, true); setSwitching(false); toast('Mode libre activé'); nav(me.role === 'coach' ? '/coach/me' : '/app/sessions') }}>Partir de mon programme actuel</Button>
          <Button full variant="secondary" onClick={() => { switchToLibre(userId, false); setSwitching(false); toast('Mode libre activé'); nav(me.role === 'coach' ? '/coach/me' : '/app/sessions') }}>Partir de zéro</Button>
        </div>
      </Sheet>
      <InstallGuide open={guide} onClose={() => setGuide(false)} onGranted={() => updateProfile(me.id, { notifications: true })} />
    </div>
  )
}

export default function ProfilePage({ userId }: { userId: string }) {
  return <Page title="Profil"><ProfileView userId={userId} /></Page>
}
