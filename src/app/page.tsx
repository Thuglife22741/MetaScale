"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { FilterPills } from '@/components/dashboard/FilterPills';
import { CampaignCard } from '@/components/dashboard/CampaignCard';
import { SummaryHeader } from '@/components/dashboard/SummaryHeader';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { ClaudeAdsHealth } from '@/components/dashboard/ClaudeAdsHealth';
import { Campaign, AIDiagnostic } from '@/types';

interface MetaAccount {
  id: string;
  name: string;
  currency: string;
}

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState('Todas');
  const [isSyncing, setIsSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, AIDiagnostic>>({});
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState({ done: 0, total: 0 });

  // Dispara a análise de IA (Claude) para cada campanha em paralelo, sem bloquear o render.
  const fetchDiagnostics = useCallback(async (list: Campaign[]) => {
    const withMetrics = list.filter((c) => c.metrics);
    setIsAuditing(true);
    setAuditProgress({ done: 0, total: withMetrics.length });
    try {
      await Promise.all(
        withMetrics.map(async (c) => {
          try {
            const res = await fetch('/api/ai/diagnostic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ campaignName: c.nome, metrics: c.metrics }),
            });
            const data = await res.json();
            if (data.success && data.diagnostic) {
              setDiagnostics((prev) => ({
                ...prev,
                [c.id]: {
                  id: `diag-${c.id}`,
                  campaign_id: c.id,
                  metrics_id: c.metrics!.id,
                  data: new Date().toISOString(),
                  gargalo: data.diagnostic.gargalo ?? 'nenhum',
                  diagnostico: data.diagnostic.diagnostico ?? '',
                  recomendacoes: data.diagnostic.recomendacoes ?? [],
                  prioridade: data.diagnostic.recomendacoes?.[0]?.prioridade ?? 'media',
                  criado_em: new Date().toISOString(),
                },
              }));
            }
          } catch {
            // Falha silenciosa por campanha — o card mostra "Analisando...".
          } finally {
            setAuditProgress((p) => ({ ...p, done: p.done + 1 }));
          }
        })
      );
    } finally {
      setIsAuditing(false);
    }
  }, []);

  // Botão "Rodar Auditoria Completa" — re-analisa todas as campanhas com IA.
  const handleRunAudit = useCallback(() => {
    if (campaigns.length > 0) void fetchDiagnostics(campaigns);
  }, [campaigns, fetchDiagnostics]);

  // Botão "Exportar Relatório PDF" — usa a impressão do navegador (Salvar como PDF).
  const handleExportPDF = useCallback(() => {
    if (typeof window !== 'undefined') window.print();
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    setDiagnostics({});
    try {
      const res = await fetch('/api/meta/sync?range=last_30d', { method: 'GET' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao sincronizar com a Meta Ads.');
      }
      const list: Campaign[] = data.campaigns || [];
      setCampaigns(list);
      setAccount(data.account || null);
      setLastSync(data.synced_at || new Date().toISOString());
      // Análise de IA em background (não aguarda para liberar o dashboard).
      void fetchDiagnostics(list);
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido ao sincronizar.');
      setCampaigns([]);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDiagnostics]);

  // Sincroniza automaticamente ao abrir o dashboard.
  useEffect(() => {
    handleSync();
  }, [handleSync]);

  const filteredCampaigns = campaigns.filter(c => {
    if (activeFilter === 'Todas') return true;
    if (activeFilter === 'Escaláveis') return c.metrics?.escala_status === 'escalavel';
    if (activeFilter === 'Otimizar') return c.metrics?.escala_status === 'otimizar';
    if (activeFilter === 'Não Escalar') return c.metrics?.escala_status === 'nao_escalar';
    return true;
  });

  // Calcular métricas agregadas para o topo
  const aggregateMetrics = filteredCampaigns.reduce((acc, curr) => {
    const m = curr.metrics;
    if (!m) return acc;
    return {
      investimento: acc.investimento + m.valor_gasto,
      impressoes: acc.impressoes + m.impressoes,
      cliques: acc.cliques + m.cliques_link,
      views: acc.views + m.landing_page_views,
      checkouts: acc.checkouts + m.checkouts_iniciados,
      vendas: acc.vendas + m.compras,
      faturamento: acc.faturamento + m.valor_conversao,
    };
  }, { investimento: 0, impressoes: 0, cliques: 0, views: 0, checkouts: 0, vendas: 0, faturamento: 0 });

  const summaryData = {
    investimento: aggregateMetrics.investimento,
    cpa: aggregateMetrics.vendas > 0 ? aggregateMetrics.investimento / aggregateMetrics.vendas : 0,
    roas: aggregateMetrics.investimento > 0 ? aggregateMetrics.faturamento / aggregateMetrics.investimento : 0,
    vendas: aggregateMetrics.vendas,
    faturamento: aggregateMetrics.faturamento
  };

  const funnelData = {
    impressoes: aggregateMetrics.impressoes,
    cliques: aggregateMetrics.cliques,
    views: aggregateMetrics.views,
    checkouts: aggregateMetrics.checkouts,
    vendas: aggregateMetrics.vendas,
    ctr: aggregateMetrics.impressoes > 0 ? (aggregateMetrics.cliques / aggregateMetrics.impressoes) * 100 : 0,
    connectRate: aggregateMetrics.cliques > 0 ? aggregateMetrics.views / aggregateMetrics.cliques : 0,
    lpConv: aggregateMetrics.views > 0 ? aggregateMetrics.checkouts / aggregateMetrics.views : 0,
    chkConv: aggregateMetrics.checkouts > 0 ? aggregateMetrics.vendas / aggregateMetrics.checkouts : 0,
    globalConv: aggregateMetrics.impressoes > 0 ? aggregateMetrics.vendas / aggregateMetrics.impressoes : 0,
    cpc: aggregateMetrics.cliques > 0 ? aggregateMetrics.investimento / aggregateMetrics.cliques : 0,
    cpv: aggregateMetrics.views > 0 ? aggregateMetrics.investimento / aggregateMetrics.views : 0,
    cpc_chk: aggregateMetrics.checkouts > 0 ? aggregateMetrics.investimento / aggregateMetrics.checkouts : 0,
    cpa: aggregateMetrics.vendas > 0 ? aggregateMetrics.investimento / aggregateMetrics.vendas : 0,
  };

  // Score de saúde (0-100) derivado das métricas reais agregadas.
  const healthScore = (() => {
    if (aggregateMetrics.impressoes === 0) return 0;
    const roas = summaryData.roas;
    const connectRate = funnelData.connectRate;
    const linkCtr = aggregateMetrics.impressoes > 0 ? aggregateMetrics.cliques / aggregateMetrics.impressoes : 0;
    const chkConv = funnelData.chkConv;
    const lpConv = funnelData.lpConv;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const score =
      clamp(roas / 3) * 40 +          // ROAS alvo 3x
      clamp(connectRate / 0.8) * 20 + // Connect rate alvo 80%
      clamp(linkCtr / 0.025) * 15 +   // CTR link alvo 2.5%
      clamp(chkConv / 0.1) * 15 +     // Conv. checkout alvo 10%
      clamp(lpConv / 0.1) * 10;       // Conv. LP alvo 10%
    return Math.round(score);
  })();

  return (
    <div className="pb-10 max-w-[1400px] mx-auto px-4">
      <TopBar
        title="Performance Overview"
        subtitle={account ? `${account.name} · ${account.currency} · dados reais Meta Ads (30d)` : 'Sincronizando com a Meta Ads...'}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Erro ao sincronizar: {error}
        </div>
      )}

      {!error && !isSyncing && campaigns.length === 0 && (
        <div className="mt-4 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-4 py-3 text-sm text-[#8B8BA0]">
          Nenhuma campanha encontrada nesta conta de anúncios.
        </div>
      )}

      {/* Seção de Cards de Sumário */}
      <div className="mt-8 mb-6">
        <SummaryHeader metrics={summaryData} />
      </div>

      {/* Seção Principal: Funil e Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        <div className="lg:col-span-8">
          <ConversionFunnel metrics={funnelData} />
        </div>
        
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#1A1A24] border border-[#2A2A38] rounded-xl p-6 flex-1 flex flex-col hover:border-[#6366F1]/30 transition-all group">
            <h3 className="text-[#F1F1F3] font-bold text-lg mb-4">Distribuição de Verba</h3>
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[#F1F1F3] text-sm font-medium">Conversão</span>
                  <span className="text-[#6366F1] text-xs font-bold">85%</span>
                </div>
                <div className="h-2 w-full bg-[#2A2A38] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#4338CA] to-[#6366F1] w-[85%] rounded-full group-hover:brightness-110 transition-all" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[#F1F1F3] text-sm font-medium">Tráfego</span>
                  <span className="text-[#10B981] text-xs font-bold">10%</span>
                </div>
                <div className="h-2 w-full bg-[#2A2A38] rounded-full overflow-hidden">
                  <div className="h-full bg-[#10B981] w-[10%] rounded-full group-hover:brightness-110 transition-all" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[#F1F1F3] text-sm font-medium">Outros</span>
                  <span className="text-[#F59E0B] text-xs font-bold">5%</span>
                </div>
                <div className="h-2 w-full bg-[#2A2A38] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F59E0B] w-[5%] rounded-full group-hover:brightness-110 transition-all" />
                </div>
              </div>
            </div>
          </div>

          <ClaudeAdsHealth
            score={healthScore}
            onRunAudit={handleRunAudit}
            isAuditing={isAuditing}
            auditProgress={auditProgress}
            onExportPDF={handleExportPDF}
          />
        </div>
      </div>

      {/* Listagem de Campanhas */}
      <div className="flex items-center justify-between mb-6 pt-6 border-t border-[#2A2A38]">
        <div>
          <h2 className="text-2xl font-bold text-[#F1F1F3]">Campanhas Individuais</h2>
          <p className="text-[#8B8BA0] text-sm">Detalhamento por conjunto de anúncio e criativos</p>
        </div>
        <FilterPills 
          filters={['Todas', 'Escaláveis', 'Otimizar', 'Não Escalar']}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredCampaigns.map(campaign => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            diagnostic={diagnostics[campaign.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
