import type {
  Campaign,
  CampaignMetrics,
  EscalaStatus,
  BreakdownRow,
  BreakdownStatus,
  CampaignAnalysis,
} from '@/types';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // Deve ser preenchido no .env.local
const GRAPH_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaAccountInfo {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
}

/**
 * Verifica se as credenciais da Meta estão presentes no ambiente.
 */
export function hasMetaCredentials(): boolean {
  return Boolean(META_ACCESS_TOKEN && AD_ACCOUNT_ID);
}

/**
 * Busca os metadados da conta de anúncios (nome, moeda, status).
 */
export async function fetchAccountInfo(): Promise<MetaAccountInfo | null> {
  if (!hasMetaCredentials()) {
    console.error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurado');
    return null;
  }

  try {
    const url = `${GRAPH_BASE}/${AD_ACCOUNT_ID}?fields=name,account_status,currency,timezone_name&access_token=${META_ACCESS_TOKEN}`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    return {
      id: data.id,
      name: data.name,
      currency: data.currency,
      timezone_name: data.timezone_name,
      account_status: data.account_status,
    };
  } catch (error) {
    console.error('Erro ao buscar dados da conta Meta:', error);
    return null;
  }
}

export async function fetchMetaCampaigns() {
  if (!hasMetaCredentials()) {
    console.error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurado');
    return [];
  }

  try {
    const response = await fetch(
      `${GRAPH_BASE}/${AD_ACCOUNT_ID}/campaigns?fields=id,name,status,objective&limit=200&access_token=${META_ACCESS_TOKEN}`,
      { cache: 'no-store' }
    );
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('Erro ao buscar campanhas da Meta:', error);
    return [];
  }
}

// --- Insights → CampaignMetrics -------------------------------------------

interface MetaAction {
  action_type: string;
  value: string;
}

/** Soma os valores de uma lista de actions para um dado action_type. */
function actionVal(actions: MetaAction[] | undefined, type: string): number {
  if (!actions) return 0;
  const found = actions.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) || 0 : 0;
}

/** Deriva o status de escala a partir de ROAS e volume de compras. */
function computeEscalaStatus(roas: number, compras: number): EscalaStatus {
  if (compras >= 1 && roas >= 2) return 'escalavel';
  if (roas >= 1) return 'otimizar';
  return 'nao_escalar';
}

/** Converte um objeto insight bruto da Graph API em CampaignMetrics. */
function mapInsightToMetrics(insight: any, campaignId: string): CampaignMetrics {
  const impressoes = parseInt(insight.impressions, 10) || 0;
  const alcance = parseInt(insight.reach, 10) || 0;
  const frequencia = parseFloat(insight.frequency) || 0;
  const valor_gasto = parseFloat(insight.spend) || 0;
  const cpm = parseFloat(insight.cpm) || 0;

  const cliques_link = actionVal(insight.actions, 'link_click');
  const landing_page_views = actionVal(insight.actions, 'landing_page_view');
  const checkouts_iniciados = actionVal(insight.actions, 'initiate_checkout');
  const compras = actionVal(insight.actions, 'purchase');
  const valor_conversao = actionVal(insight.action_values, 'purchase');

  // CTR e CPC baseados em cliques de link (mais relevantes que all-clicks).
  const ctr = impressoes > 0 ? (cliques_link / impressoes) * 100 : 0;
  const cpc = cliques_link > 0 ? valor_gasto / cliques_link : 0;
  const roas = valor_gasto > 0 ? valor_conversao / valor_gasto : 0;
  const cpa = compras > 0 ? valor_gasto / compras : 0;

  const connect_rate = cliques_link > 0 ? landing_page_views / cliques_link : 0;
  const conversao_lp = landing_page_views > 0 ? checkouts_iniciados / landing_page_views : 0;
  const conversao_checkout = checkouts_iniciados > 0 ? compras / checkouts_iniciados : 0;
  const conversao_global = impressoes > 0 ? compras / impressoes : 0;

  return {
    id: `${campaignId}-${insight.date_stop || 'current'}`,
    campaign_id: campaignId,
    data: insight.date_stop || new Date().toISOString(),
    impressoes,
    alcance,
    frequencia,
    cliques_link,
    ctr,
    cpc,
    cpm,
    valor_gasto,
    landing_page_views,
    checkouts_iniciados,
    compras,
    valor_conversao,
    roas,
    cpa,
    connect_rate,
    conversao_lp,
    conversao_checkout,
    conversao_global,
    escala_status: computeEscalaStatus(roas, compras),
    criado_em: new Date().toISOString(),
  };
}

