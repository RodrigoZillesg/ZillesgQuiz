// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface QuestionRequest {
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  count?: number;
  existingQuestions?: string[]; // Lista de perguntas já existentes para evitar duplicatas
  sourceType?: 'ai_knowledge' | 'url' | 'knowledge_base';
  sourceUrl?: string;
  sourceId?: string; // ID da fonte de conhecimento (para RAG)
}

interface GeneratedQuestion {
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_info: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Validate difficulty value
function validateDifficulty(difficulty: string): 'easy' | 'medium' | 'hard' {
  const valid = ['easy', 'medium', 'hard'];
  if (valid.includes(difficulty)) {
    return difficulty as 'easy' | 'medium' | 'hard';
  }
  // Map Portuguese values or default to medium
  const map: Record<string, 'easy' | 'medium' | 'hard'> = {
    'fácil': 'easy',
    'facil': 'easy',
    'média': 'medium',
    'media': 'medium',
    'difícil': 'hard',
    'dificil': 'hard',
    'mixed': 'medium',
    'misto': 'medium'
  };
  return map[difficulty?.toLowerCase()] || 'medium';
}

// Shuffle options and update correct_option_id accordingly
function shuffleQuestionOptions(question: GeneratedQuestion): GeneratedQuestion {
  const optionIds = ['a', 'b', 'c', 'd'];
  const correctText = question.options.find(o => o.id === question.correct_option_id)?.text;

  if (!correctText) return question;

  // Shuffle the option texts
  const texts = question.options.map(o => o.text);
  const shuffledTexts = shuffleArray(texts);

  // Create new options with shuffled texts
  const newOptions = optionIds.map((id, index) => ({
    id,
    text: shuffledTexts[index]
  }));

  // Find the new position of the correct answer
  const newCorrectId = newOptions.find(o => o.text === correctText)?.id || 'a';

  return {
    ...question,
    options: newOptions,
    correct_option_id: newCorrectId
  };
}

// Check if category is Bible-related
function isBibleCategory(category: string): boolean {
  const normalized = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized === 'biblia' || normalized === 'bíblia' || normalized === 'bible';
}

// Fetch content from URL and extract text
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuizBot/1.0; +https://quiz.zillesg.tech)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Simple HTML to text extraction
    let text = html
      // Remove script and style elements
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace common block elements with newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
      .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Limit content to avoid token overflow (roughly 8000 tokens ~ 32000 chars)
    if (text.length > 30000) {
      text = text.substring(0, 30000) + '... [conteúdo truncado]';
    }

    return text;
  } catch (error) {
    throw new Error(`Erro ao acessar URL: ${error.message}`);
  }
}

// Generate prompt for URL-based content
function getUrlContentPrompt(count: number, difficultyPrompt: string, category: string, content: string, sourceUrl: string, existingQuestions: string[] = []): string {
  const existingSection = formatExistingQuestions(existingQuestions);

  return `Você é um gerador de perguntas para quiz educativo.

TAREFA: Gerar ${count} perguntas de quiz baseadas EXCLUSIVAMENTE no conteúdo fornecido abaixo.
Dificuldade: ${difficultyPrompt}.
Categoria: "${category}"

═══════════════════════════════════════════════════════════
📄 CONTEÚDO FONTE (extraído de ${sourceUrl}):
═══════════════════════════════════════════════════════════

${content}

═══════════════════════════════════════════════════════════
🎯 INSTRUÇÕES:
═══════════════════════════════════════════════════════════

1. Gere perguntas APENAS sobre informações presentes no texto acima
2. NÃO use seu conhecimento externo - apenas o que está no conteúdo
3. Cada pergunta deve testar compreensão do texto
4. As 4 opções devem ser plausíveis, mas apenas 1 correta
5. VARIE a posição da resposta correta (a, b, c ou d)
6. No source_info, cite qual parte do texto comprova a resposta

═══════════════════════════════════════════════════════════
🎯 CLASSIFICAÇÃO DE DIFICULDADE:
═══════════════════════════════════════════════════════════

📗 FÁCIL (easy): Informação explícita e destacada no texto
📙 MÉDIA (medium): Requer leitura atenta do texto
📕 DIFÍCIL (hard): Detalhes específicos ou inferências do texto

═══════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON):
═══════════════════════════════════════════════════════════

Retorne APENAS um array JSON válido, sem markdown:
[
  {
    "question_text": "Pergunta clara e direta?",
    "options": [
      {"id": "a", "text": "Opção A"},
      {"id": "b", "text": "Opção B"},
      {"id": "c", "text": "Opção C"},
      {"id": "d", "text": "Opção D"}
    ],
    "correct_option_id": "b",
    "category": "${category}",
    "difficulty": "medium",
    "source_info": "Fonte: ${sourceUrl} - [trecho relevante do texto]"
  }
]${existingSection}`;
}

