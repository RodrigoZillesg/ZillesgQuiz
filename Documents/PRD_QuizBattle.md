# PRD - PRODUCT REQUIREMENTS DOCUMENT
**Projeto:** Quiz Battle Real-time
**Versão:** 1.0 (MVP Supabase Edition)
**Stack:** React, Tailwind, Supabase.

---

## 1. Design System & UI Specs
O estilo visual é **"Modern Flat Vibrant"**. A interface deve transmitir energia e competição, mas com leitura confortável (Dark Mode).

### Paleta de Cores (Electric Tangerine)
* **Background Principal:** `#0F172A` (Deep Ink Blue) - Usar em todas as telas de fundo.
* **Cor Primária (Ação/Destaque):** `#FF6B35` (Vibrant Tangerine) - Botões de ação, timer, highlights.
* **Cor Secundária (Detalhes):** `#00F5D4` (Electric Cyan) - Ícones, bordas de seleção, elementos secundários.
* **Texto:** `#FFFFFF` (Branco) para títulos e `#E2E8F0` (Slate-200) para corpo.
* **Estados de Feedback:**
    * Sucesso/Acerto: `#22C55E` (Green-500)
    * Erro/Perigo: `#EF4444` (Red-500)

### Tipografia e Formas
* **Fontes:** Sans-serif geométrica (Ex: 'Poppins' para títulos, 'Inter' para UI).
* **Bordas:** Arredondadas (`rounded-xl` ou `rounded-2xl`).
* **Estilo:** Flat (sem sombras realistas/drop-shadows profundos), alto contraste.

---

## 2. Arquitetura Técnica (Supabase Centric)

### 2.1. Frontend
* **Framework:** React.js + Vite + TypeScript.
* **Estilização:** Tailwind CSS (Configurado com a paleta acima).
* **Ícones:** Lucide-React.
* **Roteamento:** React Router DOM.

### 2.2. Backend & Infra (Supabase)
* **Database:** PostgreSQL.
* **Auth:** Supabase Auth.
    * Host: Email/Password.
    * Players: Anonymous Auth (signInAnonymously).
* **Realtime:** Supabase Channels.
    * O cliente deve "assinar" (subscribe) mudanças na tabela `rooms` (coluna `status` e `current_question`) e `participants`.
* **Lógica Server-side:** Supabase Edge Functions (Deno/Node) para chamadas de IA e validações sensíveis.

---

## 3. Modelo de Dados (Database Schema)

O sistema deve ser inicializado com a seguinte estrutura SQL no Supabase:

```sql
-- Tabela de Salas
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  host_id uuid references auth.users not null,
  status text check (status in ('waiting', 'active', 'finished')) default 'waiting',
  current_question_index int default 0,
  settings jsonb default '{"time_limit": 20, "mode": "solo", "reveal": "end"}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Tabela de Participantes
create table participants (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references auth.users, -- Pode ser anônimo
  nickname text not null,
  score int default 0,
  team text, -- 'Red', 'Blue', etc.
  avatar_icon text,
  last_active timestamp with time zone default now()
);

-- Tabela de Perguntas
create table questions (
  id uuid default uuid_generate_v4() primary key,
  question_text text not null,
  options jsonb not null, -- Ex: [{"id": "a", "text": "X"}, {"id": "b", "text": "Y"}]
  correct_option_id text not null,
  category text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  source_info text, -- Fonte da matéria
  created_by uuid references auth.users -- Null se for do sistema/IA
);

-- Tabela de Respostas (Log para auditoria/score)
create table answers (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id),
  participant_id uuid references participants(id),
  question_id uuid references questions(id),
  selected_option_id text,
  is_correct boolean,
  responded_at timestamp with time zone default now()
);
4. Requisitos Funcionais Detalhados
RF01 - Matchmaking e Lobby
O Host cria a sala e recebe um code de 6 dígitos.

O roomId deve ser salvo no localStorage do Host e do Player para permitir reconexão (F5).

Ao entrar, o Player cria um registro em participants via RPC ou Insert direto (com RLS configurado).

RF02 - O Jogo (Sincronização)
O fluxo é controlado pelo estado da tabela rooms.

State active: Front-end exibe a pergunta atual baseada no current_question_index.

Timer: O timer deve ser visual. Para evitar cheat, o servidor (ou Edge Function) deve rejeitar respostas enviadas após o tempo limite + margem de latência (ex: 2 segundos).

Feedback: Ao responder, o Player vê "Aguardando..." até que o tempo acabe ou todos respondam.

RF03 - Integração com IA (Edge Function)
Criar uma Edge Function generate-quiz:

Recebe: { topic, count, difficulty }.

Ação: Chama OpenAI/Gemini API pedindo JSON array.

Retorno: Insere as perguntas na tabela questions e retorna os IDs para o Host.

RF04 - Pontuação
Fácil: 100pts | Médio: 200pts | Difícil: 300pts.

A pontuação é calculada no momento do insert na tabela answers.

Trigger no banco ou lógica no backend atualiza o score na tabela participants.