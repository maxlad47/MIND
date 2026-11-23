import type { Equipment, Exercise, Level, Muscle, Pattern, Zone } from './types'

type Row = [
  id: string, name: string, muscle: Muscle, secondary: Muscle[], pattern: Pattern,
  equipment: Equipment, level: Level, contra: Zone[], compound: boolean, cue: string,
]

const D: Level = 'debutant'
const I: Level = 'intermediaire'
const A: Level = 'avance'

// L'ordre dans une même famille (pattern) = ordre de préférence du moteur.
const ROWS: Row[] = [
  // ---------- Pectoraux
  ['dev_couche_barre', 'Développé couché barre', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'barre', I, ['epaule', 'poignet'], true, 'Omoplates serrées, barre sur le bas des pecs, pieds ancrés.'],
  ['dev_couche_halteres', 'Développé couché haltères', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'halteres', D, ['epaule'], true, 'Coudes à 45°, amplitude complète, contrôle à la descente.'],
  ['dev_couche_machine', 'Développé couché machine', 'pectoraux', ['triceps'], 'push_h', 'machine', D, [], true, 'Dos plaqué, poussez sans décoller les épaules du dossier.'],
  ['dev_couche_smith', 'Développé couché Smith', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'smith', D, ['epaule'], true, 'Trajectoire guidée, gardez les omoplates serrées.'],
  ['pompes', 'Pompes', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'poids_du_corps', D, ['poignet'], true, 'Corps gainé comme une planche, poitrine proche du sol.'],
  ['dips_pecs', 'Dips (pecs)', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'poids_du_corps', A, ['epaule', 'coude'], true, 'Buste penché vers l\'avant, descente contrôlée.'],
  ['dev_incline_halteres', 'Développé incliné haltères', 'pectoraux', ['epaules', 'triceps'], 'push_inc', 'halteres', D, ['epaule'], true, 'Banc à 30°, haut des pecs, coudes sous les poignets.'],
  ['dev_incline_barre', 'Développé incliné barre', 'pectoraux', ['epaules', 'triceps'], 'push_inc', 'barre', I, ['epaule', 'poignet'], true, 'Banc à 30°, barre vers le haut de la poitrine.'],
  ['dev_incline_machine', 'Développé incliné machine', 'pectoraux', ['epaules', 'triceps'], 'push_inc', 'machine', D, [], true, 'Réglez le siège pour que les poignées soient au niveau du haut des pecs.'],
  ['dev_incline_smith', 'Développé incliné Smith', 'pectoraux', ['epaules', 'triceps'], 'push_inc', 'smith', D, ['epaule'], true, 'Banc à 30°, trajectoire verticale stable.'],
  ['pec_deck', 'Pec deck', 'pectoraux', [], 'fly', 'machine', D, [], false, 'Coudes légèrement fléchis, serrez les pecs en fin de mouvement.'],
  ['ecarte_poulie', 'Écarté poulie vis-à-vis', 'pectoraux', [], 'fly', 'poulie', D, [], false, 'Tension continue, rapprochez les mains devant la poitrine.'],
  ['ecarte_halteres', 'Écarté haltères', 'pectoraux', [], 'fly', 'halteres', I, ['epaule'], false, 'Arc de cercle, coudes souples, étirement sans douleur.'],

  // ---------- Dos
  ['tirage_vertical', 'Tirage vertical poulie haute', 'dos', ['biceps'], 'pull_v', 'poulie', D, [], true, 'Tirez vers le haut de la poitrine, coudes vers le bas.'],
  ['tractions_pronation', 'Tractions pronation', 'dos', ['biceps'], 'pull_v', 'poids_du_corps', A, ['epaule', 'coude'], true, 'Départ bras tendus, menton au-dessus de la barre.'],
  ['tractions_supination', 'Tractions supination', 'dos', ['biceps'], 'pull_v', 'poids_du_corps', I, ['coude'], true, 'Prise serrée paumes vers vous, poitrine vers la barre.'],
  ['traction_assistee', 'Tractions assistées machine', 'dos', ['biceps'], 'pull_v', 'machine', D, [], true, 'Réglez l\'assistance pour tenir toutes vos reps proprement.'],
  ['tirage_vertical_neutre', 'Tirage vertical prise neutre serrée', 'dos', ['biceps'], 'pull_v', 'poulie', D, [], true, 'Poignée en V, tirez coudes le long du corps.'],
  ['pullover_poulie', 'Pull-over poulie haute', 'dos', [], 'pull_v', 'poulie', I, [], false, 'Bras presque tendus, ramenez la barre vers les cuisses.'],
  ['rowing_machine', 'Rowing machine buste soutenu', 'dos', ['biceps'], 'pull_h', 'machine', D, [], true, 'Poitrine collée au support, serrez les omoplates.'],
  ['rowing_haltere', 'Rowing haltère un bras', 'dos', ['biceps'], 'pull_h', 'halteres', D, [], true, 'Dos plat, tirez le coude vers la hanche.'],
  ['rowing_poulie_basse', 'Tirage horizontal poulie basse', 'dos', ['biceps'], 'pull_h', 'poulie', D, [], true, 'Buste fixe, tirez la poignée vers le nombril.'],
  ['rowing_barre', 'Rowing barre', 'dos', ['biceps'], 'pull_h', 'barre', I, ['dos'], true, 'Buste à 45°, dos plat, barre vers le bas du ventre.'],
  ['rowing_t', 'Rowing barre en T', 'dos', ['biceps'], 'pull_h', 'barre', I, ['dos'], true, 'Poitrine haute, coudes serrés le long du corps.'],
  ['rowing_smith', 'Rowing Smith', 'dos', ['biceps'], 'pull_h', 'smith', I, ['dos'], true, 'Dos plat, tirez vers le bas des pectoraux.'],
  ['rowing_inverse', 'Rowing inversé', 'dos', ['biceps'], 'pull_h', 'smith', D, [], true, 'Corps gainé, tirez la poitrine vers la barre.'],
  ['extension_lombaires', 'Extension lombaires sur banc', 'dos', ['fessiers', 'ischios'], 'hinge', 'poids_du_corps', D, ['dos'], false, 'Montée contrôlée jusqu\'à l\'alignement, sans cambrer.'],
  ['shrug_halteres', 'Shrugs haltères', 'dos', [], 'shrug', 'halteres', D, [], false, 'Haussez les épaules droit vers le haut, pause en haut.'],
  ['shrug_barre', 'Shrugs barre', 'dos', [], 'shrug', 'barre', I, [], false, 'Trajectoire verticale, ne roulez pas les épaules.'],

  // ---------- Épaules
  ['dev_epaules_halteres', 'Développé épaules haltères assis', 'epaules', ['triceps'], 'push_v', 'halteres', D, ['epaule'], true, 'Dos calé, poussez au-dessus de la tête sans cambrer.'],
  ['dev_epaules_machine', 'Développé épaules machine', 'epaules', ['triceps'], 'push_v', 'machine', D, ['epaule'], true, 'Trajectoire guidée, ne verrouillez pas les coudes.'],
  ['dev_militaire_barre', 'Développé militaire barre', 'epaules', ['triceps'], 'push_v', 'barre', I, ['epaule', 'dos'], true, 'Fessiers et abdos serrés, barre qui passe devant le visage.'],
  ['dev_militaire_smith', 'Développé militaire Smith', 'epaules', ['triceps'], 'push_v', 'smith', D, ['epaule'], true, 'Barre devant le visage, descente jusqu\'au menton.'],
  ['arnold_press', 'Arnold press', 'epaules', ['triceps'], 'push_v', 'halteres', I, ['epaule'], true, 'Rotation fluide des poignets pendant la poussée.'],
  ['elev_lat_halteres', 'Élévations latérales haltères', 'epaules', [], 'lat_raise', 'halteres', D, [], false, 'Montez les coudes, pas les mains, jusqu\'à l\'horizontale.'],
  ['elev_lat_poulie', 'Élévations latérales poulie', 'epaules', [], 'lat_raise', 'poulie', D, [], false, 'Tension constante, léger penché sur le côté.'],
  ['elev_lat_machine', 'Élévations latérales machine', 'epaules', [], 'lat_raise', 'machine', D, [], false, 'Coudes appuyés sur les coussins, montez sans à-coups.'],
  ['oiseau_halteres', 'Oiseau haltères buste penché', 'epaules', ['dos'], 'rear_delt', 'halteres', D, [], false, 'Dos plat, ouvrez les bras en serrant les omoplates.'],
  ['reverse_pec_deck', 'Pec deck inversé', 'epaules', ['dos'], 'rear_delt', 'machine', D, [], false, 'Bras à hauteur d\'épaules, ouvrez sans hausser les trapèzes.'],
  ['face_pull', 'Face pull', 'epaules', ['dos'], 'rear_delt', 'poulie', D, [], false, 'Tirez la corde vers le front, coudes hauts.'],

  // ---------- Biceps
  ['curl_halteres', 'Curl haltères alterné', 'biceps', [], 'curl', 'halteres', D, [], false, 'Coudes fixes, supination en montant.'],
  ['curl_barre_ez', 'Curl barre EZ', 'biceps', [], 'curl', 'barre', D, ['poignet', 'coude'], false, 'Pas d\'élan, montée contrôlée, descente lente.'],
  ['curl_pupitre', 'Curl pupitre machine', 'biceps', [], 'curl', 'machine', D, [], false, 'Bras calés sur le pupitre, amplitude complète.'],
  ['curl_poulie', 'Curl poulie basse', 'biceps', [], 'curl', 'poulie', D, [], false, 'Tension continue du bas jusqu\'en haut.'],
  ['curl_marteau', 'Curl marteau', 'biceps', [], 'curl', 'halteres', D, [], false, 'Prise neutre, travaille aussi l\'avant-bras.'],
  ['curl_incline', 'Curl incliné haltères', 'biceps', [], 'curl', 'halteres', I, ['epaule'], false, 'Bras en arrière du corps pour étirer le biceps.'],

  // ---------- Triceps
  ['ext_triceps_poulie', 'Extension triceps poulie corde', 'triceps', [], 'tri_ext', 'poulie', D, [], false, 'Coudes collés, écartez la corde en bas du mouvement.'],
  ['ext_triceps_machine', 'Extension triceps machine', 'triceps', [], 'tri_ext', 'machine', D, [], false, 'Épaules basses, extension complète.'],
  ['ext_overhead_poulie', 'Extension triceps au-dessus de la tête poulie', 'triceps', [], 'tri_ext', 'poulie', D, [], false, 'Coudes serrés près de la tête, étirement maximal.'],
  ['barre_front', 'Barre au front', 'triceps', [], 'tri_ext', 'barre', I, ['coude', 'poignet'], false, 'Seuls les avant-bras bougent, descente derrière la tête.'],
  ['ext_overhead_halteres', 'Extension haltère au-dessus de la tête', 'triceps', [], 'tri_ext', 'halteres', D, ['coude', 'epaule'], false, 'Coudes pointés vers le plafond, descente contrôlée.'],
  ['kickback_triceps', 'Kickback triceps poulie', 'triceps', [], 'tri_ext', 'poulie', D, [], false, 'Buste penché, tendez le bras vers l\'arrière.'],
  ['dips_triceps', 'Dips banc / barres (triceps)', 'triceps', ['pectoraux', 'epaules'], 'tri_ext', 'poids_du_corps', I, ['epaule', 'coude'], true, 'Buste droit, coudes vers l\'arrière.'],
  ['dev_couche_serre', 'Développé couché prise serrée', 'triceps', ['pectoraux'], 'tri_ext', 'barre', I, ['poignet', 'coude', 'epaule'], true, 'Mains à largeur d\'épaules, coudes serrés.'],

  // ---------- Quadriceps
  ['squat_barre', 'Squat barre', 'quadriceps', ['fessiers', 'ischios'], 'squat', 'barre', I, ['dos', 'genou', 'hanche'], true, 'Gainage serré, genoux dans l\'axe des pieds, descente profonde.'],
  ['squat_avant', 'Squat avant', 'quadriceps', ['fessiers'], 'squat', 'barre', A, ['poignet', 'genou', 'dos'], true, 'Coudes hauts, buste très droit.'],
  ['hack_squat', 'Hack squat machine', 'quadriceps', ['fessiers'], 'squat', 'machine', I, ['genou'], true, 'Dos calé, descendez jusqu\'à 90° ou plus.'],
  ['squat_goblet', 'Goblet squat', 'quadriceps', ['fessiers'], 'squat', 'halteres', D, [], true, 'Haltère contre la poitrine, descendez entre les jambes.'],
  ['squat_smith', 'Squat Smith', 'quadriceps', ['fessiers'], 'squat', 'smith', D, ['genou'], true, 'Pieds légèrement devant la barre, dos droit.'],
  ['presse_cuisses', 'Presse à cuisses', 'quadriceps', ['fessiers'], 'squat', 'machine', D, [], true, 'Dos plaqué, genoux dans l\'axe, ne verrouillez pas en haut.'],
  ['presse_pieds_hauts', 'Presse pieds hauts', 'fessiers', ['ischios', 'quadriceps'], 'squat', 'machine', D, [], true, 'Pieds hauts sur la plateforme pour cibler fessiers et ischios.'],
  ['fentes_marchees', 'Fentes marchées haltères', 'quadriceps', ['fessiers'], 'lunge', 'halteres', I, ['genou', 'hanche'], true, 'Grands pas, genou arrière proche du sol.'],
  ['fentes_arriere', 'Fentes arrière', 'quadriceps', ['fessiers'], 'lunge', 'halteres', D, ['genou'], true, 'Reculez un pied, gardez le buste droit.'],
  ['bulgare', 'Squat bulgare', 'quadriceps', ['fessiers'], 'lunge', 'halteres', I, ['genou', 'hanche'], true, 'Pied arrière surélevé, descente verticale.'],
  ['step_up', 'Montées sur banc', 'quadriceps', ['fessiers'], 'lunge', 'halteres', D, ['genou'], true, 'Poussez avec la jambe d\'appui, sans élan.'],
  ['leg_extension', 'Leg extension', 'quadriceps', [], 'leg_ext', 'machine', D, ['genou'], false, 'Contractez en haut une seconde, descente lente.'],

  // ---------- Ischios / fessiers
  ['rdl_halteres', 'Soulevé de terre roumain haltères', 'ischios', ['fessiers', 'dos'], 'hinge', 'halteres', D, ['dos'], true, 'Hanches vers l\'arrière, jambes presque tendues, dos plat.'],
  ['rdl_barre', 'Soulevé de terre roumain barre', 'ischios', ['fessiers', 'dos'], 'hinge', 'barre', I, ['dos'], true, 'Barre proche des jambes, étirement des ischios.'],
  ['souleve_terre', 'Soulevé de terre', 'ischios', ['fessiers', 'dos', 'quadriceps'], 'hinge', 'barre', I, ['dos', 'hanche'], true, 'Barre collée aux jambes, dos neutre, poussez le sol.'],
  ['trap_bar', 'Soulevé de terre trap bar', 'ischios', ['fessiers', 'quadriceps', 'dos'], 'hinge', 'barre', D, ['dos'], true, 'Poignées neutres, poussez le sol, hanches et épaules montent ensemble.'],
  ['rdl_unilateral', 'Soulevé de terre roumain unilatéral', 'ischios', ['fessiers'], 'hinge', 'halteres', I, [], true, 'Équilibre sur une jambe, hanches carrées.'],
  ['good_morning', 'Good morning', 'ischios', ['dos', 'fessiers'], 'hinge', 'barre', A, ['dos'], true, 'Barre sur les trapèzes, charnière de hanche, dos plat.'],
  ['leg_curl_assis', 'Leg curl assis', 'ischios', [], 'leg_curl', 'machine', D, [], false, 'Hanches bien calées, ramenez les talons sous vous.'],
  ['leg_curl_allonge', 'Leg curl allongé', 'ischios', [], 'leg_curl', 'machine', D, [], false, 'Hanches collées au banc, flexion complète.'],
  ['hip_thrust_barre', 'Hip thrust barre', 'fessiers', ['ischios'], 'hip_thrust', 'barre', I, [], true, 'Menton rentré, extension complète de hanche, pause en haut.'],
  ['hip_thrust_machine', 'Hip thrust machine', 'fessiers', ['ischios'], 'hip_thrust', 'machine', D, [], true, 'Poussez avec les talons, serrez les fessiers en haut.'],
  ['pont_fessier', 'Pont fessier', 'fessiers', ['ischios'], 'hip_thrust', 'poids_du_corps', D, [], true, 'Pieds à plat, bassin en rétroversion en haut.'],
  ['kickback_fessiers', 'Kickback fessiers poulie', 'fessiers', [], 'glute_iso', 'poulie', D, [], false, 'Poussez la jambe en arrière sans cambrer.'],
  ['abduction_machine', 'Abduction machine', 'fessiers', [], 'glute_iso', 'machine', D, ['hanche'], false, 'Légèrement penché en avant, ouvrez contrôlé.'],

  // ---------- Mollets
  ['mollets_debout', 'Mollets debout machine', 'mollets', [], 'calf', 'machine', D, ['cheville'], false, 'Amplitude maximale, pause en bas et en haut.'],
  ['mollets_assis', 'Mollets assis', 'mollets', [], 'calf', 'machine', D, ['cheville'], false, 'Genoux à 90°, montée lente.'],
  ['mollets_presse', 'Mollets à la presse', 'mollets', [], 'calf', 'machine', D, ['cheville'], false, 'Poussez avec l\'avant du pied, étirez en bas.'],

  // ---------- Abdominaux
  ['crunch_poulie', 'Crunch à la poulie', 'abdos', [], 'core', 'poulie', D, [], false, 'Enroulez le buste en rapprochant les côtes du bassin.'],
  ['releve_jambes', 'Relevé de jambes suspendu', 'abdos', [], 'core', 'poids_du_corps', I, ['epaule', 'poignet'], false, 'Basculez le bassin, évitez de vous balancer.'],
  ['crunch_machine', 'Crunch machine', 'abdos', [], 'core', 'machine', D, [], false, 'Expirez en contractant, retour lent.'],
  ['planche', 'Gainage planche', 'abdos', [], 'core', 'poids_du_corps', D, ['epaule'], false, 'Corps aligné, fessiers et abdos serrés (tenue en secondes).'],
  ['pallof_press', 'Pallof press', 'abdos', [], 'core', 'poulie', D, [], false, 'Résistez à la rotation, bras tendus devant vous.'],
  ['roue_abdos', 'Roue abdominale', 'abdos', [], 'core', 'poids_du_corps', A, ['epaule', 'dos'], false, 'Dos rond, avancez sans cambrer.'],
  ['farmer_walk', 'Marche du fermier', 'abdos', ['dos'], 'core', 'halteres', D, ['poignet'], false, 'Épaules basses, buste haut, pas courts.'],
  ['crunch_incline', 'Crunch sur banc incliné', 'abdos', [], 'core', 'poids_du_corps', D, [], false, 'Enroulez le buste, mains croisées sur la poitrine.'],

  // ---------- Compléments
  ['dev_couche_declin', 'Développé décliné haltères', 'pectoraux', ['triceps'], 'push_h', 'halteres', I, ['epaule'], true, 'Banc légèrement décliné, bas des pecs sollicité.'],
  ['dips_assistes', 'Dips assistés machine', 'pectoraux', ['triceps', 'epaules'], 'push_h', 'machine', D, ['epaule', 'coude'], true, 'Buste penché, réglez l\'assistance pour garder le contrôle.'],
  ['ecarte_incline_poulie', 'Écarté incliné poulie basse', 'pectoraux', ['epaules'], 'fly', 'poulie', D, [], false, 'Montez les mains en arc vers le haut de la poitrine.'],
  ['tirage_unilateral', 'Tirage vertical unilatéral poulie', 'dos', ['biceps'], 'pull_v', 'poulie', D, [], true, 'Un bras à la fois, rotation légère du buste autorisée.'],
  ['rowing_prise_large', 'Tirage horizontal prise large', 'dos', ['epaules'], 'pull_h', 'poulie', D, [], true, 'Coudes écartés, tirez vers le haut du ventre.'],
  ['elev_frontale', 'Élévations frontales disque', 'epaules', [], 'lat_raise', 'halteres', D, ['epaule'], false, 'Montez jusqu\'à hauteur des yeux sans balancer.'],
  ['curl_araignee', 'Curl araignée', 'biceps', [], 'curl', 'halteres', I, [], false, 'Torse calé sur banc incliné, bras à la verticale.'],
  ['curl_concentre', 'Curl concentré', 'biceps', [], 'curl', 'halteres', D, [], false, 'Coude contre la cuisse, contraction maximale en haut.'],
  ['presse_unilaterale', 'Presse à cuisses unilatérale', 'quadriceps', ['fessiers'], 'lunge', 'machine', D, ['genou'], true, 'Une jambe à la fois, descente contrôlée.'],
  ['sdt_sumo', 'Soulevé de terre sumo', 'ischios', ['fessiers', 'quadriceps', 'dos'], 'hinge', 'barre', I, ['dos', 'hanche'], true, 'Écartez les pieds, poussez les genoux vers l\'extérieur.'],
  ['hip_thrust_unilateral', 'Hip thrust unilatéral', 'fessiers', ['ischios'], 'hip_thrust', 'poids_du_corps', I, [], true, 'Une jambe, bassin stable, serrez en haut.'],
  ['mollets_unilateral', 'Mollets unilatéraux à la marche', 'mollets', [], 'calf', 'poids_du_corps', D, ['cheville'], false, 'Sur une marche, amplitude maximale, lent.'],
  ['tirage_poitrine_large', 'Tirage poitrine prise large', 'dos', ['biceps'], 'pull_v', 'poulie', D, ['epaule'], true, 'Prise large, tirez vers le haut de la poitrine.'],

  // ---------- Renfo coureur (gainage, force, pliométrie, élastique) : jamais choisis par le générateur de muscu
  ['planche_laterale', 'Planche latérale', 'abdos', [], 'core', 'poids_du_corps', D, ['epaule'], false, 'Corps aligné sur l\'avant-bras, hanche haute, serrez les abdos (tenue en secondes, par côté).'],
  ['copenhague', 'Planche Copenhague', 'abdos', ['fessiers'], 'core', 'poids_du_corps', I, ['hanche'], false, 'Jambe du haut sur un banc ou une chaise, bassin haut : le travail est dans l\'adducteur (tenue, par côté).'],
  ['dead_bug', 'Dead bug', 'abdos', [], 'core', 'poids_du_corps', D, [], false, 'Dos plaqué au sol, bras et jambe opposés qui s\'éloignent lentement, sans cambrer.'],
  ['bird_dog', 'Bird dog', 'abdos', ['dos', 'fessiers'], 'core', 'poids_du_corps', D, ['poignet'], false, 'À quatre pattes, étendez le bras et la jambe opposés, bassin stable.'],
  ['pont_unilateral', 'Pont fessier unilatéral', 'fessiers', ['ischios'], 'hip_thrust', 'poids_du_corps', D, [], true, 'Une jambe tendue, poussez avec le talon d\'appui, bassin à l\'horizontale.'],
  ['hip_thrust_halteres', 'Hip thrust haltère', 'fessiers', ['ischios'], 'hip_thrust', 'halteres', D, [], true, 'Haltère sur les hanches, menton rentré, extension complète en haut.'],
  ['pont_elastique', 'Pont fessier avec élastique', 'fessiers', ['ischios'], 'hip_thrust', 'elastique', D, [], true, 'Élastique au-dessus des genoux, poussez les genoux vers l\'extérieur en montant.'],
  ['chaise', 'Chaise (isométrique)', 'quadriceps', ['fessiers'], 'squat', 'poids_du_corps', D, ['genou'], true, 'Dos contre le mur, cuisses à l\'horizontale, tenez la position.'],
  ['nordic', 'Nordic curl', 'ischios', [], 'leg_curl', 'poids_du_corps', A, [], false, 'Genoux calés, descendez le buste le plus lentement possible, remontez en vous aidant des mains.'],
  ['mollets_excentrique', 'Mollets debout en excentrique', 'mollets', [], 'calf', 'poids_du_corps', D, ['cheville'], false, 'Montez sur deux pieds, descendez sur un seul en 3 secondes, talon sous la marche.'],
  ['mollets_fleche', 'Mollets genou fléchi', 'mollets', [], 'calf', 'halteres', D, ['cheville'], false, 'Genoux fléchis à 90°, montée lente : cible le soléaire, le muscle d\'endurance du coureur.'],
  ['fente_laterale', 'Fente latérale', 'quadriceps', ['fessiers'], 'lunge', 'poids_du_corps', D, ['genou', 'hanche'], true, 'Grand pas sur le côté, fessier en arrière, jambe tendue de l\'autre côté.'],
  ['squat_jump', 'Squat jump', 'quadriceps', ['fessiers', 'mollets'], 'plyo', 'poids_du_corps', I, ['genou', 'hanche', 'cheville'], true, 'Descendez en squat, explosez vers le haut, réception souple et silencieuse.'],
  ['bonds', 'Bonds alternés', 'quadriceps', ['fessiers', 'mollets'], 'plyo', 'poids_du_corps', I, ['genou', 'hanche', 'cheville'], true, 'Grandes foulées bondissantes, un appui à la fois, cherchez la hauteur et la longueur.'],
  ['skipping', 'Skipping', 'mollets', ['quadriceps'], 'plyo', 'poids_du_corps', D, ['cheville'], false, 'Genoux hauts, appuis rapides sur l\'avant du pied, bras qui accompagnent.'],
  ['pogo', 'Pogo jumps', 'mollets', [], 'plyo', 'poids_du_corps', I, ['cheville', 'genou'], false, 'Petits sauts raides sur l\'avant du pied, chevilles verrouillées, contact au sol très court.'],
  ['sauts_lateraux', 'Sauts latéraux', 'quadriceps', ['fessiers'], 'plyo', 'poids_du_corps', D, ['genou', 'cheville'], false, 'Sautez d\'un pied sur l\'autre de côté, réception stable avant de repartir.'],
  ['monster_walk', 'Monster walk (élastique)', 'fessiers', ['quadriceps'], 'glute_iso', 'elastique', D, [], false, 'Élastique aux chevilles ou au-dessus des genoux, pas latéraux larges, genoux fléchis.'],
  ['abduction_elastique', 'Abduction à l\'élastique', 'fessiers', [], 'glute_iso', 'elastique', D, [], false, 'Debout, élastique aux chevilles, écartez la jambe sur le côté sans pencher le buste.'],
  ['clamshell', 'Palourde (élastique)', 'fessiers', [], 'glute_iso', 'elastique', D, [], false, 'Sur le côté, pieds joints, ouvrez le genou du haut sans basculer le bassin.'],
]

