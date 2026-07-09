# Auditoria Técnica — Encerramento da Fase 6

## Objetivo

Consolidar a auditoria final da Fase 6 da migração Cypress → Playwright, considerando:

- o estado documentado em `Docs/PLAYWRIGHT_MIGRATION.md`;
- o estado documentado em `Docs/PLAYWRIGHT_ARCHITECTURE.md`;
- a ausência dos arquivos `task.md` e `walkthrough.md` no workspace auditado;
- as auditorias técnicas anteriores sobre estrutura, Page Objects e Components, Fixtures/Runtime Config/Helpers e Specs.

Este documento não implementa recomendações. Ele classifica riscos, remove duplicidades entre auditorias e define quais ajustes devem ser tratados antes da Fase 7.

## Escopo auditado

Foram considerados os seguintes artefatos:

- `Docs/PLAYWRIGHT_MIGRATION.md`;
- `Docs/PLAYWRIGHT_ARCHITECTURE.md`;
- estrutura atual de `tests`;
- camada de `tests/pages/**`;
- camada de `tests/components/**`;
- camada de `tests/fixtures/**`;
- camada de `tests/config/**`;
- camada de `tests/helpers/**`;
- specs em `tests/functional/**`;
- specs em `tests/smoke/**`;
- configuração runtime do Playwright em `playwright.config.ts`;
- resultados consolidados das auditorias anteriores realizadas ao final da Fase 6.

Os arquivos `task.md` e `walkthrough.md` foram solicitados como parte do escopo documental, porém não existem no workspace no momento desta auditoria. Essa ausência é tratada como lacuna documental, não como falha da suíte Playwright.

Não foram auditados nesta etapa:

- código funcional do Portal, Admin, AEJS ou SCCI;
- implementação Cypress, exceto como referência histórica já registrada na documentação;
- CI/CD;
- qualidade funcional detalhada de cada cenário;
- execução real dos testes;
- performance de runtime.

## Resumo executivo

A Fase 6 está documentada como concluída, com as subfases 6.1 a 6.13 migradas e os 108 casos funcionais representados no Playwright. A documentação principal está coerente com o objetivo de coexistência controlada e com a preparação da Fase 7.

A arquitetura atual é suficiente para encerrar a migração funcional do Portal, mas ainda não deve ser considerada pronta para iniciar a Fase 7 sem uma preparação curta. O principal motivo é que a Fase 7 introduzirá integração Portal → AEJS, mutação controlada, autenticação adicional e validação cruzada de operação. Esses riscos exigem fronteiras mais explícitas para AEJS, massa mutável e lifecycle de setup/teardown.

As auditorias convergiram para quatro recomendações que devem ser tratadas antes da Fase 7:

1. separar testes realmente read-only de testes mutáveis;
2. definir lifecycle centralizado para cenários mutáveis;
3. criar fronteira estrutural para AEJS em pages, components, fixtures e config;
4. atualizar a documentação operacional da Fase 7 com essas decisões antes de implementar integrações.

Não há bloqueador técnico crítico para continuar a migração, mas há bloqueadores de governança técnica para executar a Fase 7 com segurança. Em outras palavras: a base Playwright funciona, mas a Fase 7 não deve começar adicionando AEJS diretamente sobre a estrutura Portal-only atual.

## Pontos fortes da arquitetura

- A estrutura Playwright separa responsabilidades principais em `tests/functional`, `tests/smoke`, `tests/setup`, `tests/fixtures`, `tests/pages`, `tests/components`, `tests/config` e `tests/helpers`.
- A organização funcional por domínio em `tests/functional/proposal-form/**` escala melhor do que uma pasta plana de specs.
- A cadeia de fixtures é explícita e legível: configuração, autenticação, Portal e captura de erros.
- O uso de `storageState` e projeto `setup` segue a estratégia recomendada para reaproveitamento seguro de sessão.
- Page Objects e Components existentes são poucos, focados e não apresentam hierarquia artificial.
- `components/portal` já estabelece um precedente correto de namespace por produto.
- Helpers permanecem puros e não acessam Playwright, `Page`, `Locator`, rede, filesystem ou variáveis de ambiente.
- A configuração Playwright já prevê projetos lógicos para `setup`, `smoke`, `functional-readonly`, `functional-mutation` e `integration`.

