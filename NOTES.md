# 📓 NOTES.md — Diário de Bordo do MetaScale

> Registro vivo do projeto. Sempre que fizermos algo relevante, anotamos aqui.
> **Regra de ouro:** nunca colocar valores de chaves/segredos neste arquivo — apenas os *nomes* das variáveis.

---

## 1. O que é o MetaScale

SaaS de **análise de campanhas Meta Ads** para e-commerce/dropshipping. O dashboard puxa as métricas reais da conta de anúncios via Meta Graph API, calcula o funil de conversão e usa IA (Claude) para diagnosticar gargalos e sugerir ações.

**Princípio de análise:** modelo **80x10x10** (foco em conversão, com atenção a connect rate, conversão de LP e conversão de checkout).

---

## 2. Stack / Motor

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React + Tailwind CSS |
| Banco de dados | Supabase (Postgres) |
| IA | Anthropic API — modelo `claude-sonnet-4-20250514` |
| Dados de anúncios | Meta Graph API `v19.0` |
| Idioma | Rodando local em `localhost:3000` |

**Diretrizes do projeto** (ver `CLAUDE.md`): completude absoluta ("boil the lake"), zero chaves hardcoded, `.env` blindado, UI elite (cores restritas, foco utilitário).

---

## 3. Variáveis de ambiente (`.env.local`)

> ⚠️ O arquivo `.env.local` **está protegido** pelo `.gitignore` (`.env*.local`) e nunca foi commitado. Não versionar.

| Variável | Para que serve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (client) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (server) do Supabase |
| `META_APP_ID` | ID do app Meta |
| `META_APP_SECRET` | Secret do app Meta |
| `META_ACCESS_TOKEN` | Token de acesso à Graph API |
| `META_AD_ACCOUNT_ID` | Conta de anúncios (`act_...`) que o dashboard lê |
| `ANTHROPIC_API_KEY` | Chave da IA (diagnósticos Claude) |
| `GITHUB_EMAIL` / `GITHUB_USERNAME` / `GITHUB_TOKEN` / `REPOSITORIO` | Credenciais Git |

---

## 4. Conta conectada hoje (ambiente de teste)

- **Nome:** PREMIER ESPORTES I
- **Conta:** `act_1276563654651319`
- **Moeda:** BRL · **Fuso:** America/Sao_Paulo · **Status:** ativa
- **Campanhas ativas (30d):**
  | Campanha | Gasto | ROAS | Compras | Status derivado |
  |---|---|---|---|---|
  | Vendas_ABO_rmkt_12/07 | R$ 67,45 | ~15,6 | 2 | 🟢 escalável |
  | Catálogos_ABO_27/06 | R$ 684,16 | ~3,9 | 9 | 🟢 escalável |
  | Vendas_ABO_27/06/2026 | R$ 3.278,95 | ~1,45 | 14 | 🟡 otimizar |

---

## 5. Arquitetura / mapa dos arquivos

```
src/
├── app/
│   ├── page.tsx                     ← Dashboard principal (client component)
│   ├── api/
│   │   ├── meta/
│   │   │   ├── sync/route.ts        ← Sincroniza conta + campanhas + métricas reais
│   │   │   └── accounts/route.ts    ← Retorna a conta Meta conectada
│   │   └── ai/
│   │       └── diagnostic/route.ts  ← Chama Claude para diagnosticar 1 campanha
│   ├── campanhas/                   ← Listagem e detalhe de campanha
│   ├── simulador/                   ← Simulador de escala (80x10x10)
│   └── settings/
├── lib/
│   ├── meta-api.ts                  ← Cliente Graph API + parser de insights → métricas
│   ├── anthropic.ts                 ← callDiagnostic() + parsing robusto de JSON
│   ├── supabase.ts                  ← Cliente Supabase
│   ├── calc-8010x10.ts              ← Cálculos do modelo 80x10x10
│   └── colors.ts                    ← Cores de performance (verde/amarelo/vermelho)
├── components/
│   ├── dashboard/                   ← CampaignCard, SummaryHeader, ConversionFunnel,
│   │                                  ClaudeAdsHealth, FilterPills
│   ├── campaigns/                   ← AIAnalyst, FunnelBars, MetaMetricsGrid, TrendChart
│   ├── layout/                      ← Sidebar, TopBar (botão "Sync Data")
│   └── ui/                          ← Badge, MetricCard, ProgressBar
└── types/index.ts                   ← Campaign, CampaignMetrics, AIDiagnostic, etc.
```

