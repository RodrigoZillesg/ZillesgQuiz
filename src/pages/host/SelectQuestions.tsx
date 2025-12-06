import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Circle, Filter, Play, ArrowLeft, Loader2 } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { Question, Room } from '../../types'

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard'

export default function SelectQuestions() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Buscar sala e perguntas
  useEffect(() => {
    const fetchData = async () => {
      if (!code) return

      // Buscar sala
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (roomError || !roomData) {
        setError('Sala não encontrada')
        setLoading(false)
        return
      }

      setRoom(roomData as Room)

      // Se já tem perguntas selecionadas, marcar
      if (roomData.question_ids && roomData.question_ids.length > 0) {
        setSelectedIds(roomData.question_ids)
      }

      // Buscar todas as perguntas
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('difficulty', { ascending: true })
        .order('category', { ascending: true })

      if (questionsError) {
        setError('Erro ao buscar perguntas')
      } else {
        setQuestions(questionsData as Question[])
      }

      setLoading(false)
    }

    fetchData()
  }, [code])

  // Categorias únicas
  const categories = [...new Set(questions.map(q => q.category))].filter(Boolean)

  // Filtrar perguntas
  const filteredQuestions = questions.filter(q => {
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false
    if (categoryFilter !== 'all' && q.category !== categoryFilter) return false
    return true
  })

  // Toggle seleção
  const toggleQuestion = (questionId: string) => {
    setSelectedIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    )
  }

  // Selecionar/Deselecionar todos filtrados
  const toggleAll = () => {
    const filteredIds = filteredQuestions.map(q => q.id)
    const allSelected = filteredIds.every(id => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])])
    }
  }

  // Salvar e ir para o lobby
  const handleSave = async () => {
    if (!room || selectedIds.length === 0) return

    setSaving(true)

    const { error } = await supabase
      .from('rooms')
      .update({ question_ids: selectedIds })
      .eq('id', room.id)

    if (error) {
      setError('Erro ao salvar perguntas')
      setSaving(false)
      return
    }

    navigate(`/host/room/${code}`)
  }

  // Cor por dificuldade
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success/20 text-success'
      case 'medium': return 'bg-warning/20 text-warning'
      case 'hard': return 'bg-error/20 text-error'
      default: return 'bg-white/10 text-text-muted'
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Fácil'
      case 'medium': return 'Médio'
      case 'hard': return 'Difícil'
      default: return difficulty
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-4">{error}</h1>
          <Button onClick={() => navigate('/host')}>Voltar ao Dashboard</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(`/host/room/${code}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading">Selecionar Perguntas</h1>
              <p className="text-text-muted">Sala: {code}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{selectedIds.length}</p>
            <p className="text-sm text-text-muted">selecionadas</p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-secondary" />
            <span className="font-semibold">Filtros</span>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Dificuldade */}
            <div>
              <label className="block text-sm text-text-muted mb-2">Dificuldade</label>
              <div className="flex gap-2">
                {(['all', 'easy', 'medium', 'hard'] as const).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setDifficultyFilter(diff)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      difficultyFilter === diff
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {diff === 'all' ? 'Todas' : getDifficultyLabel(diff)}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm text-text-muted mb-2">Categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Selecionar todos */}
            <div className="flex items-end">
              <button
                onClick={toggleAll}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary/20 text-secondary hover:bg-secondary/30 transition-colors"
              >
                {filteredQuestions.every(q => selectedIds.includes(q.id))
                  ? 'Desmarcar filtrados'
                  : 'Selecionar filtrados'}
              </button>
            </div>
          </div>
        </Card>

        {/* Lista de Perguntas */}
        <div className="space-y-3 mb-6">
          {filteredQuestions.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-text-muted">Nenhuma pergunta encontrada com esses filtros</p>
            </Card>
          ) : (
            filteredQuestions.map((question) => {
              const isSelected = selectedIds.includes(question.id)
              return (
                <div
                  key={question.id}
                  onClick={() => toggleQuestion(question.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface border-transparent hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckCircle className="w-6 h-6 text-primary" />
                      ) : (
                        <Circle className="w-6 h-6 text-text-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-2">{question.question_text}</p>

                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                          {getDifficultyLabel(question.difficulty)}
                        </span>
                        {question.category && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-text-muted">
                            {question.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer com botão de salvar */}
        <div className="sticky bottom-4">
          <Card className="flex items-center justify-between">
            <div>
              <span className="text-text-muted">
                {selectedIds.length} pergunta{selectedIds.length !== 1 ? 's' : ''} selecionada{selectedIds.length !== 1 ? 's' : ''}
              </span>
            </div>

            <Button
              onClick={handleSave}
              disabled={selectedIds.length === 0}
              loading={saving}
            >
              <Play className="w-5 h-5 mr-2" />
              Salvar e Continuar
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
