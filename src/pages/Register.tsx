import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft } from 'lucide-react'
import { Button, Input, Card } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        setError('Este email já está cadastrado')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <div className="text-center">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold font-heading mb-2">Conta criada!</h1>
              <p className="text-text-secondary mb-6">
                Verifique seu email para confirmar sua conta.
              </p>
              <Button onClick={() => navigate('/login')} fullWidth>
                Ir para Login
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
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
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold font-heading">Criar Conta</h1>
          </div>

          <p className="text-text-secondary text-center mb-6">
            Crie uma conta para ser Host e criar salas de quiz
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

            <Input
              type="password"
              label="Confirmar Senha"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button type="submit" fullWidth loading={loading}>
              Criar Conta
            </Button>
          </form>

          <p className="text-text-muted text-center mt-6">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-secondary hover:underline">
              Fazer login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
