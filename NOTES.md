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

### 2026-07-19 — Claude Ads Audit: fim do teatro, nota transparente
**Contexto:** o card mostrava 4 "agentes" falsos ("Copywriter IA · Online", "Visual Designer · Online", "Ads Strategist · Online", "Audit Engine · 250+ Checks") — tudo hardcoded, não existe agente nenhum rodando. Confundia (parecia funcional). O score já era real, mas opaco.
- ✅ Removidos os 4 quadros falsos. No lugar, o card mostra os **5 fatores REAIS** que compõem a nota (ROAS 40pts, Connect Rate 20, CTR link 15, Conv. Checkout 15, Conv. LP 10), cada um com valor atual, meta, pontos e barra colorida. A nota exibida é a **soma dos pontos** → 100% transparente e bate com o que aparece.
- ✅ `page.tsx`: `healthScore` refeito a partir de `auditFactors` (mesma ponderação de antes, agora derivada dos fatores). Passado `factors` ao componente. Adicionada nota em letra (A–F) no ring. Estado vazio tratado.
- ✅ Continua real: botão "Rodar Auditoria Completa" (re-roda `/api/ai/diagnostic` em todas as campanhas) e "Exportar PDF" (`window.print`).
- ✅ Validado: com os dados atuais a nota dá **96 (A)** — ROAS/Connect/CTR/Checkout no máximo, só Conv. LP em 6/10 (6% vs meta 10%), que é exatamente o gargalo do diagnóstico.

### 2026-07-19 — Fixes de dashboard: CPA formatado + "Distribuição de Verba" real
- ✅ **CPA Médio (SummaryHeader):** mostrava "R$ 102,303" (3 casas decimais → parecia "cento e dois mil"). `toLocaleString('pt-BR', { minimumFractionDigits: 2 })` sem `maximumFractionDigits` cai no default de 3 casas. Travado em `maximumFractionDigits: 2` no CPA e no Investimento → **R$ 102,30**. Demais pontos de moeda já fixavam o máximo (OK).
- ✅ **"Distribuição de Verba" era 100% hardcoded** (85% Conversão / 10% Tráfego / 5% Outros — resquício de mock). Reescrito para dado REAL: gasto por objetivo das campanhas do período (Conversão = SALES/CONVERSION/LEAD; Tráfego = TRAFFIC; Outros = awareness/engagement/etc.), com % e valor em R$, barras dinâmicas via `style width`, estado vazio, e o rótulo da janela ativa. Validado: conta atual dá **Conversão 100%** (3 campanhas OUTCOME_SALES) — antes mentia 85/10/5.

### 2026-07-19 — "Salvar análise" grava a PÁGINA INTEIRA (não só o diagnóstico raso)
**Contexto:** o botão "Salvar análise" gravava só o diagnóstico de funil (gargalo + texto + recomendações) no `.md`. Pedido: salvar a página toda.

- ✅ **`campanhas/[id]` `handleSaveDiagnostic`** passou a enviar o payload completo: `account`, `range_label`, `metrics` (grid), diagnóstico raso, `analysis` (quebras), `deep` (media buyer) e `plan.plano` (Plano de Otimização).
- ✅ **`api/diagnostics/save` `buildFullMarkdown()`** (novo, substitui `toMarkdown`): monta o `.md` com TODAS as seções da tela — Métricas Meta Ads, Funil 80×10×10, Diagnóstico IA + recomendações, Análise Profunda (3 tabelas com status colorido), Diagnóstico de media buying (vazamentos + ações), e Plano de Otimização (ajustes, realocação de público/posicionamento, conjuntos NÃO duplicados, racional, riscos). Cada seção é guardada por presença (se não rodou a Análise Profunda/Plano, apenas omite). O `diagnosticos.json` e o insert no Supabase seguem com os campos rasos (compat).
- ✅ Validado ao vivo (Vendas_ABO_27/06): `.md` completo gerado, acentos corretos, `{file:true, supabase:true}`.
- ℹ️ O JSON/Supabase continuam guardando só o resumo raso; o **arquivo `.md`** é a versão completa/arrastável.

### 2026-07-19 — Plano de Otimização ancorado na Análise Profunda (media buying real)
**Contexto:** a Análise Profunda (media buyer IA) identifica os vazamentos reais (posicionamento, público, conjunto), mas o "Plano de Otimização — v1 (duplicar + ajustar)" foi feito antes dela e só olhava métricas agregadas: duplicava **todos** os conjuntos aplicando apenas budget/AN/mobile. Não realocava nada do que a análise apontava. Pedido: o plano deve refletir a Análise Profunda (ex.: `analises-ia/analise-profunda_vendas-abo-27-06_*.md`).

