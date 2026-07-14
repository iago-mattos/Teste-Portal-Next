# PortalNext — Testes E2E

Suíte E2E principal em **Playwright + TypeScript**, baseada nos casos oficiais de
[`Docs/TestesPortalC6(1).xlsx`](Docs/TestesPortalC6(1).xlsx).

O Cypress permanece no repositório apenas como legado temporário e referência
histórica. Novos testes, correções e execuções oficiais devem utilizar
Playwright.

## Estado atual

- 108/108 casos funcionais migrados para Playwright;
- 128 testes coletados em 31 arquivos, incluindo setup, smoke e integrações;
- integrações Portal → SCCI/AEJS disponíveis com massas dedicadas;
- execução protegida por tags `@readonly` e `@mutation`;
- Cypress preservado, mas fora do fluxo principal e da CI.

A coleta é a fonte atual do total de testes:

```bash
npm run pw:test:list
```

As decisões da migração e da arquitetura estão registradas em:

- [`Docs/PLAYWRIGHT_MIGRATION.md`](Docs/PLAYWRIGHT_MIGRATION.md);
- [`Docs/PLAYWRIGHT_ARCHITECTURE.md`](Docs/PLAYWRIGHT_ARCHITECTURE.md);
- [`Docs/PLAYWRIGHT_FINAL_EQUIVALENCE_AUDIT.md`](Docs/PLAYWRIGHT_FINAL_EQUIVALENCE_AUDIT.md).

## Pré-requisitos

- Node.js conforme [`.nvmrc`](.nvmrc);
- npm conforme `packageManager` do [`package.json`](package.json);
- acesso à VPN quando o ambiente exigir;
- credenciais e massas exclusivas de QA;
- Chromium do Playwright instalado.

Instalação inicial:

```bash
npm ci
npm run pw:install
```

## Configuração por ambiente

Cada ambiente possui um perfil completo, local e ignorado pelo Git. O arquivo
`.env.local` serve somente para escolher o perfil ativo:

```env
PW_PROFILE=desenv
```

Os dados ficam em `.env.<perfil>.local`, por exemplo:

```text
.env.desenv.local
.env.ht.local
.env.esteira.local
```

Para criar outro perfil:

```bash
cp .env.example .env.esteira.local
```

Preencha o novo arquivo e troque apenas `PW_PROFILE` no `.env.local`. Nunca
versione os perfis, credenciais, CPFs, magic links, cookies ou tokens.

### Grupos de configuração

- `PORTAL_URL`, `PORTAL_ADMIN_URL`: URLs do Portal e do Admin;
- `PORTAL_ADMIN_USER`, `PORTAL_ADMIN_PASSWORD`: autenticação do Admin de QA;
- `PORTAL_TEST_CPF`: CPF associado às massas do ambiente;
- `PORTAL_PROPOSAL_*`: operações dos casos funcionais;
- `PORTAL_EXPECTED_*`: contrato visual da massa padrão;
- `AEJS_URL`, `AEJS_USERNAME`, `AEJS_PASSWORD`: acesso ao SCCI/AEJS;
- `AEJS_USE_PLATFORM_ACCESS`, `AEJS_PATH`: modalidade de login do SCCI/AEJS;
- `PORTAL_INTEGRATION_*_OPERATION`: operações exclusivas das integrações;
- `ALLOW_TEST_MUTATION`: autorização explícita para testes que alteram estado;
- `ALLOW_REACT_418_QUARANTINE`: exceção diagnóstica temporária do frontend.

O setup do Portal acessa o Admin, gera um magic link e cria o `storageState` da
sessão. `PORTAL_ACCESS_URL` existe somente como fallback manual. O SCCI/AEJS é
autenticado dentro da fixture porque a sessão ExtJS não pode ser restaurada por
`storageState`.

Para o login C6, use `AEJS_USE_PLATFORM_ACCESS=true`. Para login direto, use
`false`. Quando `AEJS_PATH` estiver preenchido, o login direto será usado
independentemente dessa flag.

Valide o perfil sem abrir navegador e sem exibir segredos:

```bash
npm run config:check
```

Os scripts que executam navegador também validam o perfil automaticamente.

### Massas funcionais

| Variável | Estado exigido | Responsabilidade |
| --- | --- | --- |
| `PORTAL_PROPOSAL_DEFAULT` | Visível e em Cadastro | Smokes, formulários e validações gerais. |
| `PORTAL_PROPOSAL_CANCELED` | Cancelada no SCCI | Deve aparecer cancelada e sem ação de preenchimento. |
| `PORTAL_PROPOSAL_CREDIT_REJECTED` | Crédito Reprovado | Deve exibir a orientação de contato/e-mail. |
| `PORTAL_PROPOSAL_CREDIT_APPROVED` | Crédito ou fase posterior | Deve estar com o cadastro concluído. |
| `PORTAL_PROPOSAL_EXPIRED` | Expirada há no máximo 30 dias | Deve permanecer visível em modo de consulta. |
| `PORTAL_PROPOSAL_EXPIRED_OVER_30_DAYS` | Expirada há mais de 30 dias | Não deve aparecer; se aparecer, `PROP-10` deve falhar. |
| `PORTAL_PROPOSAL_TIMELINE_CADASTRO` | Parada em Cadastro | Jornada de cadastro pela timeline. |
| `PORTAL_PROPOSAL_TIMELINE_DOCUMENTS` | Parada em Documentos | Jornada de documentos; não pode ter avançado para 996. |

Não reutilize a mesma operação em estados incompatíveis. O validador rejeita
massas exclusivas duplicadas, mas o responsável pelo ambiente ainda deve
garantir o estado funcional correto de cada uma.

## Execução Playwright

### Qualidade, contrato e coleta

Não abrem navegador:

