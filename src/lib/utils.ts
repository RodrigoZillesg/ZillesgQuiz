/**
 * Gera um código de sala de 6 caracteres alfanuméricos maiúsculos
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Pontuação base por dificuldade
 */
export const BASE_SCORES = {
  easy: 100,
  medium: 200,
  hard: 300,
} as const

/**
 * Calcula pontuação baseada na dificuldade (sem bônus)
 */
export function calculateScore(difficulty: 'easy' | 'medium' | 'hard'): number {
  return BASE_SCORES[difficulty]
}

/**
 * Calcula bônus de velocidade (0-50% do score base)
 * Quanto mais rápido responder, maior o bônus
 * @param responseTimeMs - Tempo de resposta em milissegundos
 * @param timeLimitMs - Limite de tempo em milissegundos
 * @returns Multiplicador de bônus (1.0 a 1.5)
 */
export function calculateSpeedBonus(responseTimeMs: number, timeLimitMs: number): number {
  if (responseTimeMs <= 0 || timeLimitMs <= 0) return 1.0

  // Percentual do tempo usado (0 = instantâneo, 1 = no limite)
  const timeUsedRatio = Math.min(responseTimeMs / timeLimitMs, 1)

  // Bônus máximo de 50% para respostas instantâneas, 0% no limite
  const bonusMultiplier = 1 + (0.5 * (1 - timeUsedRatio))

  return bonusMultiplier
}

/**
 * Calcula bônus de streak (sequência de acertos)
 * +10% por cada acerto consecutivo, máximo de 50%
 * @param streak - Número de acertos consecutivos
 * @returns Multiplicador de bônus (1.0 a 1.5)
 */
export function calculateStreakBonus(streak: number): number {
  const bonusPerStreak = 0.1 // 10% por streak
  const maxBonus = 0.5 // Máximo 50%

  const bonus = Math.min(streak * bonusPerStreak, maxBonus)
  return 1 + bonus
}

/**
 * Calcula pontuação total com todos os bônus
 */
export function calculateTotalScore(
  difficulty: 'easy' | 'medium' | 'hard',
  responseTimeMs: number,
  timeLimitMs: number,
  streak: number
): { baseScore: number; speedBonus: number; streakBonus: number; totalScore: number } {
  const baseScore = BASE_SCORES[difficulty]
  const speedMultiplier = calculateSpeedBonus(responseTimeMs, timeLimitMs)
  const streakMultiplier = calculateStreakBonus(streak)

  // Aplicar bônus multiplicativamente
  const totalScore = Math.round(baseScore * speedMultiplier * streakMultiplier)

  return {
    baseScore,
    speedBonus: Math.round(baseScore * (speedMultiplier - 1)),
    streakBonus: Math.round(baseScore * speedMultiplier * (streakMultiplier - 1)),
    totalScore,
  }
}

/**
 * Lista de emojis disponíveis para avatares
 */
export const avatarEmojis = [
  '😀', '😎', '🤓', '🥳', '🤩', '😺', '🦊', '🐼',
  '🦁', '🐯', '🐸', '🐙', '🦄', '🐲', '👻', '🤖',
  '👽', '🎃', '💀', '🦇', '🦋', '🐝', '🌟', '🔥'
]

/**
 * Formata tempo em segundos para MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
