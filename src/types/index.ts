// Database types

export interface Room {
  id: string
  code: string
  host_id: string
  status: 'waiting' | 'active' | 'finished'
  current_question_index: number
  settings: RoomSettings
  question_ids: string[]
  question_started_at: string | null
  created_at: string
}

export interface RoomSettings {
  time_limit: 10 | 20 | 30
  mode: 'solo' | 'teams'
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  sudden_death: boolean
  score_reveal: 'each' | 'end'
}

export interface Participant {
  id: string
  room_id: string
  user_id: string | null
  nickname: string
  score: number
  streak: number
  team: 'red' | 'blue' | null
  avatar_icon: string
  last_active: string
}

export interface Question {
  id: string
  question_text: string
  options: QuestionOption[]
  correct_option_id: string
  category: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  source_info: string | null
  created_by: string | null
}

export interface QuestionOption {
  id: string
  text: string
}

export interface Answer {
  id: string
  room_id: string
  participant_id: string
  question_id: string
  selected_option_id: string | null
  is_correct: boolean
  response_time_ms: number | null
  points_earned: number
  responded_at: string
}

// UI types

export type GamePhase = 'lobby' | 'question' | 'feedback' | 'results'

export interface PlayerState {
  hasAnswered: boolean
  selectedOption: string | null
  isCorrect: boolean | null
}
