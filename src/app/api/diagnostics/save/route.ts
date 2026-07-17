import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), 'analises-ia');
const FILE_PATH = path.join(DATA_DIR, 'diagnosticos.json');

/** Slug seguro para nome de arquivo (sem acentos/símbolos). */
function slugify(s: string): string {
  return s
    .normalize('NFD') // decompõe acentos: "á" -> "a" + diacrítico
    .replace(/[^\x00-\x7F]/g, '') // remove tudo que não é ASCII (os diacríticos)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Monta o markdown legível de uma análise (arrastável para o chat). */
function toMarkdown(r: SavedDiagnostic): string {
  const recs = (r.recomendacoes as any[])
    .map((rec, i) => {
      const p = (rec?.prioridade || '').toUpperCase();
      const txt = rec?.texto ?? String(rec);
      return `${i + 1}. ${p ? `**[${p}]** ` : ''}${txt}`;
    })
    .join('\n');
  return `# 🧠 Análise de IA — ${r.campaign_nome || r.meta_campaign_id}

- **Campanha (Meta ID):** ${r.meta_campaign_id}
- **Gargalo:** ${r.gargalo}
- **Prioridade:** ${r.prioridade}
- **Salvo em:** ${new Date(r.salvo_em).toLocaleString('pt-BR')}

## Diagnóstico

${r.diagnostico}

## Recomendações

${recs || '_(sem recomendações)_'}
`;
}

interface SavedDiagnostic {
  meta_campaign_id: string;
  campaign_nome: string;
  gargalo: string;
  diagnostico: string;
  recomendacoes: unknown[];
  prioridade: string;
  salvo_em: string;
}

async function readFileSafe(): Promise<SavedDiagnostic[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // arquivo ainda não existe
  }
}

/** Salva a análise de IA de uma campanha: no arquivo JSON do projeto e no Supabase. */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const { meta_campaign_id, campaign_nome, gargalo, diagnostico, recomendacoes, prioridade } = body || {};
  if (!meta_campaign_id || !diagnostico) {
    return NextResponse.json(
      { success: false, error: 'meta_campaign_id e diagnostico são obrigatórios.' },
      { status: 400 }
    );
  }

  const record: SavedDiagnostic = {
    meta_campaign_id: String(meta_campaign_id),
    campaign_nome: campaign_nome ?? '',
    gargalo: gargalo ?? 'nenhum',
    diagnostico: String(diagnostico),
    recomendacoes: Array.isArray(recomendacoes) ? recomendacoes : [],
    prioridade: prioridade ?? 'media',
    salvo_em: new Date().toISOString(),
  };

  // 1) Arquivos no projeto (pasta analises-ia/):
  //    - diagnosticos.json: todas as análises (upsert por campanha)
  //    - <campanha>_<id>.md: análise legível, arrastável para o chat
  let fileOk = false;
  let fileError: string | undefined;
  let mdFile: string | undefined;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const list = await readFileSafe();
    const idx = list.findIndex((d) => d.meta_campaign_id === record.meta_campaign_id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    await fs.writeFile(FILE_PATH, JSON.stringify(list, null, 2), 'utf8');

    const nome = slugify(record.campaign_nome) || 'campanha';
    mdFile = `${nome}_${record.meta_campaign_id}.md`;
    await fs.writeFile(path.join(DATA_DIR, mdFile), toMarkdown(record), 'utf8');

    fileOk = true;
  } catch (e: any) {
    fileError = e?.message || 'Falha ao gravar o arquivo.';
  }

  // 2) Supabase (ai_diagnostics) via service-role — histórico persistente.
  let supabaseOk = false;
  let supabaseError: string | undefined;
  const admin = getSupabaseAdmin();
  if (!admin) {
    supabaseError = 'Supabase service-role não configurado.';
  } else {
    const { error } = await admin.from('ai_diagnostics').insert({
      data: new Date().toISOString().slice(0, 10), // coluna date NOT NULL
      meta_campaign_id: record.meta_campaign_id,
      campaign_nome: record.campaign_nome,
      gargalo: record.gargalo,
      diagnostico: record.diagnostico,
      recomendacoes: record.recomendacoes,
      prioridade: record.prioridade,
    });
    if (error) {
      supabaseError = error.message; // ex.: coluna inexistente => rodar a migração
    } else {
      supabaseOk = true;
    }
  }

  // Sucesso se ao menos o arquivo foi salvo.
  return NextResponse.json({
    success: fileOk || supabaseOk,
    file: fileOk,
    fileError,
    supabase: supabaseOk,
    supabaseError,
  });
}
