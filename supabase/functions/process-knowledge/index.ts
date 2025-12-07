// Edge Function para processar fontes de conhecimento
// v14 - Modo de continuação para crawling incremental

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

console.log('Edge Function process-knowledge v14 inicializada');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  sourceId: string;
  continueMode?: boolean; // Se true, continua de onde parou sem deletar chunks existentes
}

interface KnowledgeSource {
  id: string;
  type: 'url' | 'text' | 'file';
  source_url: string | null;
  source_content: string | null;
  crawl_mode: 'single_page' | 'follow_links' | 'url_list' | 'file';
  additional_urls: string[];
  max_pages: number;
  max_depth: number;
  file_path: string | null;
  file_type: string | null;
  crawled_urls: string[];
}

// ============================================
// JINA AI READER - Para renderizar JavaScript
// ============================================

async function fetchWithJina(url: string, timeoutMs = 25000): Promise<{ text: string; links: string[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log(`Jina fetch: ${url}`);

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jina retornou ${response.status}`);
    }

    const markdown = await response.text();
    console.log(`Jina response: ${markdown.length} chars`);

    // Extrai links do markdown [texto](url)
    const links: string[] = [];

    // Regex para capturar links markdown: [texto](url)
    const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const linkUrl = match[2];
      // Remove parâmetros de tracking e fragmentos
      try {
        const urlObj = new URL(linkUrl);
        urlObj.hash = '';
        const cleanUrl = urlObj.toString();
        if (!links.includes(cleanUrl)) {
          links.push(cleanUrl);
        }
      } catch { /* URL inválida */ }
    }

    console.log(`Links encontrados: ${links.length}`);
    if (links.length > 0) {
      console.log(`  Primeiros 3: ${links.slice(0, 3).join(', ')}`);
    }

    // Limpa o texto removendo elementos de navegação
    let text = markdown;
    // Remove o header/metadata do Jina
    text = text.replace(/^Title:.*$/m, '');
    text = text.replace(/^URL Source:.*$/m, '');
    text = text.replace(/^Published Time:.*$/m, '');
    text = text.replace(/^Markdown Content:.*$/m, '');
    // Remove links markdown mas mantém o texto
    text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
    // Remove imagens
    text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    // Remove headers de navegação comuns
    text = text.replace(/^[\*\-]\s+\[?[A-Z]\]?$/gm, '');
    // Limpa espaços extras
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return { text, links };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout ao acessar ${url}`);
    }
    throw error;
  }
}

// ============================================
// FETCH DIRETO (fallback)
// ============================================

function extractTextFromHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  text = text.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&[a-z]+;/gi, ' ');
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname;
  const linkMatches = html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi);

  for (const match of linkMatches) {
    try {
      let href = match[1];
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.hostname !== baseDomain) continue;
      absoluteUrl.hash = '';
      const normalizedUrl = absoluteUrl.toString();
      if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|pdf|zip)$/i.test(normalizedUrl)) continue;
      if (!links.includes(normalizedUrl)) links.push(normalizedUrl);
    } catch { /* URL inválida */ }
  }
  return links;
}

async function fetchDirect(url: string): Promise<{ text: string; links: string[] }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });

  if (!response.ok) throw new Error(`Falha ao acessar URL: ${response.status}`);

  const html = await response.text();
  return {
    text: extractTextFromHtml(html),
    links: extractLinks(html, url)
  };
}

// ============================================
// EXTRAÇÃO DE TEXTO DE PDF (usando unpdf)
// ============================================

async function extractTextFromPdf(pdfData: Uint8Array): Promise<string> {
  try {
    // @ts-ignore - unpdf é carregado dinamicamente
    const { extractText } = await import("npm:unpdf");
    const { text } = await extractText(pdfData);
    console.log('PDF extraído com unpdf:', text.length, 'chars');
    return text;
  } catch (error) {
    console.error('Erro unpdf:', error);
    // Fallback básico
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(pdfData);
    let text = '';
    const textMatches = pdfString.matchAll(/BT[\s\S]*?ET/g);
    for (const match of textMatches) {
      const block = match[0];
      const stringMatches = block.matchAll(/\(([^)]*)\)/g);
      for (const strMatch of stringMatches) {
        let str = strMatch[1];
        str = str.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
        str = str.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
        str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        if (str.trim()) text += str + ' ';
      }
    }
    return text.replace(/\s+/g, ' ').trim();
  }
}