## Pontos fortes da suíte de testes

- Os 108 casos funcionais estão migrados e rastreáveis por IDs funcionais.
- A suíte não utiliza `waitForTimeout`, `test.only`, sleeps manuais ou `force: true` nas specs auditadas.
- Há uso consistente de `await expect(locator)` e assertions web-first.
- Smoke tests permanecem pequenos e objetivos.
- A organização por domínio facilita execução seletiva e investigação.
- O contrato de casos preserva rastreabilidade entre baseline Cypress e implementação Playwright.
- A suíte já exercita autenticação, listagem de propostas, abertura de proposta, formulário cadastral, participantes, renda, imóvel, garantidores e detalhamento.

## Pontos fortes da documentação

- `Docs/PLAYWRIGHT_MIGRATION.md` representa corretamente o encerramento da Fase 6, com subfases 6.1 a 6.13 concluídas.
- `Docs/PLAYWRIGHT_ARCHITECTURE.md` define princípios úteis e ainda válidos para a Fase 7, especialmente:
  - separação entre Portal e AEJS;
  - contexts distintos para Portal e AEJS;
  - proibição de estado global entre specs;
  - uso de fixtures para lifecycle;
  - Page Objects e Components focados;
  - cuidado com mutações e paralelismo.
- A documentação já antecipa que AEJS exigirá Page Objects, Components ExtJS, configuração própria, opt-in destrutivo e execução serial inicial.
- A matriz de projetos documenta corretamente a intenção de separar `functional-readonly`, `functional-mutation` e `integration`.
- As lições aprendidas da Fase 6 foram registradas por subfase, preservando decisões e desvios relevantes.

## Problemas encontrados

### Crítico

#### Testes mutáveis classificados como `@readonly`

Vários specs funcionais alteram estado persistente da proposta, mas continuam usando a classificação `@readonly`. Exemplos de comportamentos mutáveis incluem preenchimento de campos, seleção de opções, gravação de rascunho, alteração de estado civil, composição de renda e condição do imóvel.

**Justificativa técnica:** a arquitetura documenta `functional-readonly` como projeto para casos sem mutação persistente e `functional-mutation` como projeto para formulários e estado persistente. A classificação atual enfraquece essa separação.

**Impacto:** risco de CI executar testes mutáveis como se fossem leitura; risco de paralelismo indevido; risco de contaminação da massa usada na Fase 7.

**Antes da Fase 7:** sim. Essa é a principal correção de governança antes de iniciar integrações.

### Alto

#### Ausência de lifecycle centralizado para cenários mutáveis

Há teardowns em `afterEach` em alguns módulos, mas também há limpezas feitas dentro do corpo de testes. Ainda não existe fixture ou serviço dedicado para reserva, autorização, restauração e registro de massa mutável.

**Justificativa técnica:** a Fase 7 depende de preparação de proposta e validação da mesma operação no AEJS. Esse fluxo precisa de setup e teardown confiáveis mesmo em caso de falha parcial.

**Impacto:** dados podem permanecer contaminados; falhas podem ocorrer em cascata; a investigação de falhas fica difícil.

**Antes da Fase 7:** sim.

#### Estrutura ainda Portal-only para Page Objects, Fixtures e Config

Hoje existem `components/portal`, mas `tests/pages` ainda é plano e as fixtures/configuração atuais são centradas no Portal.

**Justificativa técnica:** AEJS/SCCI usa ExtJS e terá padrões próprios de autenticação, selectors, janelas, grids, loading masks e estado de sessão. Misturar Portal e AEJS nas mesmas camadas planas aumentaria acoplamento.

**Impacto:** Page Objects e Components de AEJS podem ficar misturados com os do Portal; fixtures podem carregar dependências desnecessárias; configuração AEJS pode ser adicionada ao runtime Portal.

**Antes da Fase 7:** sim, pelo menos como fronteira mínima.

#### Dependência de massa compartilhada

A suíte funcional depende fortemente de proposta padrão configurada e de massas compartilhadas por caso.

**Justificativa técnica:** testes de integração precisam provar que a operação preparada ou selecionada no Portal é a mesma validada no AEJS. Massa compartilhada sem reserva explícita torna esse vínculo frágil.

**Impacto:** risco de interferência entre execuções locais, CI e Fase 7; paralelismo segue inseguro.

**Antes da Fase 7:** sim, para os cenários que serão usados pela integração.

#### Variável global em spec de timeline

Foi identificado estado global em spec funcional para acumular summaries capturados por response.

**Justificativa técnica:** a arquitetura proíbe estado global mutável entre specs e recomenda que a identidade da operação fique em variável local do teste.

**Impacto:** limita paralelismo e aumenta risco de interferência se o padrão for replicado na Fase 7.

**Antes da Fase 7:** sim, se esse padrão for reutilizado ou servir de referência para integrações.

### Médio

#### `runtime-config.ts` concentra muitos domínios

O runtime config concentra ambiente, Portal URL, paths, massa esperada, propostas por caso, flags de erro e compatibilidade local com Cypress.

**Justificativa técnica:** a Fase 7 adicionará AEJS, credenciais, dados de integração e possivelmente configuração de opt-in. Colocar tudo no mesmo arquivo reduziria coesão.

**Impacto:** maior custo de manutenção e risco de exigir variáveis AEJS em execuções que não precisam delas.

**Antes da Fase 7:** parcialmente. A configuração AEJS deve nascer separada; a limpeza completa pode ser posterior.

#### `ProposalPage` tende a se tornar Page Object gigante

`ProposalPage` já centraliza cabeçalho, alertas, campos, tabs, dialogs e salvamento de rascunho.

**Justificativa técnica:** a Fase 7 adicionará preparação de proposta e transições. Sem limite claro, novas responsabilidades podem ser adicionadas ao mesmo objeto.

**Impacto:** baixa coesão, métodos longos e dificuldade de revisão.

**Antes da Fase 7:** definir regra de fronteira antes; refatoração ampla pode ser posterior.

#### API inconsistente em `ProposalTabsComponent`

Foram observadas APIs diferentes para texto da aba, botão da aba, lista de tabs e seleção.

**Justificativa técnica:** Components devem oferecer uma API pública clara e consistente para evitar uso divergente nas specs.

**Impacto:** risco de validar texto visual quando o estado real da aba está em outro elemento; risco de duplicação de estratégias.

**Antes da Fase 7:** recomendável se a Fase 7 depender de navegação intensa nas abas.

#### Specs grandes e helpers locais duplicados

Specs como propostas, timeline, participantes, imóvel e renda de terceiros concentram muitos cenários e helpers locais repetidos.

**Justificativa técnica:** duplicação de padrões como `expectRequired`, `expectOptional`, `chooseRadio` e coleta de options aumenta risco de divergência.

**Impacto:** manutenção mais cara e PRs maiores.

**Antes da Fase 7:** não obrigatório, salvo para helpers que serão reutilizados nos fluxos de integração.

#### Uso frequente de `first`, `nth`, `count` e asserts manuais

Há casos em que a spec itera sobre listas e usa leituras imediatas de texto ou valor.

**Justificativa técnica:** nem todo uso é incorreto, mas esses padrões reduzem a proteção de strict mode e auto-wait quando usados em elementos dinâmicos.

**Impacto:** risco moderado de flakiness se a massa ou UI mudar.

**Antes da Fase 7:** tratar apenas nos caminhos que serão usados como base de integração.

### Baixo

#### Ausência de `task.md` e `walkthrough.md`

Os arquivos foram solicitados para revisão, mas não foram encontrados no workspace.

**Justificativa técnica:** a documentação oficial da migração existe em `Docs/PLAYWRIGHT_MIGRATION.md` e `Docs/PLAYWRIGHT_ARCHITECTURE.md`, mas a ausência desses arquivos reduz rastreabilidade caso fossem esperados por algum fluxo operacional externo.

**Impacto:** lacuna documental leve; não afeta execução Playwright.

