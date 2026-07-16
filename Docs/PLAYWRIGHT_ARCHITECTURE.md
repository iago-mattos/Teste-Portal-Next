# Arquitetura da Suíte Playwright

> Guia arquitetural oficial e permanente da suíte Playwright do PortalNext.
>
> Toda implementação, revisão e decisão futura relacionada à automação deve respeitar este documento. O arquivo `docs/PLAYWRIGHT_MIGRATION.md` governa as fases e o acompanhamento da migração; este documento governa o estado final desejado da arquitetura.

## Estado do documento

- **Status:** Arquitetura alvo aprovada para orientar a implementação.
- **Abrangência:** suíte Playwright completa após a remoção do Cypress.
- **Última atualização:** 08/07/2026.
- **Framework alvo:** Playwright Test com TypeScript em modo estrito.
- **Browser inicial obrigatório:** Chromium.

# Objetivo

Definir como a suíte Playwright deverá ser construída, organizada e mantida para suportar por vários anos os testes do PortalNext, Admin e AEJS/SCCI.

A arquitetura deve:

- preservar a clareza funcional dos casos;
- manter os testes independentes;
- controlar com segurança autenticação e mutações;
- facilitar diagnóstico de falhas;
- reduzir duplicação sem criar abstrações desnecessárias;
- permitir crescimento para centenas de casos;
- separar regras funcionais, interação de UI, lifecycle, configuração e dados;
- impedir que detalhes do runner se espalhem por toda a suíte;
- tornar explícitas as dependências entre Portal, Admin e AEJS.

# Estrutura Final

## Estrutura esperada

```text
playwright.config.ts

playwright/
  .auth/

tests/
  setup/
    auth.setup.ts

  smoke/
    auth.spec.ts
    open-proposal.spec.ts

  functional/
    login/
    proposals/
    timeline/
    proposal-form/
      participants/
      spouse/
      income/
      hiring-reason/
      property/
      guarantor/
    details/

  integrations/
    portal-aejs/
    transitions/

  fixtures/
    test.ts
    auth.fixture.ts
    portal.fixture.ts
    scenario.fixture.ts
    page-errors.fixture.ts
    aejs/

  pages/
    portal/
      admin-access.page.ts
      proposals.page.ts
      proposal.page.ts
    aejs/

  components/
    portal/
      proposal-tabs.component.ts
      searchable-combobox.component.ts
      dialog.component.ts
      address.component.ts
    aejs/
      extjs-grid.component.ts
      extjs-window.component.ts
      extjs-tabs.component.ts

  services/
    session.service.ts
    scenario.service.ts

  helpers/
    dates.ts
    strings.ts
    case-catalog.ts

  config/
    runtime-config.ts
    environment.ts
    projects.ts

  test-data/
    integration-data.ts
    known-pending.json
    expected-proposals.ts

  types/
    portal.types.ts
    aejs.types.ts
    cases.types.ts

  reporters/
    evidence.reporter.ts

scripts/
  check-test-contracts.mjs
  require-mutation-opt-in.mjs

test-results/
playwright-report/
```

Essa árvore representa responsabilidades, não uma obrigação de criar arquivos vazios. Um diretório ou arquivo só deverá existir quando possuir uma responsabilidade real. Nomes poderão ser refinados durante a implementação mediante decisão registrada, sem alterar os limites entre camadas.

## Responsabilidade de cada diretório

### `playwright/`

Contém dados gerados e privados do próprio runner.

- `.auth/` armazena estados autenticados temporários.
- Todo o diretório de autenticação deve permanecer fora do Git e dos artefatos públicos.
- Não contém specs, configuração funcional ou dados permanentes.

### `tests/setup/`

Contém testes de preparação executados como project dependencies.

- Autentica e cria `storageState`.
- Valida que a sessão está realmente pronta antes de liberar projetos dependentes.
- Não contém casos funcionais do produto.
- Não deve concentrar preparação de massa mutável que pertença a um cenário específico.

### `tests/smoke/`

Contém verificações curtas sobre disponibilidade e infraestrutura essencial.

- autenticação;
- sessão;
- abertura da lista de propostas;
- abertura da proposta padrão.

Smokes não devem virar jornadas funcionais extensas.

### `tests/functional/`

Contém os casos funcionais do Portal organizados por domínio.

- Cada domínio agrupa comportamento funcional coeso.
- IDs existentes, como `LOGIN-01` ou `GAR-PJ-08`, permanecem visíveis nos títulos.
- Specs não são organizados de acordo com Page Objects ou fixtures, mas segundo o comportamento do produto.

### `tests/integrations/`

Contém jornadas que atravessam sistemas ou alteram fases relevantes.

- Portal para AEJS;
- confirmação;
- cancelamento;
- documentos;
- tarefas e reflexos de integração.

Integrações possuem política própria de massa, timeout, workers e evidências.

### `tests/fixtures/`

Contém dependências gerenciadas pelo Playwright.

- configuração tipada;
- páginas autenticadas;
- lifecycle de cenários;
- preparação e restauração de massa;
- coleta de erros;
- composição das fixtures exportadas aos specs.

Fixtures não são depósitos de helpers.

### `tests/pages/`

Contém Page Objects correspondentes a páginas ou jornadas estáveis.

- encapsulam navegação;
- expõem ações de alto nível sobre a página;
- compõem Components;
- escondem detalhes técnicos de locator que não são relevantes ao caso funcional.

### `tests/components/`

Contém objetos de interação para partes reutilizáveis da interface.

- widgets do Portal;
- grids, janelas e tabs ExtJS;
- dialogs;
- componentes de endereço e combobox.

Components não representam páginas inteiras.

### `tests/services/`

Contém operações não visuais ou integrações técnicas com fronteira clara.

- validação ou criação de sessão por endpoint autorizado;
- aquisição, reserva ou restauração de cenário quando existir mecanismo oficial;
- leitura de estado externo necessário ao teste.

Services não manipulam locators nem escondem assertions funcionais.

### `tests/helpers/`

Contém funções pequenas, puras e determinísticas.

- datas;
- normalização de strings;
- escape de expressões regulares;
- validação estática do catálogo de casos.

Helpers não conhecem `Page`, `Locator`, fixtures ou variáveis globais.

### `tests/config/`

Contém carregamento, validação e tipagem da configuração.

- ambiente DEV ou HT;
- URLs;
- caminhos;
- parâmetros dos projetos;
- parsing de JSON recebido por variáveis de ambiente.

Configuração não contém ações de teste.

### Capacidades Portal Core por perfil