// Format existing questions for the prompt
function formatExistingQuestions(existingQuestions: string[]): string {
  if (!existingQuestions || existingQuestions.length === 0) {
    return '';
  }

  // Limit to last 50 questions to avoid token overflow
  const recentQuestions = existingQuestions.slice(-50);

  return `

═══════════════════════════════════════════════════════════
⚠️ PERGUNTAS JÁ EXISTENTES (NÃO REPITA):
═══════════════════════════════════════════════════════════

${recentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

IMPORTANTE: Você DEVE gerar perguntas COMPLETAMENTE DIFERENTES das listadas acima.
Não reformule, não parafraseie, não use o mesmo tema/assunto dessas perguntas.
Seja CRIATIVO e explore outros aspectos do tema.
`;
}

// Gerar embedding para busca semântica via OpenAI
async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao gerar embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Buscar chunks relevantes da base de conhecimento
async function searchKnowledgeChunks(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  queryEmbedding: number[],
  matchCount: number = 10,
  matchThreshold: number = 0.5
): Promise<{ content: string; similarity: number }[]> {
  console.log('[RAG] Iniciando busca semântica...');
  console.log('[RAG] sourceId:', sourceId);
  console.log('[RAG] embedding dimensions:', queryEmbedding.length);
  console.log('[RAG] matchCount:', matchCount, 'matchThreshold:', matchThreshold);

  // Converter array de números para string no formato do PostgreSQL vector: [0.1,0.2,...]
  const embeddingString = `[${queryEmbedding.join(',')}]`;
  console.log('[RAG] Embedding string format (primeiros 100 chars):', embeddingString.substring(0, 100));

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embeddingString,
    p_source_id: sourceId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('[RAG] Erro ao buscar chunks:', JSON.stringify(error));
    throw new Error(`Erro na busca semântica: ${error.message}`);
  }

  console.log('[RAG] Chunks encontrados:', data?.length || 0);
  return data || [];
}

