import { useState } from 'react'
import { AlertTriangle, Send } from 'lucide-react'
import { Modal, Button } from './ui'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

interface ReportQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  questionId: string
  questionText: string
  roomCode?: string
  playerNickname?: string
}

export function ReportQuestionModal({
  isOpen,
  onClose,
  questionId,
  questionText,
  roomCode,
  playerNickname,
}: ReportQuestionModalProps) {
  const [reportText, setReportText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { success, error } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reportText.trim()) {
      error('Erro', 'Por favor, descreva o problema encontrado.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: submitError } = await supabase
        .from('question_reports')
        .insert({
          question_id: questionId,
          room_code: roomCode,
          player_nickname: playerNickname,
          report_text: reportText.trim(),
        })

      if (submitError) throw submitError

      success('Obrigado!', 'Seu feedback foi enviado e será analisado.')
      setReportText('')
      onClose()
    } catch (err) {
      console.error('Error submitting report:', err)
      error('Erro ao enviar', 'Não foi possível enviar o feedback. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reportar Problema" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Question preview */}
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <p className="text-sm text-text-muted mb-1">Pergunta:</p>
          <p className="text-text-primary">{questionText}</p>
        </div>

        {/* Report text */}
        <div>
          <label htmlFor="report-text" className="block text-sm font-medium text-text-secondary mb-2">
            O que está errado com essa pergunta?
          </label>
          <textarea
            id="report-text"
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Ex: A resposta correta está marcada como errada, a pergunta tem informação incorreta, etc."
            className="w-full h-32 px-4 py-3 bg-surface border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            autoFocus
          />
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-xl text-warning text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Seu feedback nos ajuda a melhorar a qualidade das perguntas. Obrigado!</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={isSubmitting}
          >
            <Send className="w-4 h-4" />
            Enviar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
