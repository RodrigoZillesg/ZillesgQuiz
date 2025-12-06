import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { calculateTotalScore } from '../lib/utils'
import type { Room, Question, Participant } from '../types'

type GamePhase = 'lobby' | 'playing' | 'answering' | 'feedback' | 'results'

interface ScoreBreakdown {
  baseScore: number
  speedBonus: number
  streakBonus: number
  totalScore: number
  streak: number
}

interface GameState {
  room: Room | null
  participants: Participant[]
  questions: Question[]
  currentQuestion: Question | null
  currentQuestionIndex: number
  phase: GamePhase
  timeLeft: number
  answersCount: number
  playerAnswer: string | null
  isCorrect: boolean | null
  lastScoreBreakdown: ScoreBreakdown | null
  questionStartTime: number | null
}

interface GameContextType extends GameState {
  // Host actions
  startGame: () => Promise<void>
  nextQuestion: () => Promise<void>
  endGame: () => Promise<void>
  stopTimer: () => void

  // Player actions
  submitAnswer: (optionId: string) => Promise<void>

  // Setup
  initGame: (roomCode: string) => Promise<void>

  loading: boolean
  error: string | null
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [timeLeft, setTimeLeft] = useState(0)
  const [answersCount, setAnswersCount] = useState(0)
  const [playerAnswer, setPlayerAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [lastScoreBreakdown, setLastScoreBreakdown] = useState<ScoreBreakdown | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Referências para controle do timer
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const questionStartedAtRef = useRef<string | null>(null)
  const timeLimitRef = useRef<number>(20)

  const roomSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const answersSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastRoomStateRef = useRef<{ questionIndex: number; status: string; questionStartedAt: string | null }>({
    questionIndex: 0,
    status: 'waiting',
    questionStartedAt: null,
  })

  const currentQuestion = questions[currentQuestionIndex] || null

  // Limpar timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Parser robusto para timestamps do PostgreSQL
  const parseTimestamp = useCallback((timestamp: string): number => {
    if (!timestamp) return 0

    // PostgreSQL retorna formato como "2025-12-05 09:53:08.134406+00"
    // JavaScript pode não entender "+00", precisa de "+00:00" ou "Z"
    let normalizedTimestamp = timestamp

    // Substituir espaço por 'T' para formato ISO
    normalizedTimestamp = normalizedTimestamp.replace(' ', 'T')

    // Corrigir timezone: "+00" -> "+00:00"
    if (/[+-]\d{2}$/.test(normalizedTimestamp)) {
      normalizedTimestamp = normalizedTimestamp + ':00'
    }

    const parsed = new Date(normalizedTimestamp).getTime()

    if (isNaN(parsed)) {
      console.error('[GameContext] Failed to parse timestamp:', timestamp)
      return 0
    }

    return parsed
  }, [])

  // Iniciar timer baseado em timestamp do servidor
  const startServerTimer = useCallback((questionStartedAt: string, timeLimit: number) => {
    // Limpar timer anterior
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    console.log('[GameContext] startServerTimer called with:', questionStartedAt, 'timeLimit:', timeLimit)

    // Parsear o timestamp do servidor
    const parsedServerTime = parseTimestamp(questionStartedAt)

    if (parsedServerTime === 0) {
      console.error('[GameContext] Failed to parse start time, cannot start timer')
      return
    }

    // Armazenar nas refs
    questionStartedAtRef.current = questionStartedAt
    timeLimitRef.current = timeLimit

    // Calcular tempo já decorrido no servidor (se positivo)
    const serverElapsedMs = Date.now() - parsedServerTime
    const serverElapsedSeconds = Math.max(0, Math.floor(serverElapsedMs / 1000))

    console.log('[GameContext] Server elapsed:', serverElapsedSeconds, 'seconds (raw ms:', serverElapsedMs, ')')

    // Usar hora local como referência para evitar problemas de sincronização de relógio
    // O tempo inicial já considera quanto tempo passou no servidor
    const localStartTime = Date.now()
    const initialElapsed = serverElapsedSeconds

    // Calcular tempo restante
    const calculateRemaining = () => {
      const localElapsedMs = Date.now() - localStartTime
      const localElapsedSeconds = Math.floor(localElapsedMs / 1000)
      const totalElapsed = initialElapsed + localElapsedSeconds
      const remaining = timeLimit - totalElapsed
      return Math.max(0, remaining)
    }

    const initialTime = calculateRemaining()
    console.log('[GameContext] Initial time left:', initialTime)

    setTimeLeft(initialTime)
    setQuestionStartTime(parsedServerTime)

    if (initialTime <= 0) {
      console.log('[GameContext] Timer already expired, going to feedback')
      setPhase('feedback')
      return
    }

    // Timer que recalcula a cada 100ms para precisão
    timerRef.current = setInterval(() => {
      const remaining = calculateRemaining()
      setTimeLeft(remaining)

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setPhase('feedback')
      }
    }, 100)
  }, [parseTimestamp])

