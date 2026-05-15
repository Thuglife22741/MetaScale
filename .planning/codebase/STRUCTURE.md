# MetaScale Structure

## Root Directory
- `/src/`: Código fonte principal (Frontend e Backend).
- `/supabase/`: Configurações, migrations e definições do banco de dados.
- `CLAUDE.md`: Diretrizes mestras do projeto e governança de elite.
- `package.json`: Dependências e scripts de execução.

## Src Directory (`/src/`)
- `/app/`: Next.js App Router (Páginas e APIs).
  - `/api/`: Route handlers para integrações (`/ai`, `/meta`, `/simulations`).
  - `/campanhas/`: Visualização e gestão de campanhas.
  - `/simulador/`: Ferramenta de simulação de escala.
  - `/settings/`: Configurações de conta e sistema.
- `/components/`: Componentes React modulares.
  - `/campaigns/`: Componentes específicos de campanhas.
  - `/dashboard/`: Componentes do painel principal (gráficos, KPIs).
  - `/simulator/`: Entradas (`SimulatorInputs.tsx`) e Resultados (`SimulatorResults.tsx`).
  - `/ui/`: Componentes genéricos e reaproveitáveis (botões, cards, modais).
- `/lib/`: Serviços principais, funções utilitárias e integrações externas.
  - `anthropic.ts`: Cliente e lógica de prompt da IA.
  - `supabase.ts`: Cliente de conexão ao Supabase.
  - `meta-api.ts`: Camada de abstração da API da Meta.
  - `calc-8010x10.ts`: Funções matemáticas base da estratégia 80x10x10.
  - `colors.ts`: Definições estritas de paleta e utilitários de cor.
- `/types/`: Definições de tipos TypeScript globais (ex: `index.ts`).

## Supabase Directory (`/supabase/`)
- `/migrations/`: Scripts SQL para versionamento do banco de dados (ex: `20260503000000_initial_schema.sql`).