### Como o dado flui (sincronização)
1. Dashboard abre → `page.tsx` chama `GET /api/meta/sync?range=last_30d` (automático) e também no botão **Sync Data**.
2. `sync/route.ts` chama `fetchAccountInfo()` + `fetchCampaignsWithMetrics()` de `meta-api.ts`.
3. `meta-api.ts` busca campanhas e insights da Graph API numa chamada e faz o **parse do array `actions`/`action_values`** em `CampaignMetrics` (link clicks, LP views, checkouts, compras, ROAS, CPA, connect rate, conversões).
4. `page.tsx` renderiza os cards e, **em background**, dispara `POST /api/ai/diagnostic` por campanha → `callDiagnostic()` (Claude) devolve `{ gargalo, diagnostico, recomendacoes }`.
5. O **score "Claude Ads Audit"** é calculado no cliente a partir das métricas reais (não depende de IA).

### Mapeamento de métricas (Graph API → app)
- `cliques_link` ← action `link_click`
- `landing_page_views` ← action `landing_page_view`
- `checkouts_iniciados` ← action `initiate_checkout`
- `compras` ← action `purchase`
- `valor_conversao` ← action_value `purchase`
- `ctr` / `cpc` → recalculados sobre **cliques de link** (não all-clicks)
- `roas` = valor_conversao / gasto · `cpa` = gasto / compras
- `connect_rate` = LP views / cliques · `conversao_lp` = checkouts / LP views · `conversao_checkout` = compras / checkouts · `conversao_global` = compras / impressões
- **`escala_status`:** `escalavel` se ROAS ≥ 2 e ≥1 compra · `otimizar` se ROAS ≥ 1 · senão `nao_escalar`

### Fórmula do health score (0–100)
`ROAS(40%, alvo 3x) + connect rate(20%, alvo 80%) + CTR link(15%, alvo 2,5%) + conv. checkout(15%, alvo 10%) + conv. LP(10%, alvo 10%)`

---

## 6. Diário — o que já fizemos

### 2026-07-17 — Sincronização do dashboard com a Meta Ads (dados reais)
**Contexto:** dashboard vinha renderizando dados **mockados** fixos; as rotas de API eram stubs.

- ✅ `meta-api.ts`: adicionadas `fetchAccountInfo()`, `fetchCampaignsWithMetrics()`, parser de insights → `CampaignMetrics`, `hasMetaCredentials()`. Removidas as métricas mockadas.
- ✅ `api/meta/sync/route.ts`: virou endpoint real (GET/POST, `force-dynamic`, sem cache) devolvendo conta + campanhas com métricas. Trata credenciais ausentes e erros.
- ✅ `api/meta/accounts/route.ts`: passou a retornar a conta Meta real.
- ✅ `page.tsx`: removidos todos os mocks; busca de `/api/meta/sync` no load e no botão Sync; estados de loading/erro/vazio; header exibe a conta ativa.
- ✅ Validado ao vivo em `localhost:3000` — 3 campanhas reais retornando corretamente.

### 2026-07-17 — Diagnósticos de IA por campanha
- ✅ `anthropic.ts`: modelo alinhado a `claude-sonnet-4-20250514` (diretriz do `CLAUDE.md`); parsing de JSON robustecido (tolera cercas de markdown).
- ✅ `page.tsx`: cada card dispara `/api/ai/diagnostic` em background após o sync; degrada com "Analisando..." em caso de falha.
- ✅ `ClaudeAdsHealth`: score passou de hardcoded (`78`) para cálculo a partir das métricas reais.
- ⚠️ **Bloqueado:** `ANTHROPIC_API_KEY` do `.env.local` retornou **401 "API key is invalid"**. Código pronto; falta chave válida.

### 2026-07-17 — Páginas de detalhe/lista de campanha com dados reais
**Contexto:** o botão "Ver Detalhes" levava para `/campanhas/[id]`, mas essa página (e a `/campanhas` do menu) mostravam **dados mockados** ("Verão 2024 — Broad", "CBO Coleção Inverno"), ignorando a campanha clicada.

- ✅ `campanhas/[id]/page.tsx`: reescrita — busca `/api/meta/sync`, acha a campanha pelo `params.id` e renderiza métricas reais + diagnóstico de IA real. Trata loading / erro / campanha não encontrada. Botão "Sync Data" re-sincroniza.
- ✅ `campanhas/page.tsx` (menu "Campaigns"): virou **lista real** de campanhas (grid de `CampaignCard`), com filtros e sync — antes era um mock de detalhe único.
- ✅ **Bug corrigido** em `components/campaigns/AIAnalyst.tsx`: o texto do diagnóstico estava **hardcoded** (sempre "ROAS 3.4x / Verão 2024"). Agora usa `diagnostic.diagnostico` + exibe o gargalo real.
- ✅ **Bug corrigido** em `components/campaigns/FunnelBars.tsx`: a caixa de status era **fixa** em verde "ESCALÁVEL". Agora é dinâmica (verde/amarelo/vermelho) conforme `escala_status`.
- ✅ `MetaMetricsGrid`: rótulo "Métricas Meta Ads — Hoje" → "— Últimos 30 dias" (condiz com o range real).
- ✅ Validado ao vivo: `/campanhas/120250369223390627` → HTTP 200, sync acha "Vendas_ABO_rmkt_12/07" (ROAS 15,56, escalável).