  // Inicializar jogo
  const initGame = useCallback(async (roomCode: string) => {
    setLoading(true)
    setError(null)

    try {
      // Buscar sala
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError || !roomData) {
        throw new Error('Sala não encontrada')
      }

      console.log('[GameContext] Room loaded:', roomData.status, 'question_started_at:', roomData.question_started_at)

      setRoom(roomData as Room)
      setCurrentQuestionIndex(roomData.current_question_index || 0)

      // Buscar perguntas da sala
      if (roomData.question_ids && roomData.question_ids.length > 0) {
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .in('id', roomData.question_ids)

        if (questionsData) {
          // Ordenar na mesma ordem dos IDs
          const orderedQuestions = roomData.question_ids
            .map((id: string) => questionsData.find(q => q.id === id))
            .filter(Boolean) as Question[]
          setQuestions(orderedQuestions)
        }
      }

      // Buscar participantes
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)

      if (participantsData) {
        setParticipants(participantsData as Participant[])
      }

      // Determinar fase baseado no status
      if (roomData.status === 'active') {
        if (roomData.question_started_at) {
          // Verificar se o tempo ainda não expirou antes de começar
          const startedAt = parseTimestamp(roomData.question_started_at)
          const elapsedMs = Date.now() - startedAt
          const elapsedSeconds = Math.floor(elapsedMs / 1000)
          const timeLimit = roomData.settings.time_limit

          if (elapsedSeconds < timeLimit) {
            console.log('[GameContext] Starting timer from initGame, elapsed:', elapsedSeconds)
            setPhase('playing')
            startServerTimer(roomData.question_started_at, timeLimit)
          } else {
            // Tempo já expirou, mostrar em fase de feedback
            console.log('[GameContext] Question time already expired in initGame')
            setPhase('feedback')
            setTimeLeft(0)
          }
        } else {
          // Sala está ativa mas ainda aguardando host iniciar a primeira pergunta
          console.log('[GameContext] Room active but no question started yet')
          setPhase('lobby')
        }
      } else if (roomData.status === 'finished') {
        setPhase('results')
      } else {
        setPhase('lobby')
      }

      // Subscribe para mudanças na sala
      roomSubscriptionRef.current = supabase
        .channel(`game-room-${roomData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomData.id}`,
          },
          (payload) => {
            const updatedRoom = payload.new as Room
            const lastState = lastRoomStateRef.current

            console.log('[GameContext] Room updated via Realtime:', updatedRoom.status, 'question_started_at:', updatedRoom.question_started_at, 'question_index:', updatedRoom.current_question_index)

            // Verificar se é uma NOVA pergunta (timestamp ou índice mudou)
            const isNewQuestion =
              updatedRoom.question_started_at !== lastState.questionStartedAt ||
              updatedRoom.current_question_index !== lastState.questionIndex

            setRoom(updatedRoom)
            setCurrentQuestionIndex(updatedRoom.current_question_index)

            if (updatedRoom.status === 'active' && updatedRoom.question_started_at && isNewQuestion) {
              // Atualizar referência
              lastRoomStateRef.current = {
                questionIndex: updatedRoom.current_question_index,
                status: updatedRoom.status,
                questionStartedAt: updatedRoom.question_started_at,
              }

              // Reiniciar timer e resetar estado do player para nova pergunta
              console.log('[GameContext] Starting timer from Realtime update (new question detected)')
              setPlayerAnswer(null)
              setIsCorrect(null)
              setLastScoreBreakdown(null)
              setAnswersCount(0)
              setPhase('playing')
              startServerTimer(updatedRoom.question_started_at, updatedRoom.settings.time_limit)
            } else if (updatedRoom.status === 'finished') {
              clearTimer()
              setPhase('results')
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[GameContext] Room subscription status:', status, err ? `Error: ${JSON.stringify(err)}` : '')
        })

      // Subscribe para respostas
      answersSubscriptionRef.current = supabase
        .channel(`game-answers-${roomData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'answers',
            filter: `room_id=eq.${roomData.id}`,
          },
          () => {
            setAnswersCount((prev) => prev + 1)
          }
        )
        .subscribe()

      // Polling fallback para quando Realtime falhar
      // Inicializar estado de referência
      lastRoomStateRef.current = {
        questionIndex: roomData.current_question_index || 0,
        status: roomData.status,
        questionStartedAt: roomData.question_started_at,
      }

      // Polling a cada 2 segundos como fallback
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const { data: polledRoom } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomData.id)
            .single()

          if (!polledRoom) return

          const lastState = lastRoomStateRef.current
          const hasChanges =
            polledRoom.current_question_index !== lastState.questionIndex ||
            polledRoom.status !== lastState.status ||
            polledRoom.question_started_at !== lastState.questionStartedAt

          if (hasChanges) {
            console.log('[GameContext] Polling detected changes:', {
              questionIndex: polledRoom.current_question_index,
              status: polledRoom.status,
              questionStartedAt: polledRoom.question_started_at,
            })

            // Atualizar referência
            lastRoomStateRef.current = {
              questionIndex: polledRoom.current_question_index,
              status: polledRoom.status,
              questionStartedAt: polledRoom.question_started_at,
            }

            // Aplicar mudanças (mesmo código do handler Realtime)
            setRoom(polledRoom as Room)
            setCurrentQuestionIndex(polledRoom.current_question_index)

            if (polledRoom.status === 'active' && polledRoom.question_started_at) {
              console.log('[GameContext] Starting timer from polling update')
              setPlayerAnswer(null)
              setIsCorrect(null)
              setLastScoreBreakdown(null)
              setAnswersCount(0)
              setPhase('playing')
              startServerTimer(polledRoom.question_started_at, polledRoom.settings.time_limit)
            } else if (polledRoom.status === 'finished') {
              clearTimer()
              setPhase('results')
            }
          }
        } catch (err) {
          console.error('[GameContext] Polling error:', err)
        }
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [startServerTimer, clearTimer, parseTimestamp])

  // Iniciar jogo (Host)
  const startGame = useCallback(async () => {
    if (!room || questions.length === 0) return

    console.log('[GameContext] Host starting game...')

    // Usar RPC para definir timestamp no servidor (evita problemas de sincronização de relógio)
    const { error: rpcError } = await supabase.rpc('start_game', { room_id: room.id })

    if (rpcError) {
      // Fallback para update normal se RPC não existir
      console.log('[GameContext] RPC not available, using client timestamp')
      const now = new Date().toISOString()
      await supabase
        .from('rooms')
        .update({
          status: 'active',
          current_question_index: 0,
          question_started_at: now
        })
        .eq('id', room.id)
    }

    // Buscar o timestamp atualizado do servidor
    const { data: updatedRoom } = await supabase
      .from('rooms')
      .select('question_started_at, settings')
      .eq('id', room.id)
      .single()

    const serverTimestamp = updatedRoom?.question_started_at
    console.log('[GameContext] Server timestamp:', serverTimestamp)

    setPhase('playing')
    setCurrentQuestionIndex(0)
    setAnswersCount(0)
    setPlayerAnswer(null)
    setIsCorrect(null)
    setLastScoreBreakdown(null)

    if (serverTimestamp) {
      startServerTimer(serverTimestamp, room.settings.time_limit)
    }
  }, [room, questions, startServerTimer])

  // Próxima pergunta (Host)
  const nextQuestion = useCallback(async () => {
    if (!room) return

    const nextIndex = currentQuestionIndex + 1

    if (nextIndex >= questions.length) {
      // Fim do jogo
      await supabase
        .from('rooms')
        .update({ status: 'finished', question_started_at: null })
        .eq('id', room.id)
      clearTimer()
      setPhase('results')
      return
    }

    console.log('[GameContext] Host advancing to question', nextIndex)

    // Usar RPC para definir timestamp no servidor
    const { error: rpcError } = await supabase.rpc('next_question', {
      room_id: room.id,
      next_index: nextIndex
    })

    if (rpcError) {
      // Fallback para update normal se RPC não existir
      console.log('[GameContext] RPC not available, using client timestamp')
      const now = new Date().toISOString()
      await supabase
        .from('rooms')
        .update({
          current_question_index: nextIndex,
          question_started_at: now
        })
        .eq('id', room.id)
    }

    // Buscar o timestamp atualizado do servidor
    const { data: updatedRoom } = await supabase
      .from('rooms')
      .select('question_started_at, settings')
      .eq('id', room.id)
      .single()

    const serverTimestamp = updatedRoom?.question_started_at
    console.log('[GameContext] Server timestamp:', serverTimestamp)

    setCurrentQuestionIndex(nextIndex)
    setAnswersCount(0)
    setPlayerAnswer(null)
    setIsCorrect(null)
    setLastScoreBreakdown(null)
    setPhase('playing')

    if (serverTimestamp) {
      startServerTimer(serverTimestamp, room.settings.time_limit)
    }
  }, [room, currentQuestionIndex, questions.length, startServerTimer, clearTimer])

  // Finalizar jogo (Host)
  const endGame = useCallback(async () => {
    if (!room) return

    await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', room.id)

    setPhase('results')
    clearTimer()
  }, [room, clearTimer])

  // Parar timer manualmente (quando todos respondem)
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimeLeft(0)
    setPhase('feedback')
  }, [])

  // Enviar resposta (Player)
  const submitAnswer = useCallback(async (optionId: string) => {
    if (!room || !currentQuestion || playerAnswer) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Buscar participant atual do BANCO (não do estado local que pode estar desatualizado)
    const { data: currentParticipant } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .single()

    if (!currentParticipant) return

    const correct = optionId === currentQuestion.correct_option_id

    // Calcular tempo de resposta
    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : 0
    const timeLimitMs = room.settings.time_limit * 1000

    // Calcular streak atual (será incrementado se correto)
    const currentStreak = currentParticipant.streak || 0
    const newStreak = correct ? currentStreak + 1 : 0

    // Calcular pontuação com bônus
    let scoreBreakdown: ScoreBreakdown | null = null
    let pointsEarned = 0

    if (correct) {
      const result = calculateTotalScore(
        currentQuestion.difficulty,
        responseTimeMs,
        timeLimitMs,
        currentStreak // Usa o streak antes de incrementar para este cálculo
      )
      scoreBreakdown = { ...result, streak: newStreak }
      pointsEarned = result.totalScore
    }

    setPlayerAnswer(optionId)
    setIsCorrect(correct)
    setLastScoreBreakdown(scoreBreakdown)
    setPhase('answering')

    // Inserir resposta com detalhes
    await supabase.from('answers').insert({
      room_id: room.id,
      participant_id: currentParticipant.id,
      question_id: currentQuestion.id,
      selected_option_id: optionId,
      is_correct: correct,
      response_time_ms: responseTimeMs,
      points_earned: pointsEarned,
    })

    // Atualizar score e streak (usando o score atual do banco)
    await supabase
      .from('participants')
      .update({
        score: currentParticipant.score + pointsEarned,
        streak: newStreak
      })
      .eq('id', currentParticipant.id)

  }, [room, currentQuestion, playerAnswer, questionStartTime])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      clearTimer()
      if (roomSubscriptionRef.current) {
        supabase.removeChannel(roomSubscriptionRef.current)
      }
      if (answersSubscriptionRef.current) {
        supabase.removeChannel(answersSubscriptionRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [clearTimer])

  return (
    <GameContext.Provider
      value={{
        room,
        participants,
        questions,
        currentQuestion,
        currentQuestionIndex,
        phase,
        timeLeft,
        answersCount,
        playerAnswer,
        isCorrect,
        lastScoreBreakdown,
        questionStartTime,
        startGame,
        nextQuestion,
        endGame,
        stopTimer,
        submitAnswer,
        initGame,
        loading,
        error,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