Os testes Portal Core não podem depender do nome de um perfil, tenant ou
cliente. A aplicabilidade é declarada por `PORTAL_CORE_CAPABILITIES` e deve
representar capacidades comprovadas das massas disponíveis, como rascunho
restaurável, slot documental reutilizável, par A/B do mesmo usuário ou operação
real de outra identidade.

- perfil não habilita capacidade implicitamente;
- capacidade só é declarada após qualificação do estado e do lifecycle;
- ausência de capacidade produz skip explícito com o requisito ausente;
- capacidade declarada com massa inválida deve falhar no preflight funcional;
- assertions e contratos Core permanecem idênticos entre clientes;
- diferenças legítimas de tenant pertencem à configuração, não ao spec.

Esse contrato permite executar a mesma suíte em outro cliente alterando apenas
o perfil e suas massas, sem introduzir condicionais por `PW_PROFILE` nos testes.

As massas Core de formulário, documentos e autorização horizontal usam as
variáveis dedicadas `PORTAL_CORE_REGISTRATION_*`,
`PORTAL_CORE_DOCUMENTS_*` e `PORTAL_CORE_FOREIGN_*`. Elas não podem
sobrescrever `PORTAL_PROPOSAL_*`, preservando a independência entre os testes
Core e a baseline funcional 108/108.

### `tests/test-data/`

Contém massa declarativa e expectativas estáticas.

- cenários de integração;
- dados de pessoas e imóveis;
- pendências conhecidas;
- expectativas por proposta.

Test data não executa navegação, assertions ou setup.

#### Massas descartáveis oficiais da Fase 7

`tests/test-data/integration-data.ts` é o catálogo único das operações descartáveis autorizadas para desenvolvimento dos fluxos Portal → AEJS. Specs, Page Objects, Components e fixtures não podem declarar números de operação.

| Caso | Operação descartável | Finalidade |
|---|---|---|
| `INT-CONFIRM-PJ` | `000436033` | Cônjuge, imóvel, garantidor PJ, sócios e interveniente. |
| `INT-CONFIRM-PF` | `000436034` | Terceiro na composição de renda e garantidor PF. |
| `INT-CONFIRM-QUITADO` | `000436035` | Titular sem composição de renda e imóvel quitado. |
| `INT-CONFIRM-WORKFLOW` | `000436036` | Preparação e transição 997 → 998 do workflow no AEJS. |

Substituições de massa devem alterar exclusivamente esse catálogo e preservar a correspondência entre caso, perfil e finalidade. O catálogo não autoriza mutações: o opt-in e a validação da operação continuam obrigatórios no fluxo de integração.

### `tests/types/`

Contém contratos compartilhados que não pertencem naturalmente a outro módulo.

- tipos de configuração do Portal e AEJS;
- contratos de casos;
- respostas relevantes de API.

Tipos locais devem permanecer próximos ao arquivo consumidor. Este diretório não deve virar um catálogo indiscriminado de interfaces.

### `tests/reporters/`

Contém reporter customizado somente se os reporters e attachments nativos não atenderem a uma exigência comprovada.

- preservação de evidência por ID funcional;
- nomenclatura operacional exigida externamente;
- integração com consumidor de resultados.

Não será criado reporter customizado apenas para reproduzir o formato antigo do Cypress.

### `scripts/`

Contém validações e proteções executadas fora do browser.

- contrato de casos;
- opt-in para mutações;
- validações de segurança anteriores ao runner.

Scripts não substituem fixtures nem lógica funcional dos specs.

### `test-results/` e `playwright-report/`

São diretórios gerados.

- nunca são fonte de configuração;
- não devem ser importados por testes;
- seguem política de retenção do ambiente;
- não podem conter `storageState` ou segredos conhecidos.

## Fluxo entre camadas

```text
Spec
  -> Fixture
      -> Page Object
          -> Component
      -> Service
      -> Runtime Config
      -> Test Data

Spec
  -> Test Data
  -> Helper puro

Page Object
  -> Component
  -> Tipo compartilhado

Component
  -> Locator do Playwright
  -> Tipo compartilhado
```

O fluxo de dependências sempre aponta das camadas mais específicas para as mais fundamentais. Dependências circulares são proibidas.

## Dependências permitidas

| Camada | Pode depender de | Não pode depender de |
|---|---|---|
| Specs | fixtures exportadas, test data, helpers puros, tipos | outros specs, artefatos gerados, implementação Cypress |
| Setup | fixtures do Playwright, config, services, tipos | specs funcionais, Page Objects não necessários ao setup |
| Fixtures | pages, components quando necessário, services, config, test data, tipos | specs, reporters |
| Page Objects | components, helpers puros, tipos, Playwright | specs, fixtures, reporters |
| Components | helpers puros, tipos, Playwright | specs, fixtures, Page Objects pais |
| Services | config, helpers puros, test data, tipos, APIs Node/Playwright | pages, components, specs |
| Helpers | outros helpers puros estritamente necessários, tipos | Playwright UI, fixtures, config global mutável |
| Config | tipos e APIs Node | pages, components, specs, test data de cenário |
| Test data | tipos | pages, fixtures, services, config runtime |
| Reporters | APIs de reporter, tipos de evidência | pages, fixtures, regras funcionais |

# Filosofia da Arquitetura

## Simplicidade acima de abstração desnecessária

Uma duplicação pequena e localizada é preferível a uma abstração genérica difícil de entender. A abstração deve nascer de um padrão comprovado, não de uma possibilidade futura.

## Legibilidade acima de redução de linhas

O spec deve permitir que uma pessoa compreenda o comportamento testado sem abrir várias camadas. Menos linhas não significam melhor teste.

## Composição acima de herança

Page Objects compõem Components e fixtures compõem outras fixtures. Não serão criadas hierarquias de páginas base com comportamento implícito, salvo necessidade técnica excepcional registrada.

## Responsabilidade única

Cada arquivo e objeto deve ter uma razão principal para mudar. Autenticação, configuração, interação, dados, lifecycle e assertions são responsabilidades diferentes.

## Testes independentes

Um teste não pode depender do sucesso, da ordem ou do estado produzido por outro teste. Dependência técnica entre projetos só é aceita para setups explícitos e idempotentes.

## Baixo acoplamento

Mudanças no widget de combobox não devem exigir alterações em todos os specs. Mudanças no catálogo funcional não devem alterar a camada de browser.

## Alta coesão

Comportamentos do mesmo domínio ficam próximos. Interações do AEJS não serão misturadas aos componentes do Portal.

