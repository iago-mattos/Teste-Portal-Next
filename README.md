# PortalNext — Testes E2E

Suíte E2E principal em **Playwright + TypeScript**, baseada nos casos oficiais de
[`Docs/TestesPortalC6(1).xlsx`](Docs/TestesPortalC6(1).xlsx).

O Cypress permanece no repositório apenas como legado temporário e referência
histórica. Novos testes, correções e execuções oficiais devem utilizar
Playwright.

## Estado atual

- 108/108 casos funcionais migrados para Playwright;
- 162 testes regulares coletados em 43 arquivos, incluindo setup, smoke, Core e integrações;
- batch documental consumível isolado da coleta regular e de `pw:test:all`;
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

Em ambientes cujas propostas são criadas pelo simulador, as massas ficam em
um segundo arquivo local, `.env.<perfil>.masses.local`. O carregamento ocorre
na ordem: variáveis do terminal/CI, perfil estático e overlay de massas. O
overlay aceita apenas `PORTAL_TEST_CPF`, `PORTAL_PROPOSAL_*`,
`PORTAL_INTEGRATION_*`, `PORTAL_EXPECTED_*` e `PORTAL_MASS_*`; por isso ele não
consegue sobrescrever URLs, credenciais ou proteções de execução.

Para criar outro perfil:

```bash
cp .env.example .env.esteira.local
cp .env.masses.example .env.esteira.masses.local
```

Preencha o novo arquivo e troque apenas `PW_PROFILE` no `.env.local`. Nunca
versione os perfis, credenciais, CPFs, magic links, cookies ou tokens.

### Grupos de configuração

- `PORTAL_URL`, `PORTAL_ADMIN_URL`: URLs do Portal e do Admin;
- `PORTAL_ADMIN_USER`, `PORTAL_ADMIN_PASSWORD`: autenticação do Admin de QA;
- `PORTAL_TEST_CPF`: CPF associado às massas do ambiente;
- `PORTAL_SIMULATOR_*`: CPF, prefixo de nome, e-mail e celular usados para
  gerar novas propostas pelo simulador;
- `PORTAL_PROPOSAL_*`: operações dos casos funcionais;
- `PORTAL_EXPECTED_*`: contrato visual da massa padrão;
- `AEJS_URL`, `AEJS_USERNAME`, `AEJS_PASSWORD`: acesso ao SCCI/AEJS;
- `AEJS_USE_PLATFORM_ACCESS`, `AEJS_PATH`: modalidade de login do SCCI/AEJS;
- `AEJS_WORKFLOW_*`: códigos, títulos e status do workflow no SCCI/AEJS;
- `PORTAL_INTEGRATION_*_OPERATION`: operações exclusivas das integrações;
- `PORTAL_INTEGRATION_PROFESSIONAL_ACTIVITY`, `PORTAL_INTEGRATION_HOUSE_USE` e
  `PORTAL_INTEGRATION_APARTMENT_USE`: rótulos de domínio usados na preparação
  quando diferirem entre C6 e Esteira Digital;
- `PORTAL_CORE_CAPABILITIES`: capacidades Core comprovadas pelas massas do
  perfil; não depende do nome do ambiente ou do cliente;
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
npm run config:check:core
```

`config:check` valida a suíte funcional e as integrações. `config:check:core`
valida somente as capacidades Core declaradas e as massas exigidas por elas.
Os scripts que executam navegador também validam o escopo correspondente.

### Provisionamento de massas pela EsteiraHT

O simulador possui um provisionador separado da suíte funcional. Cada uma das
15 propostas tem nome, finalidade, estado esperado e variável de ambiente
próprios em `tests/test-data/provisioning-slots.json`. Os protocolos e o
progresso ficam somente em
`.playwright/generated-simulations/<perfil>.json`; esse registro é atômico,
ignorado pelo Git e permite retomar uma execução sem trocar silenciosamente a
massa de um caso.

A quantidade desejada é configurada no overlay local:

```env
PORTAL_MASS_BATCH_STATUS=pending
PORTAL_MASS_TARGET_COUNT=5
```

O valor pode variar de 1 a 15 e seleciona os papéis na ordem do catálogo. Cada
slot automático recebe um CPF sintético válido e exclusivo, gerado somente no
momento da reserva e persistido no registro local. Assim, uma retomada reutiliza
o mesmo CPF e protocolo em vez de trocar a identidade silenciosamente.

Os nomes são curtos e identificam a finalidade diretamente, por exemplo
`Playwright CANC`, `Playwright BASE`, `Playwright PJ`, `Playwright FLOW` e
`Playwright DOCMAX`. O catálogo é a fonte oficial desses nomes.

Primeiro execute o piloto no slot `CANCELED`, que é o primeiro papel oficial:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:pilot
```

