export function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function formatConversationDate(dateString?: string | null): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    const now = new Date()

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()

    if (isYesterday) {
      return 'Hier'
    }

    // Moins d'une semaine : afficher le jour
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' })
    }

    // Plus ancien : jj/mm
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}