### 2026-07-17 — Diagnóstico de IA funcionando + botão de auditoria
**Contexto:** os diagnósticos apareciam "demorando"/travados e o botão "Rodar Auditoria Completa" não fazia nada.

- ✅ **Causa raiz da IA:** o modelo `claude-sonnet-4-20250514` (diretriz antiga do CLAUDE.md) retorna **404 not_found** para a chave Anthropic atual (a chave é válida; o modelo foi retirado dessa conta). Trocado para **`claude-sonnet-5`** (Sonnet-tier moderno, testado 200 OK).
- ✅ **Bug de extração:** o Sonnet 5 usa *adaptive thinking* por padrão, então `response.content[0]` era um bloco de *thinking* e o parse retornava `null`. Corrigido em `anthropic.ts` para pegar o primeiro bloco `text`; `thinking` desligado (`{type:'disabled'}`) → diagnóstico em ~6s, JSON completo, sem truncar.
- ✅ **Botão "Rodar Auditoria Completa":** era decorativo (sem `onClick`). Agora dispara `handleRunAudit` → re-analisa todas as campanhas com IA, com spinner e progresso "Auditando X/Y".
- ✅ **Botão "Exportar Relatório PDF":** ligado a `window.print()` (Salvar como PDF do navegador).
- ✅ Validado ao vivo: diagnóstico real (gargalo "Conversão LP", 5 recomendações) via `/api/ai/diagnostic` HTTP 200.
- ℹ️ Modelos disponíveis nessa chave: `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-4-8` (todos 200). Para trocar, editar `src/lib/anthropic.ts`.

### 2026-07-17 — Limpeza: projeto Meta-only + .env.example + Supabase MCP
- ✅ **Removido todo conteúdo de outras plataformas** em `src/lib/ai-agents/` (não é usado em runtime, é referência): skills `ads-apple` (+ google/linkedin/microsoft/tiktok/youtube já removidos antes); 4 agentes exclusivos de outras plataformas (`audit-budget/creative/compliance/tracking` — eram só LinkedIn/TikTok/Microsoft) e `audit-google`; ~13 referências (google/linkedin/microsoft/tiktok/youtube-*, gaql-notes, additional-platforms, platform-specs) e 3 research-sources do Google.
- ✅ **Índice `ads/SKILL.md` reescrito Meta-only** + corrigidos todos os links quebrados em `ads-audit`, `ads-creative`, `ads-generate`, `copy-writer`, `copy-frameworks`, `meta-creative-specs` e `research-sources/README`.
- ✅ Restou: 14 skills (Meta + genéricos), 5 agents (audit-meta + pipeline criativo), 13 referências. Nenhum link quebrado. Typecheck limpo.
- ℹ️ Arquivos genéricos (benchmarks, budget-allocation…) ainda citam outras plataformas como comparação — mantidos por serem úteis pro Meta também.
- ✅ **`.env.example`** criado (placeholders + instruções de onde obter cada chave; sem segredos). Versionável; `.env.local` segue protegido.
- ✅ **Supabase MCP** conectado só neste projeto (`.mcp.json`, escopo project). ⚠️ project_ref do MCP (`xizqby...`) ≠ do app (`ownwvg...` no `.env.local`) — alinhar.

### 2026-07-17 — Análise Profunda (media buyer IA) no dashboard
**Contexto:** o diagnóstico via IA só recebia métricas **somadas**, então culpava a LP e não via os vazamentos reais. Implementada uma "Análise Profunda" que quebra a campanha por posicionamento, público e conjunto — como um media buyer.

- ✅ `types/index.ts`: `BreakdownRow`, `CampaignAnalysis`, `DeepDiagnostic` + status `escalar/otimizar/pausar`.
- ✅ `meta-api.ts`: `fetchCampaignAnalysis()` — puxa quebras da Graph API (`level=adset`, `breakdowns=publisher_platform,platform_position` e `age,gender`), calcula ROAS/CPA e classifica cada linha (escalar/otimizar/pausar).
- ✅ Rota `GET /api/meta/analysis?campaignId=&range=` — devolve `{byAdset, byPlacement, byAge}`.
- ✅ `anthropic.ts` `callDeepDiagnostic()` — recebe as **quebras** e devolve `{resumo, vazamentos[], acoes[]}` (media buying). Modelo `claude-sonnet-5`, thinking off, `max_tokens: 3500` (evita truncar o JSON).
- ✅ Rota `POST /api/ai/deep-diagnostic`.
- ✅ Componente `components/campaigns/DeepAnalysis.tsx`: 3 tabelas coloridas (vencedor/perdedor) + painel de diagnóstico de media buying com vazamentos e ações priorizadas.
- ✅ Integrado na página de detalhe (`campanhas/[id]`) com botão **"Rodar Análise Profunda"** (só leitura, não escreve na conta).
- ✅ Validado ao vivo na campanha 120249862631490627: análise HTTP 200 (21 conjuntos, 19 posicionamentos, 20 públicos) + IA identificou vazamento de Feed (~R$1.500), público 25-34/65+ (~R$517), fragmentação de 20 conjuntos e ações de escalar/pausar.
- ℹ️ Escopo escolhido: **só leitura** (sem botões de escrita/pausar via API) — fica como evolução futura.