Para acompanhar visualmente todo o fluxo do piloto — simulador, criação da
proposta e validação dos dados refletidos no SCCI — execute:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:pilot -- --headed
```

Os argumentos escritos depois de `--` são encaminhados diretamente ao
Playwright. O mesmo padrão aceita, por exemplo, `--debug`.

O piloto abre primeiro o simulador, cria o slot `Playwright CANC`, captura o
protocolo e somente então autentica na EsteiraHT para validar no SCCI os dados
pessoais, contato e simulação. Após a validação, essa primeira operação deve ser
movida externamente para o estado Cancelada e confirmada com
`npm run pw:provision:mark-ready -- CANCELED`.

Após o piloto aprovado, um slot pode ser criado isoladamente:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:create -- DEFAULT
npm run pw:provision:status
```

Para criar e validar visualmente um slot oficial específico:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:create -- DEFAULT --headed
```

Para executar sequencialmente a quantidade configurada:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:create-batch
```

O lote é fail-fast: na primeira rejeição ou falha ele para e mantém o registro
dos slots já processados. Uma nova execução reutiliza protocolos existentes em
vez de criar propostas duplicadas. Dos 15 papéis, 14 são criados pelo simulador.
`TIMELINE_DOCUMENTS` é ignorado deliberadamente porque precisa compartilhar o
CPF de `DEFAULT` para validar várias propostas no mesmo login.

Depois de criar manualmente a segunda proposta com o CPF exibido para
`Playwright BASE`, use o nome `Playwright BASE 02`, registre sua operação e
avance-a para Documentos:

```bash
npm run pw:provision:register-manual -- TIMELINE_DOCUMENTS 000000000
npm run pw:provision:mark-ready -- TIMELINE_DOCUMENTS
```

Propostas que exigem estado externo — cancelada, expirada, crédito ou
documentos — devem ser preparadas no SCCI/Admin e somente então confirmadas no
registro. O comando não altera o SCCI; ele declara que o responsável verificou
a pré-condição:

```bash
npm run pw:provision:mark-ready -- CANCELED
```

Quando os 14 slots oficiais estiverem prontos, confirme no perfil estático
`PORTAL_MASS_DEFAULT_PHASE` e `PORTAL_MASS_DEFAULT_INTEREST_TYPE` observados na
massa `DEFAULT` e publique o overlay:

```bash
npm run pw:provision:publish
npm run config:check
```

`config:check` bloqueia a suíte completa no perfil `esteira-ht` enquanto o
overlay não estiver com `PORTAL_MASS_BATCH_STATUS=ready`. O slot `RESERVE`
existe apenas para reposição e não é publicado como massa oficial.
Um lote menor que 14 pode ser usado em validações focadas, mas não publica a
configuração completa porque faltariam aliases obrigatórios para `pw:test:all`.

### Provisionamento de massas no C6 HT

O C6 possui um segundo provisionador, isolado do simulador público da
EsteiraHT. Ele autentica diretamente no SCCI/AEJS do perfil `ht`, executa
`Originação → Realizar nova simulação`, grava a proposta com CPF válido e nome
do catálogo e conclui a preparação preenchendo e relendo o CEP residencial do
pretendente. Não são usados `force`, espera fixa ou IDs dinâmicos do ExtJS.

O contrato da simulação fica parametrizado no perfil:

```env
C6_PROVISION_TARGET_COUNT=15
C6_PROVISION_TERM_MONTHS=72
C6_PROVISION_APPLICANT_POSTAL_CODE=24120440
```

O registro retomável é exclusivo do C6 e fica em
`.playwright/generated-c6-simulations/ht.json`. Se a proposta já tiver
protocolo, a retomada abre a mesma operação e continua pelo preenchimento do
CEP; ela não cria uma duplicata silenciosa.

Crie primeiro um único papel e acompanhe o resultado:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:create -- DEFAULT --headed
npm run pw:provision:c6:status
```

Depois do piloto, execute sequencialmente a quantidade configurada:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:create-batch
```

O lote é fail-fast, usa um worker e nunca recomeça os slots já registrados.
`TIMELINE_DOCUMENTS` continua manual porque precisa compartilhar o CPF de
`DEFAULT`, uma restrição que o simulador interno não atende. Depois de criar a
operação compartilhada, registre-a com:

```bash
npm run pw:provision:c6:register-manual -- TIMELINE_DOCUMENTS 000000000
```

Os papéis que exigem cancelamento, expiração, decisão de crédito ou avanço para
Documentos ainda precisam da preparação externa correspondente. Depois de
confirmar o estado real, marque cada papel como pronto e publique o overlay:

```bash
npm run pw:provision:c6:mark-ready -- CANCELED
npm run pw:provision:c6:publish
```

