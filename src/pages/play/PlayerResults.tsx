import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trophy, Medal, Home, Loader2, Users } from 'lucide-react'
import { Card, Button } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { clearPlayerSession } from '../../lib/session'
import { playVictory, initAudio } from '../../lib/sounds'
import confetti from 'canvas-confetti'
import type { Room, Participant } from '../../types'

export default function PlayerResults() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [loading, setLoading] = useState(true)
  const hasPlayedVictorySoundRef = useRef(false)

  useEffect(() => {
    const fetchResults = async () => {
      if (!code) return

      // Buscar sala
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (!roomData) {
        setLoading(false)
        return
      }

      setRoom(roomData as Room)

      // Buscar participantes ordenados por score
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)
        .order('score', { ascending: false })

      if (participantsData) {
        setParticipants(participantsData as Participant[])

        // Encontrar participante atual
        if (user) {
          const current = participantsData.find(p => p.user_id === user.id)
          if (current) {
            setCurrentParticipant(current as Participant)
          }
        }
      }

      setLoading(false)
    }

    fetchResults()
  }, [code, user])

  // Efeito de confete e som de vitória ao carregar resultados
  useEffect(() => {
    if (!loading && participants.length > 0) {
      // Tocar som de vitória uma vez
      if (!hasPlayedVictorySoundRef.current) {
        initAudio()
        playVictory()
        hasPlayedVictorySoundRef.current = true
      }

      // Disparo inicial de confete
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          clearInterval(interval)
          return
        }

        const particleCount = 50 * (timeLeft / duration)

        // Confete de ambos os lados
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)

      return () => clearInterval(interval)
    }
  }, [loading, participants.length])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-4">Sala não encontrada</h1>
          <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
        </Card>
      </div>
    )
  }

  // Posição do jogador atual
  const playerPosition = currentParticipant
    ? participants.findIndex(p => p.id === currentParticipant.id) + 1
    : null

  // Top 3
  const topThree = participants.slice(0, 3)

  // Calcular pontuação dos times (se modo times)
  const teamScores = room.settings.mode === 'teams'
    ? {
        red: participants.filter(p => p.team === 'red').reduce((sum, p) => sum + p.score, 0),
        blue: participants.filter(p => p.team === 'blue').reduce((sum, p) => sum + p.score, 0),
      }
    : null

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Container com largura máxima para simular mobile no desktop */}
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-warning mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold font-heading mb-2">
            Fim de Jogo!
          </h1>
          <p className="text-text-muted">Sala {code}</p>
        </div>

        {/* Resultado do jogador atual */}
        {currentParticipant && (
          <Card className="mb-6 text-center bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">{currentParticipant.avatar_icon}</span>
              <div>
                <p className="text-lg font-semibold">{currentParticipant.nickname}</p>
                <p className="text-text-muted">Você</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-8 mt-4">
              <div>
                <p className="text-3xl font-bold text-primary">{currentParticipant.score}</p>
                <p className="text-sm text-text-muted">pontos</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-secondary">#{playerPosition}</p>
                <p className="text-sm text-text-muted">posição</p>
              </div>
            </div>
          </Card>
        )}

        {/* Placar de times (se aplicável) */}
        {teamScores && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold mb-4 text-center">Placar dos Times</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl text-center ${teamScores.red > teamScores.blue ? 'bg-team-red/20 ring-2 ring-team-red' : 'bg-team-red/10'}`}>
                <p className="text-team-red font-semibold mb-1">Time Vermelho</p>
                <p className="text-2xl font-bold">{teamScores.red}</p>
                {teamScores.red > teamScores.blue && (
                  <span className="inline-block mt-2 px-2 py-1 bg-team-red text-white text-xs rounded-full">
                    Vencedor!
                  </span>
                )}
              </div>
              <div className={`p-4 rounded-xl text-center ${teamScores.blue > teamScores.red ? 'bg-team-blue/20 ring-2 ring-team-blue' : 'bg-team-blue/10'}`}>
                <p className="text-team-blue font-semibold mb-1">Time Azul</p>
                <p className="text-2xl font-bold">{teamScores.blue}</p>
                {teamScores.blue > teamScores.red && (
                  <span className="inline-block mt-2 px-2 py-1 bg-team-blue text-white text-xs rounded-full">
                    Vencedor!
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Pódio */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-warning" />
            Ranking
          </h2>

          {/* Top 3 em destaque */}
          <div className="flex justify-center items-end gap-4 mb-6">
            {/* 2º lugar */}
            {topThree[1] && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-400/20 flex items-center justify-center text-3xl mb-2 mx-auto">
                  {topThree[1].avatar_icon}
                </div>
                <p className="font-semibold truncate max-w-20">{topThree[1].nickname}</p>
                <p className="text-sm text-text-muted">{topThree[1].score} pts</p>
                <div className="w-16 h-12 bg-gray-400/20 rounded-t-lg mt-2 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-400">2</span>
                </div>
              </div>
            )}

            {/* 1º lugar */}
            {topThree[0] && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center text-4xl mb-2 mx-auto ring-4 ring-warning">
                  {topThree[0].avatar_icon}
                </div>
                <p className="font-semibold truncate max-w-24">{topThree[0].nickname}</p>
                <p className="text-sm text-warning">{topThree[0].score} pts</p>
                <div className="w-20 h-20 bg-warning/20 rounded-t-lg mt-2 flex items-center justify-center">
                  <span className="text-2xl font-bold text-warning">1</span>
                </div>
              </div>
            )}

            {/* 3º lugar */}
            {topThree[2] && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-amber-700/20 flex items-center justify-center text-2xl mb-2 mx-auto">
                  {topThree[2].avatar_icon}
                </div>
                <p className="font-semibold truncate max-w-16">{topThree[2].nickname}</p>
                <p className="text-sm text-text-muted">{topThree[2].score} pts</p>
                <div className="w-14 h-8 bg-amber-700/20 rounded-t-lg mt-2 flex items-center justify-center">
                  <span className="text-lg font-bold text-amber-700">3</span>
                </div>
              </div>
            )}
          </div>

        </Card>

        {/* Tabela de Ranking Completo */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            Classificação Completa
          </h2>

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-white/5 rounded-t-xl text-xs font-semibold text-text-muted">
            <div className="col-span-2 text-center">#</div>
            <div className="col-span-6">Jogador</div>
            <div className="col-span-4 text-right">Pontos</div>
          </div>

          {/* Linhas da tabela */}
          <div className="divide-y divide-white/5">
            {participants.map((p, index) => {
              const position = index + 1
              const isTopThree = position <= 3
              const isCurrentPlayer = p.id === currentParticipant?.id
              const positionColor = position === 1 ? 'text-warning' : position === 2 ? 'text-gray-400' : position === 3 ? 'text-amber-600' : 'text-text-muted'

              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2 items-center transition-colors ${
                    isCurrentPlayer ? 'bg-primary/10 ring-1 ring-primary rounded-lg' :
                    isTopThree ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className={`col-span-2 text-center font-bold ${positionColor}`}>
                    {position}º
                  </div>
                  <div className="col-span-6 flex items-center gap-2">
                    <span className="text-xl">{p.avatar_icon}</span>
                    <span className="font-medium truncate text-sm">{p.nickname}</span>
                    {isCurrentPlayer && (
                      <span className="text-xs text-primary">(você)</span>
                    )}
                    {isTopThree && (
                      <span className="text-xs">
                        {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
                      </span>
                    )}
                  </div>
                  <div className="col-span-4 text-right font-bold">
                    {p.score}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Botão de voltar */}
        <Button fullWidth size="lg" onClick={() => {
          clearPlayerSession()
          navigate('/')
        }}>
          <Home className="w-5 h-5" />
          Voltar ao Início
        </Button>
      </div>
    </div>
  )
}