/**
 * Busca insights de todas as campanhas em uma única chamada e indexa por campaign_id.
 */
async function fetchInsightsByCampaign(
  datePreset: string
): Promise<Record<string, any>> {
  const fields = [
    'campaign_id',
    'campaign_name',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'spend',
    'actions',
    'action_values',
  ].join(',');

  const url = `${GRAPH_BASE}/${AD_ACCOUNT_ID}/insights?level=campaign&date_preset=${datePreset}&fields=${fields}&limit=200&access_token=${META_ACCESS_TOKEN}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const byId: Record<string, any> = {};
  for (const insight of data.data || []) {
    byId[insight.campaign_id] = insight;
  }
  return byId;
}

/**
 * Retorna todas as campanhas da conta já enriquecidas com suas métricas reais.
 * Esta é a função consumida pelo dashboard para sincronizar com a Meta.
 */
export async function fetchCampaignsWithMetrics(
  datePreset: string = 'last_30d'
): Promise<Campaign[]> {
  if (!hasMetaCredentials()) {
    console.error('Credenciais Meta ausentes no .env.local');
    return [];
  }

  const [campaigns, insightsById] = await Promise.all([
    fetchMetaCampaigns(),
    fetchInsightsByCampaign(datePreset).catch((err) => {
      console.error('Erro ao buscar insights da Meta:', err);
      return {} as Record<string, any>;
    }),
  ]);

  return (campaigns || []).map((c: any): Campaign => {
    const insight = insightsById[c.id];
    return {
      id: c.id,
      ad_account_id: AD_ACCOUNT_ID as string,
      meta_campaign_id: c.id,
      nome: c.name,
      status: c.status,
      objetivo: c.objective,
      ativo: c.status === 'ACTIVE',
      criado_em: new Date().toISOString(),
      metrics: insight ? mapInsightToMetrics(insight, c.id) : undefined,
    };
  });
}

// --- Análise Profunda: quebras por conjunto / posicionamento / público ------

const ANALYSIS_FIELDS = 'spend,impressions,clicks,actions,action_values';

/** Classifica uma linha de quebra em escalar / otimizar / pausar. */
function classify(roas: number, compras: number, spend: number): BreakdownStatus {
  if (roas >= 2 && compras >= 1) return 'escalar';
  if (spend >= 50 && roas < 1) return 'pausar';
  return 'otimizar';
}

/** Converte um insight bruto (de qualquer quebra) numa linha padronizada. */
function mapBreakdownRow(insight: any, label: string): BreakdownRow {
  const spend = parseFloat(insight.spend) || 0;
  const impressoes = parseInt(insight.impressions, 10) || 0;
  const compras = actionVal(insight.actions, 'purchase');
  const faturamento = actionVal(insight.action_values, 'purchase');
  const lp_views = actionVal(insight.actions, 'landing_page_view');
  const checkouts = actionVal(insight.actions, 'initiate_checkout');
  const roas = spend > 0 ? faturamento / spend : 0;
  const cpa = compras > 0 ? spend / compras : 0;
  return {
    label,
    spend,
    impressoes,
    compras,
    faturamento,
    roas,
    cpa,
    lp_views,
    checkouts,
    status: classify(roas, compras, spend),
  };
}

async function fetchInsightRows(campaignId: string, query: string): Promise<any[]> {
  const url = `${GRAPH_BASE}/${campaignId}/insights?${query}&access_token=${META_ACCESS_TOKEN}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

/**
 * Puxa as quebras de uma campanha (conjunto, posicionamento, público) e devolve
 * linhas já com ROAS/CPA e classificação, ordenadas por gasto.
 */
export async function fetchCampaignAnalysis(
  campaignId: string,
  datePreset: string = 'last_30d'
): Promise<CampaignAnalysis> {
  if (!hasMetaCredentials()) {
    throw new Error('Credenciais Meta ausentes no .env.local');
  }

  const [adsetRaw, placeRaw, ageRaw] = await Promise.all([
    fetchInsightRows(
      campaignId,
      `level=adset&date_preset=${datePreset}&fields=adset_name,${ANALYSIS_FIELDS}&limit=300`
    ),
    fetchInsightRows(
      campaignId,
      `date_preset=${datePreset}&breakdowns=publisher_platform,platform_position&fields=${ANALYSIS_FIELDS}&limit=300`
    ),
    fetchInsightRows(
      campaignId,
      `date_preset=${datePreset}&breakdowns=age,gender&fields=${ANALYSIS_FIELDS}&limit=300`
    ),
  ]);

  const byAdset = adsetRaw
    .map((r) => mapBreakdownRow(r, r.adset_name || 'Conjunto'))
    .sort((a, b) => b.spend - a.spend);
  const byPlacement = placeRaw
    .map((r) => mapBreakdownRow(r, `${r.publisher_platform} / ${r.platform_position}`))
    .sort((a, b) => b.spend - a.spend);
  const byAge = ageRaw
    .map((r) => mapBreakdownRow(r, `${r.age} · ${r.gender}`))
    .sort((a, b) => b.spend - a.spend);

  return { byAdset, byPlacement, byAge };
}

/**
 * Cria uma campanha de teste para validar permissões de escrita
 */
export async function createTestCampaign() {
  if (!META_ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    throw new Error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID ausente no .env.local');
  }

  const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns`;
  
  const params = new URLSearchParams({
    name: 'Teste IA Antigravity - Campanha de Curtidas',
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: '[]',
    is_adset_budget_sharing_enabled: 'false',
    access_token: META_ACCESS_TOKEN
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, campaign_id: data.id };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

/**
 * Cria um conjunto de anúncios (AdSet)
 */
export async function createAdSet(campaignId: string, name: string, dailyBudget: number) {
  if (!META_ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    throw new Error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID ausente no .env.local');
  }

  const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adsets`;
  
  // Meta API espera orçamento em centavos (ex: 5.00 -> 500)
  const budgetInCents = Math.round(dailyBudget * 100);

  const params = new URLSearchParams({
    name: name,
    campaign_id: campaignId,
    daily_budget: budgetInCents.toString(),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    bid_amount: '100', // Bid de R$ 1,00 como exemplo
    targeting: JSON.stringify({
      geo_locations: { countries: ['BR'] },
      publisher_platforms: ['facebook', 'instagram']
    }),
    status: 'PAUSED',
    access_token: META_ACCESS_TOKEN
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, adset_id: data.id };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

/**
 * Cria um criativo básico (necessário para o anúncio)
 * Nota: Geralmente requer um ID de página e uma imagem/vídeo.
 * Como o usuário quer subir manual, tentaremos criar um rascunho.
 */
export async function createAdCreative(name: string, pageId: string) {
  if (!META_ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    throw new Error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID ausente no .env.local');
  }

  const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`;
  
  const params = new URLSearchParams({
    name: name,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      link_data: {
        message: 'Draft Ad - Finalize no Gerenciador',
        link: 'https://facebook.com', // URL placeholder
        name: 'Anúncio MetaScale'
      }
    }),
    access_token: META_ACCESS_TOKEN
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, creative_id: data.id };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

/**
 * Cria o objeto do anúncio (Ad)
 */
export async function createAd(adsetId: string, creativeId: string, name: string) {
  if (!META_ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    throw new Error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID ausente no .env.local');
  }

  const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads`;
  
  const params = new URLSearchParams({
    name: name,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: 'PAUSED',
    access_token: META_ACCESS_TOKEN
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, ad_id: data.id };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}
