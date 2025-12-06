import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Clock, CheckCircle, XCircle, Trophy, Zap, Flame, Flag } from 'lucide-react'
import { Card, Button } from '../../components/ui'
import { GameProvider, useGame } from '../../contexts/GameContext'
import { ReportQuestionModal } from '../../components/ReportQuestionModal'
import { getPlayerSession } from '../../lib/session'
import { playCorrectAnswer, playWrongAnswer, playTimeTick, playTimeUp, playStreak, playSelect, initAudio } from '../../lib/sounds'

function PlayerGameContent() {
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
    submitAnswer,
    initGame,
    loading,
    error,
  } = useGame()

  const [showReportModal, setShowReportModal] = useState(false)
  const playerSession = getPlayerSession()
  const lastTimeLeftRef = useRef<number>(0)
  const audioInitializedRef = useRef(false)
  const hasPlayedAnswerSoundRef = useRef(false)

  // Inicializar jogo
  useEffect(() => {
    if (code) {
      initGame(code)
    }
  }, [code, initGame])

  // Redirecionar se o jogo terminou
  useEffect(() => {
    if (phase === 'results' && room) {
      navigate(`/play/${code}/results`)
    }
  }, [phase, room, code, navigate])

  // Inicializar áudio na primeira interação
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!audioInitializedRef.current) {
        initAudio()
        audioInitializedRef.current = true
      }
    }
    window.addEventListener('click', handleFirstInteraction, { once: true })
    window.addEventListener('touchstart', handleFirstInteraction, { once: true })
    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [])

  // Som de timer nos últimos 5 segundos (só se ainda não respondeu)
  useEffect(() => {
    // Só toca tick se ainda não respondeu
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastTimeLeftRef.current && !playerAnswer) {
      playTimeTick()
    }
    // Som de tempo esgotado (só se não respondeu)
    if (timeLeft === 0 && lastTimeLeftRef.current > 0 && !playerAnswer) {
      playTimeUp()
    }
    lastTimeLeftRef.current = timeLeft
  }, [timeLeft, playerAnswer])

  // Som de resposta certa/errada
  useEffect(() => {
    if (playerAnswer && !hasPlayedAnswerSoundRef.current) {
      hasPlayedAnswerSoundRef.current = true
      if (isCorrect) {
        playCorrectAnswer()
        // Som de streak se tiver mais de 1 acerto seguido
        if (lastScoreBreakdown && lastScoreBreakdown.streak >= 2) {
          setTimeout(() => playStreak(), 300)
        }
      } else {
        playWrongAnswer()
      }
    }
  }, [playerAnswer, isCorrect, lastScoreBreakdown])

  // Reset flag de som quando muda de pergunta
  useEffect(() => {
    hasPlayedAnswerSoundRef.current = false
  }, [currentQuestionIndex])

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
          <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
        </Card>
      </div>
    )
  }

  // Aguardando próxima pergunta
  if (phase === 'lobby' || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin text-secondary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Aguarde...</h1>
          <p className="text-text-muted">O host vai iniciar o jogo em breve</p>
        </Card>
      </div>
    )
  }

  // Cor do timer baseado no tempo restante
  const getTimerColor = () => {
    if (timeLeft <= 5) return 'text-error'
    if (timeLeft <= 10) return 'text-warning'
    return 'text-secondary'
  }

  // Cor do botão de opção
  const getOptionStyle = (optionId: string) => {
    // Se já respondeu, mostrar feedback
    if (playerAnswer) {
      if (optionId === currentQuestion.correct_option_id) {
        return 'bg-success/20 border-success text-success'
      }
      if (optionId === playerAnswer && !isCorrect) {
        return 'bg-error/20 border-error text-error'
      }
      return 'bg-white/5 border-white/10 opacity-50'
    }
    // Se tempo acabou sem responder
    if (timeLeft === 0) {
      if (optionId === currentQuestion.correct_option_id) {
        return 'bg-success/20 border-success text-success'
      }
      return 'bg-white/5 border-white/10 opacity-50'
    }
    // Estado normal
    return 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-primary cursor-pointer'
  }

  const options = currentQuestion.options as { id: string; text: string }[]

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Container com largura máxima para simular mobile no desktop */}
      <div className="w-full max-w-md mx-auto flex flex-col flex-1">
      {/* Header com progresso e timer */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-text-muted">
          Pergunta {currentQuestionIndex + 1} de {questions.length}
        </div>
        {/* Mostrar timer apenas se ainda não respondeu */}
        {!playerAnswer ? (
          <div className={`flex items-center gap-2 text-2xl font-bold ${getTimerColor()}`}>
            <Clock className="w-6 h-6" />
            {timeLeft}s
          </div>
        ) : (
          <div className="flex items-center gap-2 text-lg font-semibold text-secondary">
            <CheckCircle className="w-5 h-5" />
            Resposta enviada
          </div>
        )}
      </div>

      {/* Barra de progresso - esconder após responder */}
      {!playerAnswer ? (
        <div className="w-full h-2 bg-white/10 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{ width: `${(timeLeft / room.settings.time_limit) * 100}%` }}
          />
        </div>
      ) : (
        <div className="w-full h-2 bg-secondary/30 rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-secondary w-full" />
        </div>
      )}

      {/* Pergunta */}
      <div className="flex-1 flex flex-col">
        <Card className="mb-6 relative animate-fade-in" key={`question-${currentQuestionIndex}`}>
          <h1 className="text-xl md:text-2xl font-bold text-center pr-8">
            {currentQuestion.question_text}
          </h1>

          {/* Botão de reportar - aparece após responder ou tempo acabar */}
          {(playerAnswer || timeLeft === 0) && (
            <button
              onClick={() => setShowReportModal(true)}
              className="absolute top-3 right-3 p-2 text-text-muted hover:text-warning hover:bg-warning/10 rounded-lg transition-colors"
              title="Reportar problema com esta pergunta"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </Card>

        {/* Opções */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" key={`options-${currentQuestionIndex}`}>
          {options.map((option, index) => {
            const letters = ['A', 'B', 'C', 'D']
            const isDisabled = !!playerAnswer || timeLeft === 0

            return (
              <button
                key={option.id}
                onClick={() => {
                  if (!isDisabled) {
                    playSelect()
                    submitAnswer(option.id)
                  }
                }}
                disabled={isDisabled}
                className={`p-4 md:p-6 rounded-xl border-2 text-left transition-all animate-slide-up ${getOptionStyle(option.id)} ${playerAnswer === option.id ? 'animate-pulse-answer' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                    {letters[index]}
                  </span>
                  <span className="flex-1 text-base md:text-lg font-medium">
                    {option.text}
                  </span>
                  {playerAnswer === option.id && (
                    isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-success" />
                    ) : (
                      <XCircle className="w-6 h-6 text-error" />
                    )
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {(playerAnswer || timeLeft === 0) && (
          <Card className={`text-center animate-bounce-in ${isCorrect ? 'bg-success/10 border-success/20' : 'bg-error/10 border-error/20'} border`}>
            {playerAnswer ? (
              isCorrect && lastScoreBreakdown ? (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Trophy className="w-10 h-10 text-success" />
                    <div>
                      <p className="text-2xl font-bold text-success">Correto!</p>
                      <p className="text-3xl font-bold text-primary">+{lastScoreBreakdown.totalScore}</p>
                    </div>
                  </div>

                  {/* Breakdown de pontuação */}
                  <div className="flex flex-wrap justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                      <span className="text-text-muted">Base:</span>
                      <span className="font-semibold">{lastScoreBreakdown.baseScore}</span>
                    </div>

                    {lastScoreBreakdown.speedBonus > 0 && (
                      <div className="flex items-center gap-1 bg-secondary/10 px-3 py-1 rounded-full text-secondary">
                        <Zap className="w-4 h-4" />
                        <span>Velocidade: +{lastScoreBreakdown.speedBonus}</span>
                      </div>
                    )}

                    {lastScoreBreakdown.streakBonus > 0 && (
                      <div className="flex items-center gap-1 bg-warning/10 px-3 py-1 rounded-full text-warning">
                        <Flame className="w-4 h-4 animate-fire-flicker" />
                        <span>Streak x{lastScoreBreakdown.streak}: +{lastScoreBreakdown.streakBonus}</span>
                      </div>
                    )}
                  </div>

                  {lastScoreBreakdown.streak >= 2 && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-warning font-semibold">
                      <Flame className="w-5 h-5 animate-fire-flicker" />
                      <span>{lastScoreBreakdown.streak} acertos seguidos!</span>
                      <Flame className="w-5 h-5 animate-fire-flicker" />
                    </div>
                  )}
                </div>
              ) : !isCorrect ? (
                <div className="flex items-center justify-center gap-3">
                  <XCircle className="w-8 h-8 text-error" />
                  <div>
                    <p className="text-xl font-bold text-error">Incorreto!</p>
                    <p className="text-text-muted">A resposta correta foi destacada</p>
                  </div>
                </div>
              ) : null
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Clock className="w-8 h-8 text-error" />
                <div>
                  <p className="text-xl font-bold text-error">Tempo esgotado!</p>
                  <p className="text-text-muted">Você não respondeu a tempo</p>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Modal de reportar pergunta */}
      {currentQuestion && (
        <ReportQuestionModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          questionId={currentQuestion.id}
          questionText={currentQuestion.question_text}
          roomCode={code}
          playerNickname={playerSession?.nickname}
        />
      )}
      </div>
    </div>
  )
}

export default function PlayerGame() {
  return (
    <GameProvider>
      <PlayerGameContent />
    </GameProvider>
  )
}