O provisionador apenas cria a base em Cadastro e preenche o CEP; ele não
antecipa as transições funcionais específicas de cada teste.

### Provisionamento das massas persistentes do Portal Core

As massas de gaps persistentes ficam separadas do lote funcional e são
configuradas no overlay local do ambiente:

```env
PORTAL_CORE_DOCUMENT_A_OPERATION=000000000
PORTAL_CORE_DOCUMENT_B_OPERATION=000000000
PORTAL_CORE_CAD_A_OPERATION=000000000
PORTAL_CORE_CAD_B_OPERATION=000000000
PORTAL_CORE_FINALIZATION_OPERATION=000000000
PORTAL_CORE_REGISTRATION_OPERATION=000000000
PORTAL_CORE_REGISTRATION_EXPECTED_NAME="Playwright CORE CAD"
PORTAL_CORE_DOCUMENTS_OPERATION=000000000
PORTAL_CORE_DOCUMENTS_EXPECTED_NAME="Playwright CORE DOC"
PORTAL_CORE_FOREIGN_OPERATION=000000000
PORTAL_CORE_FOREIGN_EXPECTED_NAME="Playwright CORE IDOR"
```

Os testes Core não são liberados pelo nome do perfil. Cada perfil declara
somente as capacidades que suas massas realmente suportam:

```env
PORTAL_CORE_CAPABILITIES=restorable-draft,controlled-document-slot,registration-form
```

| Capacidade | Pré-condição comprovada |
| --- | --- |
| `restorable-draft` | Proposta dedicada em Cadastro cujo valor original pode ser restaurado e relido. |
| `controlled-document-slot` | Proposta documental reutilizável para falhas controladas, sem consumir o workflow. |
| `registration-form` | `PORTAL_CORE_REGISTRATION_OPERATION` editável em Cadastro para campos, datas e CEP. |
| `same-owner-registration-documents` | `PORTAL_CORE_REGISTRATION_OPERATION` e `PORTAL_CORE_DOCUMENTS_OPERATION`, do mesmo usuário e em etapas distintas. |
| `foreign-owner-operation` | `PORTAL_CORE_FOREIGN_OPERATION`, real e pertencente a outra identidade, para autorização horizontal read-only. |
| `restorable-registration-pair` | CAD A/B qualificadas por mutação, restauração e nova leitura. |
| `consumable-document-pair` | DOC A/B novas, vazias e reservadas para uma única execução consumível. |

Declarar uma capacidade não substitui o preflight funcional do cenário. Se a
massa não estiver no estado esperado, o teste deve falhar claramente. Quando a
capacidade não for aplicável ou ainda não estiver qualificada, o teste é
registrado como skip com a capacidade ausente, sem depender de `PW_PROFILE`.
Essas três massas Core possuem variáveis próprias e nunca devem substituir
`PORTAL_PROPOSAL_DEFAULT` ou as massas da timeline funcional.

As cinco operações também devem constar em
`PORTAL_MASS_OPERATION_CPFS_JSON`. O provisionador valida que DOC A/B
compartilham uma identidade, CAD A/B compartilham outra e FINAL usa uma terceira,
sem publicar os CPFs nos relatórios.

Execute uma única vez, somente depois de criar as cinco propostas e preencher
no Admin os dados de origem que não são editáveis no Portal:

```bash
PW_PROFILE=<perfil> ALLOW_TEST_MUTATION=true npm run pw:provision:core-masses
```

O comando é propositalmente separado de `pw:test:all` e executa com um worker:

- DOC A/B são preenchidas, confirmadas e verificadas em Documentos com ao menos
  dois slots vazios;
- FINAL é preenchida e salva, mas permanece antes da confirmação final;
- CAD A/B permanecem em Cadastro e só são classificadas como restauráveis após
  persistir um marcador temporário, restaurar o original e comprovar ambos por
  nova leitura.

