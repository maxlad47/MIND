// Les dates sont stockées en texte AAAA-MM-JJ, sans heure (V1-M0).

export function estDateValide(texte) {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false
  const [annee, mois, jour] = texte.split('-').map(Number)
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  return (
    date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour
  )
}

// Date du jour (heure locale du téléphone) au format AAAA-MM-JJ.
export function dateDuJour(maintenant = new Date()) {
  const deux = (n) => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`
}

// Nombre de jours entiers entre deux dates AAAA-MM-JJ (positif si `fin` est après `debut`).
export function joursEntre(debut, fin) {
  const ms = (t) => {
    const [a, m, j] = t.split('-').map(Number)
    return Date.UTC(a, m - 1, j)
  }
  return Math.round((ms(fin) - ms(debut)) / 86400000)
}