// ============================================
// CRAWLING INTELIGENTE COM JINA
// ============================================

async function crawlWithJina(
  startUrl: string,
  maxPages: number,
  maxDepth: number,
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  existingVisitedUrls: string[] = [] // URLs já visitadas em execuções anteriores
): Promise<string> {
  // Inicializa com URLs já visitadas (modo continuação)
  const visited = new Set<string>(existingVisitedUrls);
  const toVisit: { url: string; depth: number }[] = [];
  const allContent: string[] = [];
  const startTime = Date.now();
  const maxTimeMs = 110000; // 110 segundos (margem para o limite de 150s)

  // Se estamos continuando, começamos pela URL inicial para descobrir novos links
  // Se a URL inicial já foi visitada, ainda precisamos re-crawlá-la para descobrir links
  if (existingVisitedUrls.length > 0) {
    console.log(`Modo continuação: ${existingVisitedUrls.length} URLs já visitadas`);
    // Re-adiciona a URL inicial temporariamente para descobrir links (não vai salvar conteúdo novamente)
    toVisit.push({ url: startUrl, depth: 0 });
  } else {
    toVisit.push({ url: startUrl, depth: 0 });
  }

  // URLs que parecem ser páginas de conteúdo (artigos)
  const contentPatterns = [
    /\/d\/r\d+\/lp-[a-z]+\/\d+/, // wol.jw.org article pattern
    /\/article\//i,
    /\/post\//i,
    /\/blog\//i,
    /\/news\//i,
  ];

  // URLs que parecem ser páginas de navegação/índice
  const navPatterns = [
    /\/library\//i,
    /\/category\//i,
    /\/tag\//i,
    /\/index/i,
  ];

  function isContentUrl(url: string): boolean {
    return contentPatterns.some(p => p.test(url));
  }

  function isNavUrl(url: string): boolean {
    return navPatterns.some(p => p.test(url));
  }

  console.log(`Iniciando crawl: ${startUrl}, max ${maxPages} páginas, depth ${maxDepth}`);

  // Controla URLs que já tinham conteúdo extraído antes (para não duplicar)
  const alreadyExtracted = new Set<string>(existingVisitedUrls);

  while (toVisit.length > 0 && visited.size < maxPages) {
    // Verifica tempo limite
    if (Date.now() - startTime > maxTimeMs) {
      console.log('Tempo limite atingido, finalizando crawl...');
      break;
    }

    // Prioriza URLs de conteúdo sobre navegação
    toVisit.sort((a, b) => {
      const aIsContent = isContentUrl(a.url);
      const bIsContent = isContentUrl(b.url);
      if (aIsContent && !bIsContent) return -1;
      if (!aIsContent && bIsContent) return 1;
      return a.depth - b.depth;
    });

    const { url, depth } = toVisit.shift()!;

    // Se já foi visitada nesta sessão, pula
    if (visited.has(url) && !alreadyExtracted.has(url)) continue;

    // Se é uma URL que precisa ser re-visitada para descobrir links (modo continuação)
    const isRevisit = alreadyExtracted.has(url);
    if (isRevisit) {
      alreadyExtracted.delete(url); // Remove para processar apenas uma vez
    }

    visited.add(url);

    try {
      console.log(`[${visited.size}/${maxPages}] depth=${depth} ${isRevisit ? '(revisit for links)' : ''} ${url}`);

      // Usa Jina para buscar (funciona com SPAs)
      const { text, links } = await fetchWithJina(url);

      // Só adiciona conteúdo se for substancial E se não for uma revisita
      if (!isRevisit) {
        const minContentLength = isContentUrl(url) ? 200 : 500;
        if (text && text.length > minContentLength) {
          allContent.push(text);
          console.log(`  -> ${text.length} chars extraídos`);
        }
      } else {
        console.log(`  -> Revisita, ignorando conteúdo, apenas buscando links`);
      }

      // Atualiza progresso
      await supabase.from('knowledge_sources')
        .update({ crawled_urls: Array.from(visited) })
        .eq('id', sourceId);

      // Adiciona links para visitar
      if (depth < maxDepth) {
        const baseUrlObj = new URL(startUrl);
        const baseDomain = baseUrlObj.hostname;

        for (const link of links) {
          try {
            const linkUrl = new URL(link);
            // Só segue links do mesmo domínio
            if (linkUrl.hostname !== baseDomain) continue;
            // Ignora arquivos de mídia
            if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|pdf|zip)$/i.test(link)) continue;
            // Ignora links já visitados ou na fila
            if (visited.has(link) || toVisit.some(t => t.url === link)) continue;

            toVisit.push({ url: link, depth: depth + 1 });
          } catch { /* URL inválida */ }
        }
      }

      // Pequeno delay para não sobrecarregar
      await new Promise(r => setTimeout(r, 300));

    } catch (error) {
      console.error(`Erro em ${url}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Crawl finalizado: ${visited.size} URLs, ${allContent.length} com conteúdo`);
  return allContent.join('\n\n---\n\n');
}

