# Research Sources: claude-ads

Raw processed research documents used to build the claude-ads reference database.
These preserve the full context from each research source for future reference.

## Sources

| File | Source | Date | Pages/Words |
|------|--------|------|-------------|
| `gemini-research.md` | Gemini Deep Research | Feb 2026 | ~340 lines |
| `claude-research.md` | Claude Deep Research | Feb 2026 | Pending |

## How These Feed Into References

Research sources → extracted into structured `ads/references/` files → loaded on-demand by agents.
Each reference file cites which research source(s) it draws from.