### 2026-07-17 — Salvar análises de IA (botão "Salvar análise")
**Contexto:** pedido de um botão para guardar as análises de IA de cada campanha no projeto. Decisão do usuário: salvar **nos dois** (arquivo JSON + Supabase); botão **só na página de detalhe** (ao lado do Diagnóstico IA).

- ✅ `src/lib/supabase-admin.ts`: cliente Supabase **service-role** (só servidor) — contorna o RLS para gravar sem login.
- ✅ `src/app/api/diagnostics/save/route.ts` (POST): grava em `data/diagnosticos.json` (upsert por `meta_campaign_id`, última análise por campanha) **e** insere em `ai_diagnostics` no Supabase. Falha graciosa: se o Supabase falhar, o arquivo ainda salva; retorna `{file, supabase, supabaseError}`.
- ✅ `campanhas/[id]/page.tsx`: botão **"Salvar análise"** acima do painel de IA, com estados salvando/salvo/erro e mensagem de status.
- ✅ Migração `supabase/migrations/20260717000000_add_meta_fields_to_ai_diagnostics.sql`: autossuficiente/idempotente — cria `ai_diagnostics` (se não existir) com `meta_campaign_id` + `campaign_nome`, índice e RLS.
- ✅ **Pasta renomeada `data/` → `analises-ia/`** (nome óbvio, na raiz do projeto) para o usuário achar e arrastar pro chat. Além do `diagnosticos.json`, agora grava **um `.md` legível por campanha** (`<slug>_<meta_id>.md`). Tem `README.md` versionado pra pasta sempre aparecer no explorador.
- ✅ `.gitignore`: `analises-ia/*` ignorado (dados reais de cliente), exceto o `README.md`.
- ⚠️ **Supabase pendente:** o teste retornou `table 'public.ai_diagnostics' not found` — o schema inicial **nunca foi aplicado** nesse projeto Supabase. Para ativar a gravação no banco, rodar a migração acima no **SQL Editor** do Supabase (uma vez). Até lá, o salvamento em arquivo JSON funciona 100%.
- ⚠️ **Caveat deploy:** escrita em arquivo (`data/`) funciona em dev/local; em serverless (Vercel) não persiste — nesse cenário o Supabase é o caminho de persistência.

### 2026-07-17 — Higiene / segurança
- ✅ Confirmado que `.env.local` está gitignored e nunca foi rastreado (nenhum segredo no repo).
- ✅ `tsconfig.json`: adicionado `scratch` ao `exclude` → `npx tsc --noEmit` sai limpo (exit 0). Nada foi deletado; a pasta `scratch/` (já gitignored) segue intacta.

---

## 7. Estado atual (o que funciona)

- 🟢 Sincronização Meta Ads: **100% funcional** com dados reais.
- 🟢 Funil de conversão, cards de campanha, filtros, summary, health score: **funcionando**.
- 🟡 Diagnósticos de IA: **cabeados**, aguardando `ANTHROPIC_API_KEY` válida.
- 🟢 Typecheck limpo · `.env.local` protegido.

---

## 8. Pendências / próximos passos

- [ ] **Trocar `ANTHROPIC_API_KEY`** por uma válida (console.anthropic.com → API Keys) e reiniciar o dev server → diagnósticos preenchem sozinhos.
- [ ] Validar diagnósticos de IA de ponta a ponta assim que a chave entrar.
- [ ] (Ideia) Persistir campanhas/métricas/diagnósticos no Supabase para histórico e comparação temporal (hoje é sempre "ao vivo").
- [ ] (Ideia) Seletor de período no dashboard (hoje fixo em `last_30d`).
- [ ] (Ideia) Ligar o botão "Rodar Auditoria Completa" / "Exportar Relatório PDF" do card Claude Ads Audit.

---

## 9. Como rodar / comandos úteis

```bash
npm run dev            # sobe o dashboard em http://localhost:3000
npx tsc --noEmit       # typecheck (deve sair limpo)
```

Testar sync manualmente:
```
GET http://localhost:3000/api/meta/sync?range=last_30d
GET http://localhost:3000/api/meta/accounts
```

---

*Última atualização: 2026-07-17.*