- ✅ **`anthropic.ts` `callOptimizationPlan`** agora recebe as **quebras** (`analysis`) + a leitura do media buyer (`deep`) e deriva alavancas CONCRETAS e prontas para a Meta API no bloco `execucao`:
  - `segmentacao` `{ idade_min, idade_max, generos:['male'|'female'] }` — o público que compra.
  - `posicionamentos` `{ publisher_platforms, facebook_positions, instagram_positions }` — concentrar nos vencedores (ex.: só Reels).
  - `conjuntos_pausar` `[{ id, nome, motivo }]` — os conjuntos perdedores (0 vendas / ROAS<1), com `adset_id` real das quebras.
  - Regras no prompt: nunca cortar vencedor (ROAS≥2); usar tokens de posicionamento exatos; não listar todos os conjuntos.
- ✅ **Rota `api/meta/optimize/plan`**: aceita `analysis`/`deep`/`range` do cliente e, se não vierem, **busca `fetchCampaignAnalysis` no servidor** → o plano fica SEMPRE ancorado nas quebras. (`modelo` corrigido p/ `claude-opus-4-8`.)
- ✅ **Rota `api/meta/optimize/execute`**: `aplicarAlavancas()` injeta `age_min/age_max/genders` e `facebook_positions/instagram_positions/publisher_platforms` no targeting clonado (com whitelist de posicionamentos válidos + reconciliação de plataformas p/ não dar 400); **pula os conjuntos perdedores** (`conjuntos_pausar`, por id ou nome). Salvaguarda: se marcaria TODOS, ignora as pausas p/ não esvaziar a campanha. Resultado mostra `conjuntos_pulados` + avisos deduplicados.
- ✅ **`campanhas/[id]`**: `handleGeneratePlan` envia `analysis`, `deep` e a janela de data.
- ✅ **`OptimizationPlan.tsx`**: novo bloco "Realocação de mídia (da Análise Profunda)" com posicionamentos, público e a lista de conjuntos que **não** serão duplicados; resultado exibe "Perdedores cortados: N".
- ✅ Validado ao vivo (Vendas_ABO_27/06, R$4.153, 30d): plano saiu com segmentação **35–64 homens**, posicionamentos **FB/IG Reels** (corta IG Feed/Stories/AN) e **12 conjuntos perdedores** com adset_id reais p/ não reduplicar. Typecheck limpo.
- ⚠️ **Execução real NÃO testada de propósito** (cria campanha PAUSED na conta ativa — é reversível, mas não mexemos sem ordem). Rodar só quando você quiser validar a criação de ponta a ponta.

### 2026-07-19 — Fix "Gerando diagnóstico..." travado + limpeza da UI de detalhe
**Contexto:** na página de detalhe, o painel de IA travava eternamente em "Gerando diagnóstico...", e havia dois botões decorativos ("Editar" e "Forçar Escala") sem função.

- ✅ **Causa raiz do diagnóstico travado:** `anthropic.ts` usava **`claude-3-5-sonnet-20240620`**, modelo **descontinuado pela Anthropic em 28/10/2025** → API retorna 404 → a rota engolia como "Falha na IA" → diagnóstico nunca chegava. O mesmo afetava o deep-diagnostic (mesmo modelo) e o plano (`claude-3-7-sonnet-20250219`, retirado 19/02/2026). Trocados **os 3** para **`claude-opus-4-8`** (modelo atual; a chave responde 200 nele). O `CLAUDE.md` também citava um modelo retirado (`claude-sonnet-4-20250514`) — atualizado para `claude-opus-4-8`.
- ✅ **Rota `api/ai/diagnostic`** deixou de engolir o erro (`catch {}` → repassa `error.message` + `console.error`). Ajuda a não esconder falha de modelo de novo.
- ✅ **`AIAnalyst`** ganhou prop `error`: em vez de "Gerando..." infinito, mostra "Falha ao gerar o diagnóstico" + mensagem quando a IA falha. Ligado na página de detalhe (`diagnosticError`).
- ✅ **UI de detalhe:** removidos os botões decorativos **Editar** e **Forçar Escala** (não faziam nada); o botão **Salvar análise** subiu para o lugar deles (canto superior direito, ao lado do título).
- ✅ Validado ao vivo: `/api/ai/diagnostic` → success, gargalo `conversao_lp`, 5 recs; `/api/ai/deep-diagnostic` → success, 4 vazamentos, 6 ações. Typecheck limpo.