## Reutilização consciente

Reutilizar apenas o que representa um contrato estável. Não generalizar dois fluxos apenas porque possuem linhas parecidas.

## Clareza antes de otimização

Primeiro garantir correção, rastreabilidade e isolamento. Paralelismo, redução de tempo e abstrações adicionais vêm depois de medições.

## Evidência antes de conveniência

A espera e a assertion devem comprovar o evento relevante. Um texto antigo na tela não prova que a nova gravação terminou.

## Segurança antes de velocidade

Nenhum ganho de performance justifica consumo indevido de tokens, exposição de segredos ou colisão em propostas compartilhadas.

## Comportamento do usuário antes de detalhe interno

Testes devem observar aquilo que o usuário percebe. Detalhes internos só entram quando constituem contrato técnico necessário, como status de uma gravação ou identidade da operação integrada.

# Organização dos Testes

## Estrutura ideal de um spec

Um spec deve conter, nesta ordem conceitual:

1. imports explícitos;
2. catálogo ou metadados dos casos, quando aplicável;
3. configuração local do grupo, apenas quando necessária;
4. hooks pequenos, preferencialmente substituídos por fixtures;
5. testes organizados por comportamento;
6. nenhuma implementação reutilizável extensa no fim do spec.

Interações repetidas saem do spec para Page Objects ou Components. Cálculos puros saem para helpers. Dados saem para `test-data`.

## Arrange / Act / Assert

Cada teste deve tornar visíveis as três etapas, mesmo sem comentários formais:

- **Arrange:** selecionar cenário, obter fixture, abrir estado inicial e declarar expectativas.
- **Act:** executar a ação principal do usuário.
- **Assert:** comprovar o resultado funcional e os efeitos técnicos indispensáveis.

Quando o teste atravessar vários sistemas ou etapas longas, utilizar steps com nomes funcionais. Cada step deve manter seu próprio Arrange, Act e Assert quando necessário.

## Assertions por teste

Não existe limite rígido de assertions. A regra é uma causa funcional de falha por teste.

- A maioria dos casos deve possuir aproximadamente uma a cinco assertions lógicas.
- Uma assertion lógica pode validar uma coleção coerente de campos.
- É aceitável validar vários atributos quando todos representam o mesmo contrato funcional, como os dados integrados de um participante.
- Assertions sobre comportamentos independentes devem ser divididas em testes distintos.
- Integrações longas podem conter mais assertions, organizadas por steps e domínio.

Não dividir um teste apenas para atingir uma contagem artificial.

## Tamanho recomendado

- Um teste funcional comum deve, preferencialmente, permanecer entre 15 e 80 linhas visíveis no spec.
- Um spec deve, preferencialmente, permanecer abaixo de aproximadamente 250 linhas.
- Acima desses limites, revisar responsabilidades e duplicação.
- Integrações ponta a ponta podem ultrapassar esses valores quando os steps permanecerem claros e os detalhes estiverem encapsulados.

Esses números são sinais de revisão, não regras automáticas.

## Quando dividir um teste

Dividir quando:

- existem ações principais independentes;
- uma falha impede identificar qual regra foi quebrada;
- os comportamentos exigem massas ou pré-condições distintas;
- os resultados podem evoluir separadamente;
- o teste possui mais de uma razão funcional para falhar.

Não dividir quando:

- a jornada só possui valor se executada de ponta a ponta;
- as assertions são diferentes aspectos do mesmo resultado;
- a separação criaria dependência entre testes.

## Quando criar outro arquivo

Criar outro spec quando:

- surge um novo domínio funcional;
- o grupo exige fixture ou política de execução distinta;
- testes de leitura e mutação precisam de isolamento operacional diferente;
- o arquivo atual se torna difícil de navegar mesmo após extrair componentes;
- o novo conjunto possui ciclo de vida próprio.

Não criar um arquivo por caso individual sem necessidade real.

## Boas práticas específicas de Playwright

- importar `test` e `expect` do agregador oficial de fixtures da suíte;
- usar locators, nunca armazenar `ElementHandle` sem necessidade excepcional;
- aguardar todas as promises relevantes;
- usar assertions web-first;
- iniciar a espera de request ou response antes da ação que a dispara;
- usar `test.step` em jornadas longas e integrações;
- usar tags e annotations para classificação;
- manter `test.only` proibido no CI;
- evitar configuração dinâmica escondida dentro de specs;
- anexar evidência complementar por `testInfo` apenas quando útil.

# Convenções

## Arquivos

| Tipo | Convenção | Exemplo conceitual |
|---|---|---|
| Spec | `kebab-case.spec.ts` | `proposal-list.spec.ts` |
| Setup | `kebab-case.setup.ts` | `auth.setup.ts` |
| Page Object | `kebab-case.page.ts` | `proposals.page.ts` |
| Component | `kebab-case.component.ts` | `searchable-combobox.component.ts` |
| Fixture | `kebab-case.fixture.ts` | `page-errors.fixture.ts` |
| Service | `kebab-case.service.ts` | `scenario.service.ts` |
| Helper | nome do domínio em `kebab-case.ts` | `dates.ts` |
| Tipos compartilhados | `kebab-case.types.ts` | `portal.types.ts` |
| Dados | nome funcional em `kebab-case.ts` ou JSON | `integration-data.ts` |

## Métodos

- usar `camelCase`;
- começar com verbo que expresse intenção;
- Page Objects: `open`, `openProposal`, `loadAllProposals`;
- Components: `selectOption`, `confirm`, `openRow`;
- Services: `validateSession`, `reserveScenario`, `restoreScenario`;
- Helpers: `parseBrazilianDate`, `normalizeText`;
- evitar nomes vagos como `handle`, `process`, `doAction`, `executeFlow` ou `helper`.

## Fixtures

- usar substantivos ou estados fornecidos ao teste;
- exemplos: `authenticatedPage`, `portalConfig`, `defaultProposal`, `mutableScenario`;
- o nome deve indicar o valor recebido, não a função interna de setup;
- fixtures automáticas devem ter nome que revele seu efeito, como `capturePageErrors`.

## Page Objects

- classes em `PascalCase` com sufixo `Page`;
- exemplos: `ProposalsPage`, `ProposalPage`, `AejsPage`;
- não usar nomes de caso funcional no Page Object.

## Components

- classes em `PascalCase` com sufixo `Component`;
- nomes orientados ao widget ou região de UI;
- componentes ExtJS permanecem explicitamente separados dos componentes Portal.

## Helpers e utilitários

