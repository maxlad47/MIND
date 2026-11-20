// V0-M7 : contrôle de cohérence de la bibliothèque `data/exercices.json`.
// Vérifie les champs du critère de MISSIONS.md et leur accord avec REGLES.md v6 (M5-M12, M17, M25, M29, U5).
import { describe, it, expect } from 'vitest'
import bibliotheque from '../../data/exercices.json'
import { GROUPES_MUSCULAIRES } from '../profil/groupes.js'

const { exercices, equipements } = bibliotheque

const NIVEAUX = ['classique', 'complementaire', 'specifique'] // M8
const CONTEXTES = ['renfo_coureur'] // M8, M12
const MATERIELS = ['barre', 'halteres', 'machine', 'poids_du_corps', 'assiste'] // M25
const ZONES = ['haut', 'bas'] // M17
const TYPES = ['polyarticulaire', 'isolation'] // M5
const MESURES = ['reps', 'duree']
const MUSCLES = GROUPES_MUSCULAIRES.map((g) => g.cle)
const MUSCLES_BAS = ['quadriceps', 'ischios', 'fessiers', 'mollets']
// U5 (v6) : familles de polyarticulaires jambes, « lourdes » seulement à RPE visé ≥ 7
const FAMILLES_U5 = ['squat', 'charniere_hanche', 'fentes', 'presse', 'extension_hanche']
const CHAMPS = [
  'id', 'nom', 'niveau_usage', 'contexte', 'famille', 'principal_possible',
  'materiel', 'muscle_principal', 'zone', 'type', 'mesure',
]

describe('data/exercices.json', () => {
  it('a un numéro de version et une liste non vide', () => {
    expect(bibliotheque.version).toBe(2)
    expect(exercices.length).toBeGreaterThan(0)
  })

  it('chaque exercice a exactement les champs attendus', () => {
    for (const ex of exercices) {
      expect(Object.keys(ex).sort(), ex.id).toEqual([...CHAMPS].sort())
    }
  })

  it('les identifiants sont uniques et en minuscules sans accent', () => {
    const ids = exercices.map((ex) => ex.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('chaque valeur appartient à sa liste', () => {
    for (const ex of exercices) {
      expect(NIVEAUX, ex.id).toContain(ex.niveau_usage)
      expect(MATERIELS, ex.id).toContain(ex.materiel)
      expect(MUSCLES, ex.id).toContain(ex.muscle_principal)
      expect(ZONES, ex.id).toContain(ex.zone)
      expect(TYPES, ex.id).toContain(ex.type)
      expect(MESURES, ex.id).toContain(ex.mesure)
      expect(typeof ex.principal_possible, ex.id).toBe('boolean')
      expect(ex.nom.length, ex.id).toBeGreaterThan(0)
      expect(ex.famille, ex.id).toMatch(/^[a-z_]+$/)
    }
  })

  it('M8 : un exercice spécifique a un contexte, les autres non', () => {
    for (const ex of exercices) {
      if (ex.niveau_usage === 'specifique') expect(CONTEXTES, ex.id).toContain(ex.contexte)
      else expect(ex.contexte, ex.id).toBeNull()
    }
  })

  it('M6 : seul un polyarticulaire non spécifique peut être principal', () => {
    for (const ex of exercices.filter((e) => e.principal_possible)) {
      expect(ex.type, ex.id).toBe('polyarticulaire')
      expect(ex.niveau_usage, ex.id).not.toBe('specifique')
    }
  })

  it('M7 : chaque famille avec un principal possible a au moins une autre option (assistance)', () => {
    const familles = new Set(exercices.filter((e) => e.principal_possible).map((e) => e.famille))
    for (const famille of familles) {
      const membres = exercices.filter((e) => e.famille === famille && e.niveau_usage !== 'specifique')
      expect(membres.length, famille).toBeGreaterThanOrEqual(2)
    }
  })

  it('M17 : la zone suit le muscle principal (jambes = bas), sauf charnière de hanche', () => {
    // Exception validée par Max (17/11/2026) : le soulevé de terre est un exercice de dos
    // (ischios en secondaire), mais reste « bas » pour la progression à la barre (+5 kg).
    for (const ex of exercices) {
      if (MUSCLES_BAS.includes(ex.muscle_principal)) expect(ex.zone, ex.id).toBe('bas')
      else if (ex.zone === 'bas') expect(ex.famille, ex.id).toBe('charniere_hanche')
    }
  })

  it('M29 : chaque équipement liste des matériels connus, la salle les a tous', () => {
    expect(Object.keys(equipements).sort()).toEqual(['maison_halteres', 'poids_du_corps', 'salle'])
    for (const liste of Object.values(equipements)) {
      for (const m of liste) expect(MATERIELS).toContain(m)
    }
    expect([...equipements.salle].sort()).toEqual([...MATERIELS].sort())
  })

  it('M10, M11 : chaque muscle a un exercice non spécifique en salle et à la maison avec haltères', () => {
    for (const equipement of ['salle', 'maison_halteres']) {
      for (const muscle of MUSCLES) {
        const trouves = exercices.filter(
          (e) => e.muscle_principal === muscle
            && e.niveau_usage !== 'specifique'
            && equipements[equipement].includes(e.materiel),
        )
        expect(trouves.length, `${muscle} / ${equipement}`).toBeGreaterThan(0)
      }
    }
  })

  it('M8 : chaque muscle a au moins un exercice classique en salle', () => {
    for (const muscle of MUSCLES) {
      const classiques = exercices.filter((e) => e.muscle_principal === muscle && e.niveau_usage === 'classique')
      expect(classiques.length, muscle).toBeGreaterThan(0)
    }
  })

  it('U5 : chaque famille de jambes lourdes existe et a un principal possible', () => {
    for (const famille of FAMILLES_U5) {
      expect(exercices.some((e) => e.famille === famille && e.principal_possible), famille).toBe(true)
    }
  })

  it('M12 : le renfo coureur couvre les jambes et le tronc, sans matériel de salle', () => {
    const renfo = exercices.filter((e) => e.contexte === 'renfo_coureur')
    for (const muscle of [...MUSCLES_BAS, 'abdos']) {
      expect(renfo.some((e) => e.muscle_principal === muscle), muscle).toBe(true)
    }
    for (const ex of renfo) expect(equipements.maison_halteres, ex.id).toContain(ex.materiel)
  })
})
