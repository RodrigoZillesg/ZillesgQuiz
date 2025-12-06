import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2, Clock, Users, SkipForward, StopCircle,
  Trophy, CheckCircle, XCircle, BarChart3, Flame, Zap, Home
} from 'lucide-react'
import { Card, Button, Avatar } from '../../components/ui'
import { GameProvider, useGame } from '../../contexts/GameContext'
import { supabase } from '../../lib/supabase'
import { playCountdownTick, playCountdownGo, playTimeTick, playNewQuestion, initAudio } from '../../lib/sounds'
import type { Participant } from '../../types'

function HostGameContent() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const {
    room,
    currentQuestion,
    currentQuestionIndex,
    questions,
    phase,
    timeLeft,
    playerAnswer,
    isCorrect,
    lastScoreBreakdown,
    startGame,
    nextQuestion,
    endGame,
    stopTimer,
    submitAnswer,
    initGame,
    loading,
    error,
  } = useGame()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [showAnswer, setShowAnswer] = useState(false)
  const [currentAnswersCount, setCurrentAnswersCount] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const lastTimeLeftRef = useRef<number>(0)
  const audioInitializedRef = useRef(false)

  // Inicializar jogo
  useEffect(() => {
    if (code) {
      initGame(code)
    }
  }, [code, initGame])

  // Buscar participantes e respostas atualizados (com polling para garantir atualização)
  useEffect(() => {
    if (!room) return

    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('score', { ascending: false })

      if (data) {
        setParticipants(data as Participant[])
      }
    }

    const fetchAnswersCount = async () => {
      if (!currentQuestion) return

      const { count } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .eq('question_id', currentQuestion.id)

      setCurrentAnswersCount(count || 0)
    }

    // Fetch inicial
    fetchParticipants()
    fetchAnswersCount()

    // Polling a cada 2 segundos para garantir atualização (Realtime nem sempre funciona)
    const pollingInterval = setInterval(() => {
      fetchParticipants()
      fetchAnswersCount()
    }, 2000)

    // Subscribe para atualizações de participantes (tentativa via Realtime)
    const subscription = supabase
      .channel(`host-participants-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchParticipants()
        }
      )
      .subscribe()

    return () => {
      clearInterval(pollingInterval)
      supabase.removeChannel(subscription)
    }
  }, [room, currentQuestion])

  // Reset showAnswer e contador de respostas quando muda de pergunta
  useEffect(() => {
    setShowAnswer(false)
    setCurrentAnswersCount(0)
    // Som de nova pergunta
    if (currentQuestionIndex > 0) {
      playNewQuestion()
    }
  }, [currentQuestionIndex])

  // Som de timer nos últimos 5 segundos (só se ainda não respondeu)
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastTimeLeftRef.current && !playerAnswer) {
      playTimeTick()
    }
    lastTimeLeftRef.current = timeLeft
  }, [timeLeft, playerAnswer])

  // Verificar se todos responderam (só conta se tiver jogadores E respostas)
  const allAnswered = participants.length > 0 && currentAnswersCount > 0 && currentAnswersCount >= participants.length

  // Quando tempo acaba ou TODOS responderam, mostrar resposta e parar timer
  // Nota: playerAnswer não deve triggerar showAnswer porque o host também joga
  useEffect(() => {
    if (timeLeft === 0 || allAnswered) {
      setShowAnswer(true)
    }
    // Parar o timer quando todos responderam
    if (allAnswered && timeLeft > 0) {
      stopTimer()
    }
  }, [timeLeft, allAnswered, stopTimer])

  // Ir para próxima pergunta
  const handleNextQuestion = async () => {
    setShowAnswer(false)
    await nextQuestion()
  }

  // Encerrar jogo
  const handleEndGame = async () => {
    await endGame()
    navigate(`/host/room/${code}/results`)
  }

  // Iniciar contagem regressiva antes do jogo
  const handleStartWithCountdown = async () => {
    if (!room) return

    // Inicializar áudio na primeira interação
    if (!audioInitializedRef.current) {
      initAudio()
      audioInitializedRef.current = true
    }

    // Broadcast para players que a contagem começou
    const channel = supabase.channel(`countdown-${room.id}`)

    // Aguardar inscrição completa no canal
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        console.log('Host canal countdown status:', status)
        if (status === 'SUBSCRIBED') {
          resolve()
        }
      })
    })

    // Aguardar mais tempo para garantir que players também estejam inscritos
    // Players já devem estar inscritos desde que entraram no lobby
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Função helper para enviar broadcast com redundância
    const sendCountdown = async (count: number) => {
      // Envia 3 vezes com pequeno intervalo para garantir entrega
      for (let attempt = 0; attempt < 3; attempt++) {
        await channel.send({
          type: 'broadcast',
          event: 'countdown',
          payload: { count }
        })
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    }

    // Contagem 3, 2, 1
    for (let i = 3; i >= 0; i--) {
      setCountdown(i)
      await sendCountdown(i)

      // Tocar som de countdown
      if (i > 0) {
        playCountdownTick()
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        playCountdownGo()
      }
    }

    // Iniciar o jogo
    await startGame()
    setCountdown(null)

    // Cleanup do channel
    supabase.removeChannel(channel)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-4">Erro</h1>
          <p className="text-text-muted mb-6">{error || 'Sala não encontrada'}</p>
          <Button onClick={() => navigate('/host')}>Voltar ao Painel</Button>
        </Card>
      </div>
    )
  }

  // Se está no lobby ou em countdown, mostrar tela de espera/contagem
  if (phase === 'lobby' || countdown !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        {/* Overlay de countdown */}
        {countdown !== null && (
          <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center">
            <div className="text-center">
              {countdown > 0 ? (
                <div className="animate-countdown-pop" key={countdown}>
                  <span className="text-[12rem] font-bold font-heading text-primary drop-shadow-[0_0_50px_rgba(255,107,53,0.5)]">
                    {countdown}
                  </span>
                </div>
              ) : (
                <div className="animate-bounce-in">
                  <span className="text-8xl font-bold font-heading text-secondary drop-shadow-[0_0_50px_rgba(0,245,212,0.5)]">
                    VAI!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Card className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Pronto para iniciar!</h1>
          <p className="text-text-muted mb-6">
            {participants.length} jogador{participants.length !== 1 ? 'es' : ''} na sala
          </p>
          <Button size="lg" onClick={handleStartWithCountdown} disabled={participants.length === 0 || countdown !== null}>
            Iniciar Jogo
          </Button>
        </Card>
      </div>
    )
  }

  // Se terminou
  if (phase === 'results') {
    navigate(`/host/room/${code}/results`)
    return null
  }

  // Cor do timer
  const getTimerColor = () => {
    if (timeLeft <= 5) return 'text-error'
    if (timeLeft <= 10) return 'text-warning'
    return 'text-secondary'
  }

  const options = currentQuestion?.options as { id: string; text: string }[] || []

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/host')}
              className="text-text-muted hover:text-text-primary"
              title="Voltar ao Painel"
            >
              <Home className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-text-muted">Sala {code}</p>
              <h1 className="text-2xl font-bold font-heading">
                Pergunta {currentQuestionIndex + 1} de {questions.length}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Mostrar timer diferente após host responder */}
            {!playerAnswer ? (
              <div className={`flex items-center gap-2 text-3xl font-bold ${getTimerColor()}`}>
                <Clock className="w-8 h-8" />
                {timeLeft}s
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-lg font-semibold text-secondary">
                  <CheckCircle className="w-6 h-6" />
                  Você respondeu
                </div>
                <div className="text-text-muted text-lg">
                  ({timeLeft}s restantes)
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna principal - Pergunta */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barra de progresso - muda estilo após host responder */}
            {!playerAnswer ? (
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-1000"
                  style={{ width: `${(timeLeft / room.settings.time_limit) * 100}%` }}
                />
              </div>
            ) : (
              <div className="w-full h-3 bg-secondary/20 rounded-full overflow-hidden">
                <div className="h-full bg-secondary/50 w-full" />
              </div>
            )}

            {/* Pergunta */}
            <Card className="animate-fade-in" key={`question-${currentQuestionIndex}`}>
              <h2 className="text-xl md:text-2xl font-bold mb-6">
                {currentQuestion?.question_text}
              </h2>

              {/* Opções */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option, index) => {
                  const letters = ['A', 'B', 'C', 'D']
                  const isCorrectOption = option.id === currentQuestion?.correct_option_id
                  const wasSelected = playerAnswer === option.id

                  // Host não pode responder se: já respondeu OU tempo acabou
                  // NOTA: showAnswer NÃO deve bloquear - host pode responder até o tempo acabar
                  const isDisabled = !!playerAnswer || timeLeft === 0

                  // Condição para revelar resposta: tempo acabou, todos responderam, ou host clicou em revelar
                  // IMPORTANTE: Host só vê a resposta correta APÓS ter respondido OU tempo acabar
                  const shouldRevealAnswer = (showAnswer && playerAnswer) || timeLeft === 0 || allAnswered

                  // Determinar estilo baseado no estado
                  const getOptionStyle = () => {
                    // Se deve revelar resposta, mostrar feedback
                    if (shouldRevealAnswer) {
                      if (isCorrectOption) {
                        return 'bg-success/20 border-success'
                      }
                      if (wasSelected && !isCorrect) {
                        return 'bg-error/20 border-error'
                      }
                      return 'bg-white/5 border-white/10 opacity-50'
                    }
                    // Se host já respondeu mas ainda não deve revelar, mostrar que selecionou
                    if (wasSelected) {
                      return 'bg-primary/20 border-primary'
                    }
                    // Se tempo acabou sem responder
                    if (timeLeft === 0) {
                      return 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                    }
                    // Estado normal - clicável
                    return 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-primary cursor-pointer'
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => !isDisabled && submitAnswer(option.id)}
                      disabled={isDisabled}
                      className={`p-4 rounded-xl border-2 transition-all text-left animate-slide-up ${getOptionStyle()} ${wasSelected ? 'animate-pulse-answer' : ''}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          shouldRevealAnswer && isCorrectOption ? 'bg-success text-white' :
                          wasSelected ? 'bg-primary text-white' : 'bg-white/10'
                        }`}>
                          {letters[index]}
                        </span>
                        <span className="flex-1 font-medium">{option.text}</span>
                        {shouldRevealAnswer && isCorrectOption && (
                          <CheckCircle className="w-6 h-6 text-success animate-bounce-in" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Aviso quando host clica revelar sem ter respondido */}
              {showAnswer && !playerAnswer && timeLeft > 0 && !allAnswered && (
                <div className="mt-4 p-4 rounded-xl animate-bounce-in bg-warning/10 border border-warning/20">
                  <p className="text-warning text-center font-semibold">
                    ⚠️ Você ainda não respondeu!
                  </p>
                  <p className="text-text-muted text-center text-sm mt-1">
                    Clique em uma opção para registrar sua resposta. A resposta correta será revelada depois.
                  </p>
                </div>
              )}

              {/* Feedback de pontuação do Host - só aparece após revelar resposta E ter respondido */}
              {playerAnswer && ((showAnswer && playerAnswer) || timeLeft === 0 || allAnswered) && (
                <div className={`mt-4 p-4 rounded-xl animate-bounce-in ${isCorrect ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'}`}>
                  {isCorrect && lastScoreBreakdown ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-success" />
                        <div>
                          <p className="font-bold text-success">Você acertou!</p>
                          <p className="text-2xl font-bold text-primary">+{lastScoreBreakdown.totalScore}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <div className="bg-white/5 px-3 py-1 rounded-full">
                          Base: {lastScoreBreakdown.baseScore}
                        </div>
                        {lastScoreBreakdown.speedBonus > 0 && (
                          <div className="bg-secondary/10 px-3 py-1 rounded-full text-secondary flex items-center gap-1">
                            <Zap className="w-4 h-4" />
                            +{lastScoreBreakdown.speedBonus}
                          </div>
                        )}
                        {lastScoreBreakdown.streakBonus > 0 && (
                          <div className="bg-warning/10 px-3 py-1 rounded-full text-warning flex items-center gap-1">
                            <Flame className="w-4 h-4 animate-fire-flicker" />
                            +{lastScoreBreakdown.streakBonus}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <XCircle className="w-8 h-8 text-error" />
                      <div>
                        <p className="font-bold text-error">Resposta incorreta</p>
                        <p className="text-text-muted text-sm">A resposta correta foi destacada</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Controles */}
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${
                  currentAnswersCount >= participants.length && participants.length > 0
                    ? 'text-success'
                    : 'text-text-muted'
                }`}>
                  <Users className="w-5 h-5" />
                  <span>
                    {currentAnswersCount} / {participants.length} respostas
                    {currentAnswersCount >= participants.length && participants.length > 0 && (
                      <span className="ml-2 text-success">✓ Todos responderam!</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                {!showAnswer && timeLeft > 0 && !allAnswered && (
                  <Button variant="ghost" onClick={() => setShowAnswer(true)}>
                    Revelar Resposta
                  </Button>
                )}

                {(showAnswer || timeLeft === 0 || allAnswered) ? (
                  <>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button onClick={handleNextQuestion}>
                        <SkipForward className="w-5 h-5" />
                        Próxima Pergunta
                      </Button>
                    ) : (
                      <Button onClick={handleEndGame}>
                        <Trophy className="w-5 h-5" />
                        Ver Resultados
                      </Button>
                    )}
                  </>
                ) : null}

                <Button variant="ghost" onClick={handleEndGame} className="text-error hover:bg-error/10">
                  <StopCircle className="w-5 h-5" />
                  Encerrar
                </Button>
              </div>
            </Card>
          </div>

          {/* Coluna lateral - Ranking */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-secondary" />
                Ranking ao Vivo
              </h3>

              {room.settings.mode === 'teams' ? (
                // Modo times
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-team-red/10 border border-team-red/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-team-red font-semibold">Time Vermelho</span>
                      <span className="text-lg font-bold">
                        {participants.filter(p => p.team === 'red').reduce((sum, p) => sum + p.score, 0)} pts
                      </span>
                    </div>
                    <div className="space-y-1">
                      {participants.filter(p => p.team === 'red').slice(0, 3).map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                          <Avatar avatarId={p.avatar_icon} size="sm" />
                          <span className="truncate flex-1">{p.nickname}</span>
                          {p.streak >= 2 && (
                            <div className="flex items-center gap-0.5 text-warning">
                              <Flame className="w-3 h-3 animate-fire-flicker" />
                              <span className="text-xs font-bold">{p.streak}</span>
                            </div>
                          )}
                          <span className="text-text-muted">{p.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-team-blue/10 border border-team-blue/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-team-blue font-semibold">Time Azul</span>
                      <span className="text-lg font-bold">
                        {participants.filter(p => p.team === 'blue').reduce((sum, p) => sum + p.score, 0)} pts
                      </span>
                    </div>
                    <div className="space-y-1">
                      {participants.filter(p => p.team === 'blue').slice(0, 3).map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                          <Avatar avatarId={p.avatar_icon} size="sm" />
                          <span className="truncate flex-1">{p.nickname}</span>
                          {p.streak >= 2 && (
                            <div className="flex items-center gap-0.5 text-warning">
                              <Flame className="w-3 h-3 animate-fire-flicker" />
                              <span className="text-xs font-bold">{p.streak}</span>
                            </div>
                          )}
                          <span className="text-text-muted">{p.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Modo solo
                <div className="space-y-2">
                  {participants.slice(0, 10).map((p, index) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        index < 3 ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className={`w-6 text-center font-bold ${
                        index === 0 ? 'text-warning' :
                        index === 1 ? 'text-gray-400' :
                        index === 2 ? 'text-amber-700' :
                        'text-text-muted'
                      }`}>
                        {index + 1}
                      </span>
                      <Avatar avatarId={p.avatar_icon} size="sm" />
                      <span className="flex-1 truncate">{p.nickname}</span>
                      {p.streak >= 2 && (
                        <div className="flex items-center gap-1 text-warning">
                          <Flame className="w-4 h-4 animate-fire-flicker" />
                          <span className="text-xs font-bold">{p.streak}</span>
                        </div>
                      )}
                      <span className="font-semibold">{p.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Dificuldade da pergunta atual */}
            {currentQuestion && (
              <Card>
                <h3 className="text-sm font-semibold text-text-muted mb-2">Dificuldade</h3>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  currentQuestion.difficulty === 'easy' ? 'bg-success/20 text-success' :
                  currentQuestion.difficulty === 'medium' ? 'bg-warning/20 text-warning' :
                  'bg-error/20 text-error'
                }`}>
                  {currentQuestion.difficulty === 'easy' ? 'Fácil (100 pts)' :
                   currentQuestion.difficulty === 'medium' ? 'Médio (200 pts)' :
                   'Difícil (300 pts)'}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HostGame() {
  return (
    <GameProvider>
      <HostGameContent />
    </GameProvider>
  )
}