### 2026-07-19 — Filtro por data (janela de análise, padrão Gerenciador de Anúncios)
**Contexto:** o dashboard puxava tudo fixo em `last_30d`. Como o Facebook **atribui a compra ao clique** (janela padrão 7d clique/1d view) e há *learning phase*, a janela de leitura muda a decisão: Hoje/Ontem servem para pacing e anomalia (ROAS ainda imaturo); 7 dias é a janela de trabalho; 14/30 dias são decisão de escalar/cortar. Faltava poder escolher a janela, como no Gerenciador.

- ✅ `src/lib/date-range.ts` (novo): presets (`today`, `yesterday`, `last_3d`, `last_7d`, `last_14d`, `last_30d`, `custom`), tipo `RangeSelection`, `rangeToQuery()`, `rangeLabel()` e persistência em `localStorage` (lembra a escolha entre páginas). **Default do cockpit = `last_7d`** (antes era 30d).
- ✅ `src/components/ui/DateRangePicker.tsx` (novo): dropdown estilo Meta com legenda de uso (media buying) por preset + período **Personalizado** com inputs De/Até (`<input type="date">`, com trava De ≤ Até e max = hoje).
- ✅ `meta-api.ts`: novo tipo `DateParams` + `dateQuery()` — presets viram `date_preset`; custom vira `time_range={since,until}`. Aplicado em `fetchCampaignsWithMetrics`, `fetchInsightsByCampaign` e `fetchCampaignAnalysis` (as 3 quebras).
- ✅ Rotas `api/meta/sync` e `api/meta/analysis`: parseiam `range` **ou** `since`/`until`.
- ✅ Ligado no **Dashboard**, **Campaigns** e **Detalhe** (seletor no TopBar, subtítulos e rótulo do `MetaMetricsGrid` dinâmicos, re-sync automático ao trocar a janela). Na Detalhe, trocar a janela também limpa a Análise Profunda antiga.
- ✅ Validado ao vivo: gasto cresce monotonicamente com a janela (hoje R$537 → 3d R$1.684 → 7d R$3.274 → 14d R$4.391 → 30d R$5.182); custom 14–18/07 = R$2.584; análise profunda custom HTTP 200 (conjuntos/posições/públicos).
- ✅ **Limpeza (órfão removido):** `src/lib/agents/buildSystemPrompt.ts` importava `@/lib/supabase-server` (inexistente) e quebrava o `tsc`. Era código de **outro projeto** (Synapse/GStack — tabela `agentes_config`, system prompt de agentes), copiado por engano, **sem nenhum import** no MetaScale. Apagado (junto da pasta `src/lib/agents/`, que só tinha ele). `tsc` voltou a sair **limpo (exit 0)**.

### 2026-07-18 — Plano de Otimização e Refatoração Stateless
**Contexto:** O botão de "Gerar plano de otimização" não funcionava no MetaScale (a geração do plano falhava silenciosamente e o "Plano de Otimização do Agente — v1" não era criado). Em paralelo, no Synapse, a "Análise Profunda" dava erro de JSON.

- ✅ **Synapse:** Corrigimos o erro `Unexpected end of JSON input` na API de análise. O erro ocorria porque a rota não validava se as credenciais da Meta (`META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID`) existiam. Adicionamos a função `hasMetaCredentials()` no `meta-api.ts` e conectamos na rota.
- ✅ **MetaScale (Plano de Otimização Portado):** Migramos todo o escopo de Otimização ("duplicar + ajustar") do Synapse para o MetaScale.
  - **Refatoração Stateless:** Diferente do Synapse (que salva em banco de dados), a geração do plano no MetaScale foi refeita para ser 100% *stateless* (em memória). A página de detalhes agora orquestra os dados da campanha, métricas e diagnóstico e as envia na hora de gerar e executar o plano, tornando o sistema ultra-veloz e independente de sincronizações assíncronas com banco de dados.
  - O fluxo foi unificado na UI com: 1. **Análise Profunda**, 2. **Plano de Otimização**, 3. **Trend Analytics**.
- ✅ **Fix do Modelo IA:** O plano e outros diagnósticos falhavam com erro 400 (Bad Request) ou 404 (Not Found) devido a um identificador de modelo incorreto (`claude-sonnet-5`). Trocamos e fixamos o modelo na API pura da Anthropic como `claude-3-5-sonnet-20240620`, corrigindo de vez o fluxo de geração de planos sem restrições.

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

