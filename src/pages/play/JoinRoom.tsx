import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button, Input, Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { avatars, getAvatarsByCategory, getAvatarById, type Avatar } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { getPlayerSession, savePlayerSession, clearPlayerSession, type PlayerSession } from '../../lib/session'
import type { Room } from '../../types'
import logoQuadrado from '../../assets/flasq-quadrado.png'

export default function JoinRoom() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(avatars[0].id)
  const [avatarCategory, setAvatarCategory] = useState<Avatar['category']>('female')
  const [team, setTeam] = useState<'red' | 'blue' | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [savedSession, setSavedSession] = useState<PlayerSession | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Verificar sessão salva
  useEffect(() => {
    const checkSavedSession = async () => {
      if (!code) return

      const session = getPlayerSession()

      // Se tem sessão para esta sala, verificar se ainda é válida
      if (session && session.roomCode.toUpperCase() === code.toUpperCase()) {
        // Verificar se o participante ainda existe
        const { data: participant } = await supabase
          .from('participants')
          .select('*')
          .eq('id', session.participantId)
          .single()

        if (participant) {
          setSavedSession(session)
        } else {
          clearPlayerSession()
        }
      }

      setCheckingSession(false)
    }

    checkSavedSession()
  }, [code])

  // Buscar informações da sala
  useEffect(() => {
    const fetchRoom = async () => {
      if (!code) return

      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single()

      if (error || !data) {
        setError('Sala não encontrada')
      } else if (data.status === 'finished') {
        setError('Esta sala foi encerrada')
      } else {
        setRoom(data as Room)
      }

      setLoading(false)
    }

    fetchRoom()
  }, [code])

  // Reconectar usando sessão salva
  const handleReconnect = () => {
    if (!savedSession || !room) return

    // Redirecionar baseado no status da sala
    if (room.status === 'active') {
      navigate(`/play/${code}/game`)
    } else {
      navigate(`/play/${code}/lobby`)
    }
  }

  // Entrar como novo jogador
  const handleNewSession = () => {
    clearPlayerSession()
    setSavedSession(null)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!room || !nickname.trim()) return

    setJoining(true)
    setError('')

    try {
      let currentUser = user
      const isHost = currentUser && currentUser.id === room.host_id

      // Se o usuário atual é o host da sala, precisamos criar uma nova sessão anônima
      // Isso permite testar localmente com múltiplas abas no mesmo navegador
      if (isHost || !currentUser) {
        // Primeiro, tentar criar sessão anônima ANTES de deslogar o host
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()

        if (anonError) {
          // Se o erro for sobre anonymous sign-ins desabilitado, mostrar mensagem amigável
          if (anonError.message.includes('Anonymous sign-ins are disabled')) {
            throw new Error('Login anônimo está desabilitado. Habilite "Anonymous Sign-ins" no Supabase Dashboard (Authentication > Providers).')
          }
          throw anonError
        }

        currentUser = anonData.user
      }

      if (!currentUser) {
        throw new Error('Erro ao autenticar')
      }

      // Verificar se já está na sala (com o user atual, que agora é diferente do host)
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id)
        .single()

      if (existingParticipant) {
        // Já está na sala, salvar sessão e redirecionar
        savePlayerSession({
          roomCode: code!,
          participantId: existingParticipant.id,
          nickname: existingParticipant.nickname,
          avatarIcon: existingParticipant.avatar_icon,
          joinedAt: Date.now()
        })
        navigate(`/play/${code}/lobby`)
        return
      }

      // Entrar na sala
      const { data: newParticipant, error: joinError } = await supabase
        .from('participants')
        .insert({
          room_id: room.id,
          user_id: currentUser.id,
          nickname: nickname.trim(),
          avatar_icon: avatar,
          team: room.settings.mode === 'teams' ? team : null,
        })
        .select()
        .single()

      if (joinError) throw joinError

      // Salvar sessão para reconexão
      savePlayerSession({
        roomCode: code!,
        participantId: newParticipant.id,
        nickname: nickname.trim(),
        avatarIcon: avatar,
        joinedAt: Date.now()
      })

      // Redirecionar para o lobby do player
      navigate(`/play/${code}/lobby`)
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na sala')
    } finally {
      setJoining(false)
    }
  }

  if (loading || checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // Mostrar opção de reconexão se houver sessão salva
  if (savedSession && room) {
    const savedAvatarData = getAvatarById(savedSession.avatarIcon)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden">
            {savedAvatarData ? (
              <img src={savedAvatarData.src} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-6xl">{savedSession.avatarIcon}</div>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">Bem-vindo de volta!</h1>
          <p className="text-text-muted mb-6">
            Você estava na sala como <strong>{savedSession.nickname}</strong>
          </p>

          <div className="space-y-3">
            <Button
              fullWidth
              size="lg"
              onClick={handleReconnect}
            >
              <RefreshCw className="w-5 h-5" />
              Reconectar
            </Button>

            <Button
              variant="ghost"
              fullWidth
              onClick={handleNewSession}
            >
              Entrar como novo jogador
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-4">{error}</h1>
          <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex flex-col items-center gap-3 mb-4">
            <img src={logoQuadrado} alt="FlasQ" className="w-12 h-12 rounded-lg" />
            <span className="text-2xl font-bold tracking-widest text-primary">{code}</span>
          </div>
          <p className="text-text-muted">Entre na sala para jogar</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-6">
          <Input
            label="Seu Nickname"
            placeholder="Digite seu nome"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            required
          />

          {/* Seleção de Avatar */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Escolha seu Avatar
            </label>
            {/* Categoria de avatares */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(['female', 'male', 'animals', 'hobbies'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAvatarCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    avatarCategory === cat
                      ? 'bg-secondary text-white'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {cat === 'female' && 'Feminino'}
                  {cat === 'male' && 'Masculino'}
                  {cat === 'animals' && 'Animais'}
                  {cat === 'hobbies' && 'Hobbies'}
                </button>
              ))}
            </div>
            {/* Grid de avatares */}
            <div className="grid grid-cols-5 gap-2">
              {getAvatarsByCategory(avatarCategory).map((avatarItem) => (
                <button
                  key={avatarItem.id}
                  type="button"
                  onClick={() => setAvatar(avatarItem.id)}
                  className={`aspect-square rounded-xl overflow-hidden transition-all ${
                    avatar === avatarItem.id
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={avatarItem.src} alt={avatarItem.id} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Time (se modo times) */}
          {room?.settings.mode === 'teams' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Escolha seu Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTeam('red')}
                  className={`py-4 rounded-xl font-semibold transition-colors ${
                    team === 'red'
                      ? 'bg-team-red text-white'
                      : 'bg-team-red/20 text-team-red hover:bg-team-red/30'
                  }`}
                >
                  Time Vermelho
                </button>
                <button
                  type="button"
                  onClick={() => setTeam('blue')}
                  className={`py-4 rounded-xl font-semibold transition-colors ${
                    team === 'blue'
                      ? 'bg-team-blue text-white'
                      : 'bg-team-blue/20 text-team-blue hover:bg-team-blue/30'
                  }`}
                >
                  Time Azul
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={joining}
            disabled={!nickname.trim() || (room?.settings.mode === 'teams' && !team)}
          >
            Entrar na Sala
          </Button>
        </form>
      </Card>
    </div>
  )
}
