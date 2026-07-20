import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCampaignsWithMetrics,
  fetchAccountInfo,
  hasMetaCredentials,
} from '@/lib/meta-api';

// Sempre executar no servidor, sem cache (dados de anúncios são voláteis).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Sincroniza o dashboard com a conta de anúncios Meta configurada no .env.local.
 * Retorna os metadados da conta e todas as campanhas já enriquecidas com métricas reais.
 *
 * Query params:
 *   ?range=today | yesterday | last_7d | last_30d | last_90d | this_month | ...
 */
async function handle(req: NextRequest) {
  if (!hasMetaCredentials()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Credenciais Meta ausentes. Verifique META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no .env.local.',
      },
      { status: 400 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const since = sp.get('since') || undefined;
  const until = sp.get('until') || undefined;
  const preset = sp.get('range') || 'last_30d';
  const date = since && until ? { since, until } : { preset };
  const range = since && until ? `${since}..${until}` : preset;

  try {
    const [account, campaigns] = await Promise.all([
      fetchAccountInfo(),
      fetchCampaignsWithMetrics(date),
    ]);

    return NextResponse.json({
      success: true,
      account,
      range,
      count: campaigns.length,
      campaigns,
      synced_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Falha ao sincronizar com a Meta:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro desconhecido na sincronização.' },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
