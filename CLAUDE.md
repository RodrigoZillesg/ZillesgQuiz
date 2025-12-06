# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Quiz Battle Real-time - Sistema web de quiz competitivo em tempo real com multiplayer instantâneo.

## Stack Tecnológica

- **Frontend:** React.js + Vite + TypeScript
- **Estilização:** Tailwind CSS
- **Ícones:** Lucide-React
- **Roteamento:** React Router DOM
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)

## Arquitetura

### Autenticação
- **Host (Criador):** Login via Email/Password (Supabase Auth)
- **Players:** Anonymous Auth (signInAnonymously) com nickname e avatar

### Realtime
- Supabase Channels para sincronização de estado
- Subscrições nas tabelas `rooms` (status, current_question) e `participants`

### Modelo de Dados Principal
- `rooms` - Salas de jogo (código 6 dígitos, status, configurações)
- `participants` - Jogadores (nickname, score, team)
- `questions` - Perguntas (texto, opções JSONB, resposta correta, dificuldade)
- `answers` - Log de respostas (para auditoria e cálculo de score)

### Edge Functions
- `generate-quiz` - Geração de perguntas via OpenAI/Gemini

## Design System

Estilo "Modern Flat Vibrant" com Dark Mode:
- Background: `#0F172A` (Deep Ink Blue)
- Primária: `#FF6B35` (Vibrant Tangerine)
- Secundária: `#00F5D4` (Electric Cyan)
- Sucesso: `#22C55E` | Erro: `#EF4444`
- Fontes: Poppins (títulos), Inter (UI)
- Bordas: `rounded-xl` ou `rounded-2xl`

## Regras de Negócio

- Pontuação: Fácil 100pts | Médio 200pts | Difícil 300pts
- Timer com validação server-side (margem de 2s para latência)
- Sessão recuperável via LocalStorage para reconexão

## Configuração de Ambiente

Credenciais estão no arquivo `.env` (não commitado). Ver `.env.example` para estrutura:
- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase
- `OPENAI_API_KEY` - Chave da API OpenAI (para Edge Functions)

## Idioma

Toda comunicação deve ser em Português.