- helpers de domínio usam nomes específicos;
- utilitários realmente genéricos devem ser raros;
- não criar arquivos `utils.ts`, `common.ts` ou `helpers.ts` como depósitos genéricos.

## Constantes

- constantes locais imutáveis usam `camelCase` quando não representam configuração global;
- constantes compartilhadas e semanticamente globais usam `UPPER_SNAKE_CASE`;
- não criar constantes para valores usados uma única vez quando isso reduz legibilidade;
- timeouts não devem aparecer como números mágicos espalhados.

## IDs funcionais

- preservar os IDs atuais sem alteração;
- formato: prefixo de domínio, hífen e número, por exemplo `PROP-14`;
- novos prefixos exigem validação no catálogo;
- o ID deve aparecer no título ou metadata reportável;
- ID não substitui uma descrição legível;
- nenhum ID pode ser reutilizado para outro comportamento.

# Page Objects

## Responsabilidades

Um Page Object pode:

- navegar para uma página;
- expor regiões importantes como locators;
- executar ações de usuário de alto nível;
- compor Components;
- aguardar a prontidão técnica mínima da página;
- devolver dados necessários para o spec realizar assertions;
- esconder seletores e detalhes de interação repetitivos.

## O que pode existir

- locators privados ou readonly;
- métodos pequenos orientados à intenção;
- composição de tabs, dialogs, grids e comboboxes;
- validação técnica de que a página terminou de abrir;
- operações de navegação idempotentes quando possível.

## O que nunca deve existir

- catálogo de casos funcionais;
- decisões sobre qual caso deve rodar;
- massa fixa de um caso específico;
- credenciais;
- configuração lida diretamente de globals;
- assertions sobre regras de negócio específicas;
- lógica para ignorar falhas;
- dependência de outro spec;
- métodos gigantes como `completeEverythingAndValidateAll`;
- herança profunda entre páginas;
- `waitForTimeout` como sincronização.

## Quando criar um Page Object

Criar quando:

- a interface representa uma página ou jornada estável;
- mais de um spec repete navegação ou interação relevante;
- os detalhes de locator obscurecem o comportamento funcional;
- a página compõe vários widgets reutilizáveis;
- mudanças da página devem ser absorvidas em um único ponto.

Não criar apenas para envolver uma única chamada `goto` ou um único locator.

## Como evitar Page Objects gigantes

- Page Object representa a página e delega widgets a Components.
- Seções independentes do formulário podem ser componentes quando possuem interação própria e reutilização real.
- Preenchimentos extensos de cenário devem ser orquestrados pelo spec ou por uma camada de cenário claramente nomeada, não acumulados em uma página genérica.
- Ao ultrapassar aproximadamente 200 a 300 linhas, revisar coesão, quantidade de locators e responsabilidades.
- Métodos que mudam por motivos diferentes pertencem a objetos diferentes.

# Components

## Quando criar

Criar um Component quando uma região de UI:

- aparece em mais de uma página ou domínio;
- possui comportamento próprio e repetido;
- concentra locators complexos;
- pode mudar independentemente da página;
- precisa impor um contrato único de interação.

## Quando não criar

Não criar quando:

- existe apenas um locator simples usado uma vez;
- o componente seria apenas um alias sem comportamento;
- duas regiões são visualmente parecidas, mas possuem contratos diferentes;
- a abstração exigiria parâmetros genéricos demais;
- o componente esconderia a regra funcional testada.

## Responsabilidade máxima

Um Component deve controlar uma região visual coesa. Ele não navega entre sistemas, não escolhe massa, não autentica e não decide o resultado esperado do caso.

## Componentes previstos neste projeto

- tabs do cadastro da proposta;
- combobox pesquisável do Portal;
- dialog e alert dialog;
- bloco de endereço e CEP;
- tabela ou card de proposta, se a reutilização justificar;
- grid ExtJS;
- janela ExtJS;
- tabs ExtJS;
- campo ExtJS quando houver comportamento próprio recorrente.

# Fixtures

## Responsabilidades

Fixtures fornecem recursos com lifecycle controlado:

- configuração validada;
- browser context ou page autenticada;
- Page Objects prontos para uso;
- cenário reservado ou preparado;
- captura de erros e attachments;
- restauração de estado quando possível.

## Ciclo de vida

Cada fixture deve deixar explícitos:

1. recursos dos quais depende;
2. setup executado antes do teste;
3. valor fornecido ao teste;
4. teardown executado depois do teste;
5. comportamento quando setup ou teste falha.

O teardown deve ser idempotente sempre que possível.

## Fixtures de teste

Usar para recursos que precisam de isolamento por teste:

- `Page` e `BrowserContext`;
- Page Objects associados à página;
- proposta mutável exclusiva do caso;
- coleta de erros da página;
- estado temporário do formulário.

## Fixtures de worker

Usar somente quando o recurso puder ser compartilhado com segurança por todos os testes daquele worker:

- configuração imutável;
- autenticação por conta exclusiva do worker;
- serviço caro e read-only;
- reserva de massa exclusiva para o worker.

Não usar fixture de worker para compartilhar a mesma proposta mutável entre testes paralelos.

## Composição

- fixtures menores podem compor fixtures maiores;
- autenticação depende de configuração;
- página autenticada depende de autenticação;
- Page Object depende de página;
- cenário mutável depende de autorização e, quando aplicável, serviço de massa;
- dependências devem permanecer acíclicas.

## Boas práticas

- fixture só executa se for solicitada, salvo efeito automático indispensável;
- nomes revelam o recurso entregue;
- evitar fixtures automáticas em excesso;
- não esconder uma jornada funcional extensa no setup;
- anexar evidência no teardown apenas quando agrega diagnóstico;
- nunca engolir erro de limpeza silenciosamente;
- separar falha do teste e falha do teardown no relatório.

# Helpers, Utilitários e Serviços

## Quando usar helper

Usar para transformação pura e específica do domínio:

- calcular dias úteis;
- normalizar data brasileira;
- escapar expressão regular;
- validar estrutura estática de catálogo.

Um helper recebe valores e devolve valores. Não acessa browser, rede ou filesystem mutável.

## Quando usar utilitário

Utilitários são funções puras e realmente genéricas. Devem ser raros. Se uma função possui vocabulário do Portal ou AEJS, ela é helper de domínio, não utilitário genérico.

## Quando usar serviço

Usar Service quando houver comunicação técnica não visual:

- endpoint de sessão;
- API oficial de preparação ou restauração de massa;
- leitura segura de estado externo;
- reserva de operação por worker.

Services não usam locators e não fazem assertions funcionais.

## Quando usar fixture

Usar quando existir lifecycle, dependência, setup, teardown ou valor a ser injetado no teste.

## Quando usar Component

Usar para uma região reutilizável da UI com interação própria.

## Quando usar Page Object

Usar para página ou jornada de UI que coordena Components e navegação.

## Regra de desempate

- Se transforma valor: helper.
- Se fala com API ou recurso externo sem UI: service.
- Se gerencia lifecycle: fixture.
- Se controla parte da UI: component.
- Se representa uma página ou jornada de UI: Page Object.
- Se declara comportamento e resultado esperado: spec.

# Locators

## Ordem de preferência

1. `getByRole`
2. `getByLabel`
3. `getByPlaceholder`
4. `getByText`
5. `getByTestId`
6. atributo funcional estável, como `name`, encapsulado
7. CSS simples, estável e estritamente escopado

Essa ordem é uma preferência, não uma regra cega. O locator escolhido deve representar o contrato mais estável e compreensível para o elemento.

## `getByRole`

Preferência para botões, links, tabs, headings, dialogs, opções, listas e outros elementos com semântica acessível. Sempre fornecer nome acessível quando isso tornar o locator único.

## `getByLabel`

Preferência para campos de formulário com label corretamente associado. Além de estável, verifica implicitamente parte do contrato de acessibilidade.

## `getByPlaceholder`

Usar quando placeholder for contrato estável e não houver label adequada. Não usar quando o texto for instrução transitória ou variável.

## `getByText`

Usar para conteúdo visível estável, mensagens e regiões textuais. Escopar ao container correto e evitar textos genéricos que aparecem em várias áreas.

## `getByTestId`

Usar quando não houver contrato acessível confiável ou quando o elemento exigir identificador de automação explícito. Test IDs devem ser estáveis, sem codificar layout ou posição.

## Atributo `name`

Neste projeto, nomes como campos do Portal e AEJS representam contratos técnicos relevantes. Podem ser utilizados quando label, role ou test ID não forem suficientes, mas devem ficar encapsulados em Page Objects ou Components.

## Estratégias proibidas ou desencorajadas

- XPath sem justificativa excepcional;
- seletores baseados em classes visuais geradas;
- cadeias CSS que reproduzem toda a estrutura do DOM;
- IDs dinâmicos ExtJS sem normalização comprovada;
- escolha silenciosa por `first`, `last` ou `nth`;
- localizar pelo texto de toda a página e depois filtrar com JavaScript;
- `ElementHandle` persistido quando Locator resolve o problema;
- duplicar o mesmo locator em vários specs;
- locator que depende de ordem visual não contratual;
- `force` para contornar locator incorreto.

Se `first`, `last`, `nth`, CSS complexo ou `force` forem inevitáveis no AEJS, a decisão deve ficar encapsulada, comentada e coberta por uma verificação de escopo.

# Assertions

## Padrão

- usar `expect` do Playwright;
- preferir assertions web-first para UI;
- usar assertions síncronas apenas para valores já resolvidos e funções puras;
- toda promise de assertion deve ser aguardada;
- mensagens adicionais devem explicar o contrato, não repetir o matcher.

## Organização

- assertions permanecem próximas da ação que comprovam;
- journeys longas usam steps por domínio;
- evitar bloco único de assertions muito distante da ação;
- validar primeiro o resultado principal e depois os detalhes relacionados;
- não duplicar a mesma assertion em Page Object e spec.

## Quantidade

- não existe meta de uma assertion por teste;
- assertions múltiplas são corretas quando comprovam um único comportamento;
- usar soft assertions somente quando coletar várias divergências independentes agrega valor e o teste pode continuar com segurança;
- não usar soft assertion para permitir que uma jornada prossiga em estado inválido.

## Onde não colocar assertions

- helpers puros;
- test data;
- runtime config;
- services genéricos;
- reporters.

Page Objects e Components podem verificar prontidão técnica mínima, mas regras funcionais e expectativas do caso pertencem ao spec.

# Tratamento de Esperas

## Espera pela UI

Usar locator e assertion web-first quando o resultado relevante é visual:

- elemento visível;
- dialog aberto ou fechado;
- tab selecionada;
- campo habilitado;
- loading removido;
- valor renderizado.

## Espera por requests ou responses

Usar espera de rede quando a operação só está comprovada pela comunicação correspondente:

- salvamento de cadastro;
- confirmação;
- cancelamento;
- autenticação;
- carregamento de propostas quando o payload também é parte da validação.

A espera deve ser criada antes da ação que dispara a requisição. Deve filtrar método, endpoint e, quando necessário, identidade do recurso.

## Quando utilizar `expect`

Usar `expect` para aguardar estado observável com timeout e mensagem coerentes. Preferir timeout local quando uma operação específica é lenta, em vez de aumentar o timeout global.

## Esperas proibidas

- `waitForTimeout` como sincronização normal;
- sleeps dentro de helpers;
- polling manual quando uma assertion web-first resolve;
- `networkidle` como sinal genérico de que uma aplicação Next.js terminou;
- espera por texto antigo que já poderia estar na tela;
- timeout global enorme para esconder lentidão localizada.

Wait fixo só pode existir para diagnóstico temporário ou limitação externa comprovada, acompanhado de comentário, prazo de remoção e decisão registrada quando persistente.

# Tratamento de Erros

## Page errors

- uma fixture automática coletará erros da página;
- erros inesperados falharão o teste;
- erro deve ser anexado com mensagem, stack segura, URL e step quando possível;
- não ignorar erro apenas porque a assertion principal passou.

## React 418

- a quarentena atual deve permanecer explícita e opcional;
- deve filtrar exatamente o erro conhecido;
- precisa de responsável e data de revisão;
- não pode ocultar outros erros de hidratação;
- a ocorrência deve continuar visível no relatório mesmo quando autorizada.

## Expected failures

Usar para bug conhecido, reproduzível e documentado quando o teste já está corretamente implementado.

- registrar motivo e referência;
- limitar ao caso e condição afetados;
- unexpected pass deve falhar ou chamar atenção para possível correção;
- não usar como quarentena genérica de flakiness.

## `fixme`

Usar quando o teste não pode ser implementado ou executado corretamente por pré-condição conhecida, como massa externa ausente.

- motivo obrigatório;
- data ou critério de revisão;
- correspondência no catálogo de pendências;
- nunca usar para esconder teste quebrado durante migração.

## `skip`

