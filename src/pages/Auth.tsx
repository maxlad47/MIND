import { motion } from 'framer-motion'
import { useState } from 'react'
import { signIn, signUp } from '@/lib/auth'
import { REMOTE } from '@/lib/supabase'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/seed'
import { Button, Cover, Field, Icon, inputCls, Segmented, SportIcon, spring } from '@/ui/kit'
import { Logo } from '@/ui/motion'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const r = mode === 'in' ? await signIn(email, pw) : await signUp(email, pw, name)
      if (!r.ok) setErr(r.error ?? 'Une erreur est survenue.')
    } finally { setBusy(false) }
  }
  const demo = async (email: string) => { const r = await signIn(email, DEMO_PASSWORD); if (!r.ok) setErr(r.error ?? '') }

  return (
    <div className="relative overflow-hidden flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="absolute inset-x-0 top-0 h-[55%]">
        <Cover seed="mind-login-3" sports={['muscu', 'course']} scrim={false} className="h-full">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, var(--bg) 100%)' }} />
        </Cover>
      </div>
      <div className="relative w-full max-w-md mx-auto px-5 pt-safe flex flex-col flex-1 justify-center gap-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col items-center text-center">
          <Logo size={68} />
          <div className="t-display text-[34px] font-extrabold tracking-[-0.035em] leading-none text-white mt-4" style={{ textShadow: '0 2px 20px rgba(0,0,0,.25)' }}>Bienvenue.</div>
          <p className="hide-short text-[15px] mt-2 text-white/90 font-medium leading-snug max-w-[260px]" style={{ textShadow: '0 1px 12px rgba(0,0,0,.3)' }}>Musculation et course, qui s'adaptent à toi.</p>
        </motion.div>

        <motion.form initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}
          onSubmit={(e) => { e.preventDefault(); submit() }}
          className="flex flex-col gap-2.5 glass-strong rounded-[26px] p-3.5 border border-sep" style={{ boxShadow: 'var(--shadow-float)' }}>
          <Segmented value={mode} onChange={(v) => { setMode(v); setErr('') }} options={[{ value: 'in', label: 'Connexion' }, { value: 'up', label: 'Créer un compte' }]} />
          {mode === 'up' && <Field><input className={`${inputCls} !bg-surface2`} placeholder="Prénom" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></Field>}
          <Field><input className={`${inputCls} !bg-surface2`} placeholder="Email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Field><input className={`${inputCls} !bg-surface2`} placeholder="Mot de passe" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
          {err && <p className="text-bad text-[14px] px-1 flex items-center gap-1.5" role="alert"><Icon name="alert" size={16} /> {err}</p>}
          <Button full type="submit" disabled={busy}>{busy ? 'Un instant…' : mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</Button>
        </motion.form>

        {!REMOTE && <div>
          <div className="text-[12.5px] uppercase tracking-wide text-muted mb-2 text-center font-medium">Découvrir la démo</div>
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.96 }} transition={spring} className="text-left" onClick={() => demo(DEMO_ACCOUNTS.client)}>
              <Cover seed="demo-client" sports={['muscu']} className="rounded-[22px] h-[104px]" style={{ boxShadow: 'var(--shadow-cover)' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-2 gap-0.5">
                  <div className="flex gap-1.5 mb-1"><SportIcon sport="muscu" size={18} color="#fff" /><SportIcon sport="course" size={18} color="#fff" /></div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wide opacity-85">Espace client</div>
                  <div className="text-[21px] font-extrabold leading-tight tracking-tight">Camille</div>
                </div>
              </Cover>
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} transition={spring} className="text-left" onClick={() => demo(DEMO_ACCOUNTS.coach)}>
              <Cover seed="demo-coach-2" sports={['course']} className="rounded-[22px] h-[104px]" style={{ boxShadow: 'var(--shadow-cover)' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-2 gap-0.5">
                  <div className="mb-1"><Icon name="users" size={20} color="#fff" /></div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wide opacity-85">Espace coach</div>
                  <div className="text-[21px] font-extrabold leading-tight tracking-tight">Max</div>
                </div>
              </Cover>
            </motion.button>
          </div>
          <p className="hide-short text-[11.5px] text-muted mt-2.5 px-1 leading-snug text-center">Mode local : données stockées sur cet appareil. Mot de passe des démos : « {DEMO_PASSWORD} ».</p>
        </div>}
      </div>
    </div>
  )
}
