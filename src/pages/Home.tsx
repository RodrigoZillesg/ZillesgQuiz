import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users, Trophy, Clock, Sparkles, ArrowRight, Flame, Settings, LogIn, Zap } from 'lucide-react'
import { Button, Input, Card } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import logoRetangular from '../assets/flasq-retangular.png'

export default function Home() {
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const { user, isHost, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleCreateRoom = () => {
    if (isHost) {
      navigate('/host/create')
    } else {
      navigate('/login')
    }
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (roomCode.trim()) {
      navigate(`/play/${roomCode.toUpperCase()}`)
    }
  }

  const features = [
    {
      icon: Users,
      title: 'Multiplayer',
      description: 'Jogue com amigos em tempo real',
      color: 'text-secondary'
    },
    {
      icon: Trophy,
      title: 'Ranking',
      description: 'Compita pelo topo do ranking',
      color: 'text-warning'
    },
    {
      icon: Clock,
      title: 'Tempo Real',
      description: 'Timer sincronizado para todos',
      color: 'text-primary'
    },
    {
      icon: Sparkles,
      title: 'IA',
      description: 'Perguntas geradas por IA',
      color: 'text-purple-400'
    }
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar - Admin/Host Access */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {isAdmin ? (
          <Link
            to="/host"
            className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Admin</span>
          </Link>
        ) : isHost ? (
          <Link
            to="/host"
            className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-text-secondary hover:text-text-primary transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Painel Host</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-text-secondary hover:text-text-primary transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="text-sm font-medium">Login Host</span>
          </Link>
        )}
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <div className="text-center relative z-10">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img
              src={logoRetangular}
              alt="FlasQ"
              className="h-20 md:h-24 w-auto"
            />
          </div>

          <p className="text-xl md:text-2xl text-text-secondary mb-4">
            Quiz competitivo em tempo real
          </p>

          <p className="text-text-muted mb-12 max-w-md mx-auto">
            Crie salas, convide amigos e descubra quem é o maior sabichão!
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" onClick={handleCreateRoom} className="group">
              <Zap className="w-5 h-5 group-hover:animate-pulse" />
              Criar Sala
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button size="lg" variant="outline" onClick={() => setShowJoinModal(true)}>
              <Users className="w-5 h-5" />
              Entrar em Sala
            </Button>
          </div>

          {user && isHost && (
            <div className="flex items-center justify-center gap-2 text-success">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm">Logado como Host</span>
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="px-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="text-center hover:scale-105 transition-transform duration-300 cursor-default"
              >
                <feature.icon className={`w-8 h-8 ${feature.color} mx-auto mb-3`} />
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-xs text-text-muted">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Streak Badge */}
      <div className="fixed bottom-4 right-4 hidden md:flex items-center gap-2 bg-surface/80 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
        <Flame className="w-5 h-5 text-warning" />
        <span className="text-sm text-text-muted">Streaks e Speed Bonus!</span>
      </div>

      {/* Modal de entrada */}
      {showJoinModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowJoinModal(false)}
        >
          <Card className="w-full max-w-md animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold font-heading">Entrar em uma Sala</h2>
              <p className="text-text-muted">Digite o código de 6 dígitos</p>
            </div>

            <form onSubmit={handleJoinRoom}>
              <Input
                placeholder="ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                className="text-center text-3xl tracking-[0.5em] font-mono"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" fullWidth disabled={roomCode.length < 6}>
                  Entrar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
