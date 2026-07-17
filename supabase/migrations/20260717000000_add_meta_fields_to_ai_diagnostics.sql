-- Diagnósticos de IA de campanhas que vêm ao vivo da Meta.
-- Autossuficiente e idempotente: pode ser colado no SQL Editor do Supabase
-- mesmo que o schema inicial ainda não tenha sido aplicado.
--
-- Guarda a identificação da campanha da Meta (meta_campaign_id / campaign_nome)
-- direto na linha, sem depender das FKs campaign_id/metrics_id.

CREATE TABLE IF NOT EXISTS ai_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  metrics_id uuid,
  data date NOT NULL,
  gargalo text,
  diagnostico text,
  recomendacoes jsonb,
  prioridade text,
  meta_campaign_id text,
  campaign_nome text,
  criado_em timestamptz DEFAULT now()
);

-- Caso a tabela já exista (schema inicial), garante as novas colunas.
ALTER TABLE ai_diagnostics ADD COLUMN IF NOT EXISTS meta_campaign_id text;
ALTER TABLE ai_diagnostics ADD COLUMN IF NOT EXISTS campaign_nome text;

CREATE INDEX IF NOT EXISTS idx_ai_diagnostics_meta_campaign_id
  ON ai_diagnostics (meta_campaign_id);

-- RLS: bloqueia acesso anônimo; a gravação usa service-role (que ignora RLS).
ALTER TABLE ai_diagnostics ENABLE ROW LEVEL SECURITY;