Usar apenas para condição de ambiente, browser ou capacidade explicitamente não aplicável. Todo skip precisa de justificativa observável no relatório.

## Mensagens de erro

Uma mensagem útil deve identificar:

- ID funcional;
- ação ou contrato esperado;
- ambiente;
- identificador seguro da proposta ou operação quando aplicável;
- valor esperado e recebido quando seguro;
- sistema em que ocorreu: Portal, Admin ou AEJS.

Nunca incluir senha, token, cookie, magic link completo ou dados pessoais desnecessários.

# Organização da Configuração

## Runtime config

- carregada uma vez no processo Node;
- validada antes da execução dependente;
- imutável durante o teste;
- separada por tipos claros de Portal, Admin e AEJS;
- sem dependência de globals do browser;
- sem `Proxy` com estado implícito.

## Environment variables

- são a fonte prioritária no CI;
- nomes atuais devem ser preservados quando continuam semanticamente corretos;
- valores JSON precisam de parsing e mensagem de erro explícita;
- variáveis obrigatórias variam por projeto, evitando exigir credenciais AEJS em um smoke do Portal;
- defaults só serão usados quando forem seguros e inequívocos.

## Secrets

- nunca versionados;
- nunca registrados;
- nunca incluídos em title, annotation ou attachment;
- preenchimento de senha não deve gerar evidência legível;
- acesso restrito aos projetos que realmente necessitam do segredo.

## `storageState`

- criado por setup explícito;
- salvo em `playwright/.auth` ou output privado equivalente;
- ignorado pelo Git;
- excluído de upload de artefatos;
- recriado quando inválido ou expirado;
- não compartilhado entre workers mutáveis sem análise de segurança.

## Projects

Projetos lógicos previstos:

| Projeto | Responsabilidade | Autenticação | Workers iniciais | Retries iniciais |
|---|---|---:|---:|---:|
| `setup` | preparar sessão | cria estado | 1 | 0 |
| `smoke` | infraestrutura essencial | autenticado e não autenticado | 1 | 0 |
| `functional-readonly` | casos sem mutação persistente | autenticado | conservador, ampliável | somente após análise |
| `functional-mutation` | formulários e estado persistente | autenticado | 1 | 0 |
| `integration` | Portal para AEJS e transições | Portal e AEJS | 1 | 0 |

Projetos não devem duplicar specs desnecessariamente. Tags podem complementar a seleção. Timeouts e artefatos devem ser ajustados por risco e duração.

# Integração Portal → AEJS

## Princípio

Uma validação de integração deve provar que a mesma operação preparada ou selecionada no Portal foi localizada e validada no AEJS.

## Fluxo arquitetural

1. O spec recebe configuração e cenário autorizado.
2. A proteção de mutação valida ambiente, opt-in e operação.
3. Uma página autenticada do Portal abre a proposta correta.
4. Page Objects e Components preenchem o cenário.
5. O teste aguarda e valida as respostas de gravação e finalização.
6. O identificador da operação permanece em variável local tipada.
7. Um contexto ou página independente autentica no AEJS.
8. O AEJS Page Object abre o cadastro da mesma operação.
9. Components ExtJS navegam por grids, janelas e tabs.
10. O spec valida os reflexos por domínio em steps separados.
11. Relatório, trace e evidências identificam caso, ambiente e operação segura.
12. Teardown fecha contextos e executa restauração somente quando prevista e segura.

## Contextos

- Portal e AEJS devem utilizar páginas ou contextos distintos para evitar mistura de sessão, cookies e configuração.
- O teste pode usar um único browser quando isso não viola isolamento.
- Credenciais AEJS ficam restritas à fixture ou Page Object responsável pelo login.

## Estado entre etapas

- o identificador da operação é um valor local do teste;
- não usar variável global mutável;
- não depender da ordem de specs;
- não depender de memória de reporter ou worker;
- não inferir automaticamente a operação a partir da última massa usada.

## Organização dos steps

Steps recomendados:

- validar autorização do cenário;
- preparar proposta no Portal;
- confirmar ou executar transição;
- autenticar no AEJS;
- localizar operação;
- validar pretendentes e composição;
- validar imóvel e garantidores;
- validar documentos e tarefas;
- registrar evidência final.

Cada cenário executa somente os steps aplicáveis.

## Seletores ExtJS

- centralizados em Components AEJS;
- escopados à janela ou grid ativo;
- locators devem comprovar unicidade antes da ação;
- IDs dinâmicos não são contratos;
- `force` é último recurso e deve permanecer encapsulado;
- máscaras de loading devem ser tratadas junto ao componente responsável;
- navegação não pode escolher silenciosamente o último botão global.

## Timeouts e execução

- integração terá timeout específico maior que o funcional comum;
- execução inicial serial;
- retries zero para evitar repetir mutações;
- falhas não devem iniciar automaticamente nova preparação sobre a mesma massa;
- paralelismo exige operação exclusiva por worker.

## Evidências

- trace em falha;
- screenshot em falha;
- vídeo quando necessário para evidência operacional;
- attachments textuais sem segredo;
- steps no relatório;
- operação e ambiente identificados de forma segura.

# Estratégia para Crescimento

## Como adicionar novos testes

1. Identificar domínio e ID funcional.
2. Confirmar se o teste é read-only, mutável ou integração.
3. Identificar massa e estratégia de restauração.
4. Reutilizar fixture existente apenas se o lifecycle for compatível.
5. Reutilizar Page Object ou Component existente quando o contrato for o mesmo.
6. Escrever Arrange, Act e Assert visíveis.
7. Adicionar apenas a abstração mínima necessária.
8. Atualizar catálogo e pendências.
9. Executar validações obrigatórias.
10. Atualizar documentação quando houver decisão arquitetural.

## Como evitar duplicação

- duplicação de locator: mover para Page Object ou Component;
- duplicação de interação de widget: criar ou ampliar Component coeso;
- duplicação de navegação de página: Page Object;
- duplicação de lifecycle: fixture;
- duplicação de transformação pura: helper;
- duplicação de dados: test data;
- duplicação de comunicação não visual: service.

Não resolver duplicação copiando um helper genérico para uma camada incorreta.

## Quando refatorar

Refatorar quando:

- o mesmo padrão aparece pela terceira vez;
- uma mudança de UI exige editar múltiplos specs;
- um spec ultrapassa seu domínio;
- Page Object acumula Components independentes sem delegação;
- fixture executa setup não utilizado;
- locator precisa de `first`, `last` ou `force` em vários locais;
- tempo de execução cresce por navegação ou setup duplicados;
- flakiness possui causa repetida.

