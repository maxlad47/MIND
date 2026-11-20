"""50 profils : Q01-Q35 tirés au hasard (graine 20261119), Q36-Q50 cas limites."""
import json, random, os
rng = random.Random(20261119)
J = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
G = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos']


def tirer(i):
    obj = rng.choice(['10km', '10km', 'semi', 'semi', 'marathon', 'pas_de_course', 'pas_de_course'])
    p = dict(id=f'Q{i:02d}', cas='tiré au hasard', objectif_course=obj)
    p['sous_objectif'] = rng.choice(['garder_forme', 'courir_plus', 'courir_plus_vite']) if obj == 'pas_de_course' else None
    p['semaines'] = rng.randint(5, 30) if obj != 'pas_de_course' else None
    t = rng.random()
    if t < 0.12: p['chrono'] = None; p['hyp_test_m'] = rng.choice([1000, 1100, 1250, 1400])
    elif t < 0.40: p['chrono'] = dict(d=5, t=rng.randint(18 * 60, 36 * 60))
    else: p['chrono'] = dict(d=10, t=rng.randint(35 * 60, 68 * 60))
    p['regulier'] = rng.random() < 0.75
    p['nb_sorties'] = rng.choice([1, 2, 3, 3, 4, 4, 5, 'jnsp'])
    p['vol_unite'] = 'min' if (p['chrono'] is None or rng.random() < 0.5) else 'km'
    p['vol'] = rng.randint(8, 60) if p['vol_unite'] == 'km' else rng.randint(40, 320)
    p['pls'] = rng.choice([None, 'oui', 'oui'])
    if p['pls'] == 'oui':
        p['pls'] = dict(v=max(3, round(p['vol'] * rng.uniform(0.3, 0.5))), u=p['vol_unite'])
    om = rng.choice(['force', 'force_esthetique', 'hypertrophie', 'tonification', 'aucun'])
    p['objectif_muscu'] = om
    p['nb_muscu'] = 0 if om == 'aucun' else rng.choice([1, 2, 2, 3, 3, 4, 'jnsp'])
    p['niveau_muscu'] = rng.choice(['debutant', 'intermediaire', 'confirme'])
    p['equipement'] = rng.choice(['salle', 'salle', 'salle', 'maison_halteres', 'poids_du_corps'])
    p['organisation'] = rng.choice(['full_body', 'haut_bas', 'ppj', 'pph', 'haut_jambes_fb', 'je_ne_sais_pas', 'je_ne_sais_pas'])
    g = list(G); rng.shuffle(g)
    p['prioritaires'] = g[:rng.choice([0, 0, 1, 2, 3])]
    p['exclus'] = g[5:5 + rng.choice([0, 0, 0, 1])]
    p['renfo'] = obj != 'pas_de_course' and rng.random() < 0.8
    p['tractions'] = rng.choice([0, 0, 1, 3, 6, 10])
    n = rng.randint(2, 7)
    p['jours'] = sorted(rng.sample(J, n), key=J.index)
    p['jour_sl'] = rng.choice(['dim', 'dim', 'dim', 'sam', 'mer'])
    p['tj'] = rng.choice([30, 45, 45, 60, 60, 90])
    p['tsl'] = rng.choice([60, 90, 120, 150, 180])
    p['prioritaire'] = rng.choice(['course', 'course', 'muscu'])
    return p


profils = [tirer(i) for i in range(1, 36)]
base = dict(regulier=True, hyp_test_m=None, pls=None, prioritaires=[], exclus=[], renfo=True, tractions=0, organisation='je_ne_sais_pas',
            niveau_muscu='intermediaire', equipement='salle', sous_objectif=None, semaines=None, chrono=None, prioritaire='course')
