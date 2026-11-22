import fs from 'node:fs'
import { EXERCISES } from '../src/engine/exercises'
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const arr = (a: string[]) => `array[${a.map(q).join(',')}]::text[]`
const rows = EXERCISES.map((e) => `(${q(e.id)},${q(e.name)},${q(e.muscle)},${arr(e.secondary)},${q(e.pattern)},${q(e.equipment)},${q(e.level)},${arr(e.contra)},${e.compound},${q(e.cue)})`)
const sql = `-- Généré par scripts/gen-seed.ts — bibliothèque d'exercices de salle (${EXERCISES.length})\ninsert into public.exercises (id,name,muscle,secondary,pattern,equipment,level,contra,compound,cue) values\n${rows.join(',\n')}\non conflict (id) do update set name=excluded.name, muscle=excluded.muscle, secondary=excluded.secondary, pattern=excluded.pattern, equipment=excluded.equipment, level=excluded.level, contra=excluded.contra, compound=excluded.compound, cue=excluded.cue;\n`
fs.writeFileSync('supabase/seed.sql', sql)
console.log('seed.sql', EXERCISES.length)