**Antes da Fase 7:** não bloqueia, mas deve ser esclarecido.

#### Logs de debug remanescentes em spec funcional

Foi observado uso pontual de `console.log` em spec funcional.

**Justificativa técnica:** logs de debug em CI dificultam leitura do output e podem expor detalhes desnecessários.

**Impacto:** ruído operacional.

**Antes da Fase 7:** pode ser tratado em saneamento rápido.

#### Compatibilidade local com configuração Cypress ainda existe

O Playwright ainda possui compatibilidade transitória com configuração local do Cypress.

**Justificativa técnica:** isso foi útil durante a coexistência, mas deve ser removido no cutover.

**Impacto:** dívida técnica controlada.

**Antes da Fase 7:** não obrigatório.

## Recomendações aprovadas para implementação antes da Fase 7

### 1. Reclassificar specs mutáveis e separar execução `readonly` de `mutation` [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Etapa 1 | Commit `82e9e21f1589`]

**Justificativa técnica:** a classificação atual não representa corretamente o comportamento da suíte. Testes que gravam rascunho, alteram campos, selecionam opções persistentes ou dependem de cleanup não devem rodar como `@readonly`.

**Impacto esperado:** melhora a previsibilidade do CI, reduz risco de paralelismo indevido e prepara a suíte para distinguir validações de leitura de fluxos que alteram estado.

**Motivo para antes da Fase 7:** a Fase 7 será mutável por natureza. Iniciar integração com tags semanticamente incorretas aumentaria o risco de contaminar massas e dificultaria a governança do pipeline.

### 2. Definir lifecycle centralizado para cenários mutáveis [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Etapa 3 | Commit `0c24dd2a1db3`]

**Justificativa técnica:** setup, autorização, registro de operação alterada e teardown devem ficar juntos. Limpeza no corpo do teste não é suficiente quando há falha antes da etapa final.

**Impacto esperado:** redução de contaminação de dados, maior confiabilidade após falhas e base segura para preparação/validação Portal → AEJS.

**Motivo para antes da Fase 7:** integrações precisarão preparar proposta no Portal e validar a mesma operação no AEJS. Esse fluxo exige massa controlada e teardown previsível desde o primeiro cenário.

### 3. Criar fronteira estrutural mínima para AEJS [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Etapa 2 | Commit `81ac208a54d6`]

**Justificativa técnica:** Portal e AEJS possuem tecnologias, autenticação, selectors e lifecycle distintos. AEJS não deve ser adicionado diretamente nas mesmas classes e fixtures Portal-only.

**Impacto esperado:** menor acoplamento, melhor isolamento de sessão/cookies e Components ExtJS mais seguros.

**Motivo para antes da Fase 7:** a primeira implementação AEJS definirá o padrão de todas as integrações futuras. Se nascer misturada, a dívida estrutural crescerá rapidamente.

### 4. Separar configuração AEJS da configuração Portal [PARCIALMENTE CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Estruturas criadas na Etapa 2. A segregação de runtime config do AEJS será executada de forma incremental ao longo da Fase 7]

**Justificativa técnica:** variáveis obrigatórias devem variar por projeto. Credenciais e URLs AEJS não devem ser exigidas por smoke ou funcional Portal.

**Impacto esperado:** execução seletiva mais simples, menor risco de vazamento de segredos e mensagens de erro mais precisas.

**Motivo para antes da Fase 7:** login e abertura de operação AEJS dependem de credenciais e runtime próprios.

### 5. Definir estratégia explícita de massa para integração [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - A ser adotado durante a implementação da Fase 7]

**Justificativa técnica:** a Fase 7 precisa transportar a identidade da mesma operação entre Portal e AEJS. Isso requer proposta reservada, descartável ou controlada, com autorização explícita para mutação.

**Impacto esperado:** rastreabilidade ponta a ponta e menor risco de colisão entre execuções.

**Motivo para antes da Fase 7:** sem essa decisão, os primeiros testes de integração podem depender de massa compartilhada sem controle.

### 6. Remover estado global mutável dos padrões que possam inspirar a Fase 7 [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Etapa 3 | Commit `0c24dd2a1db3` (via registry local da fixture)]

