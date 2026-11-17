import { useState } from 'react'
import { chargerFormulaire, enregistrerProfil, estCourseVisee } from '../profil/formulaire.js'
import { GROUPES_MUSCULAIRES } from '../profil/groupes.js'
import {
  EQUIPEMENTS,
  JOURS,
  JOURS_LIBELLES,
  NIVEAUX_MUSCU,
  OBJECTIFS_COURSE,
  OBJECTIFS_MUSCU,
  OBJECTIFS_PRIORITAIRES,
  ORGANISATIONS,
  SOUS_OBJECTIFS,
  STATUTS_GROUPE_LIBELLES,
} from '../profil/options.js'

function Champ({ etiquette, aide, erreur, children }) {
  return (
    <div className="champ">
      <label>
        <span className="etiquette">{etiquette}</span>
        {children}
      </label>
      {aide && <p className="aide">{aide}</p>}
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  )
}

function Choix({ valeur, options, onChange, vide = 'Non renseigné', ...reste }) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} {...reste}>
      <option value="">{vide}</option>
      {options.map(([v, libelle]) => (
        <option key={v} value={v}>
          {libelle}
        </option>
      ))}
    </select>
  )
}

export default function Profil({ depot, onEnregistre = () => {} }) {
  const [form, setForm] = useState(() => chargerFormulaire(depot))
  const [erreurs, setErreurs] = useState({})
  const [message, setMessage] = useState('')

  const modifier = (champ, valeur) => {
    setForm((f) => ({ ...f, [champ]: valeur }))
    setMessage('')
  }
  const basculerJour = (jour) =>
    modifier(
      'jours_dispo',
      form.jours_dispo.includes(jour)
        ? form.jours_dispo.filter((j) => j !== jour)
        : JOURS.filter((j) => j === jour || form.jours_dispo.includes(j)),
    )
  const modifierVolume = (i, valeur) =>
    modifier(
      'volume_declare_4sem_min',
      form.volume_declare_4sem_min.map((v, k) => (k === i ? valeur : v)),
    )
  const modifierGroupe = (cle, statut) =>
    modifier('groupes_statut', { ...form.groupes_statut, [cle]: statut })

  const enregistrer = (e) => {
    e.preventDefault()
    try {
      const resultat = enregistrerProfil(depot, form)
      if (resultat.ok) {
        setErreurs({})
        setForm(chargerFormulaire(depot))
        setMessage('Profil enregistré.')
        onEnregistre()
      } else {
        setErreurs(resultat.erreurs)
        setMessage('')
      }
    } catch {
      setErreurs({ general: "Enregistrement impossible : le stockage de l'appareil a refusé l'écriture." })
    }
  }

  const course = estCourseVisee(form.objectif_course)

  return (
    <form className="profil" onSubmit={enregistrer} noValidate>
      <h1>Profil</h1>

      <fieldset>
        <legend>Toi</legend>
        <Champ etiquette="Prénom" erreur={erreurs.prenom}>
          <input type="text" value={form.prenom} onChange={(e) => modifier('prenom', e.target.value)} />
        </Champ>
      </fieldset>

      <fieldset>
        <legend>Objectifs</legend>
        <Champ etiquette="Objectif course">
          <Choix valeur={form.objectif_course} options={OBJECTIFS_COURSE} onChange={(v) => modifier('objectif_course', v)} />
        </Champ>
        {form.objectif_course === 'pas_de_course' && (
          <Champ etiquette="Sans course visée, tu veux…">
            <Choix valeur={form.pas_de_course_type} options={SOUS_OBJECTIFS} onChange={(v) => modifier('pas_de_course_type', v)} />
          </Champ>
        )}
        {course && (
          <Champ
            etiquette="Date de la course"
            aide="Nécessaire pour générer un plan (règle C10)."
            erreur={erreurs.date_course}
          >
            <input type="date" value={form.date_course} onChange={(e) => modifier('date_course', e.target.value)} />
          </Champ>
        )}
        <Champ etiquette="Objectif muscu">
          <Choix valeur={form.objectif_muscu} options={OBJECTIFS_MUSCU} onChange={(v) => modifier('objectif_muscu', v)} />
        </Champ>
        <Champ etiquette="En cas de conflit, la priorité va à">
          <Choix valeur={form.objectif_prioritaire} options={OBJECTIFS_PRIORITAIRES} onChange={(v) => modifier('objectif_prioritaire', v)} />
        </Champ>
      </fieldset>

      <fieldset>
        <legend>Disponibilités</legend>
        <div className="champ">
          <span className="etiquette">Jours d’entraînement</span>
          <div className="jours">
            {JOURS.map((jour) => (
              <label key={jour} className="jour">
                <input type="checkbox" checked={form.jours_dispo.includes(jour)} onChange={() => basculerJour(jour)} />
                <span>{JOURS_LIBELLES[jour]}</span>
              </label>
            ))}
          </div>
        </div>
        <Champ etiquette="Temps par jour (minutes)" erreur={erreurs.temps_par_jour_min}>
          <input type="text" inputMode="numeric" placeholder="ex. 60" value={form.temps_par_jour_min} onChange={(e) => modifier('temps_par_jour_min', e.target.value)} />
        </Champ>
        <Champ etiquette="Séances de course par semaine" erreur={erreurs.nb_seances_course}>
          <input type="text" inputMode="numeric" value={form.nb_seances_course} onChange={(e) => modifier('nb_seances_course', e.target.value)} />
        </Champ>
        <Champ etiquette="Séances de muscu par semaine" erreur={erreurs.nb_seances_muscu}>
          <input type="text" inputMode="numeric" value={form.nb_seances_muscu} onChange={(e) => modifier('nb_seances_muscu', e.target.value)} />
        </Champ>
      </fieldset>

      <fieldset>
        <legend>Musculation</legend>
        <Champ etiquette="Organisation">
          <Choix valeur={form.organisation_muscu} options={ORGANISATIONS} onChange={(v) => modifier('organisation_muscu', v)} />
        </Champ>
        <Champ etiquette="Niveau de muscu">
          <Choix valeur={form.niveau_muscu} options={NIVEAUX_MUSCU} onChange={(v) => modifier('niveau_muscu', v)} />
        </Champ>
        <Champ etiquette="Équipement">
          <Choix valeur={form.equipement} options={EQUIPEMENTS} onChange={(v) => modifier('equipement', v)} />
        </Champ>
        <div className="champ">
          <span className="etiquette">Des muscles en priorité ou des exclusions ?</span>
          <div className="jours">
            {[
              [true, 'Oui'],
              [false, 'Non'],
            ].map(([valeur, libelle]) => (
              <label key={libelle} className="jour">
                <input
                  type="radio"
                  name="groupes_actif"
                  checked={form.groupes_actif === valeur}
                  onChange={() => modifier('groupes_actif', valeur)}
                />
                <span>{libelle}</span>
              </label>
            ))}
          </div>
          {form.groupes_actif && (
            <div className="groupes">
              {GROUPES_MUSCULAIRES.map((g) => (
                <label key={g.cle} className="groupe">
                  <span>{g.libelle}</span>
                  <select
                    aria-label={g.libelle}
                    value={form.groupes_statut[g.cle]}
                    onChange={(e) => modifierGroupe(g.cle, e.target.value)}
                  >
                    {STATUTS_GROUPE_LIBELLES.map(([v, libelle]) => (
                      <option key={v} value={v}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Course à pied</legend>
        <Champ
          etiquette="Chrono 10 km (facultatif)"
          aide="Sans chrono, l’appli propose de l’endurance fondamentale et un test de 6 minutes en semaine 1."
          erreur={erreurs.chrono_10km}
        >
          <input type="text" inputMode="numeric" placeholder="mm:ss ou h:mm:ss" value={form.chrono_10km} onChange={(e) => modifier('chrono_10km', e.target.value)} />
        </Champ>
        <div className="champ">
          <span className="etiquette">Volume de course des 4 dernières semaines (minutes par semaine)</span>
          <div className="volumes">
            {form.volume_declare_4sem_min.map((v, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                aria-label={`Semaine ${i + 1}`}
                placeholder={`S${i + 1}`}
                value={v}
                onChange={(e) => modifierVolume(i, e.target.value)}
              />
            ))}
          </div>
          {erreurs.volume_declare_4sem_min && (
            <p className="erreur" role="alert">
              {erreurs.volume_declare_4sem_min}
            </p>
          )}
        </div>
        <Champ etiquette="Je cours régulièrement depuis le" erreur={erreurs.course_reguliere_depuis}>
          <input type="date" value={form.course_reguliere_depuis} onChange={(e) => modifier('course_reguliere_depuis', e.target.value)} />
        </Champ>
      </fieldset>

      {Object.entries(erreurs)
        .filter(([cle]) => cle === 'general' || cle.startsWith('mind_'))
        .map(([cle, texte]) => (
          <p key={cle} className="erreur" role="alert">
            {texte}
          </p>
        ))}
      {Object.keys(erreurs).some((c) => !c.startsWith('mind_') && c !== 'general') && (
        <p className="erreur" role="alert">
          Corrige les champs signalés pour enregistrer.
        </p>
      )}
      {message && (
        <p className="confirmation" role="status">
          {message}
        </p>
      )}
      <button type="submit">Enregistrer</button>
    </form>
  )
}
