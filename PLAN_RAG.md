# Plano de Implementação: RAG com pgvector

## Visão Geral

Implementar um sistema de **Retrieval Augmented Generation (RAG)** para permitir que admins importem conteúdo extenso (sites, documentos) e gerem perguntas de quiz baseadas nesse conhecimento indexado.

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin Panel    │────▶│  Knowledge Base  │────▶│  Quiz Generator │
│  (Upload/URL)   │     │  (pgvector)      │     │  (RAG + GPT)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
   Crawl/Extract          Embed & Index           Semantic Search
   Content                 (OpenAI)              + Generate Questions
```

## Componentes

### 1. Extensões PostgreSQL
- **vector** (pgvector) - Armazenamento e busca de embeddings
- **pgmq** - Fila para processamento assíncrono de embeddings

### 2. Novas Tabelas

```sql
-- Fontes de conhecimento (sites, documentos, textos)
knowledge_sources (
  id, name, type, url, status,
  total_chunks, created_by, created_at
)

-- Chunks indexados com embeddings
knowledge_chunks (
  id, source_id, content, embedding vector(1536),
  metadata, created_at
)
```

### 3. Edge Functions

| Função | Descrição |
|--------|-----------|
| `crawl-source` | Extrai conteúdo de URLs (multi-página) |
| `embed-chunks` | Gera embeddings via OpenAI |
| `generate-quiz` (atualizar) | Busca chunks relevantes + gera perguntas |

### 4. Interface Admin

Nova seção "Base de Conhecimento":
- Adicionar fonte (URL ou texto)
- Visualizar status de indexação
- Gerenciar fontes existentes
- Selecionar fonte ao gerar perguntas

---

## Etapas de Implementação

### Fase 1: Infraestrutura de Banco (Migrations)

1. **Habilitar extensão pgvector**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
   ```

2. **Criar tabela `knowledge_sources`**
   - Campos: id, name, description, type (url/text/file), source_url, status (pending/processing/ready/error), total_chunks, error_message, created_by, created_at

3. **Criar tabela `knowledge_chunks`**
   - Campos: id, source_id (FK), content (text), embedding (vector 1536), chunk_index, metadata (jsonb), created_at
   - Índice HNSW para busca vetorial

4. **Criar fila pgmq para embeddings**
   ```sql
   SELECT pgmq.create('embedding_jobs');
   ```

5. **RLS Policies**
   - Admins podem gerenciar fontes
   - Chunks são read-only para geração

### Fase 2: Edge Functions

1. **`crawl-source`** (Nova)
   - Recebe URL de fonte
   - Faz crawling de múltiplas páginas (seguir links do mesmo domínio)
   - Extrai texto limpo (remove HTML, scripts, etc)
   - Divide em chunks de ~500-1000 tokens
   - Enfileira chunks para embedding
   - Atualiza status da fonte

2. **`embed-chunks`** (Nova)
   - Processa fila de chunks
   - Gera embeddings via OpenAI `text-embedding-3-small`
   - Salva no banco com vetor
   - Batch processing para eficiência

3. **`generate-quiz`** (Atualizar)
   - Novo parâmetro: `sourceId` (opcional)
   - Se sourceId fornecido:
     1. Gera embedding da categoria/tema
     2. Busca top 10 chunks mais similares
     3. Usa chunks como contexto no prompt
   - Caso contrário: comportamento atual (conhecimento da IA)

### Fase 3: Interface Frontend

1. **Nova página: `/host/knowledge`**
   - Lista de fontes com status
   - Botão "Adicionar Fonte"
   - Ações: visualizar chunks, reprocessar, excluir

2. **Modal "Adicionar Fonte"**
   - Nome da fonte
   - Tipo: URL / Texto direto
   - Se URL: campo para colar link
   - Se Texto: textarea para colar conteúdo
   - Descrição (opcional)

3. **Atualizar modal de Geração com IA**
   - Terceira opção: "Base de Conhecimento"
   - Dropdown para selecionar fonte indexada
   - Mostra quantidade de chunks disponíveis

### Fase 4: Integração e Testes

1. Testar fluxo completo:
   - Adicionar fonte → Indexar → Gerar perguntas
2. Validar qualidade das perguntas geradas
3. Ajustar parâmetros (chunk size, similarity threshold)

---

## Modelo de Dados Detalhado

### knowledge_sources
```sql
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('url', 'text', 'file')),
  source_url TEXT,
  source_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'crawling', 'embedding', 'ready', 'error')),
  total_chunks INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### knowledge_chunks
```sql
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca vetorial (HNSW é mais rápido que IVFFlat)
CREATE INDEX ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
```

---

## Função de Busca Semântica

```sql
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  source_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM knowledge_chunks kc
  WHERE kc.source_id = match_knowledge_chunks.source_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Fluxo de Geração com RAG

```
1. Admin seleciona "Base de Conhecimento" + Fonte
2. Frontend envia: { sourceId, category, difficulty, count }
3. Edge Function generate-quiz:
   a. Gera embedding do tema: "Perguntas sobre [category]"
   b. Busca chunks similares: match_knowledge_chunks(embedding, sourceId)
   c. Monta prompt com contexto dos chunks
   d. Chama GPT-4o para gerar perguntas
   e. Retorna perguntas com source_info referenciando a fonte
```

---

## Estimativas

| Fase | Complexidade | Arquivos Afetados |
|------|--------------|-------------------|
| 1. Migrations | Média | 4 migrations |
| 2. Edge Functions | Alta | 3 functions |
| 3. Frontend | Média | 3-4 componentes |
| 4. Testes | Baixa | - |

---

## Considerações

1. **Limite de tokens**: Chunks de ~500 tokens para caber no contexto
2. **Rate limiting**: OpenAI tem limites, usar fila com delays
3. **Custo**: Embeddings OpenAI são baratos (~$0.0001/1K tokens)
4. **Crawler**: Respeitar robots.txt, limitar profundidade
5. **Storage**: Embeddings 1536 dims = ~6KB por chunk

---

## Próximos Passos

Após aprovação deste plano:
1. Criar migrations para habilitar pgvector e tabelas
2. Desenvolver Edge Functions
3. Implementar interface admin
4. Testar e ajustar
