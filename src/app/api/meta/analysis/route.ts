import { NextRequest, NextResponse } from 'next/server';
import { fetchCampaignAnalysis, hasMetaCredentials } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Análise Profunda de uma campanha: quebras por conjunto, posicionamento e público.
 * GET /api/meta/analysis?campaignId=<meta_id>&range=last_30d
 */
export async function GET(req: NextRequest) {
  if (!hasMetaCredentials()) {
    return NextResponse.json(
      { success: false, error: 'Credenciais Meta ausentes no .env.local.' },
      { status: 400 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const campaignId = sp.get('campaignId');
  const since = sp.get('since') || undefined;
  const until = sp.get('until') || undefined;
  const preset = sp.get('range') || 'last_30d';
  const date = since && until ? { since, until } : { preset };
  const range = since && until ? `${since}..${until}` : preset;
  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: 'Parâmetro campaignId é obrigatório.' },
      { status: 400 }
    );
  }

  try {
    const analysis = await fetchCampaignAnalysis(campaignId, date);
    return NextResponse.json({ success: true, range, ...analysis });
  } catch (error: any) {
    console.error('Falha na análise profunda:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro desconhecido na análise.' },
      { status: 502 }
    );
  }
}