E = [
 dict(id='Q36', cas="Marathon dans 7 semaines (C5 : plan « finir »)", objectif_course='marathon', semaines=7, chrono=dict(d=10, t=46 * 60),
      nb_sorties=4, vol_unite='min', vol=230, pls=dict(v=110, u='min'), objectif_muscu='aucun', nb_muscu=0, jours=['mar', 'jeu', 'sam', 'dim'],
      jour_sl='dim', tj=60, tsl=180),
 dict(id='Q37', cas="10 km dans 3 semaines (C5)", objectif_course='10km', semaines=3, chrono=dict(d=10, t=52 * 60), nb_sorties=3,
      vol_unite='km', vol=25, pls=dict(v=10, u='km'), objectif_muscu='tonification', nb_muscu=1, jours=['lun', 'mer', 'ven', 'dim'],
      jour_sl='dim', tj=45, tsl=90),
 dict(id='Q38', cas="Semi avec 1 sortie (C9 : refus)", objectif_course='semi', semaines=14, chrono=dict(d=10, t=58 * 60), nb_sorties=1,
      vol_unite='min', vol=75, pls=dict(v=75, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['mar', 'jeu', 'sam', 'dim'],
      jour_sl='dim', tj=60, tsl=120),
 dict(id='Q39', cas="Marathon dans 24 semaines avec 160 min : C9 contrôlé en fin de préparation", objectif_course='marathon', semaines=24,
      chrono=dict(d=10, t=48 * 60), nb_sorties=4, vol_unite='min', vol=160, pls=dict(v=70, u='min'), objectif_muscu='force_esthetique', nb_muscu=2,
      jours=['lun', 'mar', 'jeu', 'sam', 'dim'], jour_sl='dim', tj=60, tsl=180),
 dict(id='Q40', cas="Débutant sans chrono, 60 min/sem. en 3 sorties (N8 : qualité douce)", objectif_course='10km', semaines=14,
      hyp_test_m=1050, regulier=False, nb_sorties=3, vol_unite='min', vol=60, objectif_muscu='tonification', nb_muscu=2,
      niveau_muscu='debutant', equipement='maison_halteres', jours=['lun', 'mer', 'ven', 'dim'], jour_sl='dim', tj=30, tsl=60),
 dict(id='Q41', cas="Muscu seule, hypertrophie 5 séances (E7)", objectif_course='pas_de_course', sous_objectif='muscu_seule', nb_sorties=0,
      vol_unite='min', vol=0, objectif_muscu='hypertrophie', nb_muscu=5, niveau_muscu='confirme', renfo=False, tractions=9,
      jours=['lun', 'mar', 'mer', 'jeu', 'ven'], jour_sl=None, tj=60, tsl=None, prioritaire='muscu', prioritaires=['dos', 'epaules']),
 dict(id='Q42', cas="Poids du corps, hypertrophie 3 × 45 min + 10 km (M8 complémentaires)", objectif_course='10km', semaines=11,
      chrono=dict(d=5, t=26 * 60), nb_sorties=3, vol_unite='km', vol=22, pls=dict(v=9, u='km'), objectif_muscu='hypertrophie', nb_muscu=3,
      equipement='poids_du_corps', tractions=2, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], jour_sl='dim', tj=45, tsl=90),
 dict(id='Q43', cas="Expert, marathon dans 18 semaines, 5 sorties, 90 min/jour", objectif_course='marathon', semaines=18,
      chrono=dict(d=10, t=34 * 60), nb_sorties=5, vol_unite='km', vol=80, pls=dict(v=28, u='km'), objectif_muscu='force', nb_muscu=1,
      niveau_muscu='confirme', jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], jour_sl='dim', tj=90, tsl=180),
 dict(id='Q44', cas="7 jours, 5 sorties + 4 muscu, refus du repos (P5)", objectif_course='semi', semaines=12, chrono=dict(d=10, t=44 * 60),
      nb_sorties=5, vol_unite='min', vol=280, pls=dict(v=100, u='min'), objectif_muscu='hypertrophie', nb_muscu=4, niveau_muscu='confirme',
      tractions=7, jours=J, jour_sl='dim', tj=60, tsl=120, refus_repos=True),
 dict(id='Q45', cas="Course seule, renfo coché sans muscu (E8, M12)", objectif_course='10km', semaines=10, chrono=dict(d=10, t=47 * 60),
      nb_sorties=4, vol_unite='km', vol=30, pls=dict(v=12, u='km'), objectif_muscu='aucun', nb_muscu=0, jours=['lun', 'mar', 'jeu', 'sam', 'dim'],
      jour_sl='dim', tj=60, tsl=90),
 dict(id='Q46', cas="Dos et quadriceps exclus, 10 km (M11)", objectif_course='10km', semaines=12, chrono=dict(d=10, t=50 * 60),
      nb_sorties=3, vol_unite='min', vol=150, pls=dict(v=65, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, exclus=['dos', 'quadriceps'],
      jours=['lun', 'mer', 'ven', 'dim'], jour_sl='dim', tj=60, tsl=90),
 dict(id='Q47', cas="Force 3 séances + semi, quadriceps prioritaires (P2, P13)", objectif_course='semi', semaines=13, chrono=dict(d=10, t=45 * 60),
      nb_sorties=4, vol_unite='min', vol=220, pls=dict(v=90, u='min'), objectif_muscu='force', nb_muscu=3, niveau_muscu='confirme',
      prioritaires=['quadriceps'], tractions=6, jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], jour_sl='dim', tj=60, tsl=120),
 dict(id='Q48', cas="Courir plus vite avec 1 sortie (C8)", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', nb_sorties=1,
      chrono=dict(d=10, t=50 * 60), vol_unite='min', vol=70, objectif_muscu='tonification', nb_muscu=2, renfo=False,
      jours=['mar', 'jeu', 'dim'], jour_sl='dim', tj=45, tsl=90),
 dict(id='Q49', cas="Maison avec haltères, tonification, biceps et triceps prioritaires", objectif_course='pas_de_course',
      sous_objectif='garder_forme', chrono=dict(d=10, t=55 * 60), nb_sorties=2, vol_unite='min', vol=90, objectif_muscu='tonification',
      nb_muscu=3, equipement='maison_halteres', prioritaires=['biceps', 'triceps'], renfo=False, jours=['lun', 'mer', 'jeu', 'sam'],
      jour_sl='sam', tj=45, tsl=60, prioritaire='muscu'),
 dict(id='Q50', cas="300 min déclarées, 3 × 30 min (E3)", objectif_course='10km', semaines=16, chrono=dict(d=10, t=43 * 60), nb_sorties=3,
      vol_unite='min', vol=300, pls=dict(v=100, u='min'), objectif_muscu='force_esthetique', nb_muscu=2, jours=['mar', 'jeu', 'sam', 'dim'],
      jour_sl='dim', tj=30, tsl=60),
]
for e in E:
    d = dict(base); d.update(e); d.setdefault('niveau_muscu', 'intermediaire'); profils.append(d)
json.dump(profils, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'profils50.json'), 'w'), ensure_ascii=False, indent=1)
print(len(profils))