// Gerar prompt para Base de Conhecimento (RAG)
function getKnowledgeBasePrompt(
  count: number,
  difficultyPrompt: string,
  category: string,
  chunks: { content: string; similarity: number }[],
  sourceName: string,
  customPrompt: string | null,
  existingQuestions: string[] = []
): string {
  const existingSection = formatExistingQuestions(existingQuestions);

  // Montar contexto dos chunks
  const context = chunks
    .map((chunk, i) => `[Trecho ${i + 1}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  // Instruções customizadas do usuário
  const customInstructions = customPrompt
    ? `
═══════════════════════════════════════════════════════════
⭐ INSTRUÇÕES ESPECÍFICAS DO USUÁRIO:
═══════════════════════════════════════════════════════════

${customPrompt}

IMPORTANTE: Siga RIGOROSAMENTE as instruções acima ao gerar as perguntas.
`
    : '';

  return `Você é um gerador de perguntas para quiz educativo.

TAREFA: Gerar ${count} perguntas de quiz baseadas EXCLUSIVAMENTE no conteúdo fornecido abaixo.
Dificuldade: ${difficultyPrompt}.
Categoria: "${category}"
Fonte: "${sourceName}"
${customInstructions}
═══════════════════════════════════════════════════════════
📚 BASE DE CONHECIMENTO (trechos mais relevantes):
═══════════════════════════════════════════════════════════

${context}

═══════════════════════════════════════════════════════════
🎯 INSTRUÇÕES GERAIS:
═══════════════════════════════════════════════════════════

1. Gere perguntas sobre o CONTEÚDO REAL do material (conhecimento, conceitos, procedimentos)
2. NÃO gere perguntas sobre metadados (nome do arquivo, como baixar, navegação do site)
3. NÃO use seu conhecimento externo - apenas o que está no conteúdo
4. Cada pergunta deve testar compreensão do material fornecido
5. As 4 opções devem ser plausíveis, mas apenas 1 correta
6. VARIE a posição da resposta correta (a, b, c ou d)
7. No source_info, cite qual trecho e informação comprova a resposta

═══════════════════════════════════════════════════════════
⚠️ O QUE EVITAR:
═══════════════════════════════════════════════════════════

❌ Perguntas sobre o nome do arquivo ou documento
❌ Perguntas sobre como baixar ou acessar o conteúdo
❌ Perguntas sobre navegação do site ou interface
❌ Perguntas sobre número de páginas ou estrutura do documento
❌ Perguntas genéricas que não testam o conhecimento real

═══════════════════════════════════════════════════════════
🎯 CLASSIFICAÇÃO DE DIFICULDADE:
═══════════════════════════════════════════════════════════

📗 FÁCIL (easy): Informação explícita e destacada no texto
📙 MÉDIA (medium): Requer leitura atenta e conexão de ideias
📕 DIFÍCIL (hard): Detalhes específicos, inferências ou análise profunda

═══════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON):
═══════════════════════════════════════════════════════════

Retorne APENAS um array JSON válido, sem markdown:
[
  {
    "question_text": "Pergunta clara e direta?",
    "options": [
      {"id": "a", "text": "Opção A"},
      {"id": "b", "text": "Opção B"},
      {"id": "c", "text": "Opção C"},
      {"id": "d", "text": "Opção D"}
    ],
    "correct_option_id": "b",
    "category": "${category}",
    "difficulty": "medium",
    "source_info": "Base: ${sourceName} - [informação específica do trecho]"
  }
]${existingSection}`;
}

// Generate ULTRA-RESTRICTIVE prompt for Bible category
function getBiblePrompt(count: number, difficultyPrompt: string, category: string, existingQuestions: string[] = []): string {
  const existingSection = formatExistingQuestions(existingQuestions);

  return `Você é um gerador de perguntas bíblicas EXTREMAMENTE RIGOROSO.

REGRA FUNDAMENTAL: A resposta DEVE estar LITERALMENTE escrita no versículo fonte.
NÃO use interpretações, conclusões teológicas ou conhecimento externo.

Gere ${count} perguntas sobre a Bíblia (Tradução do Novo Mundo).
Dificuldade: ${difficultyPrompt}.

═══════════════════════════════════════════════════════════
🎯 CLASSIFICAÇÃO DE DIFICULDADE (SIGA RIGOROSAMENTE):
═══════════════════════════════════════════════════════════

📗 FÁCIL (easy) - Conhecimento cultural geral, até não-religiosos sabem:
   ✅ "Quantas pragas foram enviadas ao Egito?" → 10 (TODO MUNDO sabe)
   ✅ "Quem construiu a arca?" → Noé (história infantil famosa)
   ✅ "Em quantos dias Deus criou o mundo?" → 6 dias (conhecimento cultural)
   ✅ "Quem foi lançado na cova dos leões?" → Daniel (história muito popular)
   ✅ "Qual fruto Adão e Eva comeram?" → Fruto proibido/Maçã (cultura popular)
   ✅ "Quem traiu Jesus por 30 moedas?" → Judas (conhecimento básico)
   ✅ "Quantos mandamentos Deus deu a Moisés?" → 10 (cultura geral)

📙 MÉDIA (medium) - Requer leitura regular da Bíblia:
   ✅ "Quantos dias Moisés ficou no Monte Sinai?" → 40 dias
   ✅ "Qual era o nome da esposa de Abraão?" → Sara
   ✅ "Quantos homens foram lançados na fornalha ardente?" → 3
   ✅ "Qual profeta foi engolido por um grande peixe?" → Jonas
   ✅ "Quem era o pai de Salomão?" → Davi
   ✅ "Quantos livros tem o Novo Testamento?" → 27
   ✅ "Qual era a profissão de Pedro antes de seguir Jesus?" → Pescador

📕 DIFÍCIL (hard) - Exige estudo aprofundado, detalhes obscuros:
   ✅ "Quantos anos tinha Abraão quando Isaque nasceu?" → 100 anos
   ✅ "Qual era o nome do servo de Abraão enviado para buscar esposa para Isaque?" → Eliézer
   ✅ "Quantos anos Jacó trabalhou no total por Raquel?" → 14 anos
   ✅ "Qual era o nome do pai de Moisés?" → Anrão
   ✅ "Quantas cestas sobraram na multiplicação dos 7 pães?" → 7 cestas
   ✅ "Qual era o nome do centurião em Cesareia que se converteu?" → Cornélio
   ✅ "Quantos anos durou o reinado de Davi em Jerusalém?" → 33 anos

⚠️ REGRA CRÍTICA: Se uma criança de Escola Dominical ou até alguém não-religioso
provavelmente sabe a resposta, a pergunta é FÁCIL, não média ou difícil!

═══════════════════════════════════════════════════════════
TIPOS DE PERGUNTAS PERMITIDAS (exemplos corretos):
═══════════════════════════════════════════════════════════

✅ CORRETO - Pergunta direta (fonte no source_info):
Pergunta: "Quem deu nome a todos os animais domésticos?"
Resposta: "O homem"
Fonte: "Gênesis 2:19, 20 - 'o homem lhes dava nomes'"

✅ CORRETO - Número exato:
Pergunta: "Quantos dias e noites durou o dilúvio?"
Resposta: "40 dias e 40 noites"
Fonte: "Gênesis 7:4 - 'farei chover sobre a terra 40 dias e 40 noites'"

✅ CORRETO - Pergunta que PRECISA do versículo:
Pergunta: "O que diz João 3:16?"
Resposta: "Deus amou tanto o mundo que deu o seu Filho unigênito..."
Fonte: "João 3:16 - citação direta"

═══════════════════════════════════════════════════════════
TIPOS DE PERGUNTAS PROIBIDAS:
═══════════════════════════════════════════════════════════

❌ ERRADO - Interpretação teológica:
"Qual o tema principal do Sermão do Monte?"

❌ ERRADO - Conclusão não explícita:
"Quem foi o primeiro homem criado por Deus?"
(O texto não diz "primeiro")

❌ ERRADO - Nome não mencionado no versículo:
"Quem escreveu o livro de Gênesis?"

═══════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON):
═══════════════════════════════════════════════════════════

