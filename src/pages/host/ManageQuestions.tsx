import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Edit2, Loader2, Sparkles,
  CheckCircle, Filter, Search, FolderPlus, X
} from 'lucide-react'
import { Card, Button, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import type { Question } from '../../types'

type Difficulty = 'easy' | 'medium' | 'hard'

interface Category {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  is_active: boolean
}

interface NewQuestion {
  question_text: string
  options: { id: string; text: string }[]
  correct_option_id: string
  category: string
  difficulty: Difficulty
  source_info: string
}

interface AIGenerationConfig {
  category: string
  difficulty: Difficulty | 'mixed'
  count: number
}

interface NewCategory {
  name: string
  description: string
  color: string
}

const emptyCategory: NewCategory = {
  name: '',
  description: '',
  color: '#6366f1'
}

export default function ManageQuestions() {
  const navigate = useNavigate()
  const toast = useToast()
  const [questions, setQuestions] = useState<Question[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState<NewCategory>(emptyCategory)
  const [savingCategory, setSavingCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lastImportIds, setLastImportIds] = useState<string[]>(() => {
    // Carregar do localStorage na inicialização
    const saved = localStorage.getItem('lastImportIds')
    return saved ? JSON.parse(saved) : []
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterLastImport, setFilterLastImport] = useState(false)
  const [activeTab, setActiveTab] = useState<'questions' | 'categories'>('questions')

  const getEmptyQuestion = () => ({
    question_text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' }
    ],
    correct_option_id: 'a',
    category: categories[0]?.name || 'Conhecimentos Gerais',
    difficulty: 'medium' as Difficulty,
    source_info: ''
  })

  const [newQuestion, setNewQuestion] = useState<NewQuestion>(getEmptyQuestion())
  const [aiConfig, setAIConfig] = useState<AIGenerationConfig>({
    category: 'Conhecimentos Gerais',
    difficulty: 'mixed',
    count: 5
  })

  // Fetch questions and categories
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/host/login')
      return
    }

    // Fetch categories first
    await fetchCategories()
    // Then fetch questions
    await fetchQuestions()
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (!error && data) {
      setCategories(data as Category[])
    }
  }

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setQuestions(data as Question[])
    }
  }

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDifficulty = filterDifficulty === 'all' || q.difficulty === filterDifficulty
    const matchesCategory = filterCategory === 'all' || q.category === filterCategory
    const matchesLastImport = !filterLastImport || lastImportIds.includes(q.id)
    return matchesSearch && matchesDifficulty && matchesCategory && matchesLastImport
  })

  // Save question
  const handleSave = async () => {
    if (!newQuestion.question_text.trim()) return
    if (newQuestion.options.some(o => !o.text.trim())) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const questionData = {
      question_text: newQuestion.question_text,
      options: newQuestion.options,
      correct_option_id: newQuestion.correct_option_id,
      category: newQuestion.category,
      difficulty: newQuestion.difficulty,
      source_info: newQuestion.source_info.trim() || null,
      created_by: user?.id
    }

    if (editingId) {
      await supabase
        .from('questions')
        .update(questionData)
        .eq('id', editingId)
    } else {
      await supabase
        .from('questions')
        .insert(questionData)
    }

    setShowForm(false)
    setEditingId(null)
    setNewQuestion(getEmptyQuestion())
    setSaving(false)
    fetchQuestions()
  }

  // Delete question
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return

    await supabase
      .from('questions')
      .delete()
      .eq('id', id)

    fetchQuestions()
  }

  // Delete filtered questions in bulk
  const handleBulkDelete = async () => {
    if (filteredQuestions.length === 0) return

    const filterDescription = []
    if (searchTerm) filterDescription.push(`busca: "${searchTerm}"`)
    if (filterDifficulty !== 'all') filterDescription.push(`dificuldade: ${getDifficultyLabel(filterDifficulty)}`)
    if (filterCategory !== 'all') filterDescription.push(`categoria: ${filterCategory}`)

    const filterText = filterDescription.length > 0
      ? `\n\nFiltros ativos: ${filterDescription.join(', ')}`
      : ''

    const confirmed = confirm(
      `Tem certeza que deseja excluir ${filteredQuestions.length} pergunta(s)?${filterText}\n\nEsta ação não pode ser desfeita!`
    )

    if (!confirmed) return

    setDeleting(true)

    const idsToDelete = filteredQuestions.map(q => q.id)

    const { error } = await supabase
      .from('questions')
      .delete()
      .in('id', idsToDelete)

    if (error) {
      toast.error('Erro ao excluir', error.message)
    } else {
      toast.success('Sucesso', `${idsToDelete.length} pergunta(s) excluída(s)`)
    }

    setDeleting(false)
    fetchQuestions()
  }

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!newCategory.name.trim()) return

    setSavingCategory(true)
    const { data: { user } } = await supabase.auth.getUser()

    const categoryData = {
      name: newCategory.name.trim(),
      description: newCategory.description.trim() || null,
      color: newCategory.color,
      created_by: user?.id
    }

    if (editingCategoryId) {
      await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', editingCategoryId)
    } else {
      await supabase
        .from('categories')
        .insert(categoryData)
    }

    setShowCategoryModal(false)
    setEditingCategoryId(null)
    setNewCategory(emptyCategory)
    setSavingCategory(false)
    fetchCategories()
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id)
    setNewCategory({
      name: category.name,
      description: category.description || '',
      color: category.color
    })
    setShowCategoryModal(true)
  }

  const handleDeleteCategory = async (id: string) => {
    // Check if category has questions
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('category', categories.find(c => c.id === id)?.name)

    if (count && count > 0) {
      if (!confirm(`Esta categoria possui ${count} perguntas. Deseja realmente excluí-la? As perguntas ficarão sem categoria.`)) {
        return
      }
    } else {
      if (!confirm('Tem certeza que deseja excluir esta categoria?')) return
    }

    await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    fetchCategories()
  }

  // Edit question
  const handleEdit = (question: Question) => {
    setEditingId(question.id)
    setNewQuestion({
      question_text: question.question_text,
      options: question.options as { id: string; text: string }[],
      correct_option_id: question.correct_option_id,
      category: question.category || 'Conhecimentos Gerais',
      difficulty: question.difficulty,
      source_info: question.source_info || ''
    })
    setShowForm(true)
  }

  // Normalize text for comparison (remove accents, lowercase, extra spaces)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
  }

  // Calculate similarity between two strings (Jaccard similarity on words)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = new Set(normalizeText(text1).split(' '))
    const words2 = new Set(normalizeText(text2).split(' '))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  // Check if a question is too similar to existing ones
  const isDuplicateQuestion = (newQuestion: string, existingQuestions: string[], threshold = 0.6): boolean => {
    return existingQuestions.some(existing => calculateSimilarity(newQuestion, existing) >= threshold)
  }

  // Generate questions with AI
  const handleGenerateAI = async () => {
    setGenerating(true)
    setShowAIModal(false)

    try {
      // Buscar perguntas existentes da mesma categoria para evitar duplicatas
      const existingQuestionsInCategory = questions
        .filter(q => q.category === aiConfig.category)
        .map(q => q.question_text)

      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          category: aiConfig.category,
          difficulty: aiConfig.difficulty,
          count: aiConfig.count,
          existingQuestions: existingQuestionsInCategory // Enviar para a IA evitar
        }
      })

      if (error) throw error

      if (data?.questions && data.questions.length > 0) {
        // Validação local de similaridade - filtrar duplicatas
        const allExistingQuestions = questions.map(q => q.question_text)
        const uniqueQuestions = data.questions.filter((q: any) =>
          !isDuplicateQuestion(q.question_text, allExistingQuestions)
        )

        const duplicatesFound = data.questions.length - uniqueQuestions.length

        if (uniqueQuestions.length === 0) {
          throw new Error('Todas as perguntas geradas já existem no banco. Tente novamente para obter perguntas diferentes.')
        }

        // Insert generated questions
        const { data: { user } } = await supabase.auth.getUser()

        const questionsToInsert = uniqueQuestions.map((q: any) => ({
          question_text: q.question_text,
          options: q.options,
          correct_option_id: q.correct_option_id,
          category: q.category || aiConfig.category,
          difficulty: q.difficulty || 'medium',
          source_info: q.source_info || 'Gerado por IA',
          created_by: user?.id
        }))

        const { data: insertedData, error: insertError } = await supabase
          .from('questions')
          .insert(questionsToInsert)
          .select('id')

        if (insertError) {
          console.error('Insert error:', insertError)
          throw new Error(`Erro ao salvar perguntas: ${insertError.message}`)
        }

        // Guardar IDs das perguntas importadas para mostrar tag "Nova"
        if (insertedData) {
          const newIds = insertedData.map((q: { id: string }) => q.id)
          setLastImportIds(newIds)
          localStorage.setItem('lastImportIds', JSON.stringify(newIds))
        }

        await fetchQuestions()

        // Mensagem informando sobre duplicatas filtradas
        if (duplicatesFound > 0) {
          toast.success('Perguntas geradas', `${questionsToInsert.length} novas (${duplicatesFound} duplicata(s) filtrada(s))`)
        } else {
          toast.success('Sucesso', `${questionsToInsert.length} perguntas geradas!`)
        }
      } else {
        throw new Error('Nenhuma pergunta foi gerada pela IA')
      }
    } catch (error: any) {
      toast.error('Erro ao gerar', error.message)
    } finally {
      setGenerating(false)
    }
  }

  const getDifficultyColor = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-success/20 text-success'
      case 'medium': return 'bg-warning/20 text-warning'
      case 'hard': return 'bg-error/20 text-error'
    }
  }

  const getDifficultyLabel = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'easy': return 'Fácil'
      case 'medium': return 'Médio'
      case 'hard': return 'Difícil'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/host')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold font-heading">
              Gerenciar Perguntas
            </h1>
            <p className="text-text-muted">{questions.length} perguntas no banco</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'questions'
                ? 'bg-primary text-white'
                : 'bg-white/5 hover:bg-white/10 text-text-secondary'
            }`}
          >
            Perguntas ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-primary text-white'
                : 'bg-white/5 hover:bg-white/10 text-text-secondary'
            }`}
          >
            Categorias ({categories.length})
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          {activeTab === 'questions' ? (
            <>
              <Button onClick={() => { setShowForm(true); setEditingId(null); setNewQuestion(getEmptyQuestion()); }}>
                <Plus className="w-5 h-5" />
                Nova Pergunta
              </Button>
              <Button variant="secondary" onClick={() => setShowAIModal(true)} disabled={generating}>
                {generating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {generating ? 'Gerando...' : 'Gerar com IA'}
              </Button>
              {filteredQuestions.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="text-error hover:text-error hover:bg-error/10"
                >
                  {deleting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  {deleting ? 'Excluindo...' : `Excluir ${filteredQuestions.length} pergunta(s)`}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => { setShowCategoryModal(true); setEditingCategoryId(null); setNewCategory(emptyCategory); }}>
              <FolderPlus className="w-5 h-5" />
              Nova Categoria
            </Button>
          )}
        </div>

        {/* AI Generation Modal */}
        {showAIModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md bg-surface border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Gerar Perguntas com IA</h2>
                  <p className="text-text-muted text-sm">Configure a geração automática</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-2">Categoria</label>
                  <select
                    value={aiConfig.category}
                    onChange={(e) => setAIConfig({ ...aiConfig, category: e.target.value })}
                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name} className="bg-surface text-text-primary">{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium mb-2">Dificuldade</label>
                  <select
                    value={aiConfig.difficulty}
                    onChange={(e) => setAIConfig({ ...aiConfig, difficulty: e.target.value as Difficulty | 'mixed' })}
                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
                  >
                    <option value="mixed" className="bg-surface text-text-primary">Misto (todas)</option>
                    <option value="easy" className="bg-surface text-text-primary">Fácil</option>
                    <option value="medium" className="bg-surface text-text-primary">Médio</option>
                    <option value="hard" className="bg-surface text-text-primary">Difícil</option>
                  </select>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantidade de perguntas: <span className="text-primary font-bold">{aiConfig.count}</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={aiConfig.count}
                      onChange={(e) => setAIConfig({ ...aiConfig, count: parseInt(e.target.value) })}
                      className="flex-1 accent-primary"
                    />
                    <div className="flex gap-2">
                      {[5, 10, 15, 20].map(num => (
                        <button
                          key={num}
                          onClick={() => setAIConfig({ ...aiConfig, count: num })}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            aiConfig.count === num
                              ? 'bg-primary text-white'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowAIModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateAI}
                  className="flex-1"
                >
                  <Sparkles className="w-5 h-5" />
                  Gerar {aiConfig.count} Perguntas
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md bg-surface border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}
                </h2>
                <button
                  onClick={() => { setShowCategoryModal(false); setEditingCategoryId(null); setNewCategory(emptyCategory); }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome da Categoria</label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Ex: Conhecimentos Gerais"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descrição (opcional)</label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-h-[80px] resize-none"
                    placeholder="Breve descrição da categoria..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Cor</label>
                  <div className="flex gap-3">
                    {['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#f97316'].map(color => (
                      <button
                        key={color}
                        onClick={() => setNewCategory({ ...newCategory, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          newCategory.color === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-background' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => { setShowCategoryModal(false); setEditingCategoryId(null); setNewCategory(emptyCategory); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveCategory}
                  disabled={savingCategory || !newCategory.name.trim()}
                  className="flex-1"
                >
                  {savingCategory ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Questions Tab Content */}
        {activeTab === 'questions' && (
          <>
            {/* Filters */}
            <Card className="mb-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                      placeholder="Buscar perguntas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-5 h-5 text-text-muted" />
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as Difficulty | 'all')}
                    className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="all">Todas dificuldades</option>
                    <option value="easy">Fácil</option>
                    <option value="medium">Médio</option>
                    <option value="hard">Difícil</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="all">Todas categorias</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  {lastImportIds.length > 0 && (
                    <button
                      onClick={() => setFilterLastImport(!filterLastImport)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        filterLastImport
                          ? 'bg-secondary text-background'
                          : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      Última importação ({lastImportIds.length})
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-text-muted mb-4">Nenhuma pergunta encontrada</p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-5 h-5" />
                    Criar primeira pergunta
                  </Button>
                </Card>
              ) : (
                filteredQuestions.map((question) => (
                  <Card key={question.id} className="hover:border-white/20 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {lastImportIds.includes(question.id) && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary animate-pulse">
                              Nova
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                            {getDifficultyLabel(question.difficulty)}
                          </span>
                          {question.category && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10">
                              {question.category}
                            </span>
                          )}
                        </div>
                        <p className="font-medium mb-3">{question.question_text}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(question.options as { id: string; text: string }[]).map((option, index) => (
                            <div
                              key={option.id}
                              className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                                option.id === question.correct_option_id
                                  ? 'bg-success/10 text-success'
                                  : 'bg-white/5 text-text-muted'
                              }`}
                            >
                              <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                              <span>{option.text}</span>
                              {option.id === question.correct_option_id && (
                                <CheckCircle className="w-4 h-4 ml-auto" />
                              )}
                            </div>
                          ))}
                        </div>
                        {question.source_info && (
                          <p className="text-xs text-text-muted mt-3 pt-3 border-t border-white/5">
                            <span className="font-medium">Fonte:</span> {question.source_info}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(question)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(question.id)}
                          className="text-error hover:text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {/* Categories Tab Content */}
        {activeTab === 'categories' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.length === 0 ? (
              <Card className="text-center py-12 col-span-full">
                <p className="text-text-muted mb-4">Nenhuma categoria cadastrada</p>
                <Button onClick={() => { setShowCategoryModal(true); setEditingCategoryId(null); setNewCategory(emptyCategory); }}>
                  <FolderPlus className="w-5 h-5" />
                  Criar primeira categoria
                </Button>
              </Card>
            ) : (
              categories.map((category) => {
                const questionCount = questions.filter(q => q.category === category.name).length
                return (
                  <Card key={category.id} className="hover:border-white/20 transition-colors">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-text-muted line-clamp-2">{category.description}</p>
                        )}
                        <p className="text-xs text-text-muted mt-2">
                          {questionCount} {questionCount === 1 ? 'pergunta' : 'perguntas'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-error hover:text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* Question Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-white/10">
              <h2 className="text-xl font-bold mb-6">
                {editingId ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h2>

              <div className="space-y-4">
                {/* Question text */}
                <div>
                  <label className="block text-sm font-medium mb-2">Pergunta</label>
                  <textarea
                    value={newQuestion.question_text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-h-[100px] resize-none"
                    placeholder="Digite a pergunta..."
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium mb-2">Opções</label>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-3">
                        <button
                          onClick={() => setNewQuestion({ ...newQuestion, correct_option_id: option.id })}
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                            newQuestion.correct_option_id === option.id
                              ? 'bg-success text-white'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {newQuestion.correct_option_id === option.id ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </button>
                        <Input
                          value={option.text}
                          onChange={(e) => {
                            const newOptions = [...newQuestion.options]
                            newOptions[index] = { ...option, text: e.target.value }
                            setNewQuestion({ ...newQuestion, options: newOptions })
                          }}
                          placeholder={`Opção ${String.fromCharCode(65 + index)}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    Clique na letra para marcar como resposta correta
                  </p>
                </div>

                {/* Category and Difficulty */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoria</label>
                    <select
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Dificuldade</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value as Difficulty })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                      <option value="easy">Fácil (100 pts)</option>
                      <option value="medium">Médio (200 pts)</option>
                      <option value="hard">Difícil (300 pts)</option>
                    </select>
                  </div>
                </div>

                {/* Source Info */}
                <div>
                  <label className="block text-sm font-medium mb-2">Fonte / Referência (opcional)</label>
                  <Input
                    value={newQuestion.source_info}
                    onChange={(e) => setNewQuestion({ ...newQuestion, source_info: e.target.value })}
                    placeholder="Ex: Provérbios 3:5-6, Wikipedia, Manual do usuário..."
                  />
                  <p className="text-xs text-text-muted mt-1">
                    De onde essa informação foi extraída (referência bíblica, link, livro, etc.)
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => { setShowForm(false); setEditingId(null); setNewQuestion(getEmptyQuestion()); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !newQuestion.question_text.trim() || newQuestion.options.some(o => !o.text.trim())}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