DOC A/B e FINAL são consumíveis. Não reexecute o provisionamento completo sobre
essas mesmas operações depois da primeira preparação bem-sucedida.

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
| `PORTAL_PROPOSAL_TIMELINE_DOCUMENTS` | Parada em Documentos | Jornada de documentos; não pode ter avançado para a tarefa seguinte configurada no ambiente. |

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
ALLOW_TEST_MUTATION=true npm run pw:test:core
```

`pw:test:core` executa os projetos desktop e mobile. Cada perfil roda apenas os
grupos cujas capacidades foram qualificadas em `PORTAL_CORE_CAPABILITIES`.

O batch documental Portal Core possui comando isolado e não participa de
`pw:test:all`:

```bash
PW_PROFILE=<perfil> ALLOW_TEST_MUTATION=true npm run pw:test:core:consumable-documents
```

Esse comando consome slots reais. Só pode ser usado com um novo par DOC A/B
qualificado e vazio. As operações já registradas como `CONSUMED` não podem ser
reutilizadas nem reprovisionadas; consulte
`PORTAL_CORE_CONSUMABLE_BATCH_PLAN.md` antes de qualquer execução.

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

O comando `pw:test:all` executa os blocos na ordem funcional: Portal, simulador,
preparações mutáveis Portal → SCCI e validações read-only no SCCI. Mesmo que um
bloco falhe, os blocos seguintes são coletados e o relatório consolidado fica
em `playwright-report/index.html`. Não o utilize como verificação cotidiana
quando as massas mutáveis não puderem ser restauradas.

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

### Relatório Portal minimalista

Além do HTML oficial do Playwright, a suíte gera dados para um relatório próprio
em React, Vite e componentes shadcn. Ele oferece filtros por resultado e projeto,
agrupamento por projeto e domínio, diagnóstico destacado de falhas, detalhes das
etapas, lightbox de screenshots, vídeos e controles para baixar ou abrir traces.

Para validar o visual com os smokes pequenos do perfil selecionado e guardar
evidências inclusive dos testes aprovados:

```bash
PW_PROFILE=ht npm run pw:test:report:sample
npm run pw:report:portal:open
```

Na execução cotidiana, a política continua econômica: screenshot, vídeo e trace
são preservados em falhas. `PW_EVIDENCE=all` deve ser usado somente quando for
útil documentar também os testes aprovados. Para montar ou abrir o relatório da
última execução manualmente:

```bash
npm run pw:report:portal:build
npm run pw:report:portal
```

O resultado fica em `portal-report/index.html` e não é versionado. O comando
`pw:test:all` consolida automaticamente tanto o relatório oficial em
`playwright-report/` quanto o relatório Portal em `portal-report/`.

### Reutilização do relatório em outro projeto

O relatório também é distribuído como o pacote local
`@prognum/playwright-report`. Para gerar o arquivo instalável:

```bash
npm run pw:report:package
```

O pacote será criado em
`artifacts/prognum-playwright-report-0.1.0.tgz`. No projeto Playwright de
destino, execute:

```bash
npm install -D /caminho/prognum-playwright-report-0.1.0.tgz
npx prognum-playwright-report init
npm run pw:test:report
npm run pw:report:open
```

O `init` preserva o `playwright.config.*` original e cria uma configuração
adicional somente para o relatório. Ele também adiciona os scripts e entradas
de `.gitignore`. Título, produto, cor, domínios, política de evidências e pasta
de saída ficam centralizados no arquivo `prognum-report.config.mjs` do projeto
consumidor.

## Integração Portal → SCCI/AEJS

Cada cenário usa uma operação própria definida no perfil ativo:

| Caso | Variável | Finalidade | Reexecução |
| --- | --- | --- | --- |
| `INT-CONFIRM-PJ` | `PORTAL_INTEGRATION_PJ_OPERATION` | Cônjuge, garantidor PJ, sócios e interveniente refletidos no SCCI. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-PF` | `PORTAL_INTEGRATION_PF_OPERATION` | Terceiro na renda e garantidor PF refletidos no SCCI. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-QUITADO` | `PORTAL_INTEGRATION_PAID_OFF_OPERATION` | Imóvel quitado, sem terceiro ou garantidor. | Preparação exige massa nova/restaurada; validação SCCI é repetível. |
| `INT-CONFIRM-WORKFLOW` | `PORTAL_INTEGRATION_WORKFLOW_OPERATION` | Envio de documentos e validação das tarefas configuradas em `AEJS_WORKFLOW_*`. | O avanço consome o estado da massa. |
| `INT-DOCUMENT-PERSISTENCE` | `PORTAL_INTEGRATION_DOCUMENT_PERSISTENCE_OPERATION` | Envia todos os documentos do Portal e os abre em `Documentos → Renda PF` no SCCI. | O envio consome a massa; leitura dos PDFs é repetível. |
| `INT-DOCUMENT-SIZE` | `PORTAL_INTEGRATION_DOCUMENT_SIZE_OPERATION` | Todos os seletores rejeitam PDFs de 25 MB e 50 MB, acima do limite de 10 MB. | Repetível, pois arquivos rejeitados não são persistidos. |

Não existem números históricos de fallback. Se uma variável de integração não
estiver configurada, a execução falha antes de usar uma operação indevida.

As três etapas verificadas em **Andamento do Processo** são parametrizadas por
ambiente: cadastro concluído, documentos concluídos e próxima validação. Cada
etapa possui `TASK_CODE`, `TASK_TITLE` e `TASK_STATUS`; assim, uma Esteira com
códigos ou descrições diferentes não exige alteração nas specs.

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