Retorne APENAS um array JSON válido, sem markdown:
[
  {
    "question_text": "Pergunta clara e direta?",
    "options": [
      {"id": "a", "text": "Opção A"},
      {"id": "b", "text": "Opção B"},
      {"id": "c", "text": "Opção C"},
      {"id": "d", "text": "Opção D"}
    ],
    "correct_option_id": "b",
    "category": "${category}",
    "difficulty": "medium",
    "source_info": "[Livro X:Y] - '[citação literal do trecho relevante]'"
  }
]

REGRAS OBRIGATÓRIAS:
1. NÃO cite o versículo na pergunta, EXCETO se for essencial (ex: "O que diz Romanos 6:23?")
2. A resposta DEVE ser uma citação LITERAL ou paráfrase direta do texto bíblico
3. O source_info DEVE incluir o versículo E a citação literal que comprova a resposta
4. As 3 opções erradas devem ser plausíveis mas claramente incorretas
5. VARIE a posição da resposta correta (a, b, c ou d) - NÃO coloque sempre em "a"
6. NUNCA use interpretações, apenas fatos escritos no texto
7. CLASSIFIQUE A DIFICULDADE CORRETAMENTE usando os critérios acima!${existingSection}`;
}

// Generate ULTRA-RESTRICTIVE prompt for general categories
function getGeneralPrompt(count: number, difficultyPrompt: string, category: string, existingQuestions: string[] = []): string {
  const existingSection = formatExistingQuestions(existingQuestions);

  return `Você é um gerador de perguntas EXTREMAMENTE RIGOROSO para quiz educativo.

