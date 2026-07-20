"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { CampaignCard } from '@/components/dashboard/CampaignCard';
import { FilterPills } from '@/components/dashboard/FilterPills';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Campaign } from '@/types';
import {
  RangeSelection,
  DEFAULT_RANGE,
  loadRange,
  saveRange,
  rangeToQuery,
  rangeLabel,
} from '@/lib/date-range';

interface MetaAccount {
  id: string;
  name: string;
  currency: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [activeFilter, setActiveFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeSelection>(DEFAULT_RANGE);

  // Restaura a janela de data salva no navegador ao montar.
  useEffect(() => {
    setRange(loadRange());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta/sync?${rangeToQuery(range)}`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao sincronizar com a Meta Ads.');
      }
      setCampaigns(data.campaigns || []);
      setAccount(data.account || null);
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido ao sincronizar.');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRangeChange = useCallback((sel: RangeSelection) => {
    saveRange(sel);
    setRange(sel);
  }, []);

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeFilter === 'Todas') return true;
    if (activeFilter === 'Escaláveis') return c.metrics?.escala_status === 'escalavel';
    if (activeFilter === 'Otimizar') return c.metrics?.escala_status === 'otimizar';
    if (activeFilter === 'Não Escalar') return c.metrics?.escala_status === 'nao_escalar';
    return true;
  });

  return (
    <div className="pb-10 max-w-[1400px] mx-auto px-4">
      <TopBar
        title="Campaigns"
        subtitle={
          account
            ? `${account.name} · ${account.currency} · ${campaigns.length} campanha(s) · dados reais · ${rangeLabel(range)}`
            : 'Sincronizando com a Meta Ads...'
        }
        onSync={load}
        isSyncing={loading}
        actions={
          <DateRangePicker value={range} onChange={handleRangeChange} disabled={loading} />
        }
      />

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Erro ao sincronizar: {error}
        </div>
      )}

      <div className="flex items-center justify-between my-6">
        <div>
          <h2 className="text-2xl font-bold text-[#F1F1F3]">Todas as Campanhas</h2>
          <p className="text-[#8B8BA0] text-sm">Clique em uma campanha para ver o detalhe completo</p>
        </div>
        <FilterPills
          filters={['Todas', 'Escaláveis', 'Otimizar', 'Não Escalar']}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center min-h-[200px] text-[#8B8BA0] text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" />
          Sincronizando campanhas reais...
        </div>
      ) : !error && filteredCampaigns.length === 0 ? (
        <div className="rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-4 py-3 text-sm text-[#8B8BA0]">
          Nenhuma campanha encontrada para este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} diagnostic={null} />
          ))}
        </div>
      )}
    </div>
  );
}
