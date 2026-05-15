# MetaScale Concerns

## 1. Confiabilidade da API e Rate Limits
- **Meta API**: As chamadas dependem de Tokens de Acesso. Existe o risco de expiração do Token (`token_expires_at`) ou recusa por limites de taxa (Rate Limits). É necessário gerenciar a expiração e tratar erros de requisição graciosamente.
- **Anthropic API**: Dependência total para o módulo de Diagnóstico. Falhas de rede ou estouro de cota precisam exibir "Fallback UIs" consistentes em vez de crashes não tratados (`try-catch` já em vigor em `anthropic.ts`, mas a UI deve refletir as mensagens de erro).

## 2. Injeção e Segurança (Prompt Injections)
- De acordo com `CLAUDE.md`, é estritamente proibido abrir portas para Prompt Injections. Como os dados das campanhas são provenientes da API Meta (que injeta strings como nomes de campanha no prompt), há um vetor muito pequeno, mas real. Evite interpolar inputs originados diretamente pelo usuário em prompts críticos sem higienização.

## 3. Desempenho e Estado
- Consultar a base do Supabase em cascata ou realizar cálculos repetitivos de projeção de escala (80x10x10) pode causar lentidão se o volume de simulações for muito grande. É essencial focar no desempenho e cache caso haja relatórios muito pesados sendo gerados frequentemente.
- Evitar client-side waterfalls e extrair o máximo do Next.js Server Components e React Server Actions para data fetching.

## 4. RLS e Vazamentos (Supabase)
- Apesar do RLS estar ativado nas migrations, a implementação cuidadosa do Auth deve acompanhar os queries. Um query rodado em nível de admin ou no servidor (via Service Role Key, se houver) vai furar a camada RLS. Certificar que chamadas frontend usam a `anon_key` adequadamente junto com o header de autenticação.
