-- Quiz Battle - Database Schema
-- Executar no Supabase SQL Editor

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- Tabela de Salas
create table if not exists rooms (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  host_id uuid references auth.users not null,
  status text check (status in ('waiting', 'active', 'finished')) default 'waiting',
  current_question_index int default 0,
  settings jsonb default '{
    "time_limit": 20,
    "mode": "solo",
    "difficulty": "mixed",
    "sudden_death": false,
    "score_reveal": "end"
  }'::jsonb,
  question_ids uuid[] default '{}',
  created_at timestamp with time zone default now()
);

-- Tabela de Participantes
create table if not exists participants (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references auth.users,
  nickname text not null,
  score int default 0,
  team text check (team in ('red', 'blue') or team is null),
  avatar_icon text default '😀',
  last_active timestamp with time zone default now()
);

-- Tabela de Perguntas
create table if not exists questions (
  id uuid default uuid_generate_v4() primary key,
  question_text text not null,
  options jsonb not null,
  correct_option_id text not null,
  category text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')) default 'medium',
  source_info text,
  created_by uuid references auth.users,
  created_at timestamp with time zone default now()
);

-- Tabela de Respostas
create table if not exists answers (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  question_id uuid references questions(id),
  selected_option_id text,
  is_correct boolean default false,
  responded_at timestamp with time zone default now()
);

-- Índices para performance
create index if not exists idx_rooms_code on rooms(code);
create index if not exists idx_rooms_host on rooms(host_id);
create index if not exists idx_participants_room on participants(room_id);
create index if not exists idx_participants_user on participants(user_id);
create index if not exists idx_answers_room on answers(room_id);
create index if not exists idx_answers_participant on answers(participant_id);
create index if not exists idx_questions_difficulty on questions(difficulty);
create index if not exists idx_questions_category on questions(category);

-- Habilitar Realtime para as tabelas necessárias
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table answers;