REGRA FUNDAMENTAL: Cada resposta DEVE ser um FATO VERIFICÁVEL com fonte primária.
NÃO use opiniões, interpretações ou informações que possam estar desatualizadas.

Gere ${count} perguntas sobre "${category}" em português brasileiro.
Dificuldade: ${difficultyPrompt}.

═══════════════════════════════════════════════════════════
🎯 CLASSIFICAÇÃO DE DIFICULDADE (SIGA RIGOROSAMENTE):
═══════════════════════════════════════════════════════════

📗 FÁCIL (easy) - Conhecimento de ensino fundamental, cultura geral básica:
   ✅ "Qual é a capital do Brasil?" → Brasília (qualquer brasileiro sabe)
   ✅ "Quantos planetas tem o Sistema Solar?" → 8 (conhecimento escolar básico)
   ✅ "Quem descobriu o Brasil?" → Pedro Álvares Cabral (história básica)
   ✅ "Qual o maior país do mundo em território?" → Rússia (geografia básica)
   ✅ "Quantos estados tem o Brasil?" → 26 + DF (conhecimento comum)
   ✅ "Em que continente fica o Egito?" → África (geografia básica)
   ✅ "Qual é a fórmula química da água?" → H2O (ciência básica)

📙 MÉDIA (medium) - Requer conhecimento de ensino médio ou interesse na área:
   ✅ "Em que ano foi proclamada a República no Brasil?" → 1889
   ✅ "Qual é o maior osso do corpo humano?" → Fêmur
   ✅ "Quem pintou a Mona Lisa?" → Leonardo da Vinci
   ✅ "Qual é a velocidade da luz?" → ~300.000 km/s
   ✅ "Qual país sediou a primeira Copa do Mundo?" → Uruguai (1930)
   ✅ "Qual é o elemento químico mais abundante no universo?" → Hidrogênio
   ✅ "Quem escreveu Dom Casmurro?" → Machado de Assis

📕 DIFÍCIL (hard) - Exige conhecimento especializado ou estudo aprofundado:
   ✅ "Em que ano Getúlio Vargas instituiu o Estado Novo?" → 1937
   ✅ "Qual é o ponto de ebulição do mercúrio em Celsius?" → 356,7°C
   ✅ "Quantos quilômetros tem a extensão da Muralha da China?" → ~21.196 km
   ✅ "Qual o número atômico do Urânio?" → 92
   ✅ "Em que ano foi assinado o Tratado de Tordesilhas?" → 1494
   ✅ "Qual compositor escreveu 'As Quatro Estações'?" → Vivaldi
   ✅ "Quantos ossos tem o corpo humano adulto?" → 206

⚠️ REGRA CRÍTICA: Se qualquer adulto brasileiro médio provavelmente sabe a resposta
sem precisar estudar, a pergunta é FÁCIL, não média ou difícil!

═══════════════════════════════════════════════════════════
TIPOS DE PERGUNTAS PERMITIDAS (exemplos corretos):
═══════════════════════════════════════════════════════════

✅ CORRETO - Dado numérico oficial:
Pergunta: "Em que ano o Brasil conquistou seu primeiro título na Copa do Mundo?"
Resposta: "1958"
Fonte: "FIFA - Histórico de Campeões da Copa do Mundo"

✅ CORRETO - Fato científico estabelecido:
Pergunta: "Qual é o símbolo químico do ouro na tabela periódica?"
Resposta: "Au"
Fonte: "IUPAC - Tabela Periódica dos Elementos"

✅ CORRETO - Dado geográfico:
Pergunta: "Qual é a capital da Austrália?"
Resposta: "Canberra"
Fonte: "Governo da Austrália - Site Oficial"

═══════════════════════════════════════════════════════════
TIPOS DE PERGUNTAS PROIBIDAS:
═══════════════════════════════════════════════════════════

❌ ERRADO - Opinião ou julgamento:
"Qual foi o melhor jogador de futebol de todos os tempos?"

