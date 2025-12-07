import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Input, Card } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import logoQuadrado from '../assets/flasq-quadrado.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/host')
    } catch (err) {
      setError('Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <Card>
          <div className="flex flex-col items-center justify-center gap-3 mb-6">
            <img src={logoQuadrado} alt="FlasQ" className="w-16 h-16 rounded-xl" />
            <h1 className="text-2xl font-bold font-heading">Login do Host</h1>
          </div>

          <p className="text-text-secondary text-center mb-6">
            Entre com sua conta para criar e gerenciar salas de quiz
          </p>

          {error && (
            <div className="bg-error/10 border border-error/20 text-error rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" fullWidth loading={loading}>
              Entrar
            </Button>
          </form>

          <p className="text-text-muted text-center mt-6">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-secondary hover:underline">
              Criar conta
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
