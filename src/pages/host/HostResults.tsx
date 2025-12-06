import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trophy, Medal, Home, Loader2, RotateCcw, Users } from 'lucide-react'
import { Card, Button, Avatar } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { playVictory, initAudio } from '../../lib/sounds'
import confetti from 'canvas-confetti'
import type { Room, Participant } from '../../types'

export default function HostResults() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
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
      }

      setLoading(false)
    }

    fetchResults()
  }, [code])

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
          <Button onClick={() => navigate('/host')}>Voltar ao Painel</Button>
        </Card>
      </div>
    )
  }

  // Top 3
  const topThree = participants.slice(0, 3)

  // Calcular pontuação dos times (se modo times)
  const teamScores = room.settings.mode === 'teams'
    ? {
        red: participants.filter(p => p.team === 'red').reduce((sum, p) => sum + p.score, 0),
        blue: participants.filter(p => p.team === 'blue').reduce((sum, p) => sum + p.score, 0),
      }
    : null

  const winningTeam = teamScores
    ? teamScores.red > teamScores.blue ? 'red' : teamScores.blue > teamScores.red ? 'blue' : null
    : null

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Trophy className="w-20 h-20 text-warning mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-2">
            Fim de Jogo!
          </h1>
          <p className="text-text-muted text-lg">Sala {code}</p>
        </div>

        {/* Estatísticas gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center">
            <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-2xl font-bold">{participants.length}</p>
            <p className="text-sm text-text-muted">Jogadores</p>
          </Card>
          <Card className="text-center">
            <Trophy className="w-8 h-8 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">{room.question_ids?.length || 0}</p>
            <p className="text-sm text-text-muted">Perguntas</p>
          </Card>
          <Card className="text-center">
            <Medal className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {participants.reduce((sum, p) => sum + p.score, 0)}
            </p>
            <p className="text-sm text-text-muted">Pontos Totais</p>
          </Card>
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              {topThree[0] ? <Avatar avatarId={topThree[0].avatar_icon} size="lg" /> : <span className="text-3xl">🏆</span>}
            </div>
            <p className="text-lg font-bold text-sm leading-tight">{topThree[0]?.nickname || '-'}</p>
            <p className="text-sm text-text-muted">Campeão</p>
          </Card>
        </div>

        {/* Placar de times (se aplicável) */}
        {teamScores && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold mb-6 text-center">Resultado dos Times</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className={`p-6 rounded-xl text-center ${
                winningTeam === 'red'
                  ? 'bg-team-red/20 ring-4 ring-team-red'
                  : 'bg-team-red/10'
              }`}>
                <p className="text-team-red font-semibold text-lg mb-2">Time Vermelho</p>
                <p className="text-4xl font-bold mb-2">{teamScores.red}</p>
                <p className="text-text-muted">
                  {participants.filter(p => p.team === 'red').length} jogadores
                </p>
                {winningTeam === 'red' && (
                  <span className="inline-block mt-4 px-4 py-2 bg-team-red text-white rounded-full font-bold">
                    VENCEDOR!
                  </span>
                )}
              </div>
              <div className={`p-6 rounded-xl text-center ${
                winningTeam === 'blue'
                  ? 'bg-team-blue/20 ring-4 ring-team-blue'
                  : 'bg-team-blue/10'
              }`}>
                <p className="text-team-blue font-semibold text-lg mb-2">Time Azul</p>
                <p className="text-4xl font-bold mb-2">{teamScores.blue}</p>
                <p className="text-text-muted">
                  {participants.filter(p => p.team === 'blue').length} jogadores
                </p>
                {winningTeam === 'blue' && (
                  <span className="inline-block mt-4 px-4 py-2 bg-team-blue text-white rounded-full font-bold">
                    VENCEDOR!
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Pódio */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Medal className="w-6 h-6 text-warning" />
            Ranking Final
          </h2>

          {/* Top 3 em destaque */}
          {topThree.length > 0 && (
            <div className="flex justify-center items-end gap-6 mb-8">
              {/* 2º lugar */}
              {topThree[1] && (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-400/20 flex items-center justify-center mb-3 mx-auto">
                    <Avatar avatarId={topThree[1].avatar_icon} size="lg" />
                  </div>
                  <p className="font-semibold text-lg">{topThree[1].nickname}</p>
                  <p className="text-text-muted">{topThree[1].score} pts</p>
                  {topThree[1].team && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                      topThree[1].team === 'red' ? 'bg-team-red/20 text-team-red' : 'bg-team-blue/20 text-team-blue'
                    }`}>
                      {topThree[1].team === 'red' ? 'Vermelho' : 'Azul'}
                    </span>
                  )}
                  <div className="w-20 h-16 bg-gray-400/20 rounded-t-lg mt-3 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-400">2</span>
                  </div>
                </div>
              )}

              {/* 1º lugar */}
              {topThree[0] && (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-warning/20 flex items-center justify-center mb-3 mx-auto ring-4 ring-warning">
                    <Avatar avatarId={topThree[0].avatar_icon} size="xl" />
                  </div>
                  <p className="font-semibold text-xl">{topThree[0].nickname}</p>
                  <p className="text-warning font-bold">{topThree[0].score} pts</p>
                  {topThree[0].team && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                      topThree[0].team === 'red' ? 'bg-team-red/20 text-team-red' : 'bg-team-blue/20 text-team-blue'
                    }`}>
                      {topThree[0].team === 'red' ? 'Vermelho' : 'Azul'}
                    </span>
                  )}
                  <div className="w-24 h-24 bg-warning/20 rounded-t-lg mt-3 flex items-center justify-center">
                    <span className="text-3xl font-bold text-warning">1</span>
                  </div>
                </div>
              )}

              {/* 3º lugar */}
              {topThree[2] && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-700/20 flex items-center justify-center mb-3 mx-auto">
                    <Avatar avatarId={topThree[2].avatar_icon} size="md" />
                  </div>
                  <p className="font-semibold">{topThree[2].nickname}</p>
                  <p className="text-text-muted">{topThree[2].score} pts</p>
                  {topThree[2].team && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                      topThree[2].team === 'red' ? 'bg-team-red/20 text-team-red' : 'bg-team-blue/20 text-team-blue'
                    }`}>
                      {topThree[2].team === 'red' ? 'Vermelho' : 'Azul'}
                    </span>
                  )}
                  <div className="w-16 h-12 bg-amber-700/20 rounded-t-lg mt-3 flex items-center justify-center">
                    <span className="text-xl font-bold text-amber-700">3</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </Card>

        {/* Tabela de Ranking Completo */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-secondary" />
            Classificação Completa
          </h2>

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 rounded-t-xl text-sm font-semibold text-text-muted">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6">Jogador</div>
            {room.settings.mode === 'teams' && (
              <div className="col-span-2 text-center">Time</div>
            )}
            <div className={`${room.settings.mode === 'teams' ? 'col-span-3' : 'col-span-5'} text-right`}>Pontos</div>
          </div>

          {/* Linhas da tabela */}
          <div className="divide-y divide-white/5">
            {participants.map((p, index) => {
              const position = index + 1
              const isTopThree = position <= 3
              const positionColor = position === 1 ? 'text-warning' : position === 2 ? 'text-gray-400' : position === 3 ? 'text-amber-600' : 'text-text-muted'

              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-white/5 ${
                    isTopThree ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className={`col-span-1 text-center font-bold ${positionColor}`}>
                    {position}º
                  </div>
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <Avatar avatarId={p.avatar_icon} size="sm" />
                    <span className="font-medium truncate flex-1 min-w-0">{p.nickname}</span>
                    {isTopThree && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        position === 1 ? 'bg-warning/20 text-warning' :
                        position === 2 ? 'bg-gray-400/20 text-gray-400' :
                        'bg-amber-600/20 text-amber-600'
                      }`}>
                        {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
                      </span>
                    )}
                  </div>
                  {room.settings.mode === 'teams' && (
                    <div className="col-span-2 text-center">
                      {p.team && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          p.team === 'red' ? 'bg-team-red/20 text-team-red' : 'bg-team-blue/20 text-team-blue'
                        }`}>
                          {p.team === 'red' ? 'Vermelho' : 'Azul'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={`${room.settings.mode === 'teams' ? 'col-span-3' : 'col-span-5'} text-right font-bold text-lg`}>
                    {p.score}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Botões de ação */}
        <div className="flex flex-col md:flex-row gap-4">
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={() => navigate('/host/create')}
          >
            <RotateCcw className="w-5 h-5" />
            Nova Partida
          </Button>
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/host')}
          >
            <Home className="w-5 h-5" />
            Voltar ao Painel
          </Button>
        </div>
      </div>
    </div>
  )
}
