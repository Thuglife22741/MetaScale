import Anthropic from '@anthropic-ai/sdk';
import { CampaignMetrics, CampaignAnalysis, BreakdownRow } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function callDiagnostic(campaignName: string, metrics: CampaignMetrics) {
  const prompt = `Você é um analista sênior de performance e media buyer especialista em Meta Ads para e-commerce dropshipping. Sua função é diagnosticar campanhas com base no princípio 80x10x10 e gerar recomendações acionáveis.

Regras de diagnóstico:
- Connect Rate < 80%: problema de velocidade/UX da landing page ou desalinhamento criativo->página
- Conversão LP < 10%: oferta fraca, copy desalinhada, falta de prova social ou CTA fraco
- Conversão Checkout < 10%: checkout complexo, frete inesperado, falta de método de pagamento ou erro técnico
- ROAS < 2: campanha não cobre custos — não escalar
- CTR < 1%: criativo fraco ou público errado
- CPM alto com CTR baixo: audiência saturada ou criativo não performando
- CPA > 40% do ticket médio: margem comprometida

Classifique sempre o gargalo principal. Retorne JSON com:
{
  "gargalo": "string (nome da métrica problemática ou 'nenhum')",
  "diagnostico": "string (2-3 frases explicando o problema)",
  "recomendacoes": [
    { "texto": "string", "prioridade": "alta"|"media"|"baixa" }
  ]
}
Retorne somente o JSON, sem markdown.

Aqui estão os dados da campanha:
Campanha: ${campaignName}
Data: ${new Date().toISOString()}
Métricas: ${JSON.stringify(metrics, null, 2)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5', // Sonnet-tier (CLAUDE.md); substitui claude-sonnet-4 (retirado desta conta)
      max_tokens: 1024,
      // Desliga o thinking adaptativo (padrão no Sonnet 5) — diagnóstico é extração
      // de JSON baseada em regras; sem thinking fica mais rápido e não trunca a resposta.
      thinking: { type: 'disabled' },
      system: "Retorne apenas o JSON, sem markdown, sem texto adicional.",
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    // Pega o primeiro bloco de texto (com thinking ligado, content[0] pode não ser texto).
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      return safeParseJson(textBlock.text);
    }
    return null;
  } catch (error) {
    console.error('Error calling Anthropic:', error);
    throw error;
  }
}

/** Formata uma lista de quebras num texto compacto para o prompt. */
function fmtRows(rows: BreakdownRow[], limit = 20): string {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `- ${r.label}: gasto R$${r.spend.toFixed(0)}, compras ${r.compras}, ROAS ${r.roas.toFixed(2)}, CPA R$${r.cpa.toFixed(0)}, LPviews ${r.lp_views}, checkouts ${r.checkouts}`
    )
    .join('\n');
}

/**
 * Diagnóstico de media buyer: recebe as QUEBRAS (posicionamento, público, conjunto)
 * e aponta onde a verba está sendo desperdiçada + plano de ação priorizado.
 */
export async function callDeepDiagnostic(campaignName: string, analysis: CampaignAnalysis) {
  const prompt = `Você é um media buyer sênior de Meta Ads para e-commerce/dropshipping. Analise as QUEBRAS reais da campanha abaixo (últimos 30 dias) e identifique onde a verba está sendo mal alocada. Foque em decisões de mídia acionáveis: posicionamentos e públicos que desperdiçam budget, conjuntos para escalar vs pausar, e problemas estruturais (fragmentação de conjuntos, fase de aprendizado). ROAS abaixo de ~2 costuma ser prejuízo.

Campanha: ${campaignName}

POR POSICIONAMENTO:
${fmtRows(analysis.byPlacement)}

POR PÚBLICO (idade · gênero):
${fmtRows(analysis.byAge)}

POR CONJUNTO:
${fmtRows(analysis.byAdset)}

Retorne SOMENTE um JSON, sem markdown, no formato:
{
  "resumo": "string (2-3 frases: o diagnóstico central de media buying)",
  "vazamentos": [ { "tipo": "Posicionamento|Público|Estrutura|Checkout", "descricao": "onde está vazando verba e quanto" } ],
  "acoes": [ { "texto": "ação concreta", "prioridade": "alta|media|baixa", "impacto": "efeito esperado (ex: ROAS de X para Y)" } ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3500, // resposta rica (vazamentos + várias ações) — evita truncar o JSON
      thinking: { type: 'disabled' },
      system:
        'Retorne apenas o JSON, sem markdown, sem texto adicional. Limite a no máximo 4 vazamentos e 6 ações para caber na resposta.',
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      return safeParseJson(textBlock.text);
    }
    return null;
  } catch (error) {
    console.error('Error calling Anthropic (deep):', error);
    throw error;
  }
}

/** Extrai e parseia JSON mesmo que o modelo devolva com cercas de markdown. */
function safeParseJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: pega o primeiro bloco {...} encontrado.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Resposta da IA não é um JSON válido.');
  }
}
