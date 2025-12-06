# DOCUMENTO DE ESCOPO: MVP - Quiz Battle Real-time

## 1. Visão Geral
Um sistema web de quiz competitivo em tempo real, focado em multiplayer instantâneo com baixa latência. O MVP valida a estabilidade da conexão (via Supabase Realtime), a mecânica de jogo gamificada e a geração de conteúdo via IA.

## 2. O que ESTÁ no MVP (In-Scope)

### A. Acesso e Identidade
* **Host (Criador):** Login obrigatório via E-mail/Senha (Supabase Auth).
* **Player (Jogador):** Acesso anônimo/visitante. O usuário insere apenas um "Nickname" e escolhe um Avatar (seleção simples de emojis ou ícones flat pré-definidos).
* **Resiliência:** Se o usuário fechar o navegador, o sistema recupera a sessão via LocalStorage/Supabase Auth e reconecta na sala ativa.

### B. Lobby (Sala de Espera)
* **Criação:** Host define nome da sala e configurações básicas.
* **Entrada:** Link direto (`app.com/play/CODIGO`) ou Leitura de QRCode (Modal no Mobile, Fixo no Desktop).
* **Listagem:** Jogadores aparecem na tela do Host em tempo real assim que entram na sala.

### C. Configurações de Partida (Host)
* **Nível:** Fácil, Médio, Difícil ou Misto.
* **Tempo:** 10s, 20s, 30s.
* **Modo:** Solo ou Time (Players escolhem o time Red/Blue ao entrar).
* **Morte Súbita:** Ativar/Desativar (Rodada de desempate se houver empate no 1º lugar).
* **Score Reveal:** Opção de mostrar pontos a cada pergunta ou só no final.

### D. Gameplay (Core Loop)
* **Sincronia:** Host controla o avanço (Start Game, Next Question). Mudança de tela simultânea para todos.
* **Interface do Jogo:**
    * Pergunta (Texto com scroll se necessário).
    * 4 Alternativas (Botões grandes e coloridos).
    * Feedback visual imediato ao clicar (estado "selecionado").
* **HUD:** Timer regressivo sincronizado e contador de "Respostas enviadas / Total de jogadores".
* **Pós-Pergunta:**
    * Indicação visual de Certo/Errado.
    * Ícone de "Fonte/Info" que abre modal com a justificativa da resposta.

### E. Admin & Conteúdo
* **Gerenciamento:** Host pode criar/editar perguntas manualmente.
* **Gerador IA:** Integração com OpenAI/Gemini via Supabase Edge Functions.
    * Input: Tema + Quantidade + Dificuldade.
    * Output: Inserção direta no banco de dados.

## 3. O que NÃO ESTÁ no MVP (Out-of-Scope)
* Mídia nas perguntas (Imagens/Vídeos/Áudio).
* Ranking Global persistente (histórico de longo prazo fora da sala).
* Monetização/Gateways de pagamento.
* Personalização avançada de avatar (upload de foto).
* Chat entre participantes.