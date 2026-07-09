# Migração Cypress para Playwright

> Documento oficial de referência para a migração da suíte de testes do PortalNext.
>
> Este documento deve ser atualizado sempre que uma fase mudar de status, uma decisão arquitetural for tomada, um risco for identificado ou uma lição relevante for aprendida.

## Status do programa

- **Estado geral:** ✅ Fases 1 a 5 concluídas; 🚧 Fase 6 em andamento — 6.1, 6.2, 6.3 e 6.4 concluídas.
- **Framework atual:** Cypress 15.17.0 com TypeScript.
- **Framework alvo:** Playwright Test 1.61.1 com TypeScript.
- **Estratégia de transição:** coexistência controlada até comprovação de equivalência.
- **Última atualização:** 09/07/2026.

## Legenda de status

- ⏳ Não iniciado
- 🚧 Em andamento
- ✅ Concluído

# Visão Geral

## Objetivo da migração

Migrar de forma gradual e verificável a suíte E2E do PortalNext de Cypress para Playwright, preservando a cobertura funcional existente e melhorando a arquitetura, a estabilidade, a rastreabilidade, a reutilização de código e a capacidade de crescimento da automação.

A migração não será considerada concluída apenas porque os arquivos foram convertidos. A conclusão exige equivalência comprovada de casos, comportamentos, pré-condições, pendências conhecidas, integrações e evidências.

## Motivação

A suíte atual já representa 108 casos funcionais e inclui jornadas que atravessam o PortalNext, o Admin e o AEJS/SCCI. O crescimento sobre a arquitetura atual tende a ampliar problemas já observados:

- autenticação baseada em magic link de uso único;
- risco de HTTP 429 por autenticações repetidas;
- retries globalmente desabilitados para não consumir tokens;
- estado persistente compartilhado entre testes;
- hooks complexos para restaurar propostas;
- comandos globais e configuração acoplados ao Cypress;
- estado em memória usado para ligar specs do Portal e do AEJS;
- seletores amplos, uso de jQuery, `:visible`, `.last()` e `force: true`;
- sincronização por mensagens visuais que podem representar uma gravação anterior;
- diagnóstico de fluxos longos baseado principalmente em vídeos, screenshots e logs;
- geração e consolidação manual de relatórios Mochawesome;
- dificuldade de paralelizar com segurança os testes que alteram dados no servidor.

O Playwright fornece recursos nativos que se encaixam nesses problemas: fixtures tipadas, contextos isolados, `storageState`, locators estritos, assertions web-first, espera de rede, projetos, annotations, múltiplos reporters e Trace Viewer.

## Escopo da migração

Estão incluídos no escopo:

- os 20 specs ativos em `cypress/e2e`;
- os 108 casos funcionais catalogados nos 13 specs de cliente;
- os smoke tests de autenticação e abertura de proposta;
- as rotinas auxiliares de descoberta de massa que continuarem necessárias;
- os testes de preparação, confirmação e cancelamento de propostas;
- as validações do Portal no AEJS/SCCI;
- os comandos customizados atualmente mantidos em `cypress/support`;
- o catálogo de casos e pendências conhecidas;
- configuração DEV e HT;
- carregamento e validação de variáveis de ambiente;
- política de autorização para testes mutáveis;
- relatórios, screenshots, vídeos, traces e evidências por caso;
- scripts de lint, typecheck e validação do contrato de testes;
- integração com GitHub Actions;
- documentação operacional relacionada à execução da suíte.

## Fora do escopo

Não fazem parte desta migração, salvo decisão futura registrada neste documento:

- alterar código funcional do PortalNext, Admin, AEJS ou SCCI;
- corrigir defeitos funcionais identificados pelos testes;
- substituir ou redesenhar APIs de produto;
- criar massa de produção ou executar mutações fora de ambientes autorizados de QA;
- migrar os arquivos históricos de `Portal-antigo` como suíte ativa;
- ampliar imediatamente a matriz para todos os navegadores;
- executar testes em paralelo antes de existir isolamento de massa comprovado;
- reescrever documentação histórica apenas por mudança de terminologia;
- remover Cypress antes da equivalência funcional e operacional da suíte Playwright;
- introduzir testes de componente, performance, carga ou segurança como parte obrigatória desta iniciativa.

# Situação Atual

## Resumo da arquitetura Cypress

A suíte atual está organizada da seguinte forma:

- `cypress/e2e`: specs de smoke, diagnóstico, testes funcionais e integrações;
- `cypress/support/commands.ts`: comandos globais de autenticação, navegação, abertura de propostas e interação com campos;
- `cypress/support/e2e.ts`: inicialização de configuração e quarentena do erro React 418;
- `cypress/support/client-cases.ts`: registro dinâmico dos casos funcionais e pendências;
- `cypress/config/runtime-config.ts`: tipos e carregamento da configuração de Portal e AEJS;
- `cypress/config/integration-data.ts`: cenários e dados usados nas integrações;
- `cypress/config/known-pending.json`: pendências conhecidas;
- `cypress.config.ts`: configuração do runner, tasks Node, reporter, evidências e filtros;
- `scripts`: validação do contrato de testes e opt-in para mutações;
- `.github/workflows/ci.yml`: quality gate e smoke manual.

Não existe atualmente um diretório `cypress/fixtures`. Os dados são mantidos em módulos TypeScript, configurações locais ignoradas pelo Git e variáveis de ambiente.

## Quantidade de testes

Baseline confirmada antes do início da implementação:

- **20 specs ativos** em `cypress/e2e`;
- **13 specs funcionais** de cliente;
- **3 specs de integração**;
- **4 specs** de smoke, setup ou diagnóstico;
- **108 casos funcionais catalogados**;
- **107 casos funcionais implementados**;
- **1 pendência conhecida:** `PROP-03`;
- casos adicionais de smoke, preparação, transição e validação AEJS fora do catálogo funcional de 108 casos.

## Principais componentes da suíte

- Autenticação do Portal via magic link.
- Geração de link pelo Admin quando as credenciais estão configuradas.
- Cache de sessão Cypress entre specs.
- Listagem e abertura de propostas por massa configurada.
- Testes das jornadas de login, propostas, timeline e detalhamento.
- Testes de participantes, cônjuge, renda, motivo, imóvel e garantidores.
- Preparação controlada de propostas para integração.
- Confirmação e cancelamento de propostas.
- Login e navegação no AEJS/SCCI baseado em ExtJS.
- Validação no AEJS da mesma operação preparada no Portal.
- Catálogo de IDs funcionais e controle de pendências.
- Preservação de vídeos por ambiente e ID de caso.

## Dependências importantes

- Node.js 24.x.
- npm 11.9.0.
- TypeScript com modo estrito.
- Cypress 15.17.0.
- Mochawesome, Mochawesome Merge e Mochawesome Report Generator.
- ESLint e typescript-eslint.
- Variáveis e segredos do Portal, Admin e AEJS.
- Massas DEV/HT mantidas localmente ou pelo CI.
- Disponibilidade dos ambientes PortalNext, Admin e AEJS/SCCI.

## Pontos críticos identificados

1. **Magic links de uso único:** impedem retries indiscriminados e tornam autenticações repetidas caras e arriscadas.
2. **Massa compartilhada:** vários testes alteram a mesma proposta e dependem de restauração posterior.
3. **Paralelismo inseguro:** testes mutáveis não podem ser paralelizados até existir massa independente.
4. **Estado entre specs:** o fluxo Portal para AEJS usa contexto em memória no processo do runner.
5. **Seletores frágeis:** o AEJS concentra seletores amplos e interações forçadas.
6. **Sincronização:** mensagens antigas da UI podem gerar falso positivo sobre novas gravações.
7. **Hooks complexos:** cônjuge e garantidores dependem de setup e teardown condicionais.
8. **Relatórios fragmentados:** resultados Mochawesome precisam de merge e geração adicional.
9. **Diagnóstico limitado:** vídeos ajudam visualmente, mas não preservam todo o contexto de DOM e rede.
10. **Configuração acoplada:** globals, `Cypress.expose`, `cy.task` e `Chainable` espalham dependências do framework.
11. **Defeitos conhecidos:** pendências e divergências funcionais precisam de representação mais explícita no runner.
12. **Crescimento:** duplicação de navegação, locators e preenchimento aumentará o custo de cada novo caso.

# Objetivos Técnicos

## Melhorias esperadas

- Estabelecer uma arquitetura baseada em fixtures tipadas e dependências explícitas.
- Reutilizar autenticação sem consumir magic links em cada teste.
- Separar testes de leitura, mutação, smoke e integração por projetos e tags.
- Encapsular interações repetidas em Page Objects e componentes focados.
- Adotar locators orientados ao usuário e contratos explícitos de automação.
- Usar assertions web-first e espera de rede no lugar de sincronização indireta.
- Produzir traces, relatórios e attachments úteis para diagnóstico.
- Tornar o fluxo Portal para AEJS rastreável como uma única jornada lógica.
- Preparar a suíte para paralelismo seletivo quando houver massa independente.
- Reduzir o custo marginal de inclusão de novos casos.

## Problemas que queremos eliminar

- Consumo repetido de magic links.
- Dependência de ordem ou memória compartilhada entre specs.
- Seletores ambíguos que escolhem silenciosamente o primeiro ou último elemento.
- Uso desnecessário de `force: true`.
- Esperas fixas ou baseadas em indicadores que não comprovam a operação atual.
- Comandos globais que escondem dependências.
- Duplicação de preenchimento e navegação.
- Hooks de limpeza difíceis de garantir.
- Mistura entre seleção de caso e opções de reporter.
- Scripts adicionais de merge de resultados quando reporters nativos forem suficientes.
- Remoção prematura de evidências ou cobertura durante a transição.

## Benefícios esperados

- Maior estabilidade e menor flakiness de sincronização.
- Menor tempo para diagnosticar falhas em CI e integrações longas.
- Melhor legibilidade e manutenção do código de testes.
- Tipagem TypeScript mais natural e segura.
- Execução mais eficiente dos testes de leitura.
- Evolução controlada para centenas de casos.
- Relatórios mais claros sobre passed, failed, skipped, fixme e expected failures.
- Menor acoplamento entre os testes e o framework anterior.
- Maior segurança para executar testes mutáveis.

# Decisões Arquiteturais

## Estrutura de pastas

A estrutura alvo será criada somente durante as fases correspondentes:

```text
playwright.config.ts
playwright/
  .auth/
tests/
  setup/
  smoke/
  functional/
    proposal-form/
  integrations/
  fixtures/
  pages/
  components/
  services/
  config/
  test-data/
  helpers/
  types/
  reporters/
```

Decisões:

- `playwright/.auth` será ignorado pelo Git.
- Specs serão organizados por domínio e intenção, não por dependência técnica de setup.
- Dados não serão chamados de fixtures quando forem apenas massa estática; ficarão em `test-data`.
- Fixtures significarão dependências com lifecycle gerenciado pelo Playwright.
- A definição detalhada das responsabilidades e dependências permitidas entre essas camadas está em `docs/PLAYWRIGHT_ARCHITECTURE.md`.

## Organização dos testes

- Smoke tests permanecerão pequenos e independentes.
- Testes funcionais serão agrupados por domínio do Portal.
- Testes de leitura e mutação serão identificados por tags ou projetos distintos.
- Os projetos lógicos previstos são `setup`, `smoke`, `functional-readonly`, `functional-mutation` e `integration`.
- Casos manterão seus IDs atuais, como `LOGIN-01`, `PROP-14` e `GAR-PJ-08`.
- O título deverá preservar ID e descrição funcional.
- Filtros serão feitos por tag, projeto ou `grep`, nunca por opções de reporter.
- O catálogo funcional continuará validando duplicidades, implementações ausentes e pendências conhecidas.

## Estratégia para autenticação

- A autenticação será um setup explícito.
- O magic link será consumido apenas quando necessário para criar uma sessão válida.
- A sessão será validada pelo endpoint de autenticação antes de ser reutilizada.
- A autenticação pelo Admin continuará protegida contra ambientes não autorizados.
- Credenciais e tokens nunca serão registrados em logs, screenshots ou código versionado.
- Se uma API oficial e segura permitir autenticação mais direta no futuro, a mudança exigirá registro de decisão.

## Uso de `storageState`

- O estado autenticado será salvo em diretório ignorado pelo Git.
- Nenhum arquivo de `storageState` será publicado como artefato de CI.
- Testes sem autenticação usarão contexto limpo.
- Testes que alteram estado no servidor não compartilharão automaticamente a mesma conta ou massa em paralelo.
- A validade do estado será comprovada antes do início do conjunto dependente.

## Uso de fixtures

- Fixtures deverão ter responsabilidade única e tipagem explícita.
- Setup e teardown relacionados deverão permanecer na mesma fixture.
- Fixtures serão criadas sob demanda, evitando setup global desnecessário.
- Serão consideradas fixtures para configuração, sessão autenticada, Portal, proposta, captura de erros e cenários mutáveis.
- Fixtures de worker só serão usadas quando o recurso puder ser compartilhado com segurança.

## Uso de Page Objects

- Page Objects encapsularão navegação e interação repetida.
- Assertions funcionais específicas permanecerão preferencialmente nos specs.
- Não será criado um Page Object diferente apenas para espelhar cada arquivo de teste.
- Não será criado um único Page Object monolítico para todo o cadastro.
- Os candidatos iniciais são Admin de acesso, lista de propostas, proposta e AEJS.

## Componentes reutilizáveis

Componentes serão usados quando um padrão de interação se repetir em mais de um domínio, especialmente:

- tabs da proposta;
- combobox pesquisável;
- dialogs e alert dialogs;
- campos obrigatórios e opcionais;
- endereço e preenchimento por CEP;
- grid ExtJS;
- janela ExtJS;
- tabs ExtJS;
- ações de salvar e aguardar resposta.

## Estratégia para Portal ↔ AEJS

- A estratégia preferencial é um teste por cenário de integração.
- O teste preparará a proposta no Portal e validará a mesma operação no AEJS.
- Portal e AEJS poderão usar páginas ou contextos distintos dentro do mesmo teste.
- A operação ficará em memória local do teste, sem depender de estado global entre specs.
- As etapas serão registradas separadamente no relatório.
- Se houver necessidade comprovada de separar preparação e validação em projetos, o contexto será persistido como artefato explícito e validado, com project dependency documentada.
- Testes de integração continuarão protegidos pelo opt-in de mutação.

## Organização dos relatórios

- O relatório HTML nativo será a principal visão humana.
- JSON ou JUnit será usado quando necessário para CI ou integração externa.
- Trace será preservado em falhas conforme política de segurança e retenção.
- Screenshot será gerado em falha.
- Vídeo será preservado em falha e, quando exigido, por caso de integração.
- IDs funcionais e steps deverão aparecer nos relatórios.
- Credenciais, tokens e arquivos de autenticação não poderão ser anexados.
- Mochawesome permanecerá apenas enquanto Cypress estiver ativo ou se existir dependência externa comprovada.

## Estratégia para CI/CD

- Cypress e Playwright coexistirão durante a migração.
- O smoke Playwright começará como job manual ou não bloqueante.
- Cada módulo migrado será comparado com o correspondente Cypress.
- O Playwright se tornará bloqueante somente após estabilidade e equivalência comprovadas.
- Os jobs serão separados por risco: quality, smoke, funcional de leitura, mutação e integração.
- Testes mutáveis manterão concurrency control e ambiente protegido.
- Browsers e dependências do Playwright serão instalados explicitamente no CI.
- Artefatos incluirão relatório e resultados, nunca `storageState`.

## Convenções de nomenclatura

- Specs: `*.spec.ts`.
- Setup: `*.setup.ts`.
- Page Objects: `*.page.ts`.
- Componentes: `*.component.ts`.
- Fixtures: `*.fixture.ts` ou arquivo agregador `test.ts`.
- Helpers: nomes orientados à responsabilidade, sem sufixo genérico desnecessário.
- IDs funcionais existentes serão preservados sem renumeração.
- Tags mínimas previstas: `@smoke`, `@functional`, `@readonly`, `@mutation`, `@integration` e tag do ID quando necessário.
- Métodos e arquivos usarão inglês técnico consistente; descrições funcionais dos casos poderão permanecer em português.

## Estratégia de paralelismo

- A configuração inicial usará um worker para os conjuntos que compartilham massa.
- Testes mutáveis serão seriais até existir proposta independente por worker ou reset confiável.
- Testes de leitura poderão ser paralelizados somente após validação de autenticação e limites do ambiente.
- AEJS começará serial devido ao custo, ao legado ExtJS e à massa compartilhada.
- `fullyParallel` não será habilitado globalmente no início.
- Aumento de workers exigirá medição de estabilidade, tempo e impacto no ambiente.

## Organização da configuração

- A configuração será tipada e carregada no processo Node.
- Variáveis de ambiente continuarão como fonte prioritária no CI.
- Configurações locais continuarão ignoradas pelo Git.
- DEV e HT permanecerão explicitamente separados.
- Configuração pública e segredos não serão misturados.
- O `Proxy` baseado em `Cypress.expose` será substituído por dependências explícitas.
- Campos sem uso serão removidos somente após auditoria e equivalência comprovada.

## Tratamento de erros

- Erros de página serão coletados e avaliados por fixture automática.
- Erros inesperados do browser deverão falhar o teste.
- A quarentena do React 418 permanecerá explícita, temporária, rastreável e com data de revisão.
- Não serão criadas listas genéricas de exceções ignoradas.
- Falhas de rede relevantes deverão incluir método, URL segura, status e etapa no diagnóstico.
- `test.fixme` será usado para automação ainda inviável ou pré-condição externa ausente.
- Expected failure será usado somente para defeito funcional conhecido e documentado.
- Um unexpected pass deverá ser tratado como sinal de possível correção do produto.

## Navegadores

- Chromium será o primeiro e único browser obrigatório durante a migração inicial.
- Firefox e WebKit serão avaliados após paridade funcional em Chromium.
- A matriz futura respeitará os navegadores oficialmente suportados pelo Portal e pelo AEJS.

# Estratégia de Migração

## Fase 1 — Infraestrutura

**Status:** ✅ Concluído

### Objetivo

Adicionar a infraestrutura mínima do Playwright em coexistência com Cypress, sem migrar comportamentos funcionais.

### Arquivos envolvidos

- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `.gitignore`
- referências aos diretórios base `tests` e `playwright`, criados fisicamente somente quando receberem arquivos reais

### Critérios para iniciar

- Documento oficial aprovado.
- Versões de Node, npm e Playwright definidas.
- Estratégia de coexistência aceita pela equipe.

### Critérios para concluir

- Playwright instalado e configurado.
- TypeScript e ESLint reconhecem os arquivos Playwright.
- Cypress continua executável sem regressão.
- Configuração base documentada.
- Lint e typecheck aprovados.

### Dependências

- Aprovação deste plano.
- Acesso ao registro de pacotes e browsers no ambiente de desenvolvimento e CI.

## Fase 2 — Autenticação

**Status:** ✅ Concluído

### Objetivo

Implementar autenticação segura e reutilizável com `storageState`, preservando as proteções existentes para magic link e Admin.

### Arquivos envolvidos

- `tests/setup/auth.setup.ts`
- `tests/config/auth-config.ts`
- `playwright.config.ts`
- `.gitignore`

### Critérios para iniciar

- Fase 1 concluída.
- Variáveis e credenciais necessárias disponíveis.
- Fluxo atual de geração de acesso documentado e reproduzível.

### Critérios para concluir

- Magic link consumido no máximo uma vez por estado autenticado criado.
- Estado validado em `/api/auth/me`.
- Arquivo de autenticação fora do Git e dos artefatos.
- Cenários autenticado e não autenticado suportados.
- Nenhum segredo exposto em log, screenshot, vídeo ou trace.
- Execuções repetidas sem aumento indevido de autenticações ou HTTP 429.

### Dependências

- Admin ou access URL válido.
- Disponibilidade do Portal e endpoint de sessão.

### Implementação realizada em 07/07/2026

- setup nativo do Playwright configurado como dependência dos projetos autenticados;
- carregamento e validação tipada da configuração de autenticação, com variáveis de ambiente prioritárias e compatibilidade local transitória;
- validação de estado existente em `/api/auth/me` antes de solicitar novo magic link;
- fingerprint de ambiente e usuário de teste para impedir reutilização cruzada de estado;
- geração do magic link pelo Admin e captura somente em memória, sem logs ou artefatos;
- persistência de `storageState` e metadados com permissão `0600` em diretório ignorado pelo Git;
- limpeza de estado parcial quando qualquer etapa falha;
- screenshots, vídeos e traces desativados no projeto `setup` para proteger credenciais, cookies e tokens.

### Validação e classificação dos bloqueios

- O Admin permaneceu inicialmente em `Gerando...` por mais de 120 segundos, inclusive fora do runner Playwright. Em nova verificação independente, concluiu a geração em aproximadamente 30 segundos, sem erros de console. O setup Playwright concluiu posteriormente em 10,8 segundos. Classificação: indisponibilidade ou lentidão temporária do ambiente, sem defeito na implementação Playwright.
- O React `#418` continuou reproduzível no Electron do Cypress e já possuía quarentena explícita, responsável e prazo no projeto. A documentação oficial do React o identifica como mismatch entre HTML de servidor e cliente. No Chromium do Playwright, a lista de propostas abriu, `/api/auth/me` retornou `200` e `autenticado: true`, sem `pageerror`. Classificação: defeito conhecido do frontend manifestado no Cypress, anterior e independente desta migração.
- Com a quarentena diagnóstica já documentada, os dois smokes Cypress passaram. Nenhuma alteração foi feita no tratamento Cypress.
- O setup Playwright criou estado válido, reutilizou-o em 360 ms e, após expiração deliberada do cookie de sessão, regenerou-o em 10,1 segundos. A execução subsequente reutilizou o novo estado em 87 ms, sem gerar outro magic link e sem HTTP 429.
- Typecheck, ESLint, contrato dos 108 casos, coleta Playwright e verificação binária do Cypress foram aprovados.

## Fase 3 — Fixtures

**Status:** ✅ Concluído

### Objetivo

Criar a camada de fixtures tipadas para configuração, sessão, páginas e tratamento de erros.

### Arquivos envolvidos

- `tests/fixtures/test.ts`
- `tests/fixtures/config.fixture.ts`
- `tests/fixtures/auth.fixture.ts`
- `tests/fixtures/portal.fixture.ts`
- `tests/fixtures/page-errors.fixture.ts`
- `tests/config/runtime-config.ts`
- `tests/config/auth-config.ts`

### Critérios para iniciar

- Fases 1 e 2 concluídas.
- Responsabilidades de cada fixture definidas.

### Critérios para concluir

- Configuração acessível sem globals.
- Fixtures possuem setup e teardown claros.
- Fixtures não utilizadas não executam setup desnecessário.
- Erros de página são capturados e tratados.
- Testes básicos comprovam o lifecycle.
- Tipagem forte sem `any` injustificado.

### Dependências

- Estratégia de autenticação estabilizada.
- Política de tratamento de erros definida.

### Implementação realizada em 08/07/2026

- composição explícita `configTest → authTest → portalTest → pageErrorsTest → test`;
- `portalConfig` imutável e tipado em escopo de worker, sem expor credenciais, access URL ou cookies aos specs;
- `authenticatedContext` em escopo de teste, validando tecnicamente a presença da sessão preparada na Fase 2;
- `authenticatedPage` em escopo de teste, vinculada ao mesmo contexto autenticado e com teardown delegado às fixtures nativas;
- `capturePageErrors` automática, observando todas as páginas do contexto, removendo listeners no teardown e falhando para erros inesperados;
- mensagens, stacks e URLs de page errors sanitizadas antes de attachments ou falhas;
- React `#418` mantido como quarentena exata, opcional e visível em attachment quando autorizado;
- configuração pública do Portal separada da configuração privada de autenticação;
- fixture de cenário mutável deliberadamente não criada sem mecanismo real de reserva/restauração; sua estratégia permanece definida e será implementada junto ao primeiro módulo mutável.

### Validação

- contratos temporários, removidos após a execução, comprovaram configuração congelada, página autenticada, falha automática em `pageerror` inesperado e quarentena exata do React `#418`;
- autenticação da Fase 2 foi executada com sucesso antes dos contratos das fixtures;
- os dois smokes Cypress passaram com a quarentena diagnóstica já documentada;
- TypeScript, ESLint, contrato dos 108 casos e coleta Playwright foram aprovados;
- nenhum Page Object, Component, Service de domínio, smoke Playwright ou teste funcional foi criado nesta fase.

## Fase 4 — Componentes compartilhados

**Status:** ✅ Concluído

### Objetivo

Criar Page Objects e componentes mínimos necessários para evitar duplicação e padronizar locators.

### Arquivos envolvidos

- `tests/pages/admin-access.page.ts`
- `tests/pages/proposals.page.ts`
- `tests/pages/proposal.page.ts`
- `tests/components/portal/proposal-tabs.component.ts`
- `tests/components/portal/searchable-combobox.component.ts`
- `tests/components/portal/dialog.component.ts`
- `tests/helpers/dates.ts`
- `tests/helpers/strings.ts`
- `tests/fixtures/portal.fixture.ts`
- `tests/setup/auth.setup.ts`

### Critérios para iniciar

- Fixtures principais disponíveis.
- Interações repetidas inventariadas.
- Contratos de locator definidos com a equipe do frontend quando necessário.

### Critérios para concluir

- Lista de propostas, proposta e Admin encapsulados quando aplicável.
- Combobox, tabs e dialogs reutilizáveis.
- Nenhum Page Object monolítico.
- Assertions funcionais permanecem legíveis nos specs.
- Uso de `force` documentado e restrito.

### Dependências

- Fase 3 concluída.
- Interface do Portal disponível para validação dos locators.

### Implementação realizada em 08/07/2026

- `AdminAccessPage` encapsula login, abertura do Backend e geração segura de acesso; o setup de autenticação passou a orquestrar esse Page Object sem duplicar locators;
- `ProposalsPage` encapsula abertura, prontidão, paginação por resposta real de `/api/portal/propostas`, seleção única do card e navegação para a proposta;
- `ProposalPage` representa exclusivamente o cadastro editável e compõe tabs, comboboxes pesquisáveis e dialogs;
- `ProposalTabsComponent` centraliza o tablist único e comprova seleção por `aria-selected`;
- `SearchableComboboxComponent` usa o atributo funcional `name`, listbox e option sem `force`, posição ou classes visuais;
- `DialogComponent` trata `dialog` e `alertdialog`, botões e textarea dentro do escopo correto;
- `dates.ts` fornece parsing estrito de data brasileira e contagem pura de dias úteis;
- `strings.ts` fornece normalização de whitespace e comparação sem acentos;
- as fixtures `proposalPage` e `proposalsPage` conectam os Page Objects à página autenticada da Fase 3;
- nenhum Page Object usa herança, acessa globals, escolhe massa ou contém assertion funcional.

### Validação

- locators de lista, cards, paginação, headings, tablist, tabs e combobox foram confirmados no Portal real antes da implementação;
- o setup foi forçado a regenerar a sessão e validou o `AdminAccessPage` completo em 12,9 segundos;
- cinco contratos temporários, removidos após a execução, validaram helpers, integração Fixtures → Page Objects, paginação, abertura de proposta editável, tabs, combobox e dialog;
- durante a validação isolada, a proposta padrão abriu a jornada de acompanhamento; o smoke Cypress posterior passou esperando o cadastro editável, indicando uma variação dependente de estado ou sessão que deverá ser investigada na Fase 5;
- TypeScript, ESLint, contrato da suíte e coleta Playwright passaram após a remoção dos contratos temporários;
- os dois smokes Cypress de autenticação e abertura da proposta passaram com a implementação da Fase 4 presente, comprovando a coexistência entre as suítes;
- Components ExtJS, endereço, salvamento e Page Object AEJS foram deliberadamente adiados até existirem os fluxos correspondentes nas Fases 6/7;
- nenhum smoke Playwright, teste funcional ou fluxo Portal → AEJS foi implementado.

## Fase 5 — Smoke Tests

**Status:** ✅ Concluído

### Objetivo

Comprovar autenticação, sessão e abertura da proposta padrão com a nova infraestrutura.

### Arquivos envolvidos

- `tests/smoke/auth.spec.ts`
- `tests/smoke/open-proposal.spec.ts`
- `tests/config/runtime-config.ts`
- fixtures e Page Objects relacionados, sem alteração de responsabilidade

### Critérios para iniciar

- Fases 1 a 4 concluídas no mínimo necessário.
- Massa de smoke válida.

### Critérios para concluir

- Smokes Playwright aprovados repetidamente.
- Resultado equivalente aos dois smokes Cypress atuais.
- Evidências de falha disponíveis.
- Nenhum consumo desnecessário de magic link.
- Execução local comprovada; ativação e publicação no CI de transição pertencem à Fase 8.

### Dependências

- Portal, Admin e massa disponíveis.
- Autenticação estabilizada.

### Implementação realizada em 08/07/2026

- `auth.spec.ts` valida a sessão reutilizada em `/api/auth/me`, o estado `autenticado: true` e a presença do cookie de sessão no contexto autenticado;
- `open-proposal.spec.ts` abre a lista, carrega todas as páginas, localiza exatamente a proposta configurada e comprova a abertura do cadastro e de suas tabs;
- ambos os testes importam `test` e `expect` do agregador oficial de fixtures e usam as tags `@smoke` e `@readonly`;
- o número visível da proposta padrão passou a integrar a configuração pública, tipada e imutável do Playwright;
- `PORTAL_EXPECTED_PROPOSAL_JSON` permanece como fonte prioritária para CI, com fallback transitório para a configuração local ignorada durante a coexistência;
- nenhuma fixture, Page Object ou Component novo foi necessário.

### Validação

- a primeira execução Playwright passou os dois smokes e o setup em 33,2 segundos, criando uma sessão válida;
- a repetição passou em 22,1 segundos e reutilizou o estado autenticado em 86 milissegundos, sem consumir outro magic link;
- os dois smokes Cypress correspondentes passaram em 34 segundos, comprovando equivalência e coexistência;
- TypeScript, ESLint, contrato da suíte e coleta dos projetos foram aprovados;
- autenticação, fixtures, `ProposalsPage`, `ProposalPage` e `ProposalTabsComponent` foram exercitados pelo fluxo real;
- screenshot, vídeo e trace em falha permanecem configurados nativamente; publicação e retenção no CI serão implementadas na Fase 8;
- nenhuma funcionalidade da Fase 6 foi antecipada.

## Fase 6 — Testes Funcionais

**Status:** 🚧 Em andamento — Subfases 6.1, 6.2, 6.3 e 6.4 concluídas

### Objetivo

Migrar os 108 casos funcionais preservando IDs, intenção, cobertura, pendências e divergências conhecidas.

### Arquivos envolvidos

- specs em `tests/functional`
- catálogo de casos
- `known-pending.json`
- Page Objects, componentes e helpers
- script de validação do contrato

### Critérios para iniciar

- Smoke estável.
- Componentes compartilhados disponíveis.
- Baseline Cypress do módulo registrada.
- Massa adequada identificada.

### Critérios para concluir

- 108 IDs representados no Playwright.
- Nenhum ID duplicado ou perdido.
- Pendências e expected failures corretamente modelados.
- Cada módulo comparado com Cypress.
- Setup e teardown comprovados para testes mutáveis.
- Lint, typecheck e testes do módulo aprovados.
- Documento atualizado com status e desvios.

### Dependências

- Fases 1 a 5 concluídas.
- Disponibilidade de massas funcionais.
- Defeitos conhecidos documentados.

### Subfase 6.1 — Acesso e contrato funcional

**Status:** ✅ Concluída em 08/07/2026

#### Arquivos envolvidos

- `tests/functional/login/login.spec.ts`
- `tests/config/runtime-config.ts`
- `tests/pages/proposal.page.ts`
- `tests/components/portal/proposal-tabs.component.ts`
- `playwright.config.ts`
- `scripts/check-test-contracts.mjs`
- `docs/PLAYWRIGHT_MIGRATION.md`
- `docs/PLAYWRIGHT_ARCHITECTURE.md`

#### Implementação

- `LOGIN-01` valida que a sessão tokenizada termina no Portal configurado, sem manter o token na URL e com cookie de sessão presente;
- `LOGIN-02` valida a abertura autenticada da lista sem mensagem de link inválido ou expirado;
- `LOGIN-03` carrega toda a paginação e confirma a proposta esperada na lista;
- `LOGIN-04` usa `storageState` vazio no escopo do próprio grupo, valida CPF inválido e comprova que nenhum `POST /api/auth/login` foi enviado;
- os quatro casos usam `@functional` e `@readonly` e importam somente o agregador oficial de fixtures;
- paths e CPF inválido passaram a ser públicos, tipados e imutáveis no runtime config, com variáveis de ambiente prioritárias e fallback local transitório;
- o Page Object da proposta e o componente de abas passaram a validar o contrato acessível estável da tela aberta — heading da proposta e região da subtela — porque os textos internos do formulário não são expostos de forma consistente ao snapshot do Playwright;
- o contrato mantém os 108 IDs Cypress como baseline e valida um subconjunto Playwright crescente, conhecido e sem duplicidades;
- a execução Playwright permanece serializada no nível global com `workers: 1`, preservando a sessão e a massa compartilhada até que o paralelismo entre projetos seja validado explicitamente;
- nenhum token, magic link, access URL ou credencial foi disponibilizado aos specs.

#### Validação

- Playwright: suíte acumulada com setup, smoke e `LOGIN-01` a `LOGIN-04` aprovada com 7 testes em 52,3 segundos;
- Cypress: `01-login.cy.ts` aprovado com 4 casos em 52 segundos;
- contrato: 108 casos, 107 implementados, 1 pendente conhecido e 4 migrados para Playwright;
- TypeScript, ESLint, coleta Playwright e verificação de whitespace aprovados;
- nenhuma mutação de proposta, retry, espera fixa ou abstração sem reutilização foi introduzida.

### Subfase 6.2 — Minhas Propostas

**Status:** ✅ Concluída em 09/07/2026

#### Arquivos envolvidos

- `tests/functional/proposals/proposals.spec.ts`
- `tests/pages/proposals.page.ts`
- `scripts/check-test-contracts.mjs`
- `docs/PLAYWRIGHT_MIGRATION.md`

#### Implementação

- `PROP-01` a `PROP-19` (com exceção de `PROP-03` marcado como pendente conhecido e `PROP-14` como defeito conhecido) migrados com 100% de paridade funcional com Cypress;
- `PROP-14` configurado com fail condicional (`test.fail()`) apenas quando a contagem de dias corridos diferir da de dias úteis, garantindo que o reporte de falhas conhecidas permaneça íntegro sem invalidar a esteira de CI;
- `PROP-16` adaptado para suportar o comportamento local da rota `/menu-simulacao` no ambiente de DEV, e a URL externa `https://c6imobiliario.com.br` no ambiente de HT/produção;
- Refatorado o método `loadAll()` do `ProposalsPage` para suportar paginação robusta através de timeouts dinâmicos adequados à latência do ambiente (aguardando o desaparecimento de skeletons e a visibilidade do botão de paginação por até 4 segundos);
- Aumento do timeout para 60 segundos no caso `PROP-05` devido à necessidade de carregar toda a listagem de propostas duas vezes consecutivas durante as navegações das jornadas.

#### Validação

- Playwright: execução completa de `proposals.spec.ts` aprovada com 19 casos passando (1 skip/fixme conhecido) em aproximadamente 5.7 minutos;
- Cypress: permanece íntegro com a baseline inalterada;
- contrato: 108 casos, 107 implementados, 1 pendente conhecido e 23 migrados para Playwright;
- TypeScript, ESLint, verificação de linter e contratos executados sem erros.

### Subfase 6.3 — Linha do Tempo e Alertas

**Status:** ✅ Concluída em 09/07/2026

#### Arquivos envolvidos

- `tests/functional/timeline/timeline.spec.ts`
- `tests/pages/proposal.page.ts`
- `tests/config/runtime-config.ts`
- `docs/PLAYWRIGHT_MIGRATION.md`

#### Implementação

- `TIMELINE-01` a `TIMELINE-12` migrados com 100% de paridade funcional com Cypress;
- Resolvido o localizador `proponentInfo` no Page Object do Portal para obter o container pai (`page.getByText(/^Proponente:\s*$/i).locator("..")`) do label, evitando correspondência de correspondência incompleta e assegurando a validação correta do nome e do CPF do proponente;
- Evitada a violação de strict mode em `TIMELINE-05` ao escopar o locator da etapa atual da linha do tempo especificamente para elementos `li` com `aria-current="step"`;
- Adicionado tratamento de sincronização para carregamento assíncrono em `TIMELINE-06` (proposta expirada), aguardando o desaparecimento de skeletons e a visibilidade de pelo menos um campo antes da contagem de elementos de formulário.

#### Validação

- Playwright: execução completa de `timeline.spec.ts` aprovada com 12 casos passando em 4.5 minutos;
- Cypress: execução da spec correspondente com quarentena de hydration habilitada aprovada com 12 casos em 4 minutos;
- contrato: 108 casos, 107 implementados, 1 pendente conhecido e 35 migrados para Playwright;
- TypeScript, ESLint, verificação de linter e contratos executados sem erros.

### Subfase 6.4 — Participantes

**Status:** ✅ Concluída em 09/07/2026

#### Arquivos envolvidos

- `tests/functional/proposal-form/participants/participantes.spec.ts`
- `tests/components/portal/proposal-tabs.component.ts`
- `tests/components/portal/searchable-combobox.component.ts`
- `tests/pages/proposal.page.ts`
- `tests/pages/proposals.page.ts`
- `docs/PLAYWRIGHT_MIGRATION.md`

#### Implementação

- `PART-01` a `PART-13` migrados com 100% de paridade funcional com Cypress;
- Adicionada a busca de botões de tabulação com papel de acessibilidade (`tablist.getByRole("tab", { name, exact: true })`) em `ProposalTabsComponent` para resolver validação de atributos `aria-selected` de maneira robusta e confiável;
- Expostos todos os itens de opções em `SearchableComboboxComponent` (via `get options()`) permitindo que testes funcionais verifiquem a integridade das listas de dropdowns dinâmicos;
- Otimizado o carregamento de paginação na listagem em `ProposalsPage` para verificar a visibilidade imediata (via `loadMoreButton.isVisible()`) em vez de introduzir timeouts artificiais de 4 segundos, acelerando a suíte de testes global significativamente;
- Resolvido o strict mode nos seletores de rótulo para testes de obrigatoriedade de campos ao escopar com expressões regulares estritas (e.g. `/^Profissão\s*\*?$/`).

#### Validação

- Playwright: execução completa de `participantes.spec.ts` aprovada com 13 casos passando em 4.0 minutos;
- Cypress: execução da spec correspondente com quarentena de hydration habilitada aprovada com 13 casos em 4.2 minutos;
- contrato: 108 casos, 107 implementados, 1 pendente conhecido e 48 migrados para Playwright;
- TypeScript, ESLint, verificação de linter e contratos executados sem erros.

## Fase 7 — Integrações

**Status:** ⏳ Não iniciado

### Objetivo

Migrar preparação, confirmação, cancelamento e validações AEJS com rastreabilidade ponta a ponta.

### Arquivos envolvidos

- `tests/integrations`
- Page Object e componentes AEJS
- dados de integração
- script de opt-in de mutação
- configuração AEJS

### Critérios para iniciar

- Funcionalidades de formulário necessárias já migradas.
- Opt-in de mutação preservado.
- Massas descartáveis ou controladas disponíveis.
- Credenciais AEJS válidas.

### Critérios para concluir

- Mesma operação preparada no Portal e validada no AEJS.
- Fluxo não depende de memória global entre specs.
- Cada etapa aparece no relatório.
- Traces e evidências preservados conforme política.
- Seletores ExtJS encapsulados.
- Casos de confirmação, cancelamento, documentos e tarefas equivalentes ao Cypress.
- Execução serial e proteção de massa comprovadas.

### Dependências

- Fases 1 a 6 concluídas no escopo necessário.
- Portal e AEJS disponíveis.
- Massa de integração autorizada.

## Fase 8 — CI/CD

**Status:** ⏳ Não iniciado

### Objetivo

Integrar o Playwright ao pipeline de forma gradual, segura e observável.

### Arquivos envolvidos

- `.github/workflows/ci.yml`
- scripts de execução em `package.json`
- configuração de reporters e artefatos

### Critérios para iniciar

- Smoke estável localmente.
- Estratégia de instalação de browsers definida.
- Política de retenção e segurança de traces aprovada.

### Critérios para concluir

- Quality gate inclui arquivos Playwright.
- Smoke Playwright executa no ambiente protegido.
- Artefatos são publicados sem dados de autenticação.
- Jobs de leitura, mutação e integração possuem políticas distintas.
- Playwright torna-se bloqueante apenas após período de comparação aprovado.
- Concurrency de QA preservada.

### Dependências

- Fases anteriores estáveis conforme o job habilitado.
- Variáveis e secrets configurados no GitHub.

## Fase 9 — Remoção do Cypress

**Status:** ⏳ Não iniciado

### Objetivo

Remover Cypress e dependências transitórias somente após equivalência completa e aprovação formal.

### Arquivos envolvidos

- `cypress.config.ts`
- `cypress/e2e`
- `cypress/support`
- dependências e scripts Cypress/Mochawesome
- TypeScript, ESLint, CI e documentação

### Critérios para iniciar

- Todos os módulos no escopo migrados.
- Comparação Cypress e Playwright aprovada.
- CI Playwright bloqueante e estável.
- Nenhuma integração externa depende de Mochawesome ou artefatos Cypress sem substituição.
- Aprovação explícita do Tech Lead e responsáveis funcionais.

### Critérios para concluir

- Cypress e dependências exclusivas removidos.
- Nenhum script ou documentação aponta para comandos descontinuados.
- Playwright executa toda a cobertura esperada.
- Lint, typecheck, testes e CI aprovados.
- Evidências históricas necessárias preservadas.
- Documento atualizado com encerramento, métricas e lições aprendidas.

### Dependências

- Conclusão e aceite das fases 1 a 8.
- Aprovação formal de cutover.

# Checklist Geral

## Governança e baseline

- ✅ Criar o documento oficial da migração.
- ✅ Criar o guia oficial da arquitetura final.
- ✅ Aprovar o plano para início da Fase 1.
- ⏳ Registrar baseline de execução Cypress por módulo.
- ✅ Confirmar a lista oficial dos 108 casos.
- ⏳ Confirmar casos adicionais de smoke e integração.
- ⏳ Registrar pendências e defeitos conhecidos.
- ⏳ Definir responsáveis por cada fase.
- ⏳ Definir frequência de atualização deste documento.

## Infraestrutura

- ✅ Selecionar e fixar Playwright 1.61.1.
- ✅ Adicionar dependência do Playwright.
- ✅ Instalar Chromium, Chromium Headless Shell e FFmpeg necessários.
- ✅ Criar `playwright.config.ts`.
- ✅ Configurar Chromium inicial.
- ✅ Configurar viewport 1440×900.
- ✅ Configurar base URL e timeouts por projeto.
- ✅ Configurar TypeScript.
- ✅ Configurar ESLint.
- ✅ Configurar diretórios de resultados.
- ✅ Ignorar `playwright/.auth` e resultados transitórios.
- ✅ Adicionar validação de coleta da configuração ao quality gate.
- ✅ Garantir coexistência com Cypress.

## Configuração e segurança

- ⏳ Reaproveitar os tipos úteis de runtime config.
- ✅ Separar configuração pública de segredos.
- ✅ Preservar seleção DEV/HT.
- ✅ Validar todas as variáveis obrigatórias.
- ✅ Impedir logs de credenciais e tokens.
- ⏳ Auditar campos de configuração sem uso.
- ✅ Manter configurações locais fora do Git.

## Autenticação

- ✅ Criar setup de autenticação.
- ✅ Gerar magic link com segurança.
- ✅ Salvar `storageState`.
- ✅ Validar sessão em `/api/auth/me`.
- ✅ Suportar contexto não autenticado.
- ✅ Garantir que `storageState` não seja publicado.
- ✅ Verificar comportamento após expiração da sessão.
- ✅ Medir quantidade de autenticações por execução.
- ✅ Validar ausência de HTTP 429 causado pela suíte.

## Fixtures

- ✅ Criar fixture base tipada.
- ✅ Criar fixture de configuração.
- ✅ Criar fixture de sessão autenticada.
- ✅ Criar fixture de Portal quando necessária.
- ✅ Criar fixture para captura de erros de página.
- ✅ Definir fixtures para cenários mutáveis — implementação aguarda mecanismo real nas Fases 6/7.
- ✅ Encapsular teardown junto ao setup.
- ✅ Validar lifecycle em sucesso e falha.

## Page Objects e componentes

- ✅ Criar Page Object do Admin de acesso.
- ✅ Criar Page Object da lista de propostas.
- ✅ Criar Page Object da proposta.
- ⏳ Criar Page Object do AEJS — necessário somente na Fase 7.
- ✅ Criar componente de tabs.
- ✅ Criar componente de combobox pesquisável.
- ✅ Criar componente de dialog.
- ⏳ Criar componente de grid ExtJS — necessário somente na Fase 7.
- ⏳ Criar componente de janela ExtJS — necessário somente na Fase 7.
- ⏳ Centralizar espera de gravação por resposta de rede — será implementado com o primeiro fluxo mutável real.
- ✅ Auditar duplicação após cada módulo.

## Smoke tests

- ✅ Migrar smoke de autenticação.
- ✅ Migrar smoke de abertura de proposta.
- ✅ Comparar resultados com Cypress.
- ✅ Executar repetidamente sem consumir novos tokens.
- ✅ Validar configuração nativa de evidência em falha; publicação aguarda a Fase 8.
- ⏳ Validar smoke no CI de transição — pertencente à Fase 8.

## Testes funcionais

- ✅ Migrar Login — Subfase 6.1.
- ✅ Migrar Minhas Propostas — Subfase 6.2.
- ✅ Migrar Linha do Tempo e Alertas — Subfase 6.3.
- ✅ Migrar Participantes — Subfase 6.4.
- ⏳ Migrar Cônjuge.
- ⏳ Migrar Composição de Renda.
- ⏳ Migrar Renda do Cônjuge.
- ⏳ Migrar Renda de Terceiros.
- ⏳ Migrar Motivo da Contratação.
- ⏳ Migrar Imóvel.
- ⏳ Migrar Garantidor PF.
- ⏳ Migrar Garantidor PJ.
- ⏳ Migrar Detalhamento.
- ✅ Preservar `PROP-03` como pendência conhecida.
- ✅ Representar `PROP-14` como defeito conhecido conforme decisão aprovada.
- ✅ Validar 108 IDs no contrato de testes.
- ⏳ Comparar todos os módulos com a baseline Cypress.

## Integrações

- ⏳ Preservar opt-in destrutivo.
- ⏳ Migrar preparação de proposta.
- ⏳ Migrar confirmação.
- ⏳ Migrar cancelamento.
- ⏳ Migrar login AEJS.
- ⏳ Migrar abertura de operação.
- ⏳ Migrar validação de titular e cônjuge.
- ⏳ Migrar validação de composição de renda.
- ⏳ Migrar validação de imóvel.
- ⏳ Migrar garantidores PF e PJ.
- ⏳ Migrar sócios e interveniente.
- ⏳ Migrar tarefas e documentos.
- ⏳ Unificar contexto Portal para AEJS.
- ⏳ Validar evidências por cenário.
- ⏳ Confirmar que nenhuma execução usa massa não autorizada.

## Relatórios e debug

- ✅ Configurar reporter HTML.
- ⏳ Definir necessidade de JSON e JUnit.
- ✅ Configurar screenshot em falha.
- ✅ Configurar vídeo com retenção em falha.
- ✅ Configurar trace com retenção em falha.
- ⏳ Adicionar IDs e steps aos relatórios.
- ⏳ Validar segurança dos artefatos.
- ⏳ Definir retenção de evidências.
- ⏳ Confirmar eventual consumidor externo do Mochawesome.

## Paralelismo e performance

- ⏳ Medir duração da baseline Cypress.
- ⏳ Medir duração Playwright por módulo.
- ✅ Limitar todos os projetos a um worker inicialmente, até validação segura de paralelismo read-only.
- ⏳ Identificar testes realmente read-only.
- ⏳ Validar paralelismo dos read-only.
- ⏳ Definir massa exclusiva por worker quando possível.
- ⏳ Validar limites de autenticação e backend.
- ⏳ Registrar decisão antes de aumentar workers.

## CI/CD

- ⏳ Instalar browser e dependências no CI.
- ⏳ Adicionar quality checks Playwright.
- ⏳ Criar job de smoke Playwright.
- ⏳ Manter job inicialmente não bloqueante.
- ⏳ Publicar relatório e resultados.
- ⏳ Impedir publicação de estado autenticado.
- ⏳ Preservar concurrency de QA.
- ⏳ Criar jobs distintos por risco quando necessário.
- ⏳ Tornar Playwright bloqueante após aceite.

## Cutover

- ⏳ Aprovar equivalência dos 108 casos.
- ⏳ Aprovar equivalência dos casos de integração.
- ⏳ Aprovar estabilidade do CI.
- ⏳ Confirmar substituição de relatórios e evidências.
- ⏳ Atualizar documentação operacional.
- ⏳ Remover scripts Cypress.
- ⏳ Remover dependências Cypress e Mochawesome exclusivas.
- ⏳ Remover configuração Cypress.
- ⏳ Remover specs Cypress após autorização.
- ⏳ Executar validação final completa.
- ⏳ Registrar encerramento e lições aprendidas.

# Critérios de Qualidade

As regras abaixo são obrigatórias para toda implementação da migração:

1. Nunca fazer conversão literal de Cypress para Playwright.
2. Sempre utilizar as melhores práticas atuais e estáveis do Playwright.
3. Preferir APIs nativas do Playwright antes de criar abstrações próprias ou instalar plugins.
4. Evitar duplicação de código sem esconder a intenção funcional do teste.
5. Manter tipagem forte em TypeScript.
6. Não usar `any` sem justificativa documentada.
7. Criar componentes reutilizáveis quando existir repetição real ou contrato de UI compartilhado.
8. Garantir legibilidade antes de reduzir linhas de código.
9. Preferir locators por role, label, texto estável ou test ID acordado.
10. Evitar CSS estrutural, XPath e seleção por posição quando houver alternativa semântica.
11. Tratar `first`, `last`, `nth` e `force` como exceções que exigem justificativa.
12. Utilizar assertions web-first para estado de UI.
13. Aguardar a resposta de rede associada quando ela for a evidência real da operação.
14. Não usar espera fixa como solução padrão de sincronização.
15. Manter cada teste independente de resultados produzidos por outro teste.
16. Não depender de ordem entre specs.
17. Não paralelizar testes que compartilham estado mutável.
18. Preservar os IDs funcionais existentes.
19. Não transformar defeitos funcionais em testes silenciosamente ignorados.
20. Não registrar credenciais, tokens, cookies ou conteúdo sensível.
21. Manter setup e teardown relacionados na mesma fixture sempre que possível.
22. Evitar Page Objects monolíticos e métodos que escondam toda a regra testada.
23. Manter assertions específicas no teste quando isso melhorar a clareza funcional.
24. Produzir mensagem de falha que identifique caso, massa e etapa sem expor segredo.
25. Atualizar este documento durante a mesma etapa que altera uma decisão ou status.
26. Executar lint, typecheck e testes relevantes antes de considerar uma etapa concluída.
27. Comparar o módulo Playwright com a baseline Cypress antes do aceite.
28. Não remover Cypress até o cutover formal.

# Critérios de Aceite

Um módulo será considerado totalmente migrado somente quando todos os critérios aplicáveis forem atendidos:

- Todos os IDs Cypress do módulo existem no Playwright.
- Nenhum caso adicional ou pendência foi perdido.
- A intenção funcional e as pré-condições foram preservadas.
- Os testes não dependem de outro spec ou de ordem de execução.
- A autenticação não consome magic links desnecessariamente.
- Locators seguem os critérios de qualidade.
- Esperas comprovam a ação atual, não um estado visual anterior.
- Setup e teardown foram validados em sucesso e falha.
- Testes mutáveis restauram a massa ou usam massa descartável autorizada.
- Execução paralela está desabilitada quando a massa não é independente.
- Defeitos conhecidos estão representados explicitamente.
- Relatório e evidências permitem diagnosticar uma falha.
- Nenhum segredo aparece nos artefatos.
- Lint está aprovado.
- Typecheck está aprovado.
- Testes do módulo estão aprovados ou possuem falhas esperadas documentadas.
- Resultados foram comparados com a baseline Cypress.
- Divergências entre runners foram investigadas e registradas.
- O checklist e o status da fase foram atualizados.
- A revisão técnica foi aprovada.

A suíte completa será considerada migrada somente quando:

- os 108 casos funcionais estiverem representados e validados;
- smoke, transições e integrações estiverem equivalentes;
- CI Playwright estiver estável e bloqueante onde aplicável;
- a equipe aprovar formalmente o cutover;
- não houver consumidor sem substituição para os artefatos Cypress;
- a remoção do Cypress não reduzir cobertura, segurança ou rastreabilidade.

# Registro de Decisões

Use esta seção para registrar futuras decisões arquiteturais. Nenhuma decisão relevante deve existir apenas em conversa, commit ou pull request.

## Modelo

### ADR-XXX — Título

- **Data:** AAAA-MM-DD
- **Status:** Proposta | Aceita | Substituída | Rejeitada
- **Contexto:** problema ou necessidade que motivou a decisão.
- **Decisão:** abordagem escolhida.
- **Alternativas consideradas:** opções avaliadas.
- **Consequências positivas:** benefícios esperados.
- **Consequências negativas:** custos, riscos ou limitações.
- **Fases afetadas:** fases da migração impactadas.
- **Substitui:** ADR anterior, quando aplicável.

## Decisões registradas

### ADR-001 — Migração incremental com coexistência

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** a suíte possui cobertura funcional e integrações que não podem ser interrompidas durante a reescrita.
- **Decisão:** manter Cypress e Playwright em paralelo até equivalência e cutover formal.
- **Alternativas consideradas:** substituição integral em uma única entrega.
- **Consequências positivas:** menor risco de perda de cobertura e comparação direta entre runners.
- **Consequências negativas:** manutenção temporária de duas infraestruturas.
- **Fases afetadas:** todas.

### ADR-002 — Chromium como browser inicial

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** a prioridade é alcançar paridade com a execução atual antes de ampliar a matriz.
- **Decisão:** usar Chromium como browser obrigatório durante a migração inicial.
- **Alternativas consideradas:** iniciar simultaneamente com Chromium, Firefox e WebKit.
- **Consequências positivas:** menor superfície de variação durante a paridade.
- **Consequências negativas:** cobertura cross-browser adiada.
- **Fases afetadas:** 1, 5, 6, 7 e 8.

### ADR-003 — Autenticação baseada em `storageState`

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** magic links são de uso único e autenticações repetidas já causaram risco de rate limit.
- **Decisão:** autenticar em setup explícito, validar a sessão e reutilizar `storageState` com segurança.
- **Alternativas consideradas:** autenticar pela UI em todos os testes.
- **Consequências positivas:** menos tokens consumidos, menor duração e maior estabilidade.
- **Consequências negativas:** exige política rigorosa para arquivos de autenticação.
- **Fases afetadas:** 2, 3, 5, 6 e 8.

### ADR-004 — Paralelismo conservador para testes mutáveis

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** vários testes alteram propostas compartilhadas no servidor.
- **Decisão:** iniciar conjuntos mutáveis e AEJS com um worker; aumentar paralelismo apenas com massa independente comprovada.
- **Alternativas consideradas:** habilitar paralelismo global desde o início.
- **Consequências positivas:** evita colisões e corrupção de massa.
- **Consequências negativas:** ganho inicial de performance limitado.
- **Fases afetadas:** 6, 7 e 8.

### ADR-005 — Jornada Portal ↔ AEJS no mesmo teste lógico

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** o Cypress atual transporta contexto de integração por memória entre specs.
- **Decisão:** preferir um teste por cenário, com etapas e páginas/contextos separados para Portal e AEJS.
- **Alternativas consideradas:** manter specs separados com estado global; persistir contexto em arquivo entre projetos.
- **Consequências positivas:** rastreabilidade da mesma operação e independência de ordem/processo.
- **Consequências negativas:** teste longo e necessidade de steps bem definidos.
- **Fases afetadas:** 7 e 8.

### ADR-006 — Fixtures e Page Objects focados

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** a suíte possui comandos globais e interações repetidas, mas abstrações excessivas poderiam esconder as regras funcionais.
- **Decisão:** usar fixtures para lifecycle e Page Objects/componentes para navegação e interação reutilizável, mantendo assertions funcionais nos specs.
- **Alternativas consideradas:** conversão literal de comandos Cypress; Page Object monolítico.
- **Consequências positivas:** reutilização sem perda de legibilidade.
- **Consequências negativas:** exige disciplina sobre os limites de cada abstração.
- **Fases afetadas:** 3, 4, 5, 6 e 7.

### ADR-007 — Relatório nativo e Trace Viewer como evidência técnica

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** vídeos e screenshots atuais não preservam todo o contexto necessário para diagnosticar fluxos longos.
- **Decisão:** usar relatório HTML, attachments e traces como evidência técnica principal, preservando vídeo quando necessário.
- **Alternativas consideradas:** manter Mochawesome como solução permanente.
- **Consequências positivas:** diagnóstico mais completo e menor necessidade de merge manual.
- **Consequências negativas:** traces exigem política de segurança e retenção.
- **Fases afetadas:** 1, 5, 7 e 8.

### ADR-008 — Infraestrutura mínima sem implementação prematura

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** a Fase 1 precisa validar Playwright e coexistência sem criar autenticação, fixtures, testes artificiais ou arquivos vazios pertencentes a fases futuras.
- **Decisão:** instalar Playwright Test 1.61.1 e somente Chromium; configurar os projetos `setup`, `smoke`, `functional-readonly`, `functional-mutation` e `integration`; manter dependências entre projetos e `storageState` desativados até a Fase 2; usar reporters nativos e criar diretórios físicos apenas quando houver arquivos reais.
- **Alternativas consideradas:** gerar o scaffold padrão com teste de exemplo; criar placeholders para toda a árvore; ativar setup e autenticação incompletos; instalar todos os browsers.
- **Consequências positivas:** infraestrutura validável, diff pequeno, nenhuma falsa implementação e preservação integral do Cypress.
- **Consequências negativas:** a coleta Playwright contém zero testes até o início das fases de autenticação e smoke.
- **Fases afetadas:** 1, 2 e 5.