Refatoração não deve ocorrer no meio de uma migração de módulo sem preservar uma baseline comparável.

## Quando criar novos módulos

Criar um módulo quando houver:

- novo domínio funcional;
- nova aplicação ou sistema integrado;
- política de autenticação distinta;
- lifecycle de massa próprio;
- configuração de projeto, browser ou timeout diferente;
- equipe responsável ou evolução independente.

## Métricas de saúde

A evolução deve acompanhar:

- quantidade de casos por módulo;
- duração por projeto;
- taxa de falhas reais e flakiness;
- autenticações por execução;
- testes serializados por falta de massa;
- uso de `force`, `first`, `last`, `nth` e waits excepcionais;
- tempo médio de diagnóstico;
- quantidade de pendências e expected failures;
- Page Objects ou Components com crescimento excessivo.

# Anti-patterns

As práticas abaixo são proibidas, salvo exceção técnica registrada e revisável:

1. Waits fixos usados como sincronização normal.
2. Page Objects gigantes que concentram todo o Portal.
3. Helpers realizando assertions funcionais.
4. Helpers manipulando `Page` ou `Locator`.
5. Lógica de negócio escondida em Page Objects.
6. Fixtures que executam jornadas funcionais extensas sem o spec revelar isso.
7. Duplicação de locators em vários specs.
8. Dependência de ordem entre testes.
9. Teste que depende do resultado produzido por outro teste.
10. Estado global mutável entre specs.
11. Compartilhar proposta mutável entre workers.
12. Paralelismo habilitado antes de isolamento de massa.
13. Excesso de abstração para eliminar poucas linhas semelhantes.
14. Herança profunda de Page Objects.
15. Arquivos genéricos como `utils.ts`, `common.ts` ou `base-page.ts` sem responsabilidade clara.
16. Seletores baseados em classes visuais ou DOM completo.
17. Uso indiscriminado de `first`, `last` ou `nth`.
18. Uso de `force` para esconder locator ou estado incorreto.
19. Uso de `networkidle` como espera universal para Next.js.
20. Assertions manuais imediatas quando existe assertion web-first.
21. Soft assertions que permitem continuar em estado inválido.
22. Timeout global elevado para mascarar operação lenta específica.
23. Retry automático em teste mutável.
24. Ignorar erro de página sem filtro exato e justificativa.
25. `fixme` ou `skip` sem motivo e revisão.
26. Expected failure usado como quarentena de flakiness.
27. Credencial, token, cookie ou magic link em log ou attachment.
28. `storageState` versionado ou publicado.
29. Seleção de caso por configuração de reporter.
30. Conversão literal de cadeias Cypress para sequências Playwright.
31. Criar abstração apenas para espelhar comandos customizados antigos.
32. Remover Cypress antes de equivalência e cutover formal.

# Exemplos Arquiteturais

Os exemplos abaixo são conceituais e não representam código real do projeto.

## Exemplo de spec funcional simples

```text
Caso: ABC-01 | Deve exibir determinada informação

Arrange
  Receber página autenticada e massa somente leitura
  Abrir a entidade alvo

Act
  Executar a ação principal do usuário

Assert
  Validar o resultado visível
  Validar o efeito técnico somente se ele fizer parte do contrato
```

## Exemplo de composição de camadas

```text
proposal-details.spec
  usa authenticatedProposal fixture

authenticatedProposal fixture
  usa portalConfig
  usa storageState
  fornece ProposalPage

ProposalPage
  compõe ProposalTabsComponent
  compõe SearchableComboboxComponent

Spec
  mantém as expectativas do caso funcional
```

## Exemplo de integração

```text
Caso de integração
  Step 1: selecionar cenário autorizado
  Step 2: preencher e confirmar no Portal
  Step 3: guardar localmente o número da operação
  Step 4: autenticar em contexto separado no AEJS
  Step 5: abrir exatamente a mesma operação
  Step 6: validar reflexos por domínio
  Step 7: anexar evidências seguras
```

## Exemplo de decisão entre camadas

```text
Problema: selecionar opção em combobox repetido
  -> Component

Problema: calcular quantidade de dias úteis
  -> Helper puro

Problema: obter sessão por endpoint autorizado
  -> Service

Problema: criar e limpar proposta exclusiva
  -> Fixture que compõe Service

Problema: abrir lista e escolher proposta
  -> Page Object

Problema: definir o que deve ser exibido ao usuário
  -> Spec
```

# Checklist para Novas Implementações

Antes de abrir qualquer Pull Request, confirmar:

## Escopo e comportamento

- [ ] O caso possui ID funcional válido e único.
- [ ] O título descreve o comportamento esperado.
- [ ] O teste está no domínio correto.
- [ ] A classificação read-only, mutação ou integração está correta.
- [ ] A massa e a pré-condição estão documentadas.
- [ ] O teste possui uma razão funcional clara para falhar.
- [ ] Arrange, Act e Assert são identificáveis.

## Independência e dados

- [ ] O teste executa isoladamente.
- [ ] O teste não depende de ordem.
- [ ] O teste não depende de outro spec.
- [ ] O estado mutável é exclusivo, descartável ou restaurado.
- [ ] A estratégia de worker é segura para a massa utilizada.
- [ ] O teste não consome magic link desnecessariamente.

## Arquitetura

- [ ] A camada escolhida para cada responsabilidade está correta.
- [ ] Não existe lógica funcional escondida em helper, fixture ou Page Object.
- [ ] Components representam regiões coesas.
- [ ] Page Objects não cresceram de forma desproporcional.
- [ ] Não foi criada abstração sem reutilização ou contrato real.
- [ ] Não há dependência circular.
- [ ] Não há duplicação relevante de locator ou interação.

## Locators e sincronização

- [ ] Locators seguem a ordem de preferência.
- [ ] Locators são únicos e escopados.
- [ ] Não há `first`, `last`, `nth` ou `force` sem justificativa.
- [ ] Não há wait fixo.
- [ ] Assertions de UI são web-first.
- [ ] Esperas de rede são registradas antes da ação.
- [ ] A espera comprova a operação atual.
- [ ] Timeouts excepcionais são locais e justificados.

## Assertions e erros

- [ ] Assertions funcionais permanecem no spec.
- [ ] Mensagens de erro agregam contexto seguro.
- [ ] Page errors inesperados não são ignorados.
- [ ] `skip`, `fixme` ou expected failure possuem justificativa e revisão.
- [ ] Soft assertions não permitem continuar em estado inválido.

