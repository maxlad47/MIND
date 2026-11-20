"""Tirage de 20 profils aléatoires (graine fixe) pour le test des 30 programmes.
Les 10 cas limites (P21-P30) sont écrits à la main dans profils.json ensuite."""
import json, random, sys

rng = random.Random(20261118)
JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

def tirer():
    obj = rng.choice(['10km', '10km', 'semi', 'semi', 'marathon', 'pas_de_course', 'pas_de_course'])
    p = {'objectif_course': obj}
    if obj == 'pas_de_course':
        p['pas_de_course_type'] = rng.choice(['garder_forme', 'courir_plus', 'courir_plus_vite'])
        p['semaines_avant_course'] = None
    else:
        p['semaines_avant_course'] = rng.randint(6, 30)
    # chrono
    t = rng.random()
    if t < 0.15:
        p['chrono'] = None
    elif t < 0.40:
        p['chrono'] = {'distance': 5, 'temps_s': rng.randint(19 * 60, 36 * 60)}
    else:
        p['chrono'] = {'distance': 10, 'temps_s': rng.randint(36 * 60, 68 * 60)}
    p['regulier_6_mois'] = rng.random() < 0.75
    p['nb_sorties'] = rng.choice([1, 2, 3, 3, 4, 4, 5, 'jnsp'])
    unite = rng.choice(['km', 'min'])
    p['volume_unite'] = unite
    p['volume'] = rng.randint(8, 55) if unite == 'km' else rng.randint(50, 300)
    p['plus_longue_sortie'] = rng.choice([None, 'oui', 'oui'])
    p['jour_sortie_longue'] = rng.choice(['dim', 'dim', 'dim', 'sam', 'mer'])
    om = rng.choice(['force', 'force_esthetique', 'hypertrophie', 'tonification', 'aucun'])
    p['objectif_muscu'] = om
    p['nb_seances_muscu'] = 0 if om == 'aucun' else rng.choice([1, 2, 2, 3, 3, 4, 'jnsp'])
    p['niveau_muscu'] = rng.choice(['debutant', 'intermediaire', 'confirme'])
    p['equipement'] = rng.choice(['salle', 'salle', 'salle', 'maison_halteres', 'poids_du_corps'])
    p['organisation'] = rng.choice(['full_body', 'haut_bas', 'ppj', 'ppH', 'haut_bas_fb', 'je_ne_sais_pas', 'je_ne_sais_pas'])
    groupes = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos']
    rng.shuffle(groupes)
    p['prioritaires'] = groupes[:rng.choice([0, 0, 1, 2, 3])]
    p['exclus'] = groupes[5:5 + rng.choice([0, 0, 0, 1])]
    p['renfo_coureur'] = obj != 'pas_de_course' and rng.random() < 0.8
    p['tractions_strictes'] = rng.choice([0, 0, 1, 3, 6, 10])
    n = rng.randint(2, 7)
    p['jours'] = sorted(rng.sample(JOURS, n), key=JOURS.index)
    p['temps_par_jour'] = rng.choice([30, 45, 45, 60, 60, 90])
    p['temps_sortie_longue'] = rng.choice([60, 90, 120, 150, 180])
    p['prioritaire'] = rng.choice(['course', 'course', 'muscu'])
    return p

profils = [dict(id=f'P{i:02d}', **tirer()) for i in range(1, 21)]
json.dump(profils, sys.stdout, ensure_ascii=False, indent=1)
