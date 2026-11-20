"""Profils finaux : 20 tirés (tirage.json, graine 20261118) avec retouches de cohérence notées,
+ 10 cas limites écrits à la main. Sortie : profils.json"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
P = {p['id']: p for p in json.load(open(os.path.join(D, 'tirage.json')))}
retouches = {}

def fix(pid, note, **kw):
    P[pid].update(kw)
    retouches.setdefault(pid, []).append(note)

# Jour de sortie longue hors des jours choisis : impossible dans le formulaire -> dernier jour dispo du week-end, sinon dernier jour.
for pid, p in P.items():
    if p['nb_sorties'] != 0 and p['jour_sortie_longue'] not in p['jours']:
        nouveau = 'dim' if 'dim' in p['jours'] else ('sam' if 'sam' in p['jours'] else p['jours'][-1])
        fix(pid, f"jour de sortie longue {p['jour_sortie_longue']} hors des jours choisis → {nouveau}", jour_sortie_longue=nouveau)

# Plus longue sortie récente : le tirage dit seulement « répondu » ; valeur fixée à ~40 % du volume déclaré.
for pid, p in P.items():
    if p['plus_longue_sortie'] == 'oui':
        v = p['volume']
        p['plus_longue_sortie'] = {'valeur': max(1, round(v * 0.4)), 'unite': p['volume_unite']}
    elif p['plus_longue_sortie'] is None:
        pass

fix('P14', "volume 247 min en 1 sortie (4 h d'un coup) jugé absurde → 70 min", volume=70, volume_unite='min',
    plus_longue_sortie={'valeur': 70, 'unite': 'min'})
# Sans muscu : champs muscu sans objet
for pid in ('P07', 'P14'):
    P[pid].update(nb_seances_muscu=0, organisation=None, prioritaires=[], exclus=[])

edge = [
 dict(id='P21', note="Marathon dans 5 semaines (C5), coureur confirmé", objectif_course='marathon', semaines_avant_course=5,
      chrono={'distance': 10, 'temps_s': 45*60}, regulier_6_mois=True, nb_sorties=4, volume_unite='min', volume=240,
      plus_longue_sortie={'valeur': 110, 'unite': 'min'}, jour_sortie_longue='dim', objectif_muscu='aucun', nb_seances_muscu=0,
      niveau_muscu='debutant', equipement='salle', organisation=None, prioritaires=[], exclus=[], renfo_coureur=True,
      tractions_strictes=0, jours=['mar', 'jeu', 'sam', 'dim'], temps_par_jour=60, temps_sortie_longue=180, prioritaire='course'),
 dict(id='P22', note="Débutant total sans chrono (N7, T3), 10 km dans 16 semaines", objectif_course='10km', semaines_avant_course=16,
      chrono=None, regulier_6_mois=False, nb_sorties=2, volume_unite='min', volume=50, plus_longue_sortie={'valeur': 25, 'unite': 'min'},
      jour_sortie_longue='dim', objectif_muscu='tonification', nb_seances_muscu=2, niveau_muscu='debutant', equipement='maison_halteres',
      organisation='je_ne_sais_pas', prioritaires=[], exclus=[], renfo_coureur=True, tractions_strictes=0,
      jours=['mer', 'sam', 'dim'], temps_par_jour=30, temps_sortie_longue=60, prioritaire='course'),
 dict(id='P23', note="Marathon dans 22 semaines avec 170 min/sem. : sous le seuil C9 de 10 min", objectif_course='marathon',
      semaines_avant_course=22, chrono={'distance': 10, 'temps_s': 47*60}, regulier_6_mois=True, nb_sorties=4, volume_unite='min',
      volume=170, plus_longue_sortie={'valeur': 70, 'unite': 'min'}, jour_sortie_longue='dim', objectif_muscu='hypertrophie',
      nb_seances_muscu=2, niveau_muscu='intermediaire', equipement='salle', organisation='je_ne_sais_pas', prioritaires=[], exclus=[],
      renfo_coureur=True, tractions_strictes=4, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], temps_par_jour=60, temps_sortie_longue=180,
      prioritaire='course'),
 dict(id='P24', note="Muscu seule : aucune course (0 sortie), force, 4 séances", objectif_course='pas_de_course',
      pas_de_course_type='garder_forme', semaines_avant_course=None, chrono=None, regulier_6_mois=False, nb_sorties=0,
      volume_unite='min', volume=0, plus_longue_sortie=None, jour_sortie_longue=None, objectif_muscu='force', nb_seances_muscu=4,
      niveau_muscu='confirme', equipement='salle', organisation='je_ne_sais_pas', prioritaires=['pectoraux', 'dos', 'quadriceps'],
      exclus=[], renfo_coureur=False, tractions_strictes=12, jours=['lun', 'mar', 'jeu', 'ven'], temps_par_jour=90,
      temps_sortie_longue=None, prioritaire='muscu'),
 dict(id='P25', note="Expert (33'30), semi dans 12 semaines, gros volume, 6 jours", objectif_course='semi', semaines_avant_course=12,
      chrono={'distance': 10, 'temps_s': 33*60+30}, regulier_6_mois=True, nb_sorties=5, volume_unite='km', volume=75,
      plus_longue_sortie={'valeur': 22, 'unite': 'km'}, jour_sortie_longue='dim', objectif_muscu='force_esthetique', nb_seances_muscu=2,
      niveau_muscu='intermediaire', equipement='salle', organisation='je_ne_sais_pas', prioritaires=[], exclus=[], renfo_coureur=True,
      tractions_strictes=8, jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], temps_par_jour=90, temps_sortie_longue=150,
      prioritaire='course'),
 dict(id='P26', note="Poids du corps seul, objectif force, 30 min, aucune traction stricte", objectif_course='10km',
      semaines_avant_course=12, chrono={'distance': 5, 'temps_s': 24*60}, regulier_6_mois=True, nb_sorties=3, volume_unite='km',
      volume=25, plus_longue_sortie={'valeur': 10, 'unite': 'km'}, jour_sortie_longue='dim', objectif_muscu='force', nb_seances_muscu=3,
      niveau_muscu='intermediaire', equipement='poids_du_corps', organisation='je_ne_sais_pas', prioritaires=[], exclus=[],
      renfo_coureur=True, tractions_strictes=0, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], temps_par_jour=30, temps_sortie_longue=90,
      prioritaire='course'),
 dict(id='P27', note="Reprise après arrêt (N2), ancien chrono 55'00, semi dans 18 semaines, jambes prioritaires", objectif_course='semi',
      semaines_avant_course=18, chrono={'distance': 10, 'temps_s': 55*60}, regulier_6_mois=False, nb_sorties=3, volume_unite='min',
      volume=90, plus_longue_sortie={'valeur': 40, 'unite': 'min'}, jour_sortie_longue='sam', objectif_muscu='hypertrophie',
      nb_seances_muscu=2, niveau_muscu='intermediaire', equipement='salle', organisation='je_ne_sais_pas',
      prioritaires=['fessiers', 'quadriceps'], exclus=[], renfo_coureur=True, tractions_strictes=0,
      jours=['mar', 'jeu', 'sam', 'dim'], temps_par_jour=45, temps_sortie_longue=120, prioritaire='course'),
 dict(id='P28', note="7 jours, 5 sorties + 3 muscu, refuse le jour de repos (P5), marathon dans 18 semaines", objectif_course='marathon',
      semaines_avant_course=18, chrono={'distance': 10, 'temps_s': 39*60}, regulier_6_mois=True, nb_sorties=5, volume_unite='min',
      volume=300, plus_longue_sortie={'valeur': 120, 'unite': 'min'}, jour_sortie_longue='dim', objectif_muscu='hypertrophie',
      nb_seances_muscu=3, niveau_muscu='confirme', equipement='salle', organisation='je_ne_sais_pas', prioritaires=[], exclus=[],
      renfo_coureur=True, tractions_strictes=10, jours=['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], temps_par_jour=60,
      temps_sortie_longue=180, prioritaire='course', refus_repos=True),
 dict(id='P29', note="Exclusions lourdes (dos, quadriceps, ischios) + renfo coureur coché, biceps prioritaire", objectif_course='10km',
      semaines_avant_course=9, chrono={'distance': 10, 'temps_s': 53*60}, regulier_6_mois=True, nb_sorties=3, volume_unite='km',
      volume=20, plus_longue_sortie={'valeur': 9, 'unite': 'km'}, jour_sortie_longue='dim', objectif_muscu='hypertrophie',
      nb_seances_muscu=3, niveau_muscu='intermediaire', equipement='salle', organisation='full_body', prioritaires=['biceps'],
      exclus=['dos', 'quadriceps', 'ischios'], renfo_coureur=True, tractions_strictes=0,
      jours=['lun', 'mer', 'ven', 'sam', 'dim'], temps_par_jour=60, temps_sortie_longue=90, prioritaire='course'),
 dict(id='P30', note="« Courir plus vite » sans course, 30 min par jour, sortie longue le samedi", objectif_course='pas_de_course',
      pas_de_course_type='courir_plus_vite', semaines_avant_course=None, chrono={'distance': 10, 'temps_s': 52*60},
      regulier_6_mois=True, nb_sorties=3, volume_unite='min', volume=120, plus_longue_sortie={'valeur': 50, 'unite': 'min'},
      jour_sortie_longue='sam', objectif_muscu='tonification', nb_seances_muscu=1, niveau_muscu='debutant', equipement='salle',
      organisation='haut_bas', prioritaires=[], exclus=[], renfo_coureur=False, tractions_strictes=0,
      jours=['lun', 'mer', 'sam'], temps_par_jour=30, temps_sortie_longue=90, prioritaire='course'),
]
out = []
for pid in sorted(P):
    p = P[pid]
    p['note'] = 'tiré au hasard'
    p['retouches'] = retouches.get(pid, [])
    out.append(p)
for e in edge:
    e.setdefault('retouches', [])
    e.setdefault('pas_de_course_type', None)
    out.append(e)
json.dump(out, open(os.path.join(D, 'profils.json'), 'w'), ensure_ascii=False, indent=1)
for p in out:
    print(p['id'], p['retouches'])