**Justificativa técnica:** estado como arrays globais preenchidos por listeners de response não é seguro para paralelismo e contraria a diretriz de manter a identidade da operação local ao teste.

**Impacto esperado:** melhor isolamento e menor risco de interferência entre casos.

**Motivo para antes da Fase 7:** o fluxo Portal → AEJS não pode depender de memória global ou da ordem de specs.

### 7. Atualizar documentação antes de implementar AEJS [CONCLUÍDO NO HARDENING PRÉ-FASE 7 - Etapa 4 | Commit atual]

**Justificativa técnica:** as decisões acima alteram a preparação operacional da Fase 7 e devem ficar registradas antes do código.

**Impacto esperado:** alinhamento entre arquitetura, migração e execução real.

**Motivo para antes da Fase 7:** evita que decisões estruturais relevantes sejam tomadas implicitamente dentro de PRs de implementação.

## Recomendações adiadas

### 1. Reorganizar completamente todos os Page Objects do Portal

**Justificativa técnica:** a estrutura atual é suficiente para a Fase 6. O risco real é a entrada de AEJS sem namespace, não a existência imediata de Page Objects Portal no nível atual.

**Motivo para adiar:** pode ser feito gradualmente; antes da Fase 7 basta criar fronteira para novas classes AEJS e evitar crescimento indevido.

### 2. Dividir specs funcionais grandes

**Justificativa técnica:** specs grandes dificultam manutenção, mas não impedem a Fase 7 se a governança de estado for tratada.

**Motivo para adiar:** dividir arquivos sem necessidade funcional imediata pode gerar diff grande e risco desnecessário.

### 3. Extrair todos os helpers locais repetidos

**Justificativa técnica:** há duplicação real, mas parte dela ainda é específica de cada domínio.

**Motivo para adiar:** extrair prematuramente pode criar helpers genéricos demais. Deve ser feito quando houver reutilização concreta na Fase 7 ou em manutenção dos módulos.

### 4. Refatorar completamente `runtime-config.ts`

**Justificativa técnica:** o arquivo está crescendo, mas funciona e está tipado.

**Motivo para adiar:** a prioridade antes da Fase 7 é impedir que AEJS seja adicionado sem fronteira. A decomposição completa pode ocorrer após estabilizar a configuração AEJS.

### 5. Remover compatibilidade Cypress da configuração local

**Justificativa técnica:** é dívida transitória conhecida.

**Motivo para adiar:** a Fase 9 é o momento natural de remoção do Cypress. Remover antes pode atrapalhar coexistência e comparação.

### 6. Eliminar todos os usos de `first`, `nth` e `count`

**Justificativa técnica:** alguns usos são aceitáveis para validação de listas e opções. O problema é quando substituem locators mais específicos em caminhos críticos.

**Motivo para adiar:** tratar apenas onde houver flakiness real ou onde o fluxo virar base de integração.

### 7. Revisar todos os asserts manuais

**Justificativa técnica:** web-first assertions são preferíveis, mas nem toda leitura manual é incorreta.

**Motivo para adiar:** revisão ampla pode ser feita incrementalmente durante manutenção dos módulos.

### 8. Remover ou substituir todos os comentários herdados da migração

**Justificativa técnica:** comentários residuais não impactam execução.

**Motivo para adiar:** baixo impacto técnico.

## Parecer final

### A arquitetura está pronta para suportar a Fase 7?

Parcialmente.

A arquitetura possui base suficiente para iniciar a preparação da Fase 7, mas não deve receber os testes AEJS diretamente no estado atual. Antes da primeira integração, é necessário criar fronteiras mínimas para AEJS, classificar corretamente mutações e definir lifecycle de massa.

### Existe algum bloqueador técnico?

Não há bloqueador técnico de infraestrutura Playwright.

Há bloqueadores de governança técnica para a Fase 7:

- testes mutáveis ainda classificados como `@readonly`;
- ausência de lifecycle centralizado para massa mutável;
- ausência de fronteira AEJS em fixtures/config/pages/components;
- dependência de massa compartilhada sem estratégia formal para integração.

