import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { Card, Button } from './ui'

interface ProtectedRouteProps {
  children: ReactNode
  requireHost?: boolean
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireHost = false, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isHost, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireHost && !isHost) {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
          <p className="text-text-muted mb-6">
            Esta área é exclusiva para administradores do sistema.
          </p>
          <Button onClick={() => window.history.back()}>Voltar</Button>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