```bash
npm run check
npm run pw:test:list
```

`npm test` é um alias de `npm run check`.

### Execução segura

Smoke e casos funcionais somente leitura:

```bash
npm run pw:test:safe
```

Grupos somente leitura:

```bash
npm run pw:test:smoke
npm run pw:test:functional:readonly
npm run pw:test:integration:readonly
```

### Execução mutável

Testes `@mutation` podem preencher, confirmar ou consumir propostas e enviar
documentos. Antes de executá-los, configure no perfil ativo:

```env
ALLOW_TEST_MUTATION=true
```

Comandos:

```bash
npm run pw:test:functional:mutation
npm run pw:test:integration:mutation
```

### Suítes completas

Exigem `ALLOW_TEST_MUTATION=true` e todas as massas no estado esperado:

```bash
npm run pw:test:functional
npm run pw:test:integration
npm run pw:test:all
```

Para executar toda a suíte com navegador visível:

```bash
npm run pw:test:all -- --headed
```

O comando `pw:test:all` executa setup, smoke, funcionais e integrações. Não o
utilize como verificação cotidiana quando as massas mutáveis não puderem ser
restauradas.

### Arquivo ou caso isolado

Prefira validar o perfil antes de usar diretamente o CLI:

```bash
npm run config:check
npx playwright test tests/caminho/arquivo.spec.ts
npx playwright test -g "texto do caso"
```

Interface interativa e relatório HTML:

```bash
npm run pw:ui
npm run pw:report
```

Em falhas, o Playwright mantém screenshot, vídeo e trace em `test-results/` e o
relatório em `playwright-report/`.

## Integração Portal → SCCI/AEJS

Cada cenário usa uma operação própria definida no perfil ativo:

| Caso | Variável | Finalidade | Reexecução |
| --- | --- | --- | --- |
| `INT-CONFIRM-PJ` | `PORTAL_INTEGRATION_PJ_OPERATION` | Cônjuge, garantidor PJ, sócios e interveniente refletidos no SCCI. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-PF` | `PORTAL_INTEGRATION_PF_OPERATION` | Terceiro na renda e garantidor PF refletidos no SCCI. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-QUITADO` | `PORTAL_INTEGRATION_PAID_OFF_OPERATION` | Imóvel quitado, sem terceiro ou garantidor. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-WORKFLOW` | `PORTAL_INTEGRATION_WORKFLOW_OPERATION` | Envio de documentos e transição 997 → 998 → 996. | O avanço consome o estado da massa. |
| `INT-DOCUMENT-PERSISTENCE` | `PORTAL_INTEGRATION_DOCUMENT_PERSISTENCE_OPERATION` | Envia todos os documentos do Portal e os abre em `Documentos → Renda PF` no SCCI. | O envio consome a massa; leitura dos PDFs é repetível. |
| `INT-DOCUMENT-SIZE` | `PORTAL_INTEGRATION_DOCUMENT_SIZE_OPERATION` | Todos os seletores rejeitam PDFs de 25 MB e 50 MB, acima do limite de 10 MB. | Repetível, pois arquivos rejeitados não são persistidos. |

Não existem números históricos de fallback. Se uma variável de integração não
estiver configurada, a execução falha antes de usar uma operação indevida.

## Arquitetura Playwright

```text
tests/
├── components/       # widgets reutilizáveis do Portal e do AEJS
├── config/           # runtime config e seleção de ambiente
├── fixtures/         # composição, lifecycle, autenticação e teardown
├── functional/       # 108 contratos funcionais oficiais
├── helpers/          # funções puras e transformações
├── integrations/     # fluxos Portal → SCCI/AEJS
├── pages/            # Page Objects do Portal e do AEJS
├── setup/            # autenticação e validação de setup
├── smoke/            # verificações mínimas da fundação
└── test-data/        # contratos e massas tipadas
```

Projetos definidos em [`playwright.config.ts`](playwright.config.ts):

- `setup`: autenticação do Portal;
- `aejs-setup`: validação da configuração AEJS;
- `smoke`: fundação autenticada;
- `functional-readonly`: casos funcionais sem alteração persistente;
- `functional-mutation`: casos funcionais que alteram estado;
- `integration`: cenários Portal → SCCI/AEJS.

A suíte permanece serial (`workers: 1`) porque ainda há sessão, operações e
estados externos compartilhados. Não aumente workers sem comprovar isolamento
das massas envolvidas.

## CI

O GitHub Actions executa em `push` e `pull_request`:

1. `npm ci` sem baixar o binário do Cypress;
2. `npm run check`;
3. coleta completa do Playwright;
4. publicação da lista coletada como artefato.

A CI inicial não abre navegador nem executa cenários autenticados ou mutáveis.
Falhas de TypeScript, ESLint, contrato ou coleta quebram corretamente o job.

## Cypress legado

O diretório `cypress/`, seus scripts e dependências permanecem apenas para
consulta histórica e coexistência temporária. Eles não são a arquitetura
principal, não recebem novos casos e não são executados pela CI atual.

Quando uma comparação histórica for necessária:

```bash
npm run cy:open
npm run cy:run:smoke
npm run cy:run:functional
```

A remoção definitiva ocorrerá somente mediante decisão específica, depois de
confirmado que nenhum consumidor depende dos relatórios ou comandos legados.

## Regras de segurança

- nunca execute `@mutation` sem massa descartável ou restaurável;
- nunca compartilhe uma operação entre cenários com estados incompatíveis;
- nunca versione `.env.local` ou `.env.*.local`;
- nunca use credenciais ou dados de clientes reais;
- não aumente workers nem retries para mascarar colisões ou instabilidade;
- não use números de operações diretamente nas specs: altere somente o perfil;
- preserve o Cypress apenas como baseline histórica, não como modelo para novas
  implementações.