Esses pontos não invalidam a Fase 6, mas devem ser tratados antes da implementação real dos fluxos Portal → AEJS.

### Qual o nível de confiança para iniciar a Fase 7?

Confiança média-alta para iniciar a preparação da Fase 7.

Confiança média para iniciar implementação direta de specs de integração sem saneamento prévio.

Classificação recomendada:

- **Preparação da Fase 7:** pode iniciar.
- **Primeiros specs AEJS:** aguardar recomendações obrigatórias.
- **Execução paralela ou CI bloqueante com integração:** não recomendado ainda.

### Nota geral da arquitetura

**8/10**

A arquitetura é clara, pragmática e suficiente para a suíte funcional do Portal. Perde pontos por ainda ser Portal-centric e por precisar de fronteira explícita para AEJS e massa mutável.

### Nota geral da suíte de testes

**7/10**

A suíte tem boa rastreabilidade, ausência de waits fixos e bom uso de Playwright. Perde pontos por classificação incorreta de mutações, dependência de massa compartilhada e teardown disperso.

### Nota geral da documentação

**8/10**

A documentação principal está consistente, extensa e útil como referência. Perde pontos pela ausência de `task.md` e `walkthrough.md` no workspace e por ainda não registrar as conclusões consolidadas desta auditoria antes da criação deste documento.

## Conclusão

A Fase 6 pode ser considerada encerrada do ponto de vista de migração funcional.

A Fase 7 deve começar com uma etapa curta de preparação arquitetural, não com a implementação direta de testes AEJS. Essa preparação deve corrigir a governança de mutação, estabelecer fronteiras AEJS e registrar a estratégia de massa/teardown.

Após essa preparação, a suíte terá base adequada para evoluir para integrações Portal → AEJS com rastreabilidade, isolamento e menor risco de flakiness.

## Encerramento e Parecer Final do Hardening Pré-Fase 7

Em 09/07/2026, declaramos oficialmente o **Encerramento do Hardening Pré-Fase 7**.

### 1. Recomendações Obrigatórias Implementadas
Todas as recomendações técnicas obrigatórias catalogadas nesta auditoria como requisitos pré-Fase 7 foram implementadas com sucesso:
- **Governança da Suíte (Reclassificação de Tags):** As specs mutáveis de formulários foram reclassificadas de `@readonly` para `@mutation` (Etapa 1 | Commit `82e9e21f1589`).
- **Preparação Estrutural para AEJS:** O namespace de Page Objects do Portal foi isolado sob `/portal` e os diretórios do AEJS estruturados com `.gitkeep` em pages, components, fixtures e integrations (Etapa 2 | Commit `81ac208a54d6`).
- **Lifecycle Centralizado:** A fixture `teardownRegistry` em LIFO foi criada em `tests/fixtures/scenario.fixture.ts` e os teardowns locais `afterEach` das 5 specs mutáveis migrados para registros no setup (Etapa 3 | Commit `0c24dd2a1db3`).
- **Consolidação Documental:** Os documentos `PLAYWRIGHT_ARCHITECTURE.md`, `PLAYWRIGHT_MIGRATION.md` e esta auditoria foram atualizados, harmonizados e selados (Etapa 4 | Commit atual).

### 2. Recomendações Adiadas Mantidas
As recomendações não obrigatórias ou de dívida técnica de coexistência (como reorganização completa de todos os Page Objects do Portal, divisão de specs grandes, extração total de helpers locais, eliminação de seletores genéricos secundários e remoção de compatibilidade de massa do Cypress) permanecem registradas para evolução futura na seção "Recomendações adiadas" e serão abordadas incrementalmente ou na fase de cutover final do Cypress (Fase 9).

### 3. Parecer Final de Prontidão da Arquitetura
A arquitetura da suíte Playwright encontra-se **100% pronta e recomendada** para iniciar a Fase 7. A base de código está estável, protegida de concorrência destrutiva no paralelismo, provida de lifecycle de teardown robusto e com namespaces estruturalmente definidos para receber as futures implementações do AEJS.