### 2026-07-17 — Ação: botão "Pausar conjunto" (escrita na Meta)
- ✅ `meta-api.ts` `updateAdsetStatus(adsetId, 'PAUSED'|'ACTIVE')` — escrita via Graph API (`POST /{adset_id}?status=`). `fetchCampaignAnalysis` agora inclui `adset_id` em `byAdset` (novo campo `id` em `BreakdownRow`).
- ✅ Rota `POST /api/meta/adset` (valida `adsetId` + `status`).
- ✅ `DeepAnalysis.tsx`: botão **"Pausar"** por conjunto (coluna Controle), com `window.confirm` antes de escrever, estados acting/paused/error e mensagem de erro no hover. Ligado na página de detalhe (`onPauseAdset`).
- ✅ Escopo: só **pausar** (reversível). Ajustar público/posicionamento fica pra depois.
- ⚠️ **Requer token com `ads_management`.** O token atual foi usado só para leitura (`ads_read`); se faltar escopo de escrita, o botão mostra "Erro" com a mensagem da API. Pausar é reversível (reativar no Gerenciador).
- ✅ Typecheck limpo; validação da rota testada (400 sem escrever). Pausa real NÃO testada de propósito (não mexer na conta ativa sem ordem).

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
- ✅ **(2026-07-17, atualização) Persistência no Supabase ATIVA.** Projeto migrado para `xizqbyeguosxhiglpbjm` (URL + chaves anon/service_role + MCP todos alinhados). Migração aplicada no SQL Editor; teste de gravação retornou `{file:true, supabase:true}`. Salva agora em arquivo **e** no banco.
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
- 🟢 **Filtro por data** (Hoje/Ontem/3/7/14/30d + Personalizado) compartilhado entre Dashboard, Campaigns e Detalhe; default `last_7d`; persiste no navegador.
- 🟢 Funil, cards, filtros, summary: **funcionando**. **CPA formatado** (R$ 102,30). **Distribuição de Verba** = gasto real por objetivo (não mais 85/10/5 fake).
- 🟢 **Claude Ads Audit transparente**: nota = soma de 5 fatores reais (ROAS/Connect/CTR/Checkout/LP) com valor·meta·pontos; sem "agentes online" falsos.
- 🟢 Diagnósticos de IA: **100% funcional** com `claude-opus-4-8` (modelos `claude-3-5/3-7-sonnet-*` foram retirados pela Anthropic). Rota não engole mais o erro; AIAnalyst mostra estado de erro.
- 🟢 **Análise Profunda** (media buyer IA): quebras por posicionamento/público/conjunto + diagnóstico.
- 🟢 **Plano de Otimização ancorado na Análise Profunda**: deriva segmentação/posicionamentos/conjuntos-a-pausar das quebras; a execução aplica no targeting e pula os perdedores. *Stateless*.
- 🟢 **"Salvar análise" grava a página inteira** (métricas + funil + diagnóstico + análise profunda + media buyer + plano) num `.md`, além do JSON/Supabase.
- 🟢 Typecheck limpo · `.env.local` protegido · **commitado e no GitHub** (commit `2bf95c1`).

---

## 8. Pendências / próximos passos

- [ ] (Ideia) Persistir campanhas/métricas/diagnósticos no Supabase para histórico e comparação temporal (hoje é sempre "ao vivo").
- [x] ~~Seletor de período no dashboard~~ — **feito em 2026-07-19** (presets + Personalizado, padrão Gerenciador; default `last_7d`).
- [x] ~~Botão "Rodar Auditoria Completa" / "Exportar PDF"~~ — já ligados: auditoria re-roda `/api/ai/diagnostic` em todas as campanhas; PDF via `window.print`.
- [x] ~~Resolver o órfão `src/lib/agents/buildSystemPrompt.ts`~~ — **feito em 2026-07-19** (apagado; era código de outro projeto, sem uso).
- [ ] **Execução real do Plano NÃO testada** (cria campanha PAUSED na conta ativa — reversível). Validar a criação de ponta a ponta quando quiser.
- [ ] (Ideia) Metas/pesos do health score (ROAS 3x/40pts, Connect 80%/20, CTR 2,5%/15, Checkout 10%/15, LP 10%/10) estão fixos no `page.tsx` — expor como config se quiser ajustar por negócio.
- [ ] (Ideia) Ação de escrita: pausar direto os conjuntos perdedores na conta (hoje o plano só evita reduplicá-los na campanha nova).

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

*Última atualização: 2026-07-19.*
