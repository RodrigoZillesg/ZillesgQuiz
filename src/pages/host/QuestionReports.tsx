import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Flag, CheckCircle, XCircle, Eye, Trash2, Edit3, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { Button, Card, Modal } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'

interface QuestionReport {
  id: string
  question_id: string
  room_code: string | null
  player_nickname: string | null
  report_text: string
  status: 'pending' | 'reviewed' | 'fixed' | 'dismissed'
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  question: {
    id: string
    question_text: string
    options: { id: string; text: string }[]
    correct_option_id: string
    category: string
    difficulty: string
    source_info: string | null
  } | null
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'text-warning bg-warning/10', icon: Clock },
  reviewed: { label: 'Analisado', color: 'text-secondary bg-secondary/10', icon: Eye },
  fixed: { label: 'Corrigido', color: 'text-success bg-success/10', icon: CheckCircle },
  dismissed: { label: 'Descartado', color: 'text-text-muted bg-white/5', icon: XCircle },
}

export default function QuestionReports() {
  const [reports, setReports] = useState<QuestionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'fixed' | 'dismissed'>('pending')
  const [selectedReport, setSelectedReport] = useState<QuestionReport | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const { success, error } = useToast()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('question_reports')
        .select(`
          *,
          question:questions(id, question_text, options, correct_option_id, category, difficulty, source_info)
        `)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setReports(data as QuestionReport[])
    } catch (err) {
      console.error('Error fetching reports:', err)
      error('Erro', 'Não foi possível carregar os reports.')
    } finally {
      setLoading(false)
    }
  }

  const updateReportStatus = async (reportId: string, status: QuestionReport['status'], notes?: string) => {
    setUpdating(true)
    try {
      const { error: updateError } = await supabase
        .from('question_reports')
        .update({
          status,
          admin_notes: notes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId)

      if (updateError) throw updateError

      success('Atualizado', `Report marcado como "${statusConfig[status].label}"`)
      fetchReports()
      setShowDetailModal(false)
    } catch (err) {
      console.error('Error updating report:', err)
      error('Erro', 'Não foi possível atualizar o report.')
    } finally {
      setUpdating(false)
    }
  }

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta pergunta? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (deleteError) throw deleteError

      success('Deletado', 'A pergunta foi removida do banco.')
      fetchReports()
      setShowDetailModal(false)
    } catch (err) {
      console.error('Error deleting question:', err)
      error('Erro', 'Não foi possível deletar a pergunta.')
    }
  }

  const openDetail = (report: QuestionReport) => {
    setSelectedReport(report)
    setAdminNotes(report.admin_notes || '')
    setShowDetailModal(true)
  }

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter)

  const pendingCount = reports.filter(r => r.status === 'pending').length

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
          <Link to="/host/questions">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Flag className="w-6 h-6 text-warning" />
              Reports de Perguntas
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-1 bg-warning/20 text-warning text-sm rounded-full">
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-text-muted mt-1">
              Feedbacks dos jogadores sobre perguntas com possíveis erros
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'pending', 'reviewed', 'fixed', 'dismissed'] as const).map((status) => {
            const count = status === 'all' ? reports.length : reports.filter(r => r.status === status).length
            const label = status === 'all' ? 'Todos' : statusConfig[status].label

            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <Card className="text-center py-12">
            <Flag className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum report encontrado</h2>
            <p className="text-text-muted">
              {filter === 'pending'
                ? 'Não há reports pendentes de análise.'
                : 'Não há reports nesta categoria.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const StatusIcon = statusConfig[report.status].icon

              return (
                <Card
                  key={report.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => openDetail(report)}
                >
                  <div className="flex items-start gap-4">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[report.status].color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig[report.status].label}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Question text */}
                      <p className="font-medium text-text-primary line-clamp-2 mb-2">
                        {report.question?.question_text || 'Pergunta deletada'}
                      </p>

                      {/* Report text */}
                      <p className="text-sm text-text-muted line-clamp-2 mb-3">
                        <span className="text-warning font-medium">Problema: </span>
                        {report.report_text}
                      </p>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                        {report.player_nickname && (
                          <span>Por: {report.player_nickname}</span>
                        )}
                        {report.room_code && (
                          <span>Sala: {report.room_code}</span>
                        )}
                        <span>
                          {new Date(report.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-text-muted">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title="Detalhes do Report"
          size="lg"
        >
          {selectedReport && (
            <div className="space-y-6">
              {/* Question Card */}
              {selectedReport.question ? (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedReport.question.difficulty === 'easy' ? 'bg-success/20 text-success' :
                        selectedReport.question.difficulty === 'medium' ? 'bg-warning/20 text-warning' :
                        'bg-error/20 text-error'
                      }`}>
                        {selectedReport.question.difficulty === 'easy' ? 'Fácil' :
                         selectedReport.question.difficulty === 'medium' ? 'Médio' : 'Difícil'}
                      </span>
                      <span className="text-xs text-text-muted">{selectedReport.question.category}</span>
                    </div>
                  </div>

                  <p className="font-medium text-lg mb-4">{selectedReport.question.question_text}</p>

                  {/* Options */}
                  <div className="space-y-2 mb-4">
                    {(selectedReport.question.options as { id: string; text: string }[]).map((option) => (
                      <div
                        key={option.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          option.id === selectedReport.question!.correct_option_id
                            ? 'bg-success/10 border border-success/30'
                            : 'bg-white/5'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          option.id === selectedReport.question!.correct_option_id
                            ? 'bg-success text-white'
                            : 'bg-white/10'
                        }`}>
                          {option.id.toUpperCase()}
                        </span>
                        <span className="text-sm">{option.text}</span>
                        {option.id === selectedReport.question!.correct_option_id && (
                          <CheckCircle className="w-4 h-4 text-success ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Source info */}
                  {selectedReport.question.source_info && (
                    <p className="text-xs text-text-muted">
                      <span className="font-medium">Fonte:</span> {selectedReport.question.source_info}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-error/10 rounded-xl border border-error/20 text-error">
                  <AlertCircle className="w-5 h-5 inline mr-2" />
                  Esta pergunta foi deletada.
                </div>
              )}

              {/* Report Info */}
              <div className="p-4 bg-warning/5 rounded-xl border border-warning/20">
                <h3 className="font-medium text-warning mb-2 flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  Problema Reportado
                </h3>
                <p className="text-text-secondary">{selectedReport.report_text}</p>
                <div className="flex gap-4 mt-3 text-xs text-text-muted">
                  {selectedReport.player_nickname && (
                    <span>Por: {selectedReport.player_nickname}</span>
                  )}
                  {selectedReport.room_code && (
                    <span>Sala: {selectedReport.room_code}</span>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Notas do Administrador
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione notas sobre a análise..."
                  className="w-full h-24 px-4 py-3 bg-surface border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {selectedReport.question && (
                  <>
                    <Link
                      to={`/host/questions?edit=${selectedReport.question.id}`}
                      className="flex-1"
                    >
                      <Button variant="secondary" fullWidth>
                        <Edit3 className="w-4 h-4" />
                        Editar Pergunta
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => deleteQuestion(selectedReport.question!.id)}
                      className="text-error hover:bg-error/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      Deletar
                    </Button>
                  </>
                )}
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-text-muted mb-3">Marcar como:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => updateReportStatus(selectedReport.id, 'fixed', adminNotes)}
                    loading={updating}
                    className="border-success text-success hover:bg-success hover:text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Corrigido
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => updateReportStatus(selectedReport.id, 'dismissed', adminNotes)}
                    loading={updating}
                  >
                    <XCircle className="w-4 h-4" />
                    Descartar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
