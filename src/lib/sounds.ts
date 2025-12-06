// Utilitário de sons do jogo usando Web Audio API

let audioContext: AudioContext | null = null

// Inicializa o contexto de áudio (deve ser chamado após interação do usuário)
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

// Som de beep genérico
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch (e) {
    console.warn('Erro ao tocar som:', e)
  }
}

// Som de countdown (3, 2, 1)
export function playCountdownTick() {
  playTone(800, 0.15, 'sine', 0.4)
}

// Som de "VAI!" / GO
export function playCountdownGo() {
  playTone(1200, 0.1, 'sine', 0.5)
  setTimeout(() => playTone(1600, 0.2, 'sine', 0.5), 100)
}

// Som de resposta correta
export function playCorrectAnswer() {
  playTone(523.25, 0.1, 'sine', 0.4) // C5
  setTimeout(() => playTone(659.25, 0.1, 'sine', 0.4), 100) // E5
  setTimeout(() => playTone(783.99, 0.2, 'sine', 0.4), 200) // G5
}

// Som de resposta errada
export function playWrongAnswer() {
  playTone(200, 0.15, 'sawtooth', 0.3)
  setTimeout(() => playTone(150, 0.25, 'sawtooth', 0.3), 150)
}

// Som de tempo acabando (tick rápido)
export function playTimeTick() {
  playTone(1000, 0.05, 'square', 0.2)
}

// Som de tempo esgotado
export function playTimeUp() {
  playTone(400, 0.15, 'sawtooth', 0.4)
  setTimeout(() => playTone(300, 0.15, 'sawtooth', 0.4), 150)
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.4), 300)
}

// Som de clique em botão
export function playClick() {
  playTone(600, 0.05, 'sine', 0.2)
}

// Som de seleção de opção
export function playSelect() {
  playTone(800, 0.08, 'sine', 0.25)
}

// Som de vitória / confete
export function playVictory() {
  const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
  notes.forEach((note, i) => {
    setTimeout(() => playTone(note, 0.2, 'sine', 0.4), i * 100)
  })
}

// Som de nova pergunta
export function playNewQuestion() {
  playTone(440, 0.1, 'sine', 0.3)
  setTimeout(() => playTone(550, 0.15, 'sine', 0.3), 100)
}

// Som de streak (sequência de acertos)
export function playStreak() {
  playTone(880, 0.1, 'sine', 0.4)
  setTimeout(() => playTone(1100, 0.1, 'sine', 0.4), 80)
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.4), 160)
}

// Inicializar contexto de áudio (chamar após primeira interação)
export function initAudio() {
  try {
    getAudioContext()
    // Tocar som silencioso para "desbloquear" o áudio em mobile
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.001)
  } catch (e) {
    console.warn('Não foi possível inicializar áudio:', e)
  }
}