/** Exercices dont la cible est une durée en secondes. */
const TIMED = new Set(['planche', 'planche_laterale', 'copenhague', 'chaise', 'skipping'])
/** Exercices unilatéraux : la cible (répétitions ou durée) s'entend « par côté ». */
const PER_SIDE = new Set([
  'planche_laterale', 'copenhague', 'dead_bug', 'bird_dog', 'pont_unilateral', 'mollets_excentrique', 'fente_laterale', 'clamshell',
  'abduction_elastique', 'fentes_arriere', 'fentes_marchees', 'bulgare', 'step_up', 'rdl_unilateral', 'presse_unilaterale',
  'hip_thrust_unilateral', 'mollets_unilateral', 'rowing_haltere', 'tirage_unilateral', 'curl_concentre',
])
/** Ajoutés pour le renfo coureur : exclus du générateur de muscu (voir `candidates`). */
const RENFO_ONLY = new Set(ROWS.slice(ROWS.findIndex((r) => r[0] === 'planche_laterale')).map((r) => r[0]))

export const EXERCISES: Exercise[] = ROWS.map(([id, name, muscle, secondary, pattern, equipment, level, contra, compound, cue]) => ({
  id, name, muscle, secondary, pattern, equipment, level, contra, compound, cue, alts: [],
  ...(TIMED.has(id) ? { unit: 'sec' as const } : {}),
  ...(PER_SIDE.has(id) ? { perSide: true } : {}),
  ...(RENFO_ONLY.has(id) ? { renfo: true } : {}),
}))

