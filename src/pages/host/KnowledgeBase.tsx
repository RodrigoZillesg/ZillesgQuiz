import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Link as LinkIcon, FileText, Trash2, RefreshCw, Database, Loader2, AlertCircle, CheckCircle, Clock, Upload, Globe, List, X, PlayCircle, Pencil } from 'lucide-react'
import { Button, Card, Modal, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface KnowledgeSource {
  id: string
  name: string
  description: string | null
  type: 'url' | 'text' | 'file'
  source_url: string | null
  status: 'pending' | 'crawling' | 'embedding' | 'ready' | 'error'
  total_chunks: number
  error_message: string | null
  custom_prompt: string | null
  crawl_mode: 'single_page' | 'follow_links' | 'url_list' | 'file'
  additional_urls: string[]
  max_pages: number
  max_depth: number
  file_path: string | null
  file_name: string | null
  crawled_urls: string[]
  created_at: string
  updated_at: string
}

type SourceType = 'url' | 'text' | 'file'
type CrawlMode = 'single_page' | 'follow_links' | 'url_list'

export default function KnowledgeBase() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null)

  // Reprocess confirmation state
  const [showReprocessModal, setShowReprocessModal] = useState(false)
  const [reprocessingSource, setReprocessingSource] = useState<KnowledgeSource | null>(null)

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSource, setDeletingSource] = useState<KnowledgeSource | null>(null)

  // Loading state para ações individuais
  const [continuingSourceId, setContinuingSourceId] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editMaxPages, setEditMaxPages] = useState(10)
  const [editMaxDepth, setEditMaxDepth] = useState(2)
  const [editPrompt, setEditPrompt] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('url')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceContent, setSourceContent] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')

  // Crawl settings
  const [crawlMode, setCrawlMode] = useState<CrawlMode>('single_page')
  const [maxPages, setMaxPages] = useState(10)
  const [maxDepth, setMaxDepth] = useState(2)
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([])
  const [newUrl, setNewUrl] = useState('')

  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Carregar fontes
  useEffect(() => {
    fetchSources()
  }, [])

  // Polling para atualizar status de fontes em processamento
  useEffect(() => {
    const processingIds = sources.filter(s =>
      s.status === 'pending' || s.status === 'crawling' || s.status === 'embedding'
    ).map(s => s.id)

    if (processingIds.length === 0) return

    const interval = setInterval(fetchSources, 3000)
    return () => clearInterval(interval)
  }, [sources])

  const fetchSources = async () => {
    const { data, error } = await supabase
      .from('knowledge_sources')
      .select(`
        id,
        name,
        description,
        type,
        source_url,
        status,
        total_chunks,
        error_message,
        custom_prompt,
        crawl_mode,
        additional_urls,
        max_pages,
        max_depth,
        file_path,
        file_name,
        crawled_urls,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar fontes:', error)
    } else {
      setSources(data || [])
    }
    setLoading(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/csv']
      if (!allowedTypes.includes(file.type)) {
        setError('Tipo de arquivo não suportado. Use: PDF, TXT, DOC, DOCX, MD ou CSV')
        return
      }
      // Validar tamanho (50MB)
      if (file.size > 52428800) {
        setError('Arquivo muito grande. Máximo: 50MB')
        return
      }
      setSelectedFile(file)
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const addUrl = () => {
    if (newUrl.trim() && !additionalUrls.includes(newUrl.trim())) {
      try {
        new URL(newUrl.trim())
        setAdditionalUrls([...additionalUrls, newUrl.trim()])
        setNewUrl('')
      } catch {
        setError('URL inválida')
      }
    }
  }

  const removeUrl = (index: number) => {
    setAdditionalUrls(additionalUrls.filter((_, i) => i !== index))
  }

  const handleAddSource = async () => {
    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (sourceType === 'url' && !sourceUrl.trim()) {
      setError('URL é obrigatória')
      return
    }

    if (sourceType === 'text' && !sourceContent.trim()) {
      setError('Conteúdo é obrigatório')
      return
    }

    if (sourceType === 'file' && !selectedFile) {
      setError('Selecione um arquivo')
      return
    }

    if (sourceType === 'url' && crawlMode === 'url_list' && additionalUrls.length === 0) {
      setError('Adicione pelo menos uma URL à lista')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      let filePath: string | null = null
      let fileName: string | null = null
      let fileType: string | null = null

      // Upload do arquivo se necessário
      if (sourceType === 'file' && selectedFile) {
        setUploadProgress(10)
        const fileExt = selectedFile.name.split('.').pop()
        const uniqueName = `${user?.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('knowledge-documents')
          .upload(uniqueName, selectedFile)

        if (uploadError) throw uploadError

        filePath = uniqueName
        fileName = selectedFile.name
        fileType = selectedFile.type
        setUploadProgress(50)
      }

      // Criar fonte no banco
      const { data: source, error: createError } = await supabase
        .from('knowledge_sources')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type: sourceType,
          source_url: sourceType === 'url' ? sourceUrl.trim() : null,
          source_content: sourceType === 'text' ? sourceContent.trim() : null,
          custom_prompt: customPrompt.trim() || null,
          crawl_mode: sourceType === 'url' ? crawlMode : (sourceType === 'file' ? 'file' : 'single_page'),
          additional_urls: crawlMode === 'url_list' ? [sourceUrl.trim(), ...additionalUrls] : [],
          max_pages: maxPages,
          max_depth: maxDepth,
          file_path: filePath,
          file_name: fileName,
          file_type: fileType,
          status: 'pending',
          created_by: user?.id
        })
        .select()
        .single()

      if (createError) throw createError

      setUploadProgress(70)

      // Chamar Edge Function para processar
      const { error: processError } = await supabase.functions.invoke('process-knowledge', {
        body: { sourceId: source.id }
      })

      if (processError) {
        console.error('Erro ao processar:', processError)
        await supabase
          .from('knowledge_sources')
          .update({ status: 'error', error_message: processError.message })
          .eq('id', source.id)
      }

      setUploadProgress(100)

      // Atualizar lista
      fetchSources()
      resetForm()
      setShowAddModal(false)

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar fonte'
      setError(errorMessage)
    } finally {
      setProcessing(false)
      setUploadProgress(0)
    }
  }

  // Abre o modal de confirmação de reprocessamento
  const openReprocessModal = (source: KnowledgeSource) => {
    setReprocessingSource(source)
    setShowReprocessModal(true)
  }

  // Executa o reprocessamento após confirmação
  const handleReprocess = async () => {
    if (!reprocessingSource) return

    setShowReprocessModal(false)

    await supabase
      .from('knowledge_sources')
      .update({ status: 'pending', error_message: null, crawled_urls: [] })
      .eq('id', reprocessingSource.id)

    await supabase.functions.invoke('process-knowledge', {
      body: { sourceId: reprocessingSource.id }
    })

    setReprocessingSource(null)
    fetchSources()
  }

  // Continua o crawling de onde parou (modo incremental)
  const handleContinue = async (sourceId: string) => {
    setContinuingSourceId(sourceId)

    // Atualiza estado local imediatamente para feedback visual
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, status: 'pending' as const, error_message: null } : s
    ))

    try {
      await supabase
        .from('knowledge_sources')
        .update({ status: 'pending', error_message: null })
        .eq('id', sourceId)

      await supabase.functions.invoke('process-knowledge', {
        body: { sourceId, continueMode: true }
      })
    } finally {
      setContinuingSourceId(null)
      fetchSources()
    }
  }

  // Abre o modal de edição com os dados da fonte
  const openEditModal = (source: KnowledgeSource) => {
    setEditingSource(source)
    setEditName(source.name)
    setEditDescription(source.description || '')
    setEditUrl(source.source_url || '')
    setEditMaxPages(source.max_pages)
    setEditMaxDepth(source.max_depth)
    setEditPrompt(source.custom_prompt || '')
    setError(null)
    setShowEditModal(true)
  }

  // Salva as alterações da fonte
  const handleSaveEdit = async () => {
    if (!editingSource) return

    if (!editName.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (editingSource.type === 'url' && !editUrl.trim()) {
      setError('URL é obrigatória')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const updates: Record<string, unknown> = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        custom_prompt: editPrompt.trim() || null,
        max_pages: editMaxPages,
        max_depth: editMaxDepth,
        updated_at: new Date().toISOString()
      }

      // Se a URL mudou, atualiza também
      if (editingSource.type === 'url' && editUrl.trim() !== editingSource.source_url) {
        updates.source_url = editUrl.trim()
      }

      const { error: updateError } = await supabase
        .from('knowledge_sources')
        .update(updates)
        .eq('id', editingSource.id)

      if (updateError) throw updateError

      fetchSources()
      setShowEditModal(false)
      setEditingSource(null)

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar alterações'
      setError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  // Abre o modal de confirmação de exclusão
  const openDeleteModal = (source: KnowledgeSource) => {
    setDeletingSource(source)
    setShowDeleteModal(true)
  }

  // Executa a exclusão após confirmação
  const handleDelete = async () => {
    if (!deletingSource) return

    setShowDeleteModal(false)

    // Deletar arquivo do storage se existir
    if (deletingSource.file_path) {
      await supabase.storage
        .from('knowledge-documents')
        .remove([deletingSource.file_path])
    }

    await supabase
      .from('knowledge_sources')
      .delete()
      .eq('id', deletingSource.id)

    setDeletingSource(null)
    fetchSources()
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setSourceType('url')
    setSourceUrl('')
    setSourceContent('')
    setCustomPrompt('')
    setCrawlMode('single_page')
    setMaxPages(10)
    setMaxDepth(2)
    setAdditionalUrls([])
    setNewUrl('')
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getSourceIcon = (source: KnowledgeSource) => {
    if (source.type === 'file') {
      return <Upload className="w-6 h-6 text-primary" />
    }
    if (source.type === 'url') {
      if (source.crawl_mode === 'follow_links') {
        return <Globe className="w-6 h-6 text-primary" />
      }
      if (source.crawl_mode === 'url_list') {
        return <List className="w-6 h-6 text-primary" />
      }
      return <LinkIcon className="w-6 h-6 text-primary" />
    }
    return <FileText className="w-6 h-6 text-primary" />
  }

  const getSourceSubtitle = (source: KnowledgeSource) => {
    if (source.type === 'file' && source.file_name) {
      return source.file_name
    }
    if (source.type === 'url') {
      if (source.crawl_mode === 'follow_links') {
        const crawledCount = source.crawled_urls?.length || 0
        return `${source.source_url} (${crawledCount}/${source.max_pages} páginas)`
      }
      if (source.crawl_mode === 'url_list') {
        return `${source.additional_urls?.length || 0} URLs`
      }
      return source.source_url
    }
    return 'Texto direto'
  }

  const getStatusBadge = (status: KnowledgeSource['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs font-semibold rounded-full">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        )
      case 'crawling':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            Extraindo...
          </span>
        )
      case 'embedding':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            Indexando...
          </span>
        )
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 text-success text-xs font-semibold rounded-full">
            <CheckCircle className="w-3 h-3" />
            Pronto
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-error/20 text-error text-xs font-semibold rounded-full">
            <AlertCircle className="w-3 h-3" />
            Erro
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <Link to="/host">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold font-heading">Base de Conhecimento</h1>
            <p className="text-text-muted text-sm md:text-base">
              Importe conteúdo para gerar perguntas baseadas em fontes específicas
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Fonte</span>
            <span className="sm:hidden">Adicionar</span>
          </Button>
        </div>

        {/* Lista de fontes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sources.length === 0 ? (
          <Card className="text-center py-12">
            <Database className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma fonte cadastrada</h3>
            <p className="text-text-muted mb-6">
              Adicione URLs, textos ou arquivos para criar sua base de conhecimento
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Adicionar Primeira Fonte
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <Card key={source.id} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                  {getSourceIcon(source)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold truncate">{source.name}</h3>
                    {getStatusBadge(source.status)}
                  </div>

                  {source.description && (
                    <p className="text-text-muted text-sm mb-1">{source.description}</p>
                  )}

                  <p className="text-text-muted text-xs truncate">
                    {getSourceSubtitle(source)}
                  </p>

                  {source.status === 'ready' && (
                    <p className="text-text-muted text-xs mt-1">
                      {source.total_chunks} chunks indexados
                    </p>
                  )}

                  {source.status === 'error' && source.error_message && (
                    <p className="text-error text-xs mt-1">{source.error_message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Botão Editar - sempre disponível */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(source)}
                    title="Editar configurações"
                    className="text-primary hover:bg-primary/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {/* Botão Continuar - apenas para crawl de links que não completou */}
                  {source.status === 'ready' &&
                   source.crawl_mode === 'follow_links' &&
                   (source.crawled_urls?.length || 0) < source.max_pages && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleContinue(source.id)}
                      title="Continuar crawling"
                      className="text-secondary hover:bg-secondary/10"
                      disabled={continuingSourceId === source.id}
                    >
                      {continuingSourceId === source.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                  {(source.status === 'error' || source.status === 'ready') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReprocessModal(source)}
                      title="Reprocessar do zero"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteModal(source)}
                    className="text-error hover:bg-error/10"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Adicionar Fonte */}
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false)
            resetForm()
          }}
          title="Adicionar Fonte de Conhecimento"
          size="xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <Input
              label="Nome da Fonte"
              placeholder="Ex: Documentação do Produto"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Descrição (opcional)"
              placeholder="Uma breve descrição do conteúdo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Tipo de fonte */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Fonte</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    sourceType === 'url'
                      ? 'border-primary bg-primary/10'
                      : 'border-surface-light hover:border-primary/50'
                  }`}
                >
                  <LinkIcon className={`w-5 h-5 ${sourceType === 'url' ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`text-xs ${sourceType === 'url' ? 'text-primary font-medium' : 'text-text-muted'}`}>
                    URL
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    sourceType === 'file'
                      ? 'border-primary bg-primary/10'
                      : 'border-surface-light hover:border-primary/50'
                  }`}
                >
                  <Upload className={`w-5 h-5 ${sourceType === 'file' ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`text-xs ${sourceType === 'file' ? 'text-primary font-medium' : 'text-text-muted'}`}>
                    Arquivo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('text')}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    sourceType === 'text'
                      ? 'border-primary bg-primary/10'
                      : 'border-surface-light hover:border-primary/50'
                  }`}
                >
                  <FileText className={`w-5 h-5 ${sourceType === 'text' ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`text-xs ${sourceType === 'text' ? 'text-primary font-medium' : 'text-text-muted'}`}>
                    Texto
                  </span>
                </button>
              </div>
            </div>

            {/* Campos condicionais por tipo */}
            {sourceType === 'url' && (
              <>
                <Input
                  label="URL Principal"
                  type="url"
                  placeholder="https://exemplo.com/documentacao"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />

                {/* Modo de coleta */}
                <div>
                  <label className="block text-sm font-medium mb-2">Modo de Coleta</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-light hover:border-primary/50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="crawlMode"
                        checked={crawlMode === 'single_page'}
                        onChange={() => setCrawlMode('single_page')}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">Página única</div>
                        <div className="text-xs text-text-muted">Extrai conteúdo apenas da URL informada</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-light hover:border-primary/50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="crawlMode"
                        checked={crawlMode === 'follow_links'}
                        onChange={() => setCrawlMode('follow_links')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">Seguir links do domínio</div>
                        <div className="text-xs text-text-muted mb-2">Navega pelos links internos do mesmo domínio</div>
                        {crawlMode === 'follow_links' && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-xs text-text-muted">Máx. páginas</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={maxPages}
                                onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-text-muted">Profundidade</label>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={maxDepth}
                                onChange={(e) => setMaxDepth(parseInt(e.target.value) || 2)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-light hover:border-primary/50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="crawlMode"
                        checked={crawlMode === 'url_list'}
                        onChange={() => setCrawlMode('url_list')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">Lista de URLs</div>
                        <div className="text-xs text-text-muted">Define URLs específicas para extração</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Lista de URLs adicionais */}
                {crawlMode === 'url_list' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">URLs Adicionais</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="url"
                        placeholder="https://exemplo.com/outra-pagina"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                      <Button type="button" size="sm" onClick={addUrl}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {additionalUrls.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {additionalUrls.map((url, index) => (
                          <div key={index} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                            <span className="flex-1 truncate">{url}</span>
                            <button
                              type="button"
                              onClick={() => removeUrl(index)}
                              className="text-text-muted hover:text-error"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {sourceType === 'file' && (
              <div>
                <label className="block text-sm font-medium mb-2">Arquivo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,.md,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-surface-light hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-all"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">{selectedFile.name}</div>
                        <div className="text-xs text-text-muted">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-text-muted mx-auto mb-2" />
                      <div className="text-text-muted">
                        Clique para selecionar um arquivo
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        PDF, TXT, DOC, DOCX, MD, CSV (máx. 50MB)
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {sourceType === 'text' && (
              <div>
                <label className="block text-sm font-medium mb-2">Conteúdo</label>
                <textarea
                  placeholder="Cole aqui o texto que será usado como base de conhecimento..."
                  value={sourceContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSourceContent(e.target.value)}
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}

            {/* Prompt Customizado */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Instruções para Geração de Perguntas
              </label>
              <textarea
                placeholder="Ex: Gere perguntas sobre os procedimentos de enfermagem descritos no documento. Foque no conteúdo técnico e ignore informações sobre navegação ou download do arquivo."
                value={customPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomPrompt(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-text-muted mt-1">
                Descreva sobre o que as perguntas devem ser geradas. Isso ajuda a IA a focar no conteúdo relevante.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-surface-light rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddSource}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Editar Fonte */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingSource(null)
            setError(null)
          }}
          title="Editar Fonte de Conhecimento"
          size="lg"
        >
          <div className="space-y-4">
            <Input
              label="Nome da Fonte"
              placeholder="Ex: Documentação do Produto"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <Input
              label="Descrição (opcional)"
              placeholder="Uma breve descrição do conteúdo"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            {/* URL - apenas para fontes do tipo URL */}
            {editingSource?.type === 'url' && (
              <Input
                label="URL Principal"
                type="url"
                placeholder="https://exemplo.com/documentacao"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            )}

            {/* Configurações de crawling - apenas para follow_links */}
            {editingSource?.crawl_mode === 'follow_links' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Máx. Páginas</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={editMaxPages}
                    onChange={(e) => setEditMaxPages(parseInt(e.target.value) || 10)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Atual: {editingSource?.crawled_urls?.length || 0} páginas processadas
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Profundidade</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editMaxDepth}
                    onChange={(e) => setEditMaxDepth(parseInt(e.target.value) || 2)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Níveis de links a seguir
                  </p>
                </div>
              </div>
            )}

            {/* Prompt Customizado */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Instruções para Geração de Perguntas
              </label>
              <textarea
                placeholder="Ex: Gere perguntas sobre os procedimentos descritos. Foque no conteúdo técnico."
                value={editPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditPrompt(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-text-muted mt-1">
                Descreva sobre o que as perguntas devem ser geradas.
              </p>
            </div>

            {/* Info da fonte */}
            {editingSource && (
              <div className="p-3 bg-white/5 rounded-lg text-sm text-text-muted">
                <p><strong>Tipo:</strong> {editingSource.type === 'url' ? 'URL' : editingSource.type === 'file' ? 'Arquivo' : 'Texto'}</p>
                <p><strong>Status:</strong> {editingSource.status}</p>
                <p><strong>Chunks:</strong> {editingSource.total_chunks}</p>
                {editingSource.type === 'file' && editingSource.file_name && (
                  <p><strong>Arquivo:</strong> {editingSource.file_name}</p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSource(null)
                  setError(null)
                }}
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Confirmar Reprocessamento */}
        <Modal
          isOpen={showReprocessModal}
          onClose={() => {
            setShowReprocessModal(false)
            setReprocessingSource(null)
          }}
          title="Reprocessar Fonte"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-warning shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-warning mb-1">Atenção!</h4>
                  <p className="text-sm text-text-secondary">
                    Esta ação irá <strong>apagar todos os dados</strong> desta fonte e iniciar o processamento do zero.
                  </p>
                </div>
              </div>
            </div>

            {reprocessingSource && (
              <div className="space-y-2 text-sm">
                <p><strong>Fonte:</strong> {reprocessingSource.name}</p>
                <p className="text-text-muted">O que será perdido:</p>
                <ul className="list-disc list-inside text-text-muted space-y-1 ml-2">
                  <li><strong>{reprocessingSource.total_chunks}</strong> chunks indexados serão deletados</li>
                  {reprocessingSource.crawl_mode === 'follow_links' && (
                    <li><strong>{reprocessingSource.crawled_urls?.length || 0}</strong> URLs já processadas serão descartadas</li>
                  )}
                  <li>O crawling começará novamente da URL inicial</li>
                </ul>
              </div>
            )}

            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-text-muted">
                💡 <strong>Dica:</strong> Se você apenas quer buscar mais páginas sem perder o progresso atual,
                use o botão <span className="text-secondary">▶ Continuar</span> ao invés de Reprocessar.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowReprocessModal(false)
                  setReprocessingSource(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-warning hover:bg-warning/80"
                onClick={handleReprocess}
              >
                <RefreshCw className="w-4 h-4" />
                Sim, Reprocessar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Confirmar Exclusão */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingSource(null)
          }}
          title="Excluir Fonte"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-error/10 border border-error/30 rounded-xl">
              <div className="flex items-start gap-3">
                <Trash2 className="w-6 h-6 text-error shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-error mb-1">Ação Irreversível!</h4>
                  <p className="text-sm text-text-secondary">
                    Esta fonte será <strong>permanentemente excluída</strong> e não poderá ser recuperada.
                  </p>
                </div>
              </div>
            </div>

            {deletingSource && (
              <div className="space-y-2 text-sm">
                <p><strong>Fonte:</strong> {deletingSource.name}</p>
                {deletingSource.description && (
                  <p className="text-text-muted">{deletingSource.description}</p>
                )}
                <p className="text-text-muted mt-3">O que será excluído:</p>
                <ul className="list-disc list-inside text-text-muted space-y-1 ml-2">
                  <li><strong>{deletingSource.total_chunks}</strong> chunks indexados</li>
                  {deletingSource.crawl_mode === 'follow_links' && (
                    <li>Histórico de <strong>{deletingSource.crawled_urls?.length || 0}</strong> URLs processadas</li>
                  )}
                  {deletingSource.type === 'file' && deletingSource.file_name && (
                    <li>Arquivo: <strong>{deletingSource.file_name}</strong></li>
                  )}
                  <li>Todas as configurações e metadados</li>
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingSource(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-error hover:bg-error/80"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
