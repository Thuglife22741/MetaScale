# MetaScale Integrations

## 1. Supabase
- **Role**: Banco de Dados (PostgreSQL) e Autenticação.
- **Configuração**: `src/lib/supabase.ts` via variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Segurança**: Row Level Security (RLS) habilitado para todas as tabelas, garantindo que usuários só acessem seus próprios perfis, contas de anúncio, campanhas, métricas, diagnósticos e simulações.
- **Tabelas Principais**: `profiles`, `meta_ad_accounts`, `campaigns`, `campaign_metrics`, `ai_diagnostics`, `scale_simulations`.

## 2. Anthropic API (Claude)
- **Role**: Motor de IA para diagnóstico de campanhas e recomendações.
- **Implementação**: `src/lib/anthropic.ts`.
- **Modelo utilizado**: `claude-3-5-sonnet-20241022`.
- **Lógica**: Analisa dados baseados no princípio de conversão 80x10x10. Recebe JSON de métricas (`CampaignMetrics`) e retorna JSON estruturado com gargalo, diagnóstico e recomendações (Prioridade: Alta, Média, Baixa).

## 3. Meta Graph API
- **Role**: Extração de dados e métricas de anúncios e campanhas.
- **Implementação**: `src/lib/meta-api.ts`.
- **Métricas Extraídas**: Impressões, Alcance, Frequência, Cliques, CTR, CPC, CPM, Valor Gasto, Landing Page Views, Checkouts Iniciados, Compras, Valor de Conversão, ROAS, CPA.