// Alternatives explicites : même muscle et même schéma de mouvement. Les exercices de renfo coureur ne sont proposés qu'entre eux
// (et avec les exercices de la bibliothèque de même schéma) : un exercice de salle garde les mêmes alternatives qu'avant.
for (const ex of EXERCISES) {
  ex.alts = EXERCISES.filter((o) => o.id !== ex.id && o.muscle === ex.muscle && o.pattern === ex.pattern && (ex.renfo || !o.renfo)).map((o) => o.id)
}

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

// ------------------------------------------------------------------ exercices perso (mode libre)

/** Les ids des exercices créés par le client commencent par ce préfixe. */
export const CUSTOM_PREFIX = 'custom:'
export const isCustomId = (id: string): boolean => id.startsWith(CUSTOM_PREFIX)

const CUSTOM_PATTERN: Record<Muscle, Pattern> = {
  pectoraux: 'push_h', dos: 'pull_h', epaules: 'push_v', biceps: 'curl', triceps: 'tri_ext',
  quadriceps: 'squat', ischios: 'hinge', fessiers: 'hip_thrust', mollets: 'calf', abdos: 'core',
}

/** Construit un exercice perso : suivi comme les autres (charges, dernière performance, graphiques), sans alternatives automatiques. */
export function makeCustomExercise(id: string, name: string, muscle: Muscle): Exercise {
  return {
    id, name: name.trim(), muscle, secondary: [], pattern: CUSTOM_PATTERN[muscle], equipment: 'machine', level: 'debutant',
    contra: [], alts: [], cue: 'Exercice personnalisé.', compound: false,
  }
}

