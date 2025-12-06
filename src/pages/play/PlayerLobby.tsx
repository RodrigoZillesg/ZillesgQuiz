import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Users } from 'lucide-react'
import { Card, Avatar } from '../../components/ui'
import { useRoom } from '../../hooks/useRoom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { playCountdownTick, playCountdownGo, initAudio } from '../../lib/sounds'
import type { Participant } from '../../types'

export default function PlayerLobby() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const audioInitializedRef = useRef(false)
  const lastPlayedCountdownRef = useRef<number | null>(null)

  const { room, participants, loading, error } = useRoom({
    roomCode: code || '',
    onRoomUpdate: () => {
      // Redirecionamento é feito pelo useEffect abaixo para coordenar com countdown
    },
  })

  // Buscar participante atual
  useEffect(() => {
    const fetchParticipant = async () => {
      if (!user || !room) return

      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setCurrentParticipant(data as Participant)
      }
    }

    fetchParticipant()
  }, [user, room])

  // Redirecionar automaticamente quando o jogo começar (mas só após countdown terminar)
  useEffect(() => {
    if (room?.status === 'active' && countdown === null) {
      navigate(`/play/${code}/game`)
    }
  }, [room?.status, code, navigate, countdown])

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

  // Escutar broadcast de countdown do host
  // Usar room?.id como dependência para evitar re-subscrição desnecessária
  const roomId = room?.id
  useEffect(() => {
    if (!roomId) return

    console.log('Inscrevendo no canal de countdown:', roomId)
    const channel = supabase.channel(`countdown-${roomId}`)

    channel.on('broadcast', { event: 'countdown' }, ({ payload }) => {
      const count = payload.count
      console.log('Recebido countdown:', count)

      // Prevenir valores duplicados do broadcast redundante
      if (lastPlayedCountdownRef.current === count) return
      lastPlayedCountdownRef.current = count

      setCountdown(count)

      // Tocar som de countdown
      if (count > 0) {
        playCountdownTick()
      } else if (count === 0) {
        playCountdownGo()
        // Quando chegar em 0, aguarda um pouco e reseta
        setTimeout(() => {
          setCountdown(null)
          lastPlayedCountdownRef.current = null
        }, 1000)
      }
    })

    // Usar callback para garantir inscrição completa
    channel.subscribe((status) => {
      console.log('Status do canal countdown:', status)
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

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
          <h1 className="text-2xl font-bold mb-4">Sala não encontrada</h1>
        </Card>
      </div>
    )
  }

  const teamRed = participants.filter((p) => p.team === 'red')
  const teamBlue = participants.filter((p) => p.team === 'blue')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
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

      {/* Container com largura máxima para simular mobile no desktop */}
      <div className="w-full max-w-md">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <p className="text-text-muted mb-2">Código da Sala</p>
          <h1 className="text-5xl font-bold font-heading tracking-widest text-primary mb-4">
            {code}
          </h1>

          {currentParticipant && (
            <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-4 py-2">
              <Avatar avatarId={currentParticipant.avatar_icon} size="sm" />
              <span className="font-semibold">{currentParticipant.nickname}</span>
              {currentParticipant.team && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    currentParticipant.team === 'red'
                      ? 'bg-team-red/20 text-team-red'
                      : 'bg-team-blue/20 text-team-blue'
                  }`}
                >
                  {currentParticipant.team === 'red' ? 'Vermelho' : 'Azul'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status de espera */}
        <Card className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-secondary" />
            <p className="text-lg">Aguardando o host iniciar o jogo...</p>
          </div>
          <div className="flex justify-center gap-6 text-sm text-text-muted">
            <span>{room.question_ids?.length || 0} perguntas</span>
            <span>{room.settings.time_limit}s por pergunta</span>
            <span className="capitalize">{room.settings.difficulty}</span>
          </div>
        </Card>

        {/* Lista de participantes */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            Jogadores ({participants.length})
          </h2>

          {room.settings.mode === 'teams' ? (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Time Vermelho */}
              <div className="bg-team-red/10 border border-team-red/20 rounded-xl p-4">
                <h3 className="text-team-red font-semibold mb-3">
                  Time Vermelho ({teamRed.length})
                </h3>
                <div className="space-y-2">
                  {teamRed.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                        p.id === currentParticipant?.id
                          ? 'bg-team-red/20 ring-1 ring-team-red'
                          : 'bg-white/5'
                      }`}
                    >
                      <Avatar avatarId={p.avatar_icon} size="sm" />
                      <span className="truncate">{p.nickname}</span>
                      {p.id === currentParticipant?.id && (
                        <span className="text-xs text-text-muted">(você)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Azul */}
              <div className="bg-team-blue/10 border border-team-blue/20 rounded-xl p-4">
                <h3 className="text-team-blue font-semibold mb-3">
                  Time Azul ({teamBlue.length})
                </h3>
                <div className="space-y-2">
                  {teamBlue.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                        p.id === currentParticipant?.id
                          ? 'bg-team-blue/20 ring-1 ring-team-blue'
                          : 'bg-white/5'
                      }`}
                    >
                      <Avatar avatarId={p.avatar_icon} size="sm" />
                      <span className="truncate">{p.nickname}</span>
                      {p.id === currentParticipant?.id && (
                        <span className="text-xs text-text-muted">(você)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    p.id === currentParticipant?.id
                      ? 'bg-primary/20 ring-1 ring-primary'
                      : 'bg-white/5'
                  }`}
                >
                  <Avatar avatarId={p.avatar_icon} size="sm" />
                  <span className="text-sm">{p.nickname}</span>
                  {p.id === currentParticipant?.id && (
                    <span className="text-xs text-text-muted">(você)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
