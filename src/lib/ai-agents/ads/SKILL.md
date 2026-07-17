---
name: ads
description: "Meta Ads (Facebook & Instagram) audit and optimization skill. Deep analysis with scoring, parallel agents, industry templates, and AI creative generation."
argument-hint: "audit | meta | creative | landing | budget | plan <type> | competitor | math | test | report | dna <url> | create | generate | photoshoot"
license: MIT
---

# Ads: Meta Ads (Facebook & Instagram) Audit & Optimization

Comprehensive Meta Ads account analysis (Facebook, Instagram, Advantage+).
Orchestrates specialized sub-skills and agents (Meta audit + creative pipeline).

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/ads audit` | Full Meta Ads audit with parallel subagent delegation |
| `/ads meta` | Meta Ads deep analysis (FB, IG, Advantage+) |
| `/ads creative` | Creative quality audit |
| `/ads landing` | Landing page quality assessment for ad campaigns |
| `/ads budget` | Budget allocation and bidding strategy review |
| `/ads plan <business-type>` | Strategic ad plan with industry templates |
| `/ads competitor` | Competitor ad intelligence analysis |
| `/ads math` | PPC financial calculator (CPA, ROAS, break-even, budget forecasting) |
| `/ads test` | A/B test design (hypothesis, significance, duration, sample size) |
| `/ads report` | PDF audit report generation for client deliverables |
| `/ads dna <url>` | Extract brand DNA from website, outputs `brand-profile.json` |
| `/ads create` | Generate campaign concepts + copy briefs, outputs `campaign-brief.md` |
| `/ads generate` | Generate AI ad images from brief, outputs to `ad-assets/` |
| `/ads photoshoot` | Product photography in 5 styles (Studio, Floating, Ingredient, In Use, Lifestyle) |

## Context Intake (Required: Always Do This First)

Before any audit or analysis, collect this context. Without it, benchmarks will
be generic and recommendations may be wrong for the user's situation.

Ask these questions upfront (combine into one message):

1. **Industry / Business type**: Which best describes you?
   SaaS · E-commerce · Local Service · B2B Enterprise · Info Products · Mobile App ·
   Real Estate · Healthcare · Finance · Agency · Other
2. **Monthly ad spend**: Total budget on Meta Ads (approximate is fine)
3. **Primary goal**: Sales / Revenue · Leads / Demos · App Installs · Calls · Brand

If the user provides data upfront (e.g. "audit my Meta Ads, I spend $5k/mo on e-commerce"),
extract context from that and proceed without re-asking.

Use the provided context to:
- Select the correct industry benchmarks from `references/benchmarks.md`
- Apply budget-appropriate recommendations
- Calibrate severity scoring (a $500/mo account has different priorities than $50k/mo)

## Orchestration Logic

When the user invokes `/ads audit`, delegate to subagents in parallel:
1. **Collect context** (see Context Intake above; do this first)
2. Collect account data (exports, screenshots, or pasted metrics)
3. Detect business type
4. Spawn subagent via Task tool with `context: fork`: audit-meta
5. **Validate**: verify the subagent returned valid JSON scores with required fields before aggregating
6. Collect results and generate unified report with Ads Health Score (0-100)
7. Create prioritized action plan with Quick Wins

For individual commands (`/ads meta`, etc.), load the relevant sub-skill directly.
Still collect context first if not already provided.

## Creative Workflow

Sequential pipeline (each step is independently runnable):
1. `/ads dna <url>` → `brand-profile.json` in current directory
2. `/ads create` → reads profile + optional audit results → `campaign-brief.md`
3. `/ads generate` → reads brief + profile → `ad-assets/` directory
4. `/ads photoshoot` → standalone or reads profile for style injection

Requires `GOOGLE_API_KEY` (Gemini default) or `ADS_IMAGE_PROVIDER` + matching key.
If API key is missing, `/ads generate` and `/ads photoshoot` display setup
instructions and exit; they never fail silently.

## Industry Detection

Detect business type from ad account signals:
- **SaaS**: trial_start/demo_request events, pricing page targeting, long attribution windows
- **E-commerce**: purchase events, product catalog/feed, Advantage+ Shopping campaigns
- **Local Service**: call ads, location targeting, store visits, directions events
- **B2B Enterprise**: ABM lists, high CPA tolerance ($50+), long sales cycle
- **Info Products**: webinar/course funnels, lead gen forms, low-ticket offers
- **Mobile App**: app install campaigns, in-app events, deep linking
- **Real Estate**: listing feeds, property-specific landing pages, geo-heavy targeting
- **Healthcare**: healthcare-specific ad policies
- **Finance**: Special Ad Categories declared, financial products compliance
- **Agency**: multiple client accounts, white-label reporting needs

## Quality Gates

Hard rules (never violate these):
- 3x Kill Rule: flag any ad set/campaign with CPA >3x target for pause
- Budget sufficiency: Meta ≥5x CPA per ad set
- Learning phase: never recommend edits during active learning phase
- Compliance: always check Special Ad Categories for housing/employment/credit/finance
- Attribution: default to 7-day click / 1-day view (Meta)
- Andromeda creative diversity: flag Meta accounts with <10 genuinely distinct creatives
- Privacy infrastructure gate: always verify tracking stack (CAPI, Events API) before making optimization recommendations
- PDF report quality gate: When generating reports via `/ads report`, always use `scripts/generate_report.py` with `--check` first. Reports must have: clean layout with no overlapping elements, proper margins (0.75in), word-wrapped table cells (no clipping), all charts/images sized within page boundaries, page numbers and section dividers, captions on every visual, and zero empty sections. Run `--check` before `--output` and fix any warnings before delivering the PDF

## Reference Files

Load these on-demand as needed; do NOT load all at startup.

**Path resolution:** All references are installed at `~/.claude/skills/ads/references/`.
When sub-skills or agents reference `ads/references/*.md`, resolve to
`~/.claude/skills/ads/references/*.md`.

- `references/scoring-system.md`: Weighted scoring algorithm and grading thresholds
- `references/benchmarks.md`: Industry benchmarks (CPC, CTR, CVR, ROAS)
- `references/bidding-strategies.md`: Bidding decision trees
- `references/budget-allocation.md`: Scaling rules, MER
- `references/conversion-tracking.md`: Pixel, CAPI, EMQ implementation
- `references/compliance.md`: Regulatory requirements, ad policies, privacy
- `references/meta-audit.md`: 46-check Meta Ads audit checklist
- `references/brand-dna-template.md`: Brand DNA schema and extraction guide
- `references/image-providers.md`: Provider config (Gemini/OpenAI/Stability/Replicate)
- `references/meta-creative-specs.md`: Feed/Reels/Stories specs + safe zones
- `references/voice-to-style.md`: Brand voice axis to visual attribute mapping for image generation
- `references/copy-frameworks.md`: 6 ad copy frameworks (AIDA, PAS, BAB, 4P, FAB, Star-Story-Solution)

## Scoring Methodology

### Ads Health Score (0-100)

Per-account score using weighted algorithm from `references/scoring-system.md`.

### Grading

| Grade | Score | Action Required |
|-------|-------|-----------------|
| A | 90-100 | Minor optimizations only |
| B | 75-89 | Some improvement opportunities |
| C | 60-74 | Notable issues need attention |
| D | 40-59 | Significant problems present |
| F | <40 | Urgent intervention required |

### Priority Levels

- **Critical**: Revenue/data loss risk (fix immediately)
- **High**: Significant performance drag (fix within 7 days)
- **Medium**: Optimization opportunity (fix within 30 days)
- **Low**: Best practice, minor impact (backlog)

## Sub-Skills

This skill orchestrates the following specialized sub-skills:

1. **ads-audit**: Full Meta Ads audit with parallel delegation
2. **ads-meta**: Meta Ads deep analysis (FB, IG, Advantage+)
3. **ads-meta-senior**: Senior Meta analytics engine (80x10x10 framework)
4. **ads-creative**: Creative quality audit
5. **ads-landing**: Landing page quality for ad campaigns
6. **ads-budget**: Budget allocation and bidding strategy
7. **ads-plan**: Strategic ad planning with industry templates
8. **ads-competitor**: Competitor ad intelligence
9. **ads-math**: PPC financial calculator
10. **ads-test**: A/B test design
11. **ads-dna**: Brand DNA extraction from website URL
12. **ads-create**: Campaign concepts, copy decks, creative briefs
13. **ads-generate**: AI image generation with pluggable providers
14. **ads-photoshoot**: Product photography in 5 professional styles

## Subagents

For parallel analysis during full audits:
- `audit-meta`: Meta Ads checks (M01-M46)
- `creative-strategist`: Campaign concepts from brand profile + audit results (Opus, maxTurns: 25)
- `visual-designer`: Image generation with brand injection via generate_image.py (Sonnet, maxTurns: 30)
- `copy-writer`: Headlines, CTAs, primary text within platform limits (Sonnet, maxTurns: 20)
- `format-adapter`: Asset dimension validation and spec compliance reporting (Haiku, maxTurns: 15)