// ============================================
// PROCESSAR ARQUIVO
// ============================================

async function processFile(supabase: ReturnType<typeof createClient>, filePath: string, fileType: string | null): Promise<string> {
  console.log('Processando arquivo:', filePath);

  const { data, error } = await supabase.storage.from('knowledge-documents').download(filePath);
  if (error || !data) throw new Error(`Erro ao baixar: ${error?.message}`);

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  console.log('Arquivo:', bytes.length, 'bytes');

  if (fileType?.includes('pdf') || filePath.toLowerCase().endsWith('.pdf')) {
    const text = await extractTextFromPdf(bytes);
    if (text.length < 50) throw new Error('Não foi possível extrair texto do PDF.');
    return text;
  }

  if (fileType?.includes('text') || /\.(txt|md|csv)$/i.test(filePath)) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  if (fileType?.includes('word') || /\.(doc|docx)$/i.test(filePath)) {
    let text = new TextDecoder('utf-8').decode(bytes);
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 100) throw new Error('Não foi possível extrair texto do Word.');
    return text;
  }

  throw new Error(`Tipo não suportado: ${fileType}`);
}

// ============================================
// CHUNKS
// ============================================

function splitIntoChunks(text: string): string[] {
  const MAX_CHUNK_CHARS = 1500;
  const chunks: string[] = [];
  const cleanText = text.replace(/\s+/g, ' ').trim();

  if (cleanText.length <= MAX_CHUNK_CHARS) {
    if (cleanText.length >= 30) chunks.push(cleanText);
    return chunks;
  }

  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > MAX_CHUNK_CHARS) {
      if (current.trim().length >= 30) {
        chunks.push(current.trim());
      }
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current.trim().length >= 30) {
    chunks.push(current.trim());
  }

  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > MAX_CHUNK_CHARS) {
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_CHARS) {
        const part = chunk.substring(i, i + MAX_CHUNK_CHARS).trim();
        if (part.length >= 30) finalChunks.push(part);
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  console.log(`Dividido em ${finalChunks.length} chunks`);
  return finalChunks;
}

// ============================================
// EMBEDDINGS
// ============================================

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

  const safetexts = texts.map(t => t.substring(0, 6000));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: safetexts }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro embeddings: ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

