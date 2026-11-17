import { describe, expect, it } from 'vitest'
import { surveillerMiseAJour } from './pwa.js'

function fauxRegistration({ waiting = null } = {}) {
  const ecouteurs = {}
  return {
    waiting,
    installing: null,
    addEventListener: (nom, fn) => {
      ecouteurs[nom] = fn
    },
    declencher: (nom) => ecouteurs[nom]?.(),
  }
}

function fauxWorker() {
  const ecouteurs = {}
  const messages = []
  return {
    state: 'installing',
    messages,
    postMessage: (m) => messages.push(m),
    addEventListener: (nom, fn) => {
      ecouteurs[nom] = fn
    },
    passer(etat) {
      this.state = etat
      ecouteurs.statechange?.()
    },
  }
}

describe('détection de nouvelle version', () => {
  it('installation terminée alors qu’une version est déjà active : signale la mise à jour', () => {
    const registration = fauxRegistration()
    const signalements = []
    surveillerMiseAJour(registration, () => true, (appliquer) => signalements.push(appliquer))
    const worker = fauxWorker()
    registration.installing = worker
    registration.declencher('updatefound')
    worker.passer('installing')
    expect(signalements).toHaveLength(0)
    worker.passer('installed')
    expect(signalements).toHaveLength(1)
    signalements[0]()
    expect(worker.messages).toEqual(['SKIP_WAITING'])
  })

  it('première installation (aucune version active) : pas de message de mise à jour', () => {
    const registration = fauxRegistration()
    const signalements = []
    surveillerMiseAJour(registration, () => false, (a) => signalements.push(a))
    const worker = fauxWorker()
    registration.installing = worker
    registration.declencher('updatefound')
    worker.passer('installed')
    expect(signalements).toHaveLength(0)
  })

  it('version déjà en attente au chargement de la page : signale la mise à jour', () => {
    const attente = fauxWorker()
    const signalements = []
    surveillerMiseAJour(fauxRegistration({ waiting: attente }), () => true, (a) => signalements.push(a))
    expect(signalements).toHaveLength(1)
    signalements[0]()
    expect(attente.messages).toEqual(['SKIP_WAITING'])
  })
})
