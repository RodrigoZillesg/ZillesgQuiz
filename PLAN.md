# Plano de Implementação - Quiz Battle Real-time

## Fase 1: Setup do Projeto

### 1.1 Inicialização do Frontend
- Criar projeto com `npm create vite@latest . -- --template react-ts`
- Instalar dependências:
  - `tailwindcss`, `postcss`, `autoprefixer`
  - `@supabase/supabase-js`
  - `react-router-dom`
  - `lucide-react`
  - `qrcode.react` (para QR codes)
- Configurar Tailwind com a paleta de cores do Design System
- Configurar estrutura de pastas:
  ```
  src/
    components/    # Componentes reutilizáveis
    pages/         # Páginas/rotas
    hooks/         # Custom hooks
    lib/           # Configuração Supabase, utils
    types/         # TypeScript types
    contexts/      # React Contexts (Auth, Game)
  ```

### 1.2 Configuração do Supabase
- Criar projeto no Supabase
- Criar arquivo `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Executar SQL do schema (tables: rooms, participants, questions, answers)
- Configurar Row Level Security (RLS) policies

## Fase 2: Sistema de Autenticação

### 2.1 Auth Context
- Criar `AuthContext` com estados: user, loading, isHost
- Implementar funções: signUp, signIn, signOut, signInAnonymously
- Hook `useAuth()` para consumir o contexto

### 2.2 Páginas de Auth
- `/login` - Formulário email/senha para Hosts
- `/register` - Cadastro de novos Hosts
- Lógica de redirecionamento baseada em estado de auth

## Fase 3: Sistema de Lobby

### 3.1 Criação de Sala (Host)
- Página `/host/create`
- Gerar código de 6 caracteres único
- Formulário de configurações: tempo, modo, dificuldade, morte súbita, score reveal
- Inserir sala na tabela `rooms`

### 3.2 Entrada na Sala (Player)
- Página `/play/:code`
- Formulário: nickname + seleção de avatar (emojis)
- Auth anônimo + inserção em `participants`
- Seleção de time (se modo = teams)

### 3.3 Tela de Espera
- Componente `Lobby`
- Subscription Realtime na tabela `participants` (filtro por room_id)
- Exibir QR Code com link da sala
- Lista de jogadores em tempo real
- Botão "Iniciar Jogo" (apenas Host)

## Fase 4: Core do Jogo

### 4.1 Game Context
- Criar `GameContext` com estados: room, participants, currentQuestion, answers, timeLeft
- Subscription Realtime na tabela `rooms` para mudanças de status e current_question_index
- Lógica de timer sincronizado

### 4.2 Seleção de Perguntas
- Antes de iniciar, Host seleciona perguntas do banco ou gera via IA
- Associar perguntas à sala (nova tabela `room_questions` ou campo JSONB)

### 4.3 Tela de Jogo (Player)
- Componente `QuestionCard` com pergunta e 4 alternativas
- Timer visual regressivo
- Estados visuais: default, selected, waiting, correct, incorrect
- Envio de resposta para tabela `answers`
- HUD: timer + respostas enviadas/total

### 4.4 Controle do Jogo (Host)
- Dashboard com visão geral
- Botões: "Próxima Pergunta", "Encerrar Jogo"
- Atualização do `current_question_index` na tabela `rooms`
- Contador de respostas recebidas

### 4.5 Feedback Pós-Pergunta
- Mostrar resposta correta com destaque visual
- Modal com `source_info` (justificativa)
- Atualização de scores se `score_reveal = "each"`

## Fase 5: Sistema de Pontuação

### 5.1 Cálculo de Score
- Trigger ou função no Supabase para calcular pontos
- Regra: Fácil 100pts | Médio 200pts | Difícil 300pts
- Atualizar `participants.score` ao inserir em `answers`

### 5.2 Tela de Resultados
- Página `/results/:roomId`
- Ranking final ordenado por score
- Modo times: soma de pontos por time
- Animações de celebração (CSS)

### 5.3 Morte Súbita (se ativada)
- Detectar empate no primeiro lugar
- Rodada extra com pergunta aleatória difícil
- Primeiro a acertar vence

## Fase 6: Admin e Geração de Conteúdo

### 6.1 Área Admin (Host)
- Página `/host/questions`
- CRUD de perguntas manuais
- Listagem com filtros (categoria, dificuldade)

### 6.2 Edge Function: generate-quiz
- Criar função no Supabase Edge Functions
- Input: `{ topic, count, difficulty }`
- Prompt para OpenAI/Gemini retornar JSON estruturado
- Inserir perguntas na tabela `questions`
- Retornar IDs das perguntas criadas

### 6.3 Interface de Geração IA
- Formulário: tema, quantidade, dificuldade
- Loading state durante geração
- Preview das perguntas geradas

## Fase 7: Persistência e Reconexão

### 7.1 LocalStorage
- Salvar `roomId` e `participantId` no localStorage
- Ao carregar página, verificar se existe sessão ativa
- Reconectar automaticamente se sala ainda estiver ativa

### 7.2 Heartbeat
- Atualizar `participants.last_active` periodicamente
- Cleanup de participantes inativos (opcional)

## Fase 8: Polish e UX

### 8.1 Componentes de UI
- Loading spinners consistentes
- Toasts para feedback de ações
- Transições suaves entre estados

### 8.2 Responsividade
- Mobile-first para players
- Desktop otimizado para hosts
- QR Code: modal no mobile, fixo no desktop

### 8.3 Tratamento de Erros
- Boundary de erro global
- Mensagens amigáveis para falhas de conexão
- Retry automático em subscriptions

---

## Ordem de Execução Recomendada

1. **Fase 1** - Setup completo
2. **Fase 2** - Auth funcionando
3. **Fase 3** - Lobby e entrada de players
4. **Fase 4.1-4.3** - Jogo básico funcionando
5. **Fase 5** - Pontuação
6. **Fase 4.4-4.5** - Controles do host e feedback
7. **Fase 6** - Admin e IA
8. **Fase 7** - Persistência
9. **Fase 8** - Polish

## Dependências Externas

- Conta Supabase (free tier suficiente para MVP)
- API Key OpenAI ou Gemini (para geração de perguntas)