// ============================================
// HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { sourceId, continueMode = false }: ProcessRequest = await req.json();
    if (!sourceId) throw new Error('sourceId obrigatório');

    console.log('Processando:', sourceId, continueMode ? '(modo continuação)' : '(modo normal)');

    const { data: source, error: sourceError } = await supabase
      .from('knowledge_sources').select('*').eq('id', sourceId).single();

    if (sourceError || !source) throw new Error('Fonte não encontrada');

    const typedSource = source as KnowledgeSource;
    console.log('Tipo:', typedSource.type, 'Modo:', typedSource.crawl_mode);

    // Preserva crawled_urls existentes se estiver em modo continuação
    const existingCrawledUrls = continueMode ? (typedSource.crawled_urls || []) : [];

    await supabase.from('knowledge_sources')
      .update({
        status: 'crawling',
        error_message: null,
        // Só reseta crawled_urls se NÃO estiver em modo continuação
        ...(continueMode ? {} : { crawled_urls: [] })
      })
      .eq('id', sourceId);

    let content: string;

    if (typedSource.type === 'file' && typedSource.file_path) {
      content = await processFile(supabase, typedSource.file_path, typedSource.file_type);
    } else if (typedSource.type === 'url' && typedSource.source_url) {
      if (typedSource.crawl_mode === 'follow_links') {
        // Usa Jina para crawling inteligente
        content = await crawlWithJina(
          typedSource.source_url,
          typedSource.max_pages,
          typedSource.max_depth,
          supabase,
          sourceId,
          existingCrawledUrls // URLs já visitadas (modo continuação)
        );
      } else if (typedSource.crawl_mode === 'url_list' && typedSource.additional_urls?.length > 0) {
        // Processa lista de URLs com Jina
        const allContent: string[] = [];
        const processed: string[] = [];

        for (const url of typedSource.additional_urls) {
          try {
            const { text } = await fetchWithJina(url);
            if (text && text.length > 100) {
              allContent.push(text);
              processed.push(url);
            }
            await supabase.from('knowledge_sources').update({ crawled_urls: processed }).eq('id', sourceId);
          } catch (e) {
            console.error(`Erro ${url}:`, e);
          }
        }
        content = allContent.join('\n\n---\n\n');
      } else {
        // Página única com Jina
        const { text } = await fetchWithJina(typedSource.source_url);
        content = text;
      }
    } else if (typedSource.type === 'text' && typedSource.source_content) {
      content = typedSource.source_content;
    } else {
      throw new Error('Fonte inválida');
    }

    console.log('Conteúdo total:', content?.length || 0, 'chars');
    if (!content || content.length < 50) throw new Error('Conteúdo insuficiente extraído');

    await supabase.from('knowledge_sources').update({ status: 'embedding' }).eq('id', sourceId);

    const chunks = splitIntoChunks(content);
    console.log('Chunks gerados:', chunks.length);

    // Em modo continuação sem novo conteúdo, mantém o que já existe
    if (chunks.length === 0 && continueMode) {
      console.log('Modo continuação: nenhum novo conteúdo, mantendo chunks existentes');
      await supabase.from('knowledge_sources').update({
        status: 'ready',
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId);

      return new Response(JSON.stringify({
        success: true,
        chunks: typedSource.total_chunks,
        status: 'ready',
        message: 'Nenhum novo conteúdo encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (chunks.length === 0) throw new Error('Nenhum chunk gerado');

    // Em modo continuação, obtém o maior chunk_index existente
    let startingChunkIndex = 0;
    let existingChunksCount = 0;

    if (continueMode) {
      const { data: maxChunk } = await supabase
        .from('knowledge_chunks')
        .select('chunk_index')
        .eq('source_id', sourceId)
        .order('chunk_index', { ascending: false })
        .limit(1)
        .single();

      if (maxChunk) {
        startingChunkIndex = maxChunk.chunk_index + 1;
        console.log(`Modo continuação: iniciando chunks no índice ${startingChunkIndex}`);
      }

      // Conta chunks existentes
      const { count } = await supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId);

      existingChunksCount = count || 0;
      console.log(`Chunks existentes: ${existingChunksCount}`);
    } else {
      // Modo normal: deleta chunks existentes
      await supabase.from('knowledge_chunks').delete().eq('source_id', sourceId);
    }

    const batchSize = 10;
    let total = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Batch ${Math.floor(i/batchSize)+1}: ${batch.length} chunks`);

      const embeddings = await generateEmbeddings(batch);

      const toInsert = batch.map((c, idx) => ({
        source_id: sourceId,
        content: c,
        embedding: JSON.stringify(embeddings[idx]),
        chunk_index: startingChunkIndex + i + idx,
        metadata: { char_count: c.length },
      }));

      const { error: insertError } = await supabase.from('knowledge_chunks').insert(toInsert);
      if (insertError) throw new Error(`Erro ao salvar: ${insertError.message}`);

      total += batch.length;
      console.log(`Progresso: ${total}/${chunks.length}`);
    }

    // Total inclui chunks existentes (modo continuação) + novos
    const finalTotal = existingChunksCount + total;

    await supabase.from('knowledge_sources').update({
      status: 'ready',
      total_chunks: finalTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', sourceId);

    console.log('Concluído:', finalTotal, 'chunks totais,', total, 'novos');
    return new Response(JSON.stringify({
      success: true,
      chunks: finalTotal,
      newChunks: total,
      existingChunks: existingChunksCount,
      status: 'ready',
      continueMode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro:', error);

    try {
      const body = await req.clone().json();
      if (body.sourceId) {
        await supabase.from('knowledge_sources').update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Erro',
          updated_at: new Date().toISOString(),
        }).eq('id', body.sourceId);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