let registered: string[] = []
/**
 * Branche les exercices perso sur `EXERCISE_BY_ID` : tous les endroits qui résolvent un `exerciseId` (nom, muscle, Progress,
 * lastPerformance…) les trouvent comme les exercices de la bibliothèque. Ils ne sont jamais ajoutés à `EXERCISES`,
 * donc le générateur de programmes ne les voit pas. Appelé par le store après chaque changement de données.
 */
export function registerCustomExercises(list: Exercise[]): void {
  for (const id of registered) delete EXERCISE_BY_ID[id]
  registered = []
  for (const ex of list) {
    if (!isCustomId(ex.id) || EXERCISE_BY_ID[ex.id]) continue
    EXERCISE_BY_ID[ex.id] = ex
    registered.push(ex.id)
  }
}

const UNKNOWN: Exercise = {
  id: 'unknown', name: 'Exercice supprimé', muscle: 'abdos', secondary: [], pattern: 'core', equipment: 'poids_du_corps',
  level: 'debutant', contra: [], alts: [], cue: '', compound: false,
}
/** Résolution sûre d'un `exerciseId` : ne plante jamais, même pour un exercice perso introuvable. */
export function exerciseOf(id: string): Exercise {
  return EXERCISE_BY_ID[id] ?? UNKNOWN
}

