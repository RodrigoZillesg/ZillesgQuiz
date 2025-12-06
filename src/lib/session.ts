/**
 * Gerenciamento de sessão do jogador via LocalStorage
 * Permite reconexão após refresh/desconexão
 */

const SESSION_KEY = 'quiz_battle_session'

export interface PlayerSession {
  roomCode: string
  participantId: string
  nickname: string
  avatarIcon: string
  joinedAt: number
}

/**
 * Salva sessão do jogador
 */
export function savePlayerSession(session: PlayerSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

/**
 * Recupera sessão do jogador
 */
export function getPlayerSession(): PlayerSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null

    const session = JSON.parse(stored) as PlayerSession

    // Verifica se a sessão é recente (últimas 4 horas)
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000
    if (session.joinedAt < fourHoursAgo) {
      clearPlayerSession()
      return null
    }

    return session
  } catch (error) {
    console.error('Failed to get session:', error)
    return null
  }
}

/**
 * Limpa sessão do jogador
 */
export function clearPlayerSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error('Failed to clear session:', error)
  }
}

/**
 * Verifica se existe sessão ativa para uma sala específica
 */
export function hasActiveSession(roomCode: string): boolean {
  const session = getPlayerSession()
  return session?.roomCode.toUpperCase() === roomCode.toUpperCase()
}
