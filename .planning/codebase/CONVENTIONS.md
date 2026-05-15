# MetaScale Conventions

Baseadas no arquivo `CLAUDE.md` e regras de "Governança de Elite":

## 1. Completude ("Boil the Lake")
- Nada de atalhos ("No shortcuts").
- Completude absoluta na implementação de funcionalidades.
- Rigor máximo na estruturação arquitetural e tratamento de "edge cases" (casos limite).

## 2. Segurança (CSO)
- **Zero chaves hardcoded**: Credenciais e chaves API devem residir unicamente em variáveis de ambiente (`.env.local` na raiz) e em secrets da Vercel/Supabase na nuvem.
- **Proteção da IA**: Atenção a Prompt Injections. Enforce de output em JSON strict na chamada da API (`system: "Retorne apenas o JSON."`).
- **Data Privacy**: As tabelas do Supabase devem sempre possuir políticas rigorosas de Row Level Security (RLS) para evitar vazamento cruzado entre contas (`auth.uid() = user_id`).

## 3. Design & UI (CEO)
- **Padrão Elite UI**: As interfaces devem ser limpas, corporativas e orientadas ao utilitarismo.
- Cores restritas definidas em `src/lib/colors.ts`. Nada de paletas genéricas.
- Ausência de "AI Slop" (elementos visuais desnecessários, gerados por IA sem polimento humano).

## 4. Código e Tipagem
- Uso mandatório de TypeScript para validação estática das métricas.
- Componentes organizados logicamente e separados por contexto de domínio.