❌ ERRADO - Dado que muda frequentemente:
"Qual é a população atual do Brasil?"

❌ ERRADO - Sem fonte verificável:
"Qual é o prato típico mais famoso da Itália?"

═══════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON):
═══════════════════════════════════════════════════════════

Retorne APENAS um array JSON válido, sem markdown:
[
  {
    "question_text": "Pergunta clara e direta?",
    "options": [
      {"id": "a", "text": "Opção A"},
      {"id": "b", "text": "Opção B"},
      {"id": "c", "text": "Opção C"},
      {"id": "d", "text": "Opção D"}
    ],
    "correct_option_id": "c",
    "category": "${category}",
    "difficulty": "medium",
    "source_info": "[Fonte Oficial/Primária] - [dado específico que comprova]"
  }
]

REGRAS OBRIGATÓRIAS:
1. Apenas fatos com fontes primárias (órgãos oficiais, instituições, documentos)
2. Números, datas e nomes devem ser EXATOS
3. O source_info deve ser específico (não "Wikipedia" genérico)
4. As 3 opções erradas devem ser plausíveis mas claramente incorretas
5. VARIE a posição da resposta correta (a, b, c ou d) - NÃO coloque sempre em "a"
6. Prefira fatos atemporais que não mudam (datas históricas, leis da física, etc.)
7. CLASSIFIQUE A DIFICULDADE CORRETAMENTE usando os critérios acima!${existingSection}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { category = 'Conhecimentos Gerais', difficulty = 'medium', count = 5, existingQuestions = [], sourceType = 'ai_knowledge', sourceUrl, sourceId }: QuestionRequest = await req.json();

    // Criar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Limit count to avoid token issues (max 20)
    const safeCount = Math.min(count, 20);

    // Create difficulty instruction - very emphatic for specific difficulties
    const difficultyPrompt = difficulty === 'mixed'
      ? 'uma mistura de perguntas fáceis, médias e difíceis'
      : `SOMENTE perguntas de dificuldade ${difficulty === 'easy' ? 'FÁCIL' : difficulty === 'medium' ? 'MÉDIA' : 'DIFÍCIL'}`;

    // Create a strict difficulty reminder for non-mixed requests
    const difficultyReminder = difficulty === 'mixed'
      ? ''
      : `\n\n🚨 ATENÇÃO CRÍTICA: TODAS as ${safeCount} perguntas DEVEM ser de dificuldade "${difficulty === 'easy' ? 'easy' : difficulty === 'medium' ? 'medium' : 'hard'}".
NÃO gere perguntas de outros níveis. Se foi pedido "hard", TODAS devem ser hard.
Revise cada pergunta antes de finalizar para garantir que está no nível correto.`;

    let prompt: string;
    let systemMessage: string;

    // Check if using Knowledge Base (RAG)
    if (sourceType === 'knowledge_base' && sourceId) {
      console.log('[RAG] Modo Knowledge Base ativado');
      console.log('[RAG] sourceId:', sourceId);
      console.log('[RAG] category:', category);

      try {
        // Buscar informações da fonte
        console.log('[RAG] Buscando fonte no banco...');
        const { data: source, error: sourceError } = await supabase
          .from('knowledge_sources')
          .select('name, status, total_chunks, custom_prompt')
          .eq('id', sourceId)
          .single();

        if (sourceError || !source) {
          console.error('[RAG] Erro ao buscar fonte:', JSON.stringify(sourceError));
          throw new Error('Fonte de conhecimento não encontrada');
        }

        console.log('[RAG] Fonte encontrada:', source.name, 'Status:', source.status, 'Chunks:', source.total_chunks);

        if (source.status !== 'ready') {
          throw new Error(`Fonte ainda não está pronta. Status: ${source.status}`);
        }

        if (source.total_chunks === 0) {
          throw new Error('Fonte não possui chunks indexados');
        }

        // Gerar embedding da query de busca
        const searchQuery = `Perguntas sobre ${category}: ${category}`;
        console.log('[RAG] Gerando embedding para query:', searchQuery);

        let queryEmbedding: number[];
        try {
          queryEmbedding = await generateQueryEmbedding(searchQuery);
          console.log('[RAG] Embedding gerado com', queryEmbedding.length, 'dimensões');
        } catch (embError) {
          console.error('[RAG] Erro ao gerar embedding:', embError);
          throw new Error(`Erro ao gerar embedding: ${embError.message}`);
        }

        // Buscar chunks mais relevantes
        console.log('[RAG] Buscando chunks relevantes...');
        let chunks: { content: string; similarity: number }[];
        try {
          chunks = await searchKnowledgeChunks(supabase, sourceId, queryEmbedding, 10, 0.3);
          console.log('[RAG] Chunks retornados:', chunks.length);
        } catch (searchError) {
          console.error('[RAG] Erro na busca de chunks:', searchError);
          throw new Error(`Erro na busca semântica: ${searchError.message}`);
        }

        if (chunks.length === 0) {
          throw new Error('Nenhum conteúdo relevante encontrado na base de conhecimento');
        }

        console.log('[RAG] Gerando prompt com', chunks.length, 'chunks');
        prompt = getKnowledgeBasePrompt(safeCount, difficultyPrompt, category, chunks, source.name, source.custom_prompt, existingQuestions) + difficultyReminder;
        systemMessage = 'Você é um gerador de perguntas baseado em conhecimento indexado. Gere perguntas APENAS sobre o conteúdo fornecido dos trechos, sem usar conhecimento externo. Retorne JSON válido sem markdown.';
        console.log('[RAG] Prompt gerado, tamanho:', prompt.length);
      } catch (ragError) {
        console.error('[RAG] Erro geral no fluxo RAG:', ragError);
        throw ragError;
      }

    } else if (sourceType === 'url' && sourceUrl) {
      // Fetch content from URL
      const urlContent = await fetchUrlContent(sourceUrl);

      if (!urlContent || urlContent.length < 100) {
        throw new Error('Conteúdo insuficiente extraído da URL. Tente outra página.');
      }

      prompt = getUrlContentPrompt(safeCount, difficultyPrompt, category, urlContent, sourceUrl, existingQuestions) + difficultyReminder;
      systemMessage = 'Você é um gerador de perguntas baseado em conteúdo específico. Gere perguntas APENAS sobre o conteúdo fornecido, sem usar conhecimento externo. Retorne JSON válido sem markdown.';
    } else {
      // Use AI knowledge (original behavior)
      const isBible = isBibleCategory(category);
      prompt = isBible
        ? getBiblePrompt(safeCount, difficultyPrompt, category, existingQuestions) + difficultyReminder
        : getGeneralPrompt(safeCount, difficultyPrompt, category, existingQuestions) + difficultyReminder;

      systemMessage = isBible
        ? 'Você é um verificador bíblico rigoroso. NUNCA gere perguntas baseadas em interpretação. Apenas fatos LITERALMENTE escritos no texto. Retorne JSON válido sem markdown.'
        : 'Você é um verificador de fatos rigoroso. NUNCA gere perguntas sem fonte primária verificável. Apenas fatos 100% precisos. Retorne JSON válido sem markdown.';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7, // Higher temperature for more variety
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse JSON (remove markdown code blocks if present)
    let questions: GeneratedQuestion[];
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleanContent);
    } catch {
      throw new Error('Failed to parse questions from AI response');
    }

    // Validate structure
    if (!Array.isArray(questions)) {
      throw new Error('Invalid response format');
    }

    // Ensure all questions have required fields including source_info
    // Validate difficulty and shuffle options to randomize correct answer position
    questions = questions.map((q) => {
      const baseQuestion: GeneratedQuestion = {
        question_text: q.question_text,
        options: q.options,
        correct_option_id: q.correct_option_id,
        category: q.category || category,
        difficulty: validateDifficulty(q.difficulty || 'medium'),
        source_info: q.source_info || 'Fonte não verificada - REVISAR',
      };
      // Shuffle options to ensure correct answer isn't always in same position
      return shuffleQuestionOptions(baseQuestion);
    });

    return new Response(
      JSON.stringify({ questions }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
