import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, List, LogOut, Shield, Flag, UserCircle } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function HostDashboard() {
  const { user, signOut, isAdmin } = useAuth()
  const [pendingReports, setPendingReports] = useState(0)

  // Buscar contagem de reports pendentes
  useEffect(() => {
    if (!isAdmin) return

    const fetchPendingReports = async () => {
      const { count } = await supabase
        .from('question_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      setPendingReports(count || 0)
    }

    fetchPendingReports()
  }, [isAdmin])

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-heading">Painel do Host</h1>
          <div className="flex items-center gap-2">
            <Link to="/host/profile">
              <Button variant="ghost">
                <UserCircle className="w-4 h-4" />
                Meu Perfil
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <p className="text-text-secondary">
            Bem-vindo, {user?.email}
          </p>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full">
              <Shield className="w-3 h-3" />
              Admin
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link to="/host/create">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Criar Nova Sala</h2>
                  <p className="text-text-muted">Inicie um novo quiz</p>
                </div>
              </div>
            </Card>
          </Link>

          {isAdmin && (
            <Link to="/host/questions">
              <Card className="hover:border-secondary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                    <List className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Gerenciar Perguntas</h2>
                    <p className="text-text-muted">Banco de perguntas do sistema</p>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {isAdmin && (
            <Link to="/host/reports">
              <Card className="hover:border-warning/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center relative">
                    <Flag className="w-6 h-6 text-warning" />
                    {pendingReports > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {pendingReports > 9 ? '9+' : pendingReports}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Reports de Perguntas</h2>
                    <p className="text-text-muted">
                      {pendingReports > 0
                        ? `${pendingReports} pendente${pendingReports > 1 ? 's' : ''} de análise`
                        : 'Feedbacks dos jogadores'}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
