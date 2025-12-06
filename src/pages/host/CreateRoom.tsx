import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Users, Zap, Trophy, Eye, HelpCircle } from 'lucide-react'
import { Button, Card, Input } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { generateRoomCode, avatarEmojis } from '../../lib/utils'
import type { RoomSettings } from '../../types'

interface CategoryInfo {
  category: string
  total: number
}

export default function CreateRoom() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Host também é jogador
  const [hostNickname, setHostNickname] = useState('')
  const [hostAvatar, setHostAvatar] = useState(avatarEmojis[0])

  // Seleção de categoria e perguntas
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [settings, setSettings] = useState<RoomSettings>({
    time_limit: 20,
    mode: 'solo',
    difficulty: 'mixed',
    sudden_death: false,
    score_reveal: 'end',
  })

  // Buscar categorias disponíveis
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true)
      const { data, error } = await supabase
        .from('questions')
        .select('category')

      if (!error && data) {
        const categoryMap = new Map<string, number>()
        data.forEach((q: { category: string }) => {
          const cat = q.category || 'Geral'
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
        })

        const cats: CategoryInfo[] = []
        categoryMap.forEach((total, category) => {
          cats.push({ category, total })
        })
        cats.sort((a, b) => a.category.localeCompare(b.category))
        setCategories(cats)
      }
      setLoadingCategories(false)
    }

    fetchCategories()
  }, [])

  // Total de perguntas disponíveis para a categoria selecionada
  const availableQuestions = selectedCategory === 'all'
    ? categories.reduce((sum, c) => sum + c.total, 0)
    : categories.find(c => c.category === selectedCategory)?.total || 0

  const handleCreate = async () => {
    if (!user || !hostNickname.trim()) return

    setLoading(true)
    setError('')

    try {
      // Buscar perguntas da categoria selecionada
      let query = supabase.from('questions').select('id')

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }

      const { data: questions, error: questionsError } = await query

      if (questionsError || !questions || questions.length === 0) {
        throw new Error('Nenhuma pergunta encontrada para esta categoria')
      }

      // Embaralhar e selecionar a quantidade desejada
      const shuffled = questions.sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length))
      const questionIds = selectedQuestions.map(q => q.id)

      // Gerar código único
      let code = generateRoomCode()
      let attempts = 0

      // Verificar se código já existe
      while (attempts < 5) {
        const { data: existing } = await supabase
          .from('rooms')
          .select('code')
          .eq('code', code)
          .single()

        if (!existing) break
        code = generateRoomCode()
        attempts++
      }

      // Criar sala com perguntas já selecionadas
      const { data: room, error: createError } = await supabase
        .from('rooms')
        .insert({
          code,
          host_id: user.id,
          settings,
          status: 'waiting',
          question_ids: questionIds,
        })
        .select()
        .single()

      if (createError) throw createError

      // Adicionar host como participante
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          nickname: hostNickname.trim(),
          avatar_icon: hostAvatar,
          team: null,
        })

      if (participantError) throw participantError

      // Redirecionar para o lobby
      navigate(`/host/room/${room.code}`)
    } catch (err: any) {
      setError(err.message || 'Erro ao criar sala')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/host"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <h1 className="text-3xl font-bold font-heading mb-8">Criar Nova Sala</h1>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Tempo por pergunta */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Tempo por Pergunta</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[10, 20, 30].map((time) => (
                <button
                  key={time}
                  onClick={() => setSettings({ ...settings, time_limit: time as 10 | 20 | 30 })}
                  className={`py-3 rounded-xl font-semibold transition-colors ${
                    settings.time_limit === time
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                >
                  {time}s
                </button>
              ))}
            </div>
          </Card>

          {/* Modo de jogo */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Modo de Jogo</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSettings({ ...settings, mode: 'solo' })}
                className={`py-4 rounded-xl font-semibold transition-colors ${
                  settings.mode === 'solo'
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                Solo
              </button>
              <button
                onClick={() => setSettings({ ...settings, mode: 'teams' })}
                className={`py-4 rounded-xl font-semibold transition-colors ${
                  settings.mode === 'teams'
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                Times
              </button>
            </div>
          </Card>

          {/* Dificuldade */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Dificuldade</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['easy', 'medium', 'hard', 'mixed'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSettings({ ...settings, difficulty: diff })}
                  className={`py-3 rounded-xl font-semibold transition-colors ${
                    settings.difficulty === diff
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                >
                  {diff === 'easy' && 'Fácil'}
                  {diff === 'medium' && 'Médio'}
                  {diff === 'hard' && 'Difícil'}
                  {diff === 'mixed' && 'Misto'}
                </button>
              ))}
            </div>
          </Card>

          {/* Opções extras */}
          <Card>
            <div className="space-y-4">
              {/* Morte Súbita */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="font-semibold">Morte Súbita</p>
                    <p className="text-sm text-text-muted">Desempate em caso de empate</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, sudden_death: !settings.sudden_death })}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.sudden_death ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white transition-transform ${
                      settings.sudden_death ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Revelar pontos */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="font-semibold">Mostrar Pontuação</p>
                    <p className="text-sm text-text-muted">
                      {settings.score_reveal === 'each' ? 'A cada pergunta' : 'Só no final'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      score_reveal: settings.score_reveal === 'each' ? 'end' : 'each',
                    })
                  }
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.score_reveal === 'each' ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white transition-transform ${
                      settings.score_reveal === 'each' ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Categoria das Perguntas */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Categoria das Perguntas</h2>
            </div>
            {loadingCategories ? (
              <div className="text-center py-4 text-text-muted">Carregando categorias...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`p-3 rounded-xl text-left transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium">Todas</div>
                  <div className="text-sm opacity-70">
                    {categories.reduce((sum, c) => sum + c.total, 0)} perguntas
                  </div>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`p-3 rounded-xl text-left transition-colors ${
                      selectedCategory === cat.category
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-medium truncate">{cat.category}</div>
                    <div className="text-sm opacity-70">{cat.total} perguntas</div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Quantidade de Perguntas */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Quantidade de Perguntas</h2>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  onClick={() => setQuestionCount(num)}
                  disabled={num > availableQuestions}
                  className={`py-3 rounded-xl font-semibold transition-colors ${
                    questionCount === num
                      ? 'bg-secondary text-white'
                      : num > availableQuestions
                      ? 'bg-white/5 text-text-muted cursor-not-allowed'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-sm text-text-muted mt-3">
              {availableQuestions} perguntas disponíveis na categoria selecionada
            </p>
          </Card>

          {/* Dados do Host como jogador */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-semibold">Seus Dados de Jogador</h2>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Como host, você também participa do jogo!
            </p>

            <Input
              label="Seu Nickname"
              placeholder="Digite seu nome no jogo"
              value={hostNickname}
              onChange={(e) => setHostNickname(e.target.value)}
              maxLength={20}
            />

            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Escolha seu Avatar
              </label>
              <div className="grid grid-cols-8 gap-2">
                {avatarEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setHostAvatar(emoji)}
                    className={`text-2xl p-2 rounded-xl transition-colors ${
                      hostAvatar === emoji
                        ? 'bg-primary/20 ring-2 ring-primary'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Button
            size="lg"
            fullWidth
            onClick={handleCreate}
            loading={loading}
            disabled={!hostNickname.trim() || availableQuestions === 0}
          >
            Criar Sala ({Math.min(questionCount, availableQuestions)} perguntas)
          </Button>
        </div>
      </div>
    </div>
  )
}
