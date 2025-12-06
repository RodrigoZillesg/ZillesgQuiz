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
 * Avatar personalizado com imagem Low Poly 3D
 */
export interface Avatar {
  id: string
  src: string
  category: 'female' | 'male' | 'animals' | 'hobbies'
}

/**
 * Lista de avatares disponíveis (imagens Low Poly 3D)
 */
export const avatars: Avatar[] = [
  // Feminino
  { id: 'f01', src: '/avatars/f01.png', category: 'female' },
  { id: 'f02', src: '/avatars/f02.png', category: 'female' },
  { id: 'f03', src: '/avatars/f03.png', category: 'female' },
  { id: 'f04', src: '/avatars/f04.png', category: 'female' },
  { id: 'f05', src: '/avatars/f05.png', category: 'female' },
  { id: 'f06', src: '/avatars/f06.png', category: 'female' },
  { id: 'f07', src: '/avatars/f07.png', category: 'female' },
  { id: 'f08', src: '/avatars/f08.png', category: 'female' },
  { id: 'f09', src: '/avatars/f09.png', category: 'female' },
  { id: 'f10', src: '/avatars/f10.png', category: 'female' },
  // Masculino
  { id: 'm01', src: '/avatars/m01.png', category: 'male' },
  { id: 'm02', src: '/avatars/m02.png', category: 'male' },
  { id: 'm03', src: '/avatars/m03.png', category: 'male' },
  { id: 'm04', src: '/avatars/m04.png', category: 'male' },
  { id: 'm05', src: '/avatars/m05.png', category: 'male' },
  { id: 'm06', src: '/avatars/m06.png', category: 'male' },
  { id: 'm07', src: '/avatars/m07.png', category: 'male' },
  { id: 'm08', src: '/avatars/m08.png', category: 'male' },
  { id: 'm09', src: '/avatars/m09.png', category: 'male' },
  { id: 'm10', src: '/avatars/m10.png', category: 'male' },
  // Animais
  { id: 'a01', src: '/avatars/a01.png', category: 'animals' },
  { id: 'a02', src: '/avatars/a02.png', category: 'animals' },
  { id: 'a03', src: '/avatars/a03.png', category: 'animals' },
  { id: 'a04', src: '/avatars/a04.png', category: 'animals' },
  { id: 'a05', src: '/avatars/a05.png', category: 'animals' },
  { id: 'a06', src: '/avatars/a06.png', category: 'animals' },
  { id: 'a07', src: '/avatars/a07.png', category: 'animals' },
  { id: 'a08', src: '/avatars/a08.png', category: 'animals' },
  { id: 'a09', src: '/avatars/a09.png', category: 'animals' },
  { id: 'a10', src: '/avatars/a10.png', category: 'animals' },
  // Hobbies
  { id: 'h01', src: '/avatars/h01.png', category: 'hobbies' },
  { id: 'h02', src: '/avatars/h02.png', category: 'hobbies' },
  { id: 'h03', src: '/avatars/h03.png', category: 'hobbies' },
  { id: 'h04', src: '/avatars/h04.png', category: 'hobbies' },
  { id: 'h05', src: '/avatars/h05.png', category: 'hobbies' },
  { id: 'h06', src: '/avatars/h06.png', category: 'hobbies' },
  { id: 'h07', src: '/avatars/h07.png', category: 'hobbies' },
  { id: 'h08', src: '/avatars/h08.png', category: 'hobbies' },
  { id: 'h09', src: '/avatars/h09.png', category: 'hobbies' },
  { id: 'h10', src: '/avatars/h10.png', category: 'hobbies' },
]

/**
 * Obtém avatar por ID
 */
export function getAvatarById(id: string): Avatar | undefined {
  return avatars.find(a => a.id === id)
}

/**
 * Obtém avatares por categoria
 */
export function getAvatarsByCategory(category: Avatar['category']): Avatar[] {
  return avatars.filter(a => a.category === category)
}

/**
 * Formata tempo em segundos para MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
