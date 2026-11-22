// Connexion / inscription : comptes Supabase en ligne, comptes locaux sinon (démo).
import * as local from './store'
import { REMOTE } from './supabase'
import { remoteSignIn, remoteSignOut, remoteSignUp } from './remote'

type Result = { ok: boolean; error?: string }

export const signIn = async (email: string, password: string): Promise<Result> => (REMOTE ? remoteSignIn(email, password) : local.signIn(email, password))
export const signUp = async (email: string, password: string, firstName: string): Promise<Result> => (REMOTE ? remoteSignUp(email, password, firstName) : local.signUp(email, password, firstName))
export const signOut = async (): Promise<void> => { if (REMOTE) await remoteSignOut(); else local.signOut() }
