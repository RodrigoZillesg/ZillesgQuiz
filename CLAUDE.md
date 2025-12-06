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

## Avatares

Sistema de avatares Low Poly 3D gerados via DALL-E 3:
- 40 avatares em 4 categorias: Feminino (f01-f10), Masculino (m01-m10), Animais (a01-a10), Hobbies (h01-h10)
- Arquivos em `public/avatars/*.png`
- Componente `Avatar` em `src/components/ui/Avatar.tsx` com fallback para emojis legados
- Utilitários em `src/lib/utils.ts`: `getAvatarById()`, `getAvatarsByCategory()`

## Regras de Negócio

- Pontuação: Fácil 100pts | Médio 200pts | Difícil 300pts
- Timer com validação server-side (margem de 2s para latência)
- Sessão recuperável via LocalStorage para reconexão

## Configuração de Ambiente

Credenciais estão no arquivo `.env` (não commitado). Ver `.env.example` para estrutura:
- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase
- `OPENAI_API_KEY` - Chave da API OpenAI (para Edge Functions e geração de avatares)

---

## Deploy

**IMPORTANTE:** Quando o usuário pedir "faça um deploy", "deploy", "publicar" ou similar, seguir EXATAMENTE o processo documentado em `DEPLOY.md`.

### Arquitetura de Produção

```
Internet → Traefik (Easypanel) → quiz_quiz (Docker container nginx:alpine) → /var/www/ZillesgQuiz/dist
```

O servidor usa:
- **Easypanel** com Docker Swarm
- **Traefik** como reverse proxy (SSL automático via Let's Encrypt)
- **Container nginx:alpine** servindo arquivos estáticos
- Configuração Traefik em `/etc/easypanel/traefik/config/quiz.yaml`

### Deploy Rápido (atualização de código)

```bash
# 1. Commit e push local
git push

# 2. Executar no servidor
ssh root@103.199.187.87 "cd /var/www/ZillesgQuiz && git pull && npm run build"
```

### Informações do Servidor

| Item | Valor |
|------|-------|
| **IP** | 103.199.187.87 |
| **SSH** | `ssh root@103.199.187.87` |
| **Domínio** | quiz.zillesg.tech |
| **URL Produção** | https://quiz.zillesg.tech |
| **Diretório** | /var/www/ZillesgQuiz |
| **Serviço Docker** | quiz_quiz |

### Pré-requisitos para Deploy

1. Código deve estar commitado e pushado para o GitHub
2. Build local deve funcionar sem erros (`npm run build`)

### Troubleshooting Rápido

Se o site mostrar 404 do Easypanel após deploy:
```bash
# Verificar se o serviço está rodando
ssh root@103.199.187.87 "docker service ls | grep quiz"

# Verificar se a config do Traefik existe
ssh root@103.199.187.87 "cat /etc/easypanel/traefik/config/quiz.yaml"
```

Se a config não existir, recriar conforme documentado em `DEPLOY.md` seção "Deploy Inicial", passo 8.

---

## Idioma

Toda comunicação deve ser em Português.