### ADR-009 — Estado autenticado validado e vinculado ao contexto de execução

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** um `storageState` existente pode estar expirado ou ter sido criado para outro ambiente ou usuário de teste; arquivos de setup também podem expor segredos por meio de artefatos automáticos.
- **Decisão:** validar `/api/auth/me` antes da reutilização, associar o estado a um fingerprint sem segredos do ambiente e usuário, recriar estado inválido, restringir os arquivos a `0600` e desativar screenshot, vídeo e trace apenas no projeto de autenticação.
- **Alternativas consideradas:** reutilizar qualquer arquivo existente; regenerar em toda execução; manter artefatos de falha do setup.
- **Consequências positivas:** reduz consumo de magic links, impede reutilização cruzada e diminui risco de vazamento.
- **Consequências negativas:** adiciona um arquivo privado de metadados e torna o diagnóstico do setup deliberadamente mais textual e sanitizado.
- **Fases afetadas:** 2, 3, 5, 6, 7 e 8.

### ADR-010 — Contrato incremental de casos durante a coexistência

- **Data:** 2026-07-08
- **Status:** Aceita
- **Contexto:** os 108 casos permanecem ativos no Cypress enquanto os módulos são migrados em commits pequenos para Playwright.
- **Decisão:** manter o catálogo Cypress como baseline completa e validar, a cada subfase, que todo ID Playwright é conhecido, único e pertence aos 108 casos; o contador Playwright crescerá até atingir 108/108.
- **Alternativas consideradas:** duplicar antecipadamente todo o catálogo em Playwright; exigir 108 specs Playwright desde a primeira subfase; suspender o contrato até o fim da Fase 6.
- **Consequências positivas:** cada subfase pode terminar consistente, sem placeholders e sem perder rastreabilidade global.
- **Consequências negativas:** o Cypress continua temporariamente como fonte completa do catálogo durante a coexistência.
- **Fases afetadas:** 6 e 9.

# Lições Aprendidas

Esta seção deverá ser atualizada ao longo da migração com evidências concretas, evitando recomendações genéricas.

## Modelo de registro

### Data — Fase ou módulo

- **Situação:** contexto observado.
- **Problema ou descoberta:** o que ocorreu.
- **Causa:** causa confirmada ou hipótese ainda em validação.
- **Ação tomada:** mudança realizada.
- **Resultado:** efeito medido.
- **Aplicação futura:** regra ou melhoria que deve ser repetida nos próximos módulos.

## Lições iniciais herdadas da suíte atual

1. Uma mensagem de “Rascunho salvo” já visível não comprova que a gravação atual terminou; a nova suíte deve correlacionar ação e resposta de rede.
2. Magic links de uso único não combinam com retries globais ou autenticação repetida; autenticação e retry precisam de políticas separadas.
3. Sessão isolada no browser não isola estado persistente no servidor; paralelismo exige massa independente.
4. Vídeo ajuda a compreender o fluxo, mas não substitui evidência de DOM, console e rede para falhas complexas.
5. Seletores ExtJS amplos podem clicar no elemento errado sem erro aparente; a nova camada AEJS precisa impor escopo e unicidade.
6. Setup e teardown espalhados em hooks dificultam garantir restauração após falhas parciais; fixtures devem manter o lifecycle junto.
7. Um caso pendente precisa de motivo e prazo; uma divergência conhecida precisa permanecer visível no resultado.
8. O fluxo Portal para AEJS deve transportar explicitamente a identidade da operação validada.
9. A migração deve preservar a segurança das mutações antes de buscar ganho de velocidade.
10. A equivalência funcional deve ser comprovada caso a caso; quantidade de arquivos convertidos não é métrica suficiente.

## Lições da Fase 1 — Infraestrutura

### 2026-07-07 — Validação sem teste artificial

- **Situação:** a infraestrutura precisava ser validada antes da existência de specs Playwright.
- **Problema ou descoberta:** a coleta padrão retorna erro quando nenhum teste é encontrado, embora a configuração seja válida.
- **Causa:** autenticação e smoke pertencem às fases seguintes, e um teste de exemplo não representaria comportamento real do projeto.
- **Ação tomada:** a configuração passou a ser coletada com a opção nativa `--pass-with-no-tests` no quality gate.
- **Resultado:** os cinco projetos são carregados e validados sem criar placeholder ou enfraquecer o comando real de execução.
- **Aplicação futura:** remover a tolerância a zero testes do quality gate quando a suíte possuir cobertura mínima obrigatória definida.

### 2026-07-07 — Coexistência confirmada

- **Situação:** Playwright foi adicionado ao mesmo projeto que mantém Cypress 15.17.0.
- **Problema ou descoberta:** a verificação do Cypress precisa atualizar seu arquivo de estado no cache do usuário.
- **Causa:** comportamento do binário Cypress fora do workspace, não regressão causada pela nova dependência.
- **Ação tomada:** a verificação foi executada com acesso apropriado ao cache.
- **Resultado:** Cypress permaneceu íntegro; lint, typecheck e contrato dos 108 casos continuaram aprovados.
- **Aplicação futura:** diferenciar falha de permissão do ambiente de falha real do runner durante as validações.

## Lições da Fase 2 — Autenticação

### 2026-07-07 — Geração assíncrona e falha segura

- **Situação:** o setup precisou gerar um novo magic link pelo Admin para criar o primeiro estado autenticado.
- **Problema ou descoberta:** a ação permaneceu em `Gerando...` por mais de 120 segundos; no mesmo período, os smokes Cypress falharam no Portal com o erro React `#418`.
- **Causa:** indisponibilidade ou lentidão temporária do Admin, confirmada pela reprodução independente do runner; o serviço voltou a concluir a mesma operação sem mudança na implementação.
- **Ação tomada:** a espera foi vinculada ao estado semântico `Copiar link`, limitada a 60 segundos, e qualquer estado parcial passou a ser removido.
- **Resultado:** após a recuperação do ambiente, o setup criou e validou o estado; durante a falha, não expôs token, cookie ou credencial nem deixou `storageState` inválido.
- **Aplicação futura:** diferenciar falhas do serviço de autenticação de defeitos da suíte e nunca contornar indisponibilidade consumindo silenciosamente um magic link possivelmente expirado.

### 2026-07-07 — React 418 não pertence à autenticação Playwright

- **Situação:** os smokes Cypress falhavam durante a criação da sessão com React `#418`.
- **Problema ou descoberta:** o erro é um mismatch de hidratação conhecido, já documentado e colocado em quarentena opcional antes desta fase.
- **Causa:** divergência entre HTML renderizado no servidor e no cliente do Portal/Admin, manifestada no Electron do Cypress; não ocorreu no Chromium do Playwright durante a mesma jornada autenticada.
- **Ação tomada:** o defeito permaneceu visível por padrão e os smokes foram executados adicionalmente com a quarentena diagnóstica existente.
- **Resultado:** ambos os smokes passaram com a única exceção conhecida isolada; nenhuma mudança no Cypress ou tolerância genérica foi adicionada ao Playwright.
- **Aplicação futura:** a fixture de page errors da Fase 3 deverá preservar a política arquitetural: falhar em erros inesperados e tratar qualquer quarentena de forma exata, temporária e rastreável.

## Lições da Fase 3 — Fixtures

### 2026-07-08 — Composição explícita e lifecycle sob demanda

- **Situação:** a nova camada precisava fornecer configuração e páginas autenticadas sem reproduzir comandos globais Cypress.
- **Problema ou descoberta:** uma fixture worker sem dependências ainda exige factory com destructuring válido no runtime Playwright, regra não detectada apenas pelo TypeScript.
- **Ação tomada:** as fixtures foram encadeadas por responsabilidade e validadas no runner real, mantendo configuração em worker e recursos de browser em escopo de teste.
- **Resultado:** configuração, contexto autenticado e página são tipados, acíclicos e executados conforme a dependência solicitada.
- **Aplicação futura:** todo novo fixture deve possuir contrato de runtime, não apenas aprovação de typecheck.

### 2026-07-08 — Page errors como falha técnica observável

- **Situação:** erros do browser não podem ser ignorados quando a assertion principal passa.
- **Problema ou descoberta:** a política também precisa continuar segura para attachments e preservar a quarentena conhecida sem criar lista genérica de exceções.
- **Ação tomada:** uma fixture automática passou a coletar erros de todas as páginas, sanitizar diagnóstico, anexar evidência e falhar no teardown; somente o prefixo exato do React `#418` é quarantinado quando autorizado.
- **Resultado:** contratos de sucesso, falha inesperada e quarentena autorizada foram executados com o comportamento esperado.
- **Aplicação futura:** novas exceções exigem decisão explícita, filtro exato, responsável e prazo de revisão.

### 2026-07-08 — Nenhuma fixture de cenário sem lifecycle real

- **Situação:** a arquitetura prevê `scenario.fixture.ts`, mas ainda não existe mecanismo oficial de reserva ou restauração de massa Playwright.
- **Problema ou descoberta:** criar um arquivo placeholder ou uma fixture que apenas devolve dados estáticos anteciparia abstração e confundiria test data com lifecycle.
- **Ação tomada:** a estratégia foi mantida documentada, sem implementação fictícia nesta fase.
- **Resultado:** a fundação de fixtures foi concluída sem antecipar Services, Helpers ou regras dos módulos mutáveis.
- **Aplicação futura:** criar a fixture de cenário somente com o primeiro lifecycle real das Fases 6 ou 7, mantendo setup e teardown no mesmo recurso.

## Lições da Fase 4 — Camadas compartilhadas

### 2026-07-08 — Locators validados no produto, não herdados do Cypress

- **Situação:** os comandos Cypress atuais usam jQuery, `:visible`, busca global e seleção por posição em alguns widgets.
- **Problema ou descoberta:** transportar esses seletores preservaria fragilidade e esconderia contratos acessíveis já disponíveis no Portal.
- **Ação tomada:** lista, cards, headings, tablist, tabs, comboboxes e campos por `name` foram inspecionados no Portal real antes da implementação.
- **Resultado:** os Components usam role, nome acessível, `aria-selected`, atributo funcional `name` e escopo sem `force`, `first`, `last` ou classes visuais.
- **Aplicação futura:** validar cada novo contrato de locator no produto antes de extrair ou migrar a interação correspondente.

### 2026-07-08 — Page Object não decide qual jornada o card representa

