/**
 * Calcule l'âge exact à partir d'une date de naissance (format YYYY-MM-DD ou objet Date).
 */
export function calculateAge(birthdateInput: string | Date): number {
  const birthdate = typeof birthdateInput === 'string' ? new Date(birthdateInput) : birthdateInput
  const today = new Date()

  let age = today.getFullYear() - birthdate.getFullYear()
  const monthDiff = today.getMonth() - birthdate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age--
  }

  return age
}

/**
 * Vérifie si une date de naissance correspond à un utilisateur majeur (au moins 18 ans).
 */
export function isAtLeast18YearsOld(birthdateInput: string | Date): boolean {
  if (!birthdateInput) return false
  const age = calculateAge(birthdateInput)
  return !isNaN(age) && age >= 18
}

/**
 * Retourne la date maximale autorisée pour le sélecteur HTML <input type="date" max={...}>
 * (Jour d'aujourd'hui il y a exactement 18 ans).
 */
export function getMaxBirthdateAllowed(): string {
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() - 18)
  return maxDate.toISOString().split('T')[0]
}
