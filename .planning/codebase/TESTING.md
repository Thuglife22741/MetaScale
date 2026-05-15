# MetaScale Testing

Atualmente, o projeto não possui frameworks robustos de automação de testes unitários ou E2E configurados (ex: Jest, Cypress, Playwright).

## Recomendações Futuras
- **Testes Unitários**: Deve-se implementar testes para a lógica crítica (`src/lib/calc-8010x10.ts`) para assegurar as projeções de escala.
- **Mocking**: Mocks explícitos para integrações com APIs (Meta e Anthropic) a fim de evitar consumos indevidos durante pipelines de CI/CD.
- **Validação de Schemas**: Validação das entradas antes de serem persistidas no banco, utilizando Zod para garantir que dados incompletos não causem falhas na UI ou nos Handlers.
