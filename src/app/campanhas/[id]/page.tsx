"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Bell, User, RefreshCw, Save, Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { MetaMetricsGrid } from '@/components/campaigns/MetaMetricsGrid';
import { FunnelBars } from '@/components/campaigns/FunnelBars';
import { AIAnalyst } from '@/components/campaigns/AIAnalyst';
import { TrendChart } from '@/components/campaigns/TrendChart';
import { DeepAnalysis } from '@/components/campaigns/DeepAnalysis';
import { Campaign, AIDiagnostic, CampaignAnalysis, DeepDiagnostic } from '@/types';

interface MetaAccount {
  id: string;
  name: string;
  currency: string;
}

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  const campaignId = params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [diagnostic, setDiagnostic] = useState<AIDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null);
  const [deep, setDeep] = useState<DeepDiagnostic | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDiagnostic(null);
    try {
      const res = await fetch('/api/meta/sync?range=last_30d', { method: 'GET' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao sincronizar com a Meta Ads.');
      }

      setAccount(data.account || null);
      const found: Campaign | undefined = (data.campaigns || []).find(
        (c: Campaign) => c.id === campaignId
      );

      if (!found) {
        setCampaign(null);
        setError('Campanha não encontrada nesta conta de anúncios.');
        return;
      }
      setCampaign(found);

      // Diagnóstico de IA em background (não bloqueia o render das métricas).
      if (found.metrics) {
        fetch('/api/ai/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignName: found.nome, metrics: found.metrics }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.diagnostic) {
              setDiagnostic({
                id: `diag-${found.id}`,
                campaign_id: found.id,
                metrics_id: found.metrics!.id,
                data: new Date().toISOString(),
                gargalo: d.diagnostic.gargalo ?? 'nenhum',
                diagnostico: d.diagnostic.diagnostico ?? '',
                recomendacoes: d.diagnostic.recomendacoes ?? [],
                prioridade: d.diagnostic.recomendacoes?.[0]?.prioridade ?? 'media',
                criado_em: new Date().toISOString(),
              });
            }
          })
          .catch(() => {
            /* falha silenciosa — AIAnalyst mostra "Gerando diagnóstico..." */
          });
      }
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido ao sincronizar.');
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  // Salva a análise da IA no projeto (arquivo JSON) e no Supabase.
  const handleSaveDiagnostic = useCallback(async () => {
    if (!campaign || !diagnostic) return;
    setSaveState('saving');
    setSaveMsg(null);
    try {
      const res = await fetch('/api/diagnostics/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_campaign_id: campaign.meta_campaign_id,
          campaign_nome: campaign.nome,
          gargalo: diagnostic.gargalo,
          diagnostico: diagnostic.diagnostico,
          recomendacoes: diagnostic.recomendacoes,
          prioridade: diagnostic.prioridade,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar a análise.');
      }
      setSaveState('saved');
      setSaveMsg(
        data.supabase
          ? 'Salvo no projeto e no Supabase ✓'
          : `Salvo no arquivo do projeto ✓${data.supabaseError ? ` · Supabase pendente (${data.supabaseError})` : ''}`
      );
      setTimeout(() => setSaveState('idle'), 5000);
    } catch (err: any) {
      setSaveState('error');
      setSaveMsg(err?.message || 'Erro ao salvar.');
    }
  }, [campaign, diagnostic]);

  // Análise Profunda: puxa as quebras da Meta e roda a IA de media buying.
  const handleRunDeep = useCallback(async () => {
    if (!campaign) return;
    setDeepLoading(true);
    setDeepError(null);
    setDeep(null);
    try {
      const res = await fetch(
        `/api/meta/analysis?campaignId=${campaign.meta_campaign_id}&range=last_30d`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha na análise profunda.');
      const a: CampaignAnalysis = {
        byAdset: data.byAdset || [],
        byPlacement: data.byPlacement || [],
        byAge: data.byAge || [],
      };
      setAnalysis(a);
      setDeepLoading(false);

      // IA de media buying sobre as quebras (não bloqueia as tabelas).
      setAiLoading(true);
      try {
        const air = await fetch('/api/ai/deep-diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignName: campaign.nome, analysis: a }),
        });
        const aid = await air.json();
        if (aid.success && aid.diagnostic) setDeep(aid.diagnostic);
      } catch {
        /* IA falhou — tabelas continuam visíveis */
      } finally {
        setAiLoading(false);
      }
    } catch (err: any) {
      setDeepError(err?.message || 'Erro ao rodar a análise profunda.');
      setDeepLoading(false);
    }
  }, [campaign]);

  const m = campaign?.metrics;

  return (
    <div className="flex flex-col min-h-screen pb-10">
      {/* TopBar */}
      <header className="flex items-center justify-between pb-4 border-b border-[#2A2A38] mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-[15px] font-medium text-[#F1F1F3]">Campaign Detail</h2>
          <span className="text-[#2A2A38]">|</span>
          <p className="text-[13px] text-[#8B8BA0]">
            {account ? `${account.name} · ${account.id}` : 'Sincronizando...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full border border-[#2A2A38] flex items-center justify-center text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24]">
            <User size={14} />
          </button>
          <button className="w-8 h-8 rounded-full border border-[#2A2A38] flex items-center justify-center text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24]">
            <Bell size={14} />
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4f52e2] text-white px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Sync Data
          </button>
        </div>
      </header>

      <div className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#8B8BA0] hover:text-[#F1F1F3] transition-colors mb-2"
        >
          <ChevronLeft size={14} />
          Voltar ao Dashboard
        </Link>

        {/* Loading */}
        {loading && !campaign && (
          <div className="flex items-center justify-center min-h-[300px] text-[#8B8BA0] text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            Sincronizando dados reais da campanha...
          </div>
        )}

        {/* Erro / não encontrada */}
        {!loading && error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}{' '}
            <Link href="/" className="underline hover:text-red-200">
              Voltar ao Dashboard
            </Link>
          </div>
        )}

        {/* Conteúdo real */}
        {campaign && m && (
          <>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-[22px] font-bold text-[#F1F1F3]">{campaign.nome}</h1>
                  <Badge status={m.escala_status} />
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-[#8B8BA0]">
                  <span className="px-2.5 py-1 rounded-full bg-[#1A1A24] border border-[#2A2A38]">
                    ID: {campaign.meta_campaign_id}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#1A1A24] border border-[#2A2A38]">
                    Meta Ads Network
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#1A1A24] border border-[#2A2A38]">
                    Objetivo: {campaign.objetivo}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#1A1A24] border border-[#2A2A38]">
                    Status: {campaign.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="bg-transparent border border-[#2A2A38] text-[#F1F1F3] px-4 py-1.5 rounded-md text-[13px] font-medium hover:bg-[#1A1A24] transition-colors">
                  Editar
                </button>
                <button className="bg-[#6366F1] hover:bg-[#4f52e2] text-white px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors">
                  Forçar Escala
                </button>
              </div>
            </div>

            <MetaMetricsGrid metrics={m} />

            {/* Barra de ação: salvar a análise da IA no projeto */}
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {saveMsg && (
                <span
                  className={`text-[11px] ${
                    saveState === 'error' ? 'text-red-400' : 'text-[#22C55E]'
                  }`}
                >
                  {saveMsg}
                </span>
              )}
              <button
                onClick={handleSaveDiagnostic}
                disabled={!diagnostic || saveState === 'saving'}
                title={!diagnostic ? 'Aguardando o diagnóstico da IA' : 'Salvar esta análise no projeto'}
                className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4f52e2] text-white px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveState === 'saving' ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : saveState === 'saved' ? (
                  <>
                    <Check size={14} />
                    Análise salva
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Salvar análise
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
              <FunnelBars metrics={m} />
              <AIAnalyst diagnostic={diagnostic} />
            </div>

            <TrendChart />

            <DeepAnalysis
              analysis={analysis}
              deep={deep}
              loading={deepLoading}
              aiLoading={aiLoading}
              error={deepError}
              onRun={handleRunDeep}
            />
          </>
        )}
      </div>
    </div>
  );
}
