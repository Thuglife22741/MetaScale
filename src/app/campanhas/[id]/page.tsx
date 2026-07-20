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
import { OptimizationPlan, OptimizationPlanRow } from '@/components/campaigns/OptimizationPlan';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Campaign, AIDiagnostic, CampaignAnalysis, DeepDiagnostic } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  RangeSelection,
  DEFAULT_RANGE,
  loadRange,
  saveRange,
  rangeToQuery,
  rangeLabel,
  isCustomValid,
} from '@/lib/date-range';

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
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null);
  const [deep, setDeep] = useState<DeepDiagnostic | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [plan, setPlan] = useState<OptimizationPlanRow | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [range, setRange] = useState<RangeSelection>(DEFAULT_RANGE);

  // Restaura a janela de data salva no navegador ao montar.
  useEffect(() => {
    setRange(loadRange());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDiagnostic(null);
    setDiagnosticError(null);
    try {
      const res = await fetch(`/api/meta/sync?${rangeToQuery(range)}`, { method: 'GET' });
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
            } else {
              setDiagnosticError(d.error || 'A IA não retornou um diagnóstico.');
            }
          })
          .catch((e) => {
            setDiagnosticError(e?.message || 'Erro de rede ao chamar a IA.');
          });
      }
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido ao sincronizar.');
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRangeChange = useCallback((sel: RangeSelection) => {
    saveRange(sel);
    setRange(sel);
    // Zera a análise profunda anterior (foi calculada com outra janela).
    setAnalysis(null);
    setDeep(null);
    setDeepError(null);
  }, []);

  // Salva a PÁGINA INTEIRA (métricas + funil + diagnóstico + Análise Profunda + Plano).
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
          objetivo: campaign.objetivo,
          status: campaign.status,
          account: account ? { name: account.name, id: account.id, currency: account.currency } : null,
          range_label: rangeLabel(range),
          // Métricas completas (o grid da página)
          metrics: campaign.metrics ?? null,
          // Diagnóstico do funil (raso)
          gargalo: diagnostic.gargalo,
          diagnostico: diagnostic.diagnostico,
          recomendacoes: diagnostic.recomendacoes,
          prioridade: diagnostic.prioridade,
          // Análise Profunda (quebras + media buyer)
          analysis: analysis ?? null,
          deep: deep ?? null,
          // Plano de Otimização (se gerado)
          plan: plan?.plano ?? null,
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
        `/api/meta/analysis?campaignId=${campaign.meta_campaign_id}&${rangeToQuery(range)}`
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
  }, [campaign, range]);

  // Ação de escrita: pausar um conjunto na conta real da Meta.
  const handlePauseAdset = useCallback(async (adsetId: string, _nome: string) => {
    try {
      const res = await fetch('/api/meta/adset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adsetId, status: 'PAUSED' }),
      });
      const data = await res.json();
      return { success: !!data.success, error: data.error };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erro de rede.' };
    }
  }, []);

  const handleGeneratePlan = async () => {
    if (!campaign) return;
    setIsGeneratingPlan(true);
    setError(null);
    try {
      const res = await fetch('/api/meta/optimize/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign,
          diagnostic,
          // Ancora o plano na Análise Profunda (quebras + leitura de media buyer).
          analysis,
          deep,
          // Janela de data p/ a busca-fallback das quebras no servidor.
          ...(isCustomValid(range)
            ? { since: range.since, until: range.until }
            : { range: range.preset }),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error || 'Falha ao gerar plano');
      else setPlan(json.plano);
    } catch (e: any) {
      setError(e?.message || 'Falha ao gerar plano');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleExecute = async () => {
    if (!plan || !campaign) return;
    if (!window.confirm('Criar a campanha otimizada em PAUSED na sua conta Meta? Nada vai gastar até você dar o play no Gerenciador.')) return;
    setIsExecuting(true);
    setError(null);
    try {
      const res = await fetch('/api/meta/optimize/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, campaign }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Falha na execução');
        setPlan({ ...plan, status: 'erro' });
      } else {
        setPlan({ ...plan, status: 'executado' });
      }
    } catch (e: any) {
      setError(e?.message || 'Falha na execução');
      setPlan({ ...plan, status: 'erro' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDecide = async (decisao: 'aprovar' | 'rejeitar') => {
    if (!plan) return;
    setIsDeciding(true);
    setError(null);
    try {
      // Sem precisar ir no backend: apenas muda o estado local!
      setPlan({ ...plan, status: decisao === 'aprovar' ? 'aprovado' : 'rejeitado' });
    } catch (e: any) {
      setError(e?.message || 'Falha ao registrar decisão');
    } finally {
      setIsDeciding(false);
    }
  };

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
          <DateRangePicker value={range} onChange={handleRangeChange} disabled={loading} />
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

              {/* Ação principal do cabeçalho: salvar a análise da IA no projeto */}
              <div className="flex items-center gap-3 flex-wrap justify-end">
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
            </div>

            <MetaMetricsGrid metrics={m} rangeLabel={rangeLabel(range)} />

            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
              <FunnelBars metrics={m} />
              <AIAnalyst diagnostic={diagnostic} error={diagnosticError} />
            </div>

            <DeepAnalysis
              analysis={analysis}
              deep={deep}
              loading={deepLoading}
              aiLoading={aiLoading}
              error={deepError}
              onRun={handleRunDeep}
              onPauseAdset={handlePauseAdset}
            />

            <OptimizationPlan
              plan={plan}
              isGenerating={isGeneratingPlan}
              isDeciding={isDeciding}
              isExecuting={isExecuting}
              onGenerate={handleGeneratePlan}
              onDecide={handleDecide}
              onExecute={handleExecute}
            />

            <TrendChart />
          </>
        )}
      </div>
    </div>
  );
}
