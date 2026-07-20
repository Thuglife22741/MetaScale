import { NextResponse } from 'next/server';
import { callOptimizationPlan } from '@/lib/anthropic';
import { fetchCampaignAnalysis } from '@/lib/meta-api';
import type { CampaignAnalysis } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const campaign = body?.campaign;
    const diagnostic = body?.diagnostic;
    const deep = body?.deep ?? null;
    // Janela de data para a busca-fallback das quebras (mesmo formato das outras rotas).
    const since = body?.since as string | undefined;
    const until = body?.until as string | undefined;
    const preset = (body?.range as string | undefined) || 'last_30d';

    if (!campaign || !campaign.meta_campaign_id) {
      return NextResponse.json({ success: false, error: 'Objeto campaign é obrigatório' }, { status: 400 });
    }

    const m = campaign.metrics;
    if (!m) {
      return NextResponse.json({ success: false, error: 'Campanha sem métricas' }, { status: 400 });
    }

    // Quebras da Análise Profunda: usa as enviadas pelo cliente ou busca no servidor.
    // Assim o plano fica SEMPRE ancorado no que a Análise Profunda identificou.
    let analysis: CampaignAnalysis | null = body?.analysis ?? null;
    const temQuebras =
      analysis && (analysis.byPlacement?.length || analysis.byAge?.length || analysis.byAdset?.length);
    if (!temQuebras) {
      try {
        const date = since && until ? { since, until } : { preset };
        analysis = await fetchCampaignAnalysis(campaign.meta_campaign_id, date);
      } catch (e) {
        console.error('[plan] não consegui buscar quebras (segue só com métricas):', e);
        analysis = null;
      }
    }

    const plano = await callOptimizationPlan(
      campaign.nome,
      campaign.objetivo,
      campaign.ativo,
      {
        impressoes: m.impressoes,
        cliques_link: m.cliques_link,
        ctr_pct: m.ctr,
        cpc: m.cpc,
        cpm: m.cpm,
        valor_gasto: m.valor_gasto,
        landing_page_views: m.landing_page_views,
        connect_rate: m.connect_rate,
        checkouts_iniciados: m.checkouts_iniciados,
        compras: m.compras,
        roas: m.roas,
        cpa: m.cpa,
        escala_status: m.escala_status,
      },
      diagnostic,
      analysis,
      deep
    );

    const registro = {
      id: 'local-' + Date.now(),
      meta_campaign_id: campaign.meta_campaign_id,
      status: 'pendente',
      resumo: plano?.resumo || '',
      plano,
      modelo: 'claude-opus-4-8',
    };

    return NextResponse.json({ success: true, plano: registro });
  } catch (err: any) {
    console.error('[api/meta/optimize/plan] erro:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Falha ao gerar plano' }, { status: 500 });
  }
}