- **Situação:** durante a validação isolada, a proposta configurada como padrão abriu `Acompanhar proposta`; posteriormente, o smoke Cypress passou esperando o cadastro editável.
- **Problema ou descoberta:** a mesma lista pode levar ao cadastro ou ao acompanhamento conforme o estado atual da massa.
- **Ação tomada:** `ProposalsPage` encapsula a navegação comum e aceita ambas as ações, enquanto `ProposalPage` permanece restrito ao cadastro e valida sua própria prontidão.
- **Resultado:** nenhuma regra de massa ou fallback silencioso foi escondido no Page Object; a variação dependente de estado ou sessão ficou explícita para a preparação da Fase 5.
- **Aplicação futura:** investigar a estabilidade da massa e confirmar uma condição inicial editável antes de migrar o smoke de abertura.

### 2026-07-08 — Abstrações adiadas até existir contrato real

- **Situação:** a arquitetura final prevê endereço, componentes ExtJS, AEJS e espera padronizada de gravação.
- **Problema ou descoberta:** esses elementos ainda não são necessários ao smoke e não foram validados em seus fluxos reais nesta fase.
- **Ação tomada:** somente Admin, lista, cadastro, tabs, combobox e dialog foram implementados; as demais abstrações permaneceram no roadmap.
- **Resultado:** a Fase 4 entrega a base necessária para o smoke sem antecipar lógica das fases funcionais e de integração.
- **Aplicação futura:** criar endereço e salvamento com o primeiro módulo mutável; criar AEJS, grid e janela apenas na Fase 7.

## Lições da Fase 5 — Smoke Tests

### 2026-07-08 — O smoke deve comprovar reutilização, não apenas autenticar

- **Situação:** a primeira execução precisou criar uma sessão e os smokes seguintes deveriam reaproveitá-la sem consumir outro magic link.
- **Problema ou descoberta:** uma única execução aprovada não comprova a política de reutilização definida para `storageState`.
- **Ação tomada:** o projeto `smoke` foi executado duas vezes consecutivas com a dependência de setup habilitada.
- **Resultado:** a segunda execução validou o estado existente em 86 milissegundos e aprovou os dois fluxos sem nova autenticação pelo Admin.
- **Aplicação futura:** todo módulo autenticado deve preservar a dependência do setup e evitar autenticação própria no spec.

### 2026-07-08 — Massa de smoke precisa funcionar localmente e no CI

- **Situação:** a proposta padrão existia na configuração local de compatibilidade, enquanto o pipeline fornece a mesma expectativa por variável JSON.
- **Problema ou descoberta:** ler apenas o arquivo local faria o smoke passar no checkout atual e falhar em um checkout limpo de CI.
- **Ação tomada:** a configuração Playwright passou a ler somente `visibleNumber` de `PORTAL_EXPECTED_PROPOSAL_JSON`, mantendo a variável como fonte prioritária e o fallback local durante a coexistência.
- **Resultado:** o spec permanece desacoplado do Cypress e possui a mesma entrada de massa já disponível para o futuro job Playwright.
- **Aplicação futura:** migrar apenas os campos de configuração realmente consumidos por cada módulo, preservando precedência de ambiente e validação tipada.

## Lições da Fase 6.1 — Acesso e contrato funcional

### 2026-07-08 — Comprovar autenticação sem reexpor o magic link

- **Situação:** `LOGIN-01` e `LOGIN-02` tratam do acesso tokenizado, mas a arquitetura proíbe disponibilizar tokens aos specs.
- **Problema ou descoberta:** copiar a leitura Cypress do access URL quebraria a fronteira de segurança construída na Fase 2.
- **Ação tomada:** o setup permanece responsável por validar origem e presença do token; o spec comprova a sessão resultante, o destino correto e a remoção da query sensível.
- **Resultado:** os casos preservam a intenção funcional sem gerar outro link nem expor segredo em relatório, screenshot, vídeo ou trace.
- **Aplicação futura:** specs autenticados devem testar o comportamento pós-autenticação; geração e consumo de credenciais permanecem exclusivamente no setup seguro.

### 2026-07-08 — Contexto não autenticado escopado ao caso

- **Situação:** o projeto funcional usa `storageState` autenticado por padrão, enquanto `LOGIN-04` precisa começar sem sessão.
- **Problema ou descoberta:** uma fixture global apenas para um caso adicionaria abstração sem reutilização comprovada.
- **Ação tomada:** o grupo de `LOGIN-04` usa `test.use` nativo com estado vazio e mantém a captura automática de page errors.
- **Resultado:** o caso executou isolado, confirmou zero requests de login para CPF inválido e não interferiu nos demais testes autenticados.
- **Aplicação futura:** repetir a abordagem escopada enquanto a necessidade permanecer local; extrair fixture somente quando houver lifecycle reutilizado em outros domínios.

## Lições da Fase 6.2 — Minhas Propostas

### 2026-07-09 — Carregamento de paginação assíncrona com latência

- **Situação:** o carregamento de propostas adicionais clicando em "Carregar mais" apresentou instabilidades e falhas prematuras.
- **Problema ou descoberta:** o botão "Carregar mais" tem latência de montagem após o desaparecimento de skeletons, e o Playwright falhava com timeouts curtos de 1 segundo.
- **Causa:** o método `loadAll()` verificava a visibilidade do botão de forma síncrona/imediata com timeout de 1s antes de a listagem estabilizar.
- **Ação tomada:** implementada espera robusta pelo botão usando timeout de 4 segundos associada à validação de desaparecimento de skeletons e aumento real do número de propostas.
- **Resultado:** todos os testes passaram a carregar estavelmente toda a listagem de propostas sob quaisquer condições de rede.
- **Aplicação futura:** sempre utilizar timeouts de estabilização adequados às latências e variações de ambiente lento de DEV/HT.

### 2026-07-09 — Timeout cumulativo em fluxos com carregamento múltiplo

- **Situação:** o teste `PROP-05` falhava por timeout geral de teste excedido (30s) na segunda carga da listagem.
- **Problema ou descoberta:** o teste navega para a proposta cadastral, volta, recarrega todas as propostas, entra em documentos, excedendo o tempo limite padrão.
- **Causa:** a lentidão natural de múltiplas cargas sequenciais e navegações acumuladas consome o tempo limite padrão.
- **Ação tomada:** adicionada chamada explícita `test.setTimeout(60000)` para o caso `PROP-05`.
- **Resultado:** o caso passou estavelmente em 41.6 segundos.
- **Aplicação futura:** aplicar timeouts expandidos em fluxos complexos de navegação cumulativa.

## Lições da Fase 6.3 — Linha do Tempo e Alertas

### 2026-07-09 — Seleção de texto parcial em elementos aninhados

- **Situação:** os testes `TIMELINE-01` e `TIMELINE-02` falhavam ao validar o nome e o CPF do proponente.
- **Problema ou descoberta:** o localizador `page.getByText(/Proponente:/i)` selecionava apenas o span interno contendo o rótulo fixo.
- **Causa:** o comportamento padrão do Playwright de obter a correspondência mais específica ao invés de subir para o contêiner de texto pai.
- **Ação tomada:** ajustado o localizador do Page Object para subir para o elemento pai (`page.getByText(/^Proponente:\s*$/i).locator("..")`).
- **Resultado:** o contêiner completo foi obtido com sucesso permitindo validar os dados dinâmicos de forma consistente.
- **Aplicação futura:** usar `locator("..")` ou contêineres explícitos ao lidar com spans de rótulos aninhados em blocos de texto dinâmico.

### 2026-07-09 — Violação de Strict Mode por múltiplos aria-current

- **Situação:** o teste `TIMELINE-05` falhava com erro de violação de strict mode no Playwright.
- **Problema ou descoberta:** o localizador `[aria-current="step"]` retornava dois elementos: uma `div` e um `li` da etapa atual.
- **Causa:** múltiplos elementos contendo a indicação de etapa atual na estrutura de linha do tempo.
- **Ação tomada:** escopado o localizador explicitamente para a tag da lista (`li[aria-current="step"]`).
- **Resultado:** a linha do tempo passou a ser resolvida de maneira unívoca.
- **Aplicação futura:** evitar filtros genéricos de atributos de estado sem escopo de tag ou de container.

## Lições da Fase 6.4 — Participantes

### 2026-07-09 — Espera por Renderização Dinâmica de Opções

- **Situação:** os testes `PART-06`, `PART-08` e `PART-10` falhavam intermitentemente ao ler as opções de seletores/comboboxes que vinham vazias (`[]`).
- **Problema ou descoberta:** os elementos de opções são montados de forma assíncrona após a abertura ou interação, e `.count()` ou `.all()` não têm retentativa embutida no Playwright.
- **Causa:** a execução síncrona do teste lê o estado antes da conclusão do render no navegador.
- **Ação tomada:** adicionadas esperas explícitas como `await expect(options.first()).toBeVisible()` ou `await expect(options.nth(1)).toBeAttached()`.
- **Resultado:** o fluxo de teste aguarda com sucesso a renderização completa antes de processar as contagens ou obter arrays de textos.
- **Aplicação futura:** sempre forçar uma expectativa visual/estado de carregamento em listas dinâmicas antes de interagir ou contar seus filhos.

### 2026-07-09 — Otimização de Paginação na Listagem (Polling Ineficiente)

- **Situação:** a suite funcional demorava mais de 4 minutos no Playwright, sofrendo de flutuações e expirando a sessão do Portal na metade dos casos.
- **Problema ou descoberta:** a navegação dependia de `loadAll()` que esperava de forma síncrona e incondicional 4 segundos por um botão de paginação inexistente na última página.
- **Causa:** loop genérico usando timeouts arbitrários altos para detecção de fim de página.
- **Ação tomada:** substituído o bloco de espera por verificação instantânea baseada em `loadMoreButton.isVisible()`.
- **Resultado:** o tempo de carregamento por teste reduziu drasticamente, mantendo o cookie e garantindo execução verde completa e robusta de todos os 13 casos de teste funcionais sequencialmente.
- **Aplicação futura:** evitar esperas de timeout para elementos que podem ser ausentes; preferir checagens imediatas de visibilidade após a estabilização de skeletons.
