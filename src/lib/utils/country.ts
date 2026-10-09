/**
 * Retourne le drapeau emoji et le nom d'affichage d'un pays
 */
export function getCountryFlag(countryNameOrCode?: string | null): { flag: string; name: string } {
  if (!countryNameOrCode) {
    return { flag: '🌍', name: 'Non renseigné' }
  }

  const clean = countryNameOrCode.trim().toLowerCase()

  const countryMap: Record<string, { flag: string; name: string }> = {
    ci: { flag: '🇨🇮', name: "Côte d'Ivoire" },
    côte_d_ivoire: { flag: '🇨🇮', name: "Côte d'Ivoire" },
    "côte d'ivoire": { flag: '🇨🇮', name: "Côte d'Ivoire" },
    ivory_coast: { flag: '🇨🇮', name: "Côte d'Ivoire" },
    sn: { flag: '🇸🇳', name: 'Sénégal' },
    senegal: { flag: '🇸🇳', name: 'Sénégal' },
    sénégal: { flag: '🇸🇳', name: 'Sénégal' },
    cm: { flag: '🇨🇲', name: 'Cameroun' },
    cameroon: { flag: '🇨🇲', name: 'Cameroun' },
    cameroun: { flag: '🇨🇲', name: 'Cameroun' },
    fr: { flag: '🇫🇷', name: 'France' },
    france: { flag: '🇫🇷', name: 'France' },
    cd: { flag: '🇨🇩', name: 'RD Congo' },
    drc: { flag: '🇨🇩', name: 'RD Congo' },
    congo: { flag: '🇨🇬', name: 'Congo' },
    cg: { flag: '🇨🇬', name: 'Congo' },
    bj: { flag: '🇧🇯', name: 'Bénin' },
    benin: { flag: '🇧🇯', name: 'Bénin' },
    bénin: { flag: '🇧🇯', name: 'Bénin' },
    tg: { flag: '🇹🇬', name: 'Togo' },
    togo: { flag: '🇹🇬', name: 'Togo' },
    ga: { flag: '🇬🇦', name: 'Gabon' },
    gabon: { flag: '🇬🇦', name: 'Gabon' },
    ml: { flag: '🇲🇱', name: 'Mali' },
    mali: { flag: '🇲🇱', name: 'Mali' },
    gn: { flag: '🇬🇳', name: 'Guinée' },
    guinea: { flag: '🇬🇳', name: 'Guinée' },
    guinée: { flag: '🇬🇳', name: 'Guinée' },
    bf: { flag: '🇧🇫', name: 'Burkina Faso' },
    burkina: { flag: '🇧🇫', name: 'Burkina Faso' },
    'burkina faso': { flag: '🇧🇫', name: 'Burkina Faso' },
    ne: { flag: '🇳🇪', name: 'Niger' },
    niger: { flag: '🇳🇪', name: 'Niger' },
    be: { flag: '🇧🇪', name: 'Belgique' },
    belgique: { flag: '🇧🇪', name: 'Belgique' },
    belgium: { flag: '🇧🇪', name: 'Belgique' },
    ca: { flag: '🇨🇦', name: 'Canada' },
    canada: { flag: '🇨🇦', name: 'Canada' },
    us: { flag: '🇺🇸', name: 'États-Unis' },
    usa: { flag: '🇺🇸', name: 'États-Unis' },
    gb: { flag: '🇬🇧', name: 'Royaume-Uni' },
    uk: { flag: '🇬🇧', name: 'Royaume-Uni' },
  }

  if (countryMap[clean]) {
    return countryMap[clean]
  }

  // Si c'est un code ISO 2 lettres direct (ex: CI, SN, FR)
  if (countryNameOrCode.length === 2) {
    const code = countryNameOrCode.toUpperCase()
    const flag = code
      .split('')
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join('')
    return { flag, name: code }
  }

  return { flag: '🌍', name: countryNameOrCode }
}