/** Exercice dont la cible est une durée (secondes). */
export const isTimed = (exerciseId: string): boolean => exerciseOf(exerciseId).unit === 'sec'
/** Suffixe affiché après une cible : « 10 reps / côté », « 30 s / côté ». */
export function targetSuffix(exerciseId: string): string {
  const ex = exerciseOf(exerciseId)
  return ex.perSide ? ' / côté' : ''
}

export const LEVEL_RANK: Record<Level, number> = { debutant: 0, intermediaire: 1, avance: 2 }

export function isAllowed(ex: Exercise, injuries: Zone[]): boolean {
  return !ex.contra.some((z) => injuries.includes(z))
}

/** Alternatives : même muscle + même schéma, hors zones contre-indiquées. */
export function alternativesFor(exerciseId: string, injuries: Zone[], level?: Level): Exercise[] {
  const ex = EXERCISE_BY_ID[exerciseId]
  if (!ex) return []
  return ex.alts
    .map((id) => EXERCISE_BY_ID[id])
    .filter((o) => isAllowed(o, injuries) && (!level || LEVEL_RANK[o.level] <= LEVEL_RANK[level] + 0))
}

/** Candidats pour un schéma de mouvement, dans l'ordre de préférence, filtrés blessures + niveau. */
export function candidates(pattern: Pattern, muscle: Muscle | null, injuries: Zone[], level: Level): Exercise[] {
  const all = EXERCISES.filter((e) => !e.renfo && e.pattern === pattern && (!muscle || e.muscle === muscle) && isAllowed(e, injuries))
  const ok = all.filter((e) => LEVEL_RANK[e.level] <= LEVEL_RANK[level])
  return ok.length ? ok : all
}
