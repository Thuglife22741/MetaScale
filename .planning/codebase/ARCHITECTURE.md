# MetaScale Architecture

## Overview
A arquitetura do MetaScale segue o padrão moderno de aplicações web utilizando Next.js App Router, com o frontend e backend (Route Handlers) servidos na mesma aplicação, conectando-se a um BaaS (Supabase) para persistência e APIs externas para enriquecimento de dados.

## Fluxo de Dados (Data Flow)

1. **Ingestão de Dados (Meta API)**
   - O sistema (via simulador ou API real) busca campanhas (`fetchMetaCampaigns`) e métricas associadas (`fetchMetaMetrics`) da conta de anúncios configurada.
   - Os dados são processados e salvos no banco PostgreSQL via cliente Supabase (`src/lib/supabase.ts`).

2. **Diagnóstico (Anthropic API)**
   - O usuário ou o sistema automatizado aciona um diagnóstico para uma campanha específica.
   - O backend compila os dados das métricas em um JSON estruturado e o envia como prompt (Zero-shot / Few-shot) para a API da Anthropic (`callDiagnostic` em `src/lib/anthropic.ts`).
   - A IA processa segundo regras de negócio (80x10x10) e retorna um veredicto em JSON estruturado, que é persistido na tabela `ai_diagnostics` no Supabase.

3. **Simulação de Escala**
   - O módulo de simulador permite ajustar parâmetros (Orçamento, CTR, etc.) para projetar os resultados (Cliques, Vendas, Lucro, ROAS).
   - Lógicas baseadas em funis de e-commerce e regras rígidas codificadas em `src/lib/calc-8010x10.ts`.
   - Resultados projetados são salvos na tabela `scale_simulations`.

4. **Camada de Apresentação**
   - Componentes em React Server Components (Next.js) e Client Components renderizam as interfaces.
   - Gráficos renderizados através do Recharts, com estilização Tailwind estrita seguindo os princípios "Elite UI" do projeto.
