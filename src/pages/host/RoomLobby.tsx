import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Play, Copy, Check, Settings, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '../../components/ui'
import { useRoom } from '../../hooks/useRoom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function RoomLobby() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const { room, participants, loading, error, updateRoomStatus } = useRoom({
    roomCode: code || '',
  })

  const roomUrl = `${window.location.origin}/play/${code}`

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(roomUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartGame = async () => {
    if (participants.length === 0) return

    // Verificar se há perguntas selecionadas
    if (!room?.question_ids || room.question_ids.length === 0) {
      toast.warning('Atenção', 'Nenhuma pergunta selecionada para esta sala')
      return
    }

    await updateRoomStatus('active')
    navigate(`/host/game/${code}`)
  }

  // Quantidade de perguntas selecionadas na sala
  const roomQuestionCount = room?.question_ids?.length || 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Sala não encontrada</h1>
          <p className="text-text-muted mb-6">{error}</p>
          <Button onClick={() => navigate('/host')}>Voltar ao Painel</Button>
        </Card>
      </div>
    )
  }

  // Verificar se é o host
  if (room.host_id !== user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Acesso negado</h1>
          <p className="text-text-muted mb-6">Você não é o host desta sala.</p>
          <Button onClick={() => navigate('/')}>Voltar</Button>
        </Card>
      </div>
    )
  }

  const teamRed = participants.filter((p) => p.team === 'red')
  const teamBlue = participants.filter((p) => p.team === 'blue')
  const soloPlayers = participants.filter((p) => !p.team)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-text-muted mb-1">Código da Sala</p>
            <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-widest text-primary">
              {code}
            </h1>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleCopyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/host/room/${code}/questions`)}
            >
              <ListChecks className="w-4 h-4" />
              Perguntas ({roomQuestionCount})
            </Button>
            <Button
              onClick={handleStartGame}
              disabled={participants.length === 0}
            >
              <Play className="w-4 h-4" />
              Iniciar Jogo
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* QR Code e Link */}
          <Card className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-secondary" />
              Compartilhar
            </h2>
            <div className="bg-white p-4 rounded-xl mb-4 flex justify-center">
              <QRCodeSVG value={roomUrl} size={180} />
            </div>
            <p className="text-center text-text-muted text-sm break-all">{roomUrl}</p>

            {/* Configurações da sala */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-sm font-semibold text-text-muted mb-3">Configurações</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Tempo</span>
                  <span>{room.settings.time_limit}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Modo</span>
                  <span>{room.settings.mode === 'solo' ? 'Solo' : 'Times'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Dificuldade</span>
                  <span className="capitalize">{room.settings.difficulty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Perguntas</span>
                  <span>{roomQuestionCount}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Participantes */}
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              Participantes ({participants.length})
            </h2>

            {participants.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-text-muted">Aguardando jogadores...</p>
                <p className="text-text-muted text-sm mt-2">
                  Compartilhe o código ou QR Code para os jogadores entrarem
                </p>
              </div>
            ) : room.settings.mode === 'teams' ? (
              // Modo Times
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
                        className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                      >
                        <span className="text-xl">{p.avatar_icon}</span>
                        <span>{p.nickname}</span>
                      </div>
                    ))}
                    {teamRed.length === 0 && (
                      <p className="text-text-muted text-sm">Nenhum jogador</p>
                    )}
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
                        className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                      >
                        <span className="text-xl">{p.avatar_icon}</span>
                        <span>{p.nickname}</span>
                      </div>
                    ))}
                    {teamBlue.length === 0 && (
                      <p className="text-text-muted text-sm">Nenhum jogador</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Modo Solo
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {soloPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl">{p.avatar_icon}</span>
                    <span className="truncate">{p.nickname}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