## Segurança

- [ ] Nenhum segredo foi adicionado ao código.
- [ ] Nenhum token, cookie ou magic link aparece em log.
- [ ] Attachments e traces foram avaliados quanto a dados sensíveis.
- [ ] `storageState` permanece fora do Git e dos artefatos.
- [ ] Mutações continuam protegidas por opt-in e ambiente.

## Qualidade e validação

- [ ] TypeScript está em modo estrito sem `any` injustificado.
- [ ] Lint foi executado e aprovado.
- [ ] Typecheck foi executado e aprovado.
- [ ] Teste alvo foi executado e aprovado.
- [ ] Módulo relacionado foi executado quando necessário.
- [ ] Resultado foi comparado com a baseline Cypress durante a migração.
- [ ] Relatório e evidência de falha são suficientes para diagnóstico.
- [ ] Documentação e checklist de migração foram atualizados quando aplicável.
- [ ] Nova decisão arquitetural foi registrada quando necessária.

# Evolução da Arquitetura

## Política de evolução

A arquitetura pode evoluir, mas mudanças estruturais devem ser deliberadas. Nenhuma nova camada, dependência transversal, política de retry, estratégia de massa ou exceção permanente será introduzida apenas dentro de um Pull Request sem registro arquitetural.

## Quando registrar uma decisão

Registrar uma decisão quando houver:

- nova camada ou alteração nas dependências permitidas;
- mudança de estratégia de autenticação;
- mudança de `storageState` ou política de secrets;
- aumento de workers ou habilitação de paralelismo;
- novo browser obrigatório;
- separação da jornada Portal para AEJS;
- reporter customizado;
- adoção de plugin ou biblioteca de terceiros;
- exceção permanente a locator, wait ou tratamento de erro;
- nova estratégia de criação ou restauração de massa;
- alteração no contrato de IDs funcionais;
- substituição de uma decisão existente.

## Modelo de decisão arquitetural

### ARCH-XXX — Título

- **Data:** AAAA-MM-DD
- **Status:** Proposta | Aceita | Substituída | Rejeitada
- **Contexto:** problema observado e evidências.
- **Decisão:** abordagem escolhida.
- **Alternativas:** opções avaliadas.
- **Impacto nas camadas:** arquivos e dependências afetados.
- **Impacto operacional:** CI, massa, segurança, performance e manutenção.
- **Riscos:** limitações introduzidas.
- **Critério de revisão:** data ou condição para reavaliar.
- **Substitui:** decisão anterior, quando aplicável.

## Registro de evoluções

### ARCH-001 — Arquitetura inicial da suíte Playwright

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** início oficial da migração da suíte Cypress, composta por testes funcionais, mutações e integrações Portal/AEJS.
- **Decisão:** adotar a arquitetura em camadas e os limites descritos neste documento.
- **Alternativas:** conversão literal da estrutura Cypress; suíte plana sem fixtures, Page Objects ou Components.
- **Impacto nas camadas:** define todas as camadas iniciais.
- **Impacto operacional:** migração incremental, Chromium inicial, execução conservadora para mutações e evidência baseada em trace.
- **Riscos:** excesso de abstração se os limites não forem respeitados; duplicação temporária durante coexistência.
- **Critério de revisão:** após a migração dos smoke tests e novamente após o primeiro módulo funcional mutável.
- **Substitui:** nenhuma decisão anterior.

### ARCH-002 — Fronteira segura do setup de autenticação

- **Data:** 2026-07-07
- **Status:** Aceita
- **Contexto:** magic links são de uso único, estados autenticados podem expirar ou pertencer a outro ambiente e artefatos automáticos do runner podem registrar dados sensíveis durante o login.
- **Decisão:** o projeto `setup` valida primeiro o estado em `/api/auth/me`, associa-o a um fingerprint sem segredos, gera novo acesso somente quando necessário, salva estado e metadados privados em `playwright/.auth` com permissão restrita e não produz screenshot, vídeo ou trace. Durante a coexistência, a configuração local ignorada do Cypress pode ser lida apenas pela camada Node de configuração; variáveis de ambiente permanecem prioritárias e essa compatibilidade deverá ser removida no cutover.
- **Alternativas:** autenticação em cada spec; reutilização sem validação; cópia permanente da configuração Cypress; artefatos completos no setup.
- **Impacto nas camadas:** `tests/setup`, `tests/config`, configuração de projetos e diretório privado `playwright/.auth`.
- **Impacto operacional:** menos magic links e menor risco de vazamento, com diagnóstico do setup restrito a mensagens sanitizadas.
- **Riscos:** a primeira execução continua dependente do Admin ou de um access URL válido; sem artefatos visuais, o diagnóstico exige etapas de erro claras.
- **Critério de revisão:** após a primeira execução E2E validada em DEV e antes da configuração de autenticação no CI.
- **Substitui:** nenhuma decisão anterior.

### ARCH-003 — Contexto não autenticado escopado

- **Data:** 2026-07-08
- **Status:** Aceita
- **Contexto:** o primeiro módulo funcional possui três casos autenticados e um caso que precisa comprovar o login inválido sem sessão, enquanto os projetos funcionais autenticados usam `storageState` por padrão.
- **Decisão:** usar `test.use` com estado vazio no menor `describe` aplicável; não criar fixture global de página não autenticada até existir lifecycle ou reutilização real em outro domínio.
- **Alternativas:** criar projeto separado; limpar cookies do contexto autenticado; criar fixture global usada por um único caso.
- **Impacto nas camadas:** specs podem sobrescrever opções nativas do contexto dentro de escopo explícito; fixtures autenticadas permanecem inalteradas.
- **Impacto operacional:** mantém um único projeto read-only, não consome outro magic link e garante contexto limpo por teste.
- **Riscos:** uma necessidade não autenticada recorrente poderá justificar fixture ou projeto próprio no futuro.
- **Critério de revisão:** quando um segundo domínio funcional exigir contexto não autenticado ou antes de habilitar paralelismo adicional.
- **Substitui:** nenhuma decisão anterior.

## Revisões obrigatórias

Este documento deve ser revisado:

- após a conclusão da infraestrutura e autenticação;
- após o primeiro módulo funcional migrado;
- após o primeiro módulo mutável migrado;
- após a primeira jornada Portal para AEJS;
- antes de habilitar paralelismo adicional;
- antes de tornar Playwright bloqueante no CI;
- antes de remover Cypress;
- sempre que métricas demonstrarem crescimento excessivo, flakiness recorrente ou abstração inadequada.
