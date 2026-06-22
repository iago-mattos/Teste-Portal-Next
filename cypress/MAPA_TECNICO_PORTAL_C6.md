# Mapa técnico Cypress - Portal C6

> Fonte operacional para implementar e manter os testes end-to-end descritos em `Docs/TestesPortalC6(1).xlsx`.
> Escopo iniciado em **2 - Minhas propostas** e encerrado em **13 - Detalhamento**. Login e Integrações ficam fora deste documento.

## Objetivo

Este arquivo não é uma avaliação de OK/NOK. Ele traduz cada regra da cliente para um contrato de automação: onde chegar, qual massa usar, o que selecionar, qual ação executar e qual resultado afirmar. Ao implementar um caso, o spec deve preservar o mesmo ID usado aqui.

## Referência observada

- Ambiente: `portal-desenv.prognum.com.br`, acessado pelo link tokenizado mantido apenas em `cypress/config/connect.ts`.
- Massa observada sem alteração destrutiva: proposta `72`, CPF mascarado terminado em `12`, fase `Cadastro`, em 11/06/2026.
- Rota da listagem: `/propostas`.
- Rota interna: `/propostas/:id`.
- A proposta 72 serve para leitura e validações leves. Casos de conclusão, expiração, cancelamento, mudança de fase e integração exigem massas próprias.

## Regras de implementação

1. Use `cy.portalSession()` para autenticar pelo token e manter a sessão entre specs.
2. Localize uma proposta pelo conteúdo do card, nunca por índice: `cy.contains("article", "Proposta #72")`.
3. Abra seções por papel e nome: `cy.contains('[role="tab"]', 'Imóvel').click()`.
4. Para campos simples, prefira o atributo `name`, que é o contrato mais estável do formulário.
5. Existem nomes repetidos entre titular, terceiro, garantidor e sócios. Nesses casos, limite primeiro ao grupo visível e só depois use `[name="..."]`.
6. Não use classes CSS geradas, posição no DOM, `nth-child` ou textos de valor que mudam com a massa.
7. Testes que salvam devem usar proposta descartável ou restaurável. Testes que finalizam etapa nunca devem usar `propostaPadraoId`.
8. Instale `cy.clock()` antes de carregar a página quando o caso depender da data calculada no navegador.
9. Para listas sincronizadas com a Prognum, compare com fixture versionada e registre a data de extração da fixture.
10. Não leia estado de caso por `Cypress.env()`. O projeto está com `allowCypressEnv: false`; use imports, aliases ou `cy.env()` quando realmente necessário.

## Helpers recomendados

```ts
const proposalCard = (number: string) =>
  cy.contains('article', `Proposta #${number}`);

const openSection = (name: string) =>
  cy.contains('[role="tab"]', name).click();

const visibleField = (name: string) =>
  cy.get(`[name="${CSS.escape(name)}"]`).filter(':visible');

const withinVisibleGroup = (title: string, callback: () => void) =>
  cy.contains('fieldset, section, [role="group"]', title)
    .filter(':visible')
    .within(callback);
```

O helper `withinVisibleGroup` é um modelo. Antes de adicioná-lo ao suporte, confirme o elemento contêiner real de cada seção. O ponto obrigatório é não selecionar globalmente nomes como `PESSOA.NO_PESSOA`, pois eles podem existir para mais de um participante.

## Massas necessárias em `connect.ts`

| Chave | Uso |
|---|---|
| `propostaPadraoId` | leitura geral e alterações leves |
| `propostaExpiradaId` | expiração e bloqueio de edição |
| `propostaCanceladaId` | reflexo de cancelamento |
| `propostaCancelada30Id` | cancelada há até 30 dias |
| `propostaCanceladaAntigaId` | cancelada há mais de 30 dias |
| `propostaNegadaId` | negativa da mesa de crédito |
| `propostaAnaliseCreditoId` | fase de análise de crédito |
| `propostaCadastroCompletoId` | detalhamento e pós-cadastro |
| `propostaComConjugeId` | dados e renda do cônjuge |
| `propostaComTerceiroId` | composição com outra pessoa |
| `propostaGarantidorPfId` | imóvel em nome de terceiro |
| `propostaGarantidorPjId` | imóvel em nome de empresa |
| `propostaOrigemWebId` / `AppId` / `ApiId` | comportamento por origem do lead |

As chaves acima são o contrato desejado do mapa. As que ainda não existem em `connect.example.ts` devem ser adicionadas quando o primeiro teste dependente for implementado.

## Mapa de telas

| Tela | Rota | Âncoras estáveis |
|---|---|---|
| Minhas propostas | `/propostas` | `h1` com "Minhas propostas"; cards `article`; número, fase e ações por texto |
| Cadastro da proposta | `/propostas/:id` | cabeçalho "Proposta #"; `nav[aria-label="Fases da proposta"]`; abas `[role="tab"]` |
| Alertas | `/propostas/:id` | `[role="alert"]`, `[role="status"]`, botão com `aria-label="Fechar aviso"` |
| Formulário guiado | `/propostas/:id` | campos por `name`; aba/painel visível; botão "Salvar e Continuar" ou "Confirmar e avançar cadastro" |

## Casos por arquivo

### 2 - Minhas propostas

- **Spec:** `cypress/e2e/cliente/02-minhas-propostas.cy.ts`
- **Rota:** `/propostas`
- **Entrada padrão:** `cy.portalSession()`; permanecer na listagem.
- **Escopo de seleção:** `cy.contains("article", "Proposta #<numero>")`
- **Massa-base:** `propostaPadraoId` e `expectedProposal`

#### PROP-01

- **Regra da cliente:** Deverá vir do lead as informações: Nº da proposta, Data de cadastro, Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** card da proposta; textos "Data de cadastro", "Endereço do imóvel", "Valor do imóvel", "Valor do empréstimo" e prazo.
- **Ação Cypress:** abrir a listagem e localizar o card pelo número esperado.
- **Asserção:** comparar todos os valores com `expectedProposal`; a ausência do endereço deve falhar explicitamente.
- **Impacto:** Leitura.
- **Nota/pendência:** Na proposta 72, o endereço não apareceu no card.

#### PROP-02

- **Regra da cliente:** As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado não sofrem alteração em fase de perfilamento pelo cliente por isso ficam sempre iguais. Caso haja alteração na plataforma da prognum nesse momento aí sim reflete no portal.
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** campos de origem do card.
- **Ação Cypress:** abrir o perfilamento e localizar endereço do imóvel, valor do imóvel, valor do empréstimo e prazo solicitado.
- **Asserção:** os quatro campos estão desabilitados para o cliente.
- **Impacto:** Leitura.
- **Nota/pendência:** As propostas fornecidas para a automação são massas fakes e descartáveis do ambiente de desenvolvimento. A proposta padrão pode ser usada neste caso.

#### PROP-03

- **Regra da cliente:** As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado quando alteradas em outras fases na plataforma prognum, refletirão no portal
- **Massa/pré-condição:** massa preparada no backend.
- **Alvo técnico:** mesmos campos do card.
- **Ação Cypress:** alterar os dados na plataforma Prognum ou fixture controlada; recarregar o portal.
- **Asserção:** o portal apresenta os novos valores sem cache antigo.
- **Impacto:** Backend/massa.

#### PROP-04

- **Regra da cliente:** Deverá aparecer em “Etapa” o De/Para do status da fase parametrizado pelo C6 na “Nome da fase na WEB” na tabela de fases de operação
- **Massa/pré-condição:** proposta com fase WEB controlada.
- **Alvo técnico:** rótulo "Fase Atual" e valor de fase no card.
- **Ação Cypress:** abrir proposta com fase WEB conhecida.
- **Asserção:** o texto exibido corresponde ao de/para parametrizado na Prognum.
- **Impacto:** Leitura.

#### PROP-05

- **Regra da cliente:** O preenchimento será dividido em duas tarefas “Preenchimento Cadastral” e “Preenchimento de Documentos”, onde a fase de preenchimento de documentos depende do término de preenchimento de cadastro
- **Massa/pré-condição:** duas propostas em estados consecutivos.
- **Alvo técnico:** ações/tarefas do card.
- **Ação Cypress:** comparar proposta cadastral incompleta e proposta cadastral concluída.
- **Asserção:** documentos só ficam disponíveis depois da conclusão do cadastro.
- **Impacto:** Backend/massa.

#### PROP-06

- **Regra da cliente:** Tanto a tarefa de Preenchimento cadastral quando a de preenchimento terão prazos parametrizáveis pelo C6
- **Massa/pré-condição:** massa com prazos parametrizados.
- **Alvo técnico:** datas-limite das tarefas cadastral e documental.
- **Ação Cypress:** abrir massas com parâmetros de prazo diferentes.
- **Asserção:** cada tarefa usa o prazo configurado pelo C6.
- **Impacto:** Backend/massa.

#### PROP-07

- **Regra da cliente:** Deverá aparecer em “Etapa” “proposta expirada” de forma automática quando atingir parametrizado em uma das tarefas sem atuação do cliente.
- **Massa/pré-condição:** `propostaExpiradaId`.
- **Alvo técnico:** fase/estado "Proposta expirada".
- **Ação Cypress:** abrir `propostaExpiradaId` após o vencimento sem atuação do cliente.
- **Asserção:** o card indica expiração automaticamente.
- **Impacto:** Leitura.

#### PROP-08

- **Regra da cliente:** Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas negadas pela mesa de crédito
- **Massa/pré-condição:** `propostaNegadaId`.
- **Alvo técnico:** mensagem "Verifique seu e-mail ou entre em contato com o consultor".
- **Ação Cypress:** abrir proposta negada pela mesa de crédito.
- **Asserção:** a mensagem aparece e a ação cadastral não fica disponível.
- **Impacto:** Leitura.

#### PROP-09

- **Regra da cliente:** Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas com status a partir da Análise de Crédito.
- **Massa/pré-condição:** `propostaAnaliseCreditoId` e proposta posterior.
- **Alvo técnico:** mesma mensagem de orientação.
- **Ação Cypress:** abrir propostas em Análise de Crédito e em uma fase posterior.
- **Asserção:** a orientação aparece em ambas.
- **Impacto:** Leitura.

#### PROP-10

- **Regra da cliente:** Simulações canceladas acimas de 30 dias não veremos no resumo
- **Massa/pré-condição:** `propostaCanceladaAntigaId`.
- **Alvo técnico:** lista de cards.
- **Ação Cypress:** entrar com CPF que possua cancelamento há mais de 30 dias.
- **Asserção:** a proposta cancelada antiga não é exibida.
- **Impacto:** Leitura.

#### PROP-11

- **Regra da cliente:** Simulações canceladas até e igual 30 dias deverão constar em tela
- **Massa/pré-condição:** `propostaCancelada30Id`.
- **Alvo técnico:** lista de cards.
- **Ação Cypress:** entrar com CPF que possua cancelamento em até 30 dias.
- **Asserção:** a proposta cancelada recente permanece visível.
- **Impacto:** Leitura.

#### PROP-12

- **Regra da cliente:** Simulações canceladas na Prognum, também precisam estar canceladas no portal, tem que refletir exatamente o que está na Prognum em relação a proposta
- **Massa/pré-condição:** `propostaCanceladaId`.
- **Alvo técnico:** status/fase do card.
- **Ação Cypress:** cancelar a proposta na Prognum ou preparar massa cancelada; recarregar.
- **Asserção:** o portal reflete o cancelamento e não permite continuar a jornada ativa.
- **Impacto:** Backend/massa.

#### PROP-13

- **Regra da cliente:** Prazo remanescente deverá ser atualizado conforme os dias passarem até restar 0 dias
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** data de vencimento e texto "dias restantes".
- **Ação Cypress:** congelar o relógio com `cy.clock()` em datas sucessivas antes do vencimento.
- **Asserção:** o saldo diminui até zero e nunca fica negativo.
- **Impacto:** Leitura.
- **Nota/pendência:** Para validar cálculo do frontend, carregar a página após instalar o relógio.

#### PROP-14

- **Regra da cliente:** Prazo deverá correr contabilizando dias úteis.
- **Massa/pré-condição:** proposta com vencimento conhecido.
- **Alvo técnico:** saldo de dias.
- **Ação Cypress:** testar intervalo contendo sábado, domingo e feriado definido pela regra.
- **Asserção:** somente dias úteis são contabilizados.
- **Impacto:** Leitura.
- **Nota/pendência:** Hoje o código observado calcula dias corridos; este teste deve revelar a divergência.

#### PROP-15

- **Regra da cliente:** Data fim de preenchimento deverá se mater a mesma desde o início
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** data fim de preenchimento.
- **Ação Cypress:** capturar a data; avançar um dia ou alterar dados; recarregar.
- **Asserção:** a data fim original não é recalculada.
- **Impacto:** Altera rascunho.

#### PROP-16

- **Regra da cliente:** O botão refazer simulação deverá ser chamado “Fazer simulação com outro imóvel” e direcionar para página https://c6imobiliario.com.br
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** link/botão "Fazer simulação com outro imóvel".
- **Ação Cypress:** remover temporariamente `target` ou inspecionar `href` sem navegar.
- **Asserção:** `href` aponta para `externalSimulationUrl` e o texto está correto.
- **Impacto:** Leitura.

#### PROP-17

- **Regra da cliente:** Propostas que tiveram o cadastro finalizado irão para crédito e exibir um modal que ele concluiu a etapa e irá aguardar contato por e-mail ou whatsapp.
- **Massa/pré-condição:** proposta descartável pronta para conclusão.
- **Alvo técnico:** modal de conclusão e fase do card.
- **Ação Cypress:** finalizar o cadastro em massa descartável.
- **Asserção:** modal confirma conclusão e informa aguardo por e-mail ou WhatsApp; fase segue para Crédito.
- **Impacto:** Finaliza etapa.

#### PROP-18

- **Regra da cliente:** Na proposta em tela, quando o cliente tiver mais eu duas propostas ao passar o mouse o cliente será direcionado para jornada solicitada no momento (ex: completar dados cadatrais, anexar documentos, pendencias...) para proposta desejada
- **Massa/pré-condição:** CPF com pelo menos duas propostas em jornadas diferentes.
- **Alvo técnico:** dois ou mais cards e suas ações.
- **Ação Cypress:** acionar o card específico pelo número, sem depender da posição.
- **Asserção:** cada card abre a jornada correspondente à própria pendência.
- **Impacto:** Leitura.
- **Nota/pendência:** A expressão da planilha "mais eu duas" foi interpretada como duas ou mais propostas.

#### PROP-19

- **Regra da cliente:** Data de vencimento, fica na proposta, sem necessidade de mensagem informativa em tela nesse momento, para não distrair o cliente.
- **Massa/pré-condição:** `propostaPadraoId` e `expectedProposal`.
- **Alvo técnico:** data de vencimento dentro do card e modais/alertas da listagem.
- **Ação Cypress:** abrir a listagem.
- **Asserção:** a data aparece no card e não existe modal informativo adicional.
- **Impacto:** Leitura.

### 3 - Linha do tempo e alertas

- **Spec:** `cypress/e2e/cliente/03-linha-do-tempo-alertas.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`.
- **Escopo de seleção:** `nav[aria-label="Fases da proposta"]`, `[role="alert"]` e `[role="status"]`
- **Massa-base:** `propostaPadraoId`

#### TIMELINE-01

- **Regra da cliente:** Deverá conter cabeçalho com nome do proponente e CPF do proponente
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** cabeçalho da proposta.
- **Ação Cypress:** abrir a proposta padrão.
- **Asserção:** nome do proponente e CPF mascarado estão visíveis.
- **Impacto:** Leitura.

#### TIMELINE-02

- **Regra da cliente:** Retirar a indicação de CNPJ, mantendo apenas CPF
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** rótulos do cabeçalho.
- **Ação Cypress:** abrir proposta PF.
- **Asserção:** existe "CPF" e não existe indicação "CNPJ".
- **Impacto:** Leitura.

#### TIMELINE-03

- **Regra da cliente:** Linha do tempo deverá ser composta por: Simulação, Cadastro, Crédito, Negociação, Análise de Documentos, Análise Técnica, Formalização e Liberação.
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `nav[aria-label="Fases da proposta"]`.
- **Ação Cypress:** ler os itens na ordem do DOM.
- **Asserção:** a ordem é Simulação, Cadastro, Crédito, Negociação, Análise de Documentos, Análise Técnica, Formalização e Liberação.
- **Impacto:** Leitura.

#### TIMELINE-04

- **Regra da cliente:** O cliente poderá chegar nessa tela através de todas as jornadas na tela anterior
- **Massa/pré-condição:** proposta com mais de uma ação disponível.
- **Alvo técnico:** rota interna da proposta.
- **Ação Cypress:** abrir a mesma proposta a partir de cada ação disponível no card.
- **Asserção:** todas as jornadas chegam ao mesmo contexto e número de proposta.
- **Impacto:** Leitura.

#### TIMELINE-05

- **Regra da cliente:** A linha do tempo do portal se comunicará com a linha do tempo existente na prognum
- **Massa/pré-condição:** massa com fase alterável.
- **Alvo técnico:** etapa ativa do stepper.
- **Ação Cypress:** alterar a fase na Prognum; recarregar o portal.
- **Asserção:** a etapa ativa reflete a fase de origem.
- **Impacto:** Backend/massa.

#### TIMELINE-06

- **Regra da cliente:** Se proposta expirada tela disponível para visualização, mas edição inabilitada
- **Massa/pré-condição:** `propostaExpiradaId`.
- **Alvo técnico:** campos, abas e botões de gravação.
- **Ação Cypress:** abrir `propostaExpiradaId`.
- **Asserção:** conteúdo continua visível, mas inputs e ações de edição estão desabilitados.
- **Impacto:** Leitura.

#### TIMELINE-07

- **Regra da cliente:** Trazer mensagem informativa da data fim para preenchimento do cadastro
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** alerta de prazo.
- **Ação Cypress:** abrir proposta em cadastro.
- **Asserção:** mensagem informa a data final exata.
- **Impacto:** Leitura.

#### TIMELINE-08

- **Regra da cliente:** Exibir mensagem indicando obrigatoriedade de preenchimento
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** alerta de obrigatoriedade.
- **Ação Cypress:** abrir proposta com cadastro pendente.
- **Asserção:** mensagem informa que o preenchimento é obrigatório.
- **Impacto:** Leitura.

#### TIMELINE-09

- **Regra da cliente:** Caso o cliente feche a mensagem de cadastro obrigatório não precisa apresentar novamente.
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** botão `[aria-label="Fechar aviso"]` e alerta obrigatório.
- **Ação Cypress:** fechar o aviso; recarregar e reabrir a proposta.
- **Asserção:** o aviso fechado não volta para a mesma proposta/usuário.
- **Impacto:** Estado local.

#### TIMELINE-10

- **Regra da cliente:** Quando mais de uma proposta em andamento, a data limite de cada proposta deverá ser mostrada ao cliente
- **Massa/pré-condição:** CPF com duas propostas e prazos distintos.
- **Alvo técnico:** datas-limite de propostas diferentes.
- **Ação Cypress:** abrir cada proposta a partir de um CPF com múltiplas propostas.
- **Asserção:** cada jornada mostra sua própria data, sem reaproveitar a data da proposta anterior.
- **Impacto:** Leitura.

#### TIMELINE-11

- **Regra da cliente:** Manter habilitado botão “Ver detalhes da operação” e mostrar evolução do preenchimento
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** botão "Ver Detalhes da Operação" e indicador de progresso.
- **Ação Cypress:** abrir cadastro parcial.
- **Asserção:** botão permanece habilitado e a evolução do preenchimento é apresentada.
- **Impacto:** Leitura.
- **Nota/pendência:** A versão anterior da análise tratou este item como ocultação; a regra atual da planilha pede manter habilitado.

#### TIMELINE-12

- **Regra da cliente:** Retirar botão “Ver documentos”, pois só teremos no final após liberação cadastral.
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** botão/link "Ver documentos".
- **Ação Cypress:** abrir proposta ainda em cadastro.
- **Asserção:** o botão não existe antes da liberação cadastral.
- **Impacto:** Leitura.

### 4 - Cadastro da operação: participantes

- **Spec:** `cypress/e2e/cliente/04-cadastro-participantes.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`; abrir a aba "Sobre Você".
- **Escopo de seleção:** aba `[role="tabpanel"]` visível de "Sobre Você"
- **Massa-base:** `propostaPadraoId`

#### PART-01

- **Regra da cliente:** A aba Participantes deve ser a primeira aba habilitada, junto com Composição de Renda, Motivo da Contratação e Imóvel
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** abas do cadastro.
- **Ação Cypress:** ler as abas habilitadas na ordem.
- **Asserção:** Sobre Você é a primeira; Composição de Renda, Motivo da Contratação e Imóvel também estão habilitadas.
- **Impacto:** Leitura.

#### PART-02

- **Regra da cliente:** É de preenchimento obrigatório os campos: Renda, Estado Civil, Nacionalidade, Profissão e Tipo de profissão E por isso são sinalizados com (*)
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.VA_RENDA_BRUTA`, `PESSOA.CO_ESTCIV`, `PESSOA.CO_NACIONALIDADE`, `PESSOA.CO_PROFISSAO`, `PESSOA.CO_ATIVIDADE_PROFISSIONAL`.
- **Ação Cypress:** localizar rótulos e controles na seção visível.
- **Asserção:** todos têm indicação `*` e sem preenchimento entram na crítica de obrigatórios.
- **Impacto:** Leitura.

#### PART-03

- **Regra da cliente:** O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.VA_RENDA_BRUTA`.
- **Ação Cypress:** digitar letras e símbolos; desfocar ou salvar.
- **Asserção:** o valor não numérico é rejeitado ou uma mensagem de erro é exibida.
- **Impacto:** Altera rascunho.

#### PART-04

- **Regra da cliente:** Quando leads enviados pela WEB, a renda é coletada na simulação e deve refletir no portal cadastro para o cliente validar e alterar.
- **Massa/pré-condição:** `propostaOrigemWebId`.
- **Alvo técnico:** `PESSOA.VA_RENDA_BRUTA`.
- **Ação Cypress:** abrir lead de origem WEB com renda conhecida; alterar e salvar em cópia descartável.
- **Asserção:** renda inicial corresponde ao lead e o campo permite edição.
- **Impacto:** Altera rascunho.

#### PART-05

- **Regra da cliente:** Quando lead de APP, não tem informação de renda e o cliente deve permitir alterar.Quando lead de API, não tem informação de renda e o cliente deve editar
- **Massa/pré-condição:** `propostaOrigemAppId` e `propostaOrigemApiId`.
- **Alvo técnico:** `PESSOA.VA_RENDA_BRUTA`.
- **Ação Cypress:** abrir leads APP e API sem renda.
- **Asserção:** campo inicia editável e aceita preenchimento.
- **Impacto:** Altera rascunho.

#### PART-06

- **Regra da cliente:** No campo Estado Civil, deve permitir a lista: Solteiro, Casado, Divorciado, Desquitado, Viúvo, Separação Judicial, Separação Consensual, Divorciado Consensualmente, Convivente
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.CO_ESTCIV`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** opções correspondem exatamente à lista da regra e não incluem `Outros`.
- **Impacto:** Leitura.

#### PART-07

- **Regra da cliente:** A informação de nacionalidade deve ser default brasileira, permitindo o cliente alterar
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.CO_NACIONALIDADE`.
- **Ação Cypress:** abrir proposta nova e depois escolher outra nacionalidade.
- **Asserção:** Brasileira vem selecionada por padrão e pode ser alterada.
- **Impacto:** Leitura.
- **Nota/pendência:** Na proposta 72 não havia valor padrão; o teste deve acusar essa divergência.

#### PART-08

- **Regra da cliente:** O campo profissão deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados
- **Massa/pré-condição:** fixture versionada de profissões da Prognum.
- **Alvo técnico:** `PESSOA.CO_PROFISSAO`.
- **Ação Cypress:** abrir e pesquisar a lista; comparar com fixture exportada da Prognum.
- **Asserção:** lista é equivalente e não contém as sete opções excluídas pela regra.
- **Impacto:** Leitura.

#### PART-09

- **Regra da cliente:** O campo profissão deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.CO_PROFISSAO`.
- **Ação Cypress:** focar o combo e digitar parte de uma profissão.
- **Asserção:** as opções são filtradas sem rolagem manual.
- **Impacto:** Leitura.

#### PART-10

- **Regra da cliente:** O campo tipo de profissão deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.CO_ATIVIDADE_PROFISSIONAL`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém exatamente Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural e Assalariado.
- **Impacto:** Leitura.

#### PART-11

- **Regra da cliente:** O botão voltar não existirá, o cliente irá trafegar entre as abas de preenchimento e caso queira voltar, será via “voltar do browser”
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** ações de navegação do formulário.
- **Ação Cypress:** procurar botão "Voltar"; navegar entre abas e usar `cy.go("back")` em teste isolado.
- **Asserção:** não existe botão Voltar no formulário; a navegação entre abas funciona.
- **Impacto:** Leitura.

#### PART-12

- **Regra da cliente:** A opção de salvar acontecerá de duas formas:; Clicando entre as abas de preenchimento; Clicando em salvar e continuar
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** abas, indicador `Salvando...` e botão Salvar e Continuar.
- **Ação Cypress:** alterar um campo descartável; trocar de aba; repetir usando o botão; recarregar.
- **Asserção:** as duas ações persistem o valor.
- **Impacto:** Altera rascunho.

#### PART-13

- **Regra da cliente:** Toda vez que salvar e tiver dado obrigatório não preenchido ele criticará, mas ainda assim salvará as informações
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** campo obrigatório vazio, alerta de validação e valor válido em outro campo.
- **Ação Cypress:** preencher somente um campo; salvar.
- **Asserção:** a crítica aponta o obrigatório ausente, mas o valor preenchido permanece salvo.
- **Impacto:** Altera rascunho.

### 5 - Cadastro da operação: dados do cônjuge

- **Spec:** `cypress/e2e/cliente/05-cadastro-conjuge.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`; em "Sobre Você", usar proposta com cônjuge.
- **Escopo de seleção:** grupo/fieldset visível com título ou legenda "Cônjuge"
- **Massa-base:** `propostaComConjugeId`

#### CONJ-01

- **Regra da cliente:** Se o estado civil diferente de casado ou convivente não habilita aba cônjuge, demais opções deverá habilitar o preenchimento
- **Massa/pré-condição:** proposta descartável para alternar estado civil.
- **Alvo técnico:** `PESSOA.CO_ESTCIV`, `PESSOA.IN_UNIAO_ESTAVEL` e grupo do cônjuge.
- **Ação Cypress:** testar Solteiro/Divorciado e Casado/Convivente.
- **Asserção:** grupo do cônjuge só aparece para Casado ou Convivente/união estável.
- **Impacto:** Altera rascunho.
- **Nota/pendência:** A frase da planilha é contraditória; foi adotada a regra funcional usual: Casado/Convivente habilitam.

#### CONJ-02

- **Regra da cliente:** É de preenchimento obrigatório os campos: Nome do Cônjuge, CPF, Data de Nascimento e Regime de Comunhão. E por isso são sinalizados com (*)
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.NO_PESSOA`, `CONJUGE.NU_CPFCNPJ`, `CONJUGE.DT_NASCIMENTO`, `PESSOA.CO_REGIME_CASAMENTO`.
- **Ação Cypress:** inspecionar os rótulos e tentar salvar vazios.
- **Asserção:** os quatro campos têm `*` e são criticados.
- **Impacto:** Leitura.

#### CONJ-03

- **Regra da cliente:** É de preenchimento opcional Data de Comunhão, E-mail e Telefone. Sendo sinalizados como “(opcional)”
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `PESSOA.DT_CASAMENTO`, `CONJUGE.NO_EMAIL`, `CONJUGE.NU_DDD_CEL` e `CONJUGE.NU_CELULAR`.
- **Ação Cypress:** inspecionar os rótulos e salvar sem preencher.
- **Asserção:** são marcados como opcionais e não entram na crítica.
- **Impacto:** Leitura.

#### CONJ-04

- **Regra da cliente:** O campo telefone deve possuir o DDD
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.NU_DDD_CEL` e `CONJUGE.NU_CELULAR`.
- **Ação Cypress:** inspecionar os dois controles.
- **Asserção:** DDD possui campo próprio e ambos são associados ao telefone.
- **Impacto:** Leitura.

#### CONJ-05

- **Regra da cliente:** O campo CPF seve ser um campo válido
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.NU_CPFCNPJ`.
- **Ação Cypress:** digitar CPF inválido; desfocar/salvar.
- **Asserção:** mensagem de CPF inválido aparece e o avanço é bloqueado.
- **Impacto:** Altera rascunho.

#### CONJ-06

- **Regra da cliente:** Data de nascimento deverá permitir apenas números
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.DT_NASCIMENTO`.
- **Ação Cypress:** digitar letras misturadas à data.
- **Asserção:** somente dígitos válidos para a máscara permanecem.
- **Impacto:** Altera rascunho.

#### CONJ-07

- **Regra da cliente:** Data de comunhão deverá permitir apenas números
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `PESSOA.DT_CASAMENTO`.
- **Ação Cypress:** digitar letras misturadas à data.
- **Asserção:** somente dígitos válidos para a máscara permanecem.
- **Impacto:** Altera rascunho.

#### CONJ-08

- **Regra da cliente:** Telefone deverá permitir apenas números
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.NU_DDD_CEL` e `CONJUGE.NU_CELULAR`.
- **Ação Cypress:** digitar caracteres alfabéticos.
- **Asserção:** somente números permanecem.
- **Impacto:** Altera rascunho.

#### CONJ-09

- **Regra da cliente:** Não será permitido finalizar o nome e e-mail com espaço
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.NO_PESSOA` e `CONJUGE.NO_EMAIL`.
- **Ação Cypress:** informar valores terminando em espaço; salvar e recarregar.
- **Asserção:** espaços finais são removidos ou a validação impede a gravação.
- **Impacto:** Altera rascunho.

#### CONJ-10

- **Regra da cliente:** O regime de comunhão deverá ser uma lista: Comunhão Universal de Bens, Separação Total de Bens, Comunhão Parcial de Bens, Participação Final nos Aquestos, União Estável, Separação Obrigatória de Bens
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `PESSOA.CO_REGIME_CASAMENTO`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém exatamente os seis regimes descritos na regra.
- **Impacto:** Leitura.

### 6 - Composição de renda

- **Spec:** `cypress/e2e/cliente/06-composicao-renda.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`; abrir "Composição de Renda".
- **Escopo de seleção:** aba `[role="tabpanel"]` visível de "Composição de Renda"
- **Massa-base:** `propostaPadraoId`

#### RENDA-01

- **Regra da cliente:** Deve ter informativo que é permitido compor renda com terceiros
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** texto informativo da aba.
- **Ação Cypress:** abrir Composição de Renda.
- **Asserção:** texto informa que é possível compor renda com terceiros.
- **Impacto:** Leitura.

#### RENDA-02

- **Regra da cliente:** Se cliente selecionar a opção não, então não habilita outras informações
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.IN_COMPOE_RENDA`.
- **Ação Cypress:** selecionar "Não".
- **Asserção:** não aparece escolha de participante nem formulário adicional.
- **Impacto:** Altera rascunho.

#### RENDA-03

- **Regra da cliente:** Se cliente selecionar a opção sim, habilitar opção “cônjuge” ou “outra pessoa”
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `PESSOA.IN_COMPOE_RENDA` e `PESSOA.IN_TIPO_COMP_RENDA`.
- **Ação Cypress:** selecionar "Sim".
- **Asserção:** aparecem as opções "Cônjuge" e "Outra pessoa".
- **Impacto:** Altera rascunho.

### 7 - Composição de renda com cônjuge

- **Spec:** `cypress/e2e/cliente/07-composicao-renda-conjuge.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** abrir a proposta com cônjuge; em "Composição de Renda", marcar "Sim" e "Cônjuge".
- **Escopo de seleção:** grupo visível de composição do cônjuge
- **Massa-base:** `propostaComConjugeId`

#### RENDA-CONJ-01

- **Regra da cliente:** Se cônjuge habilitar campos: Renda do cônjuge, Profissão do Conjuge e Tipo de Profissão do Cônjuge para preenchimento obrigatório E por isso são sinalizados com (*)
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.VA_RENDA_BRUTA`, `CONJUGE.CO_PROFISSAO`, `CONJUGE.CO_ATIVIDADE_PROFISSIONAL`.
- **Ação Cypress:** habilitar composição com cônjuge.
- **Asserção:** os três campos aparecem com `*`.
- **Impacto:** Altera rascunho.

#### RENDA-CONJ-02

- **Regra da cliente:** O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.VA_RENDA_BRUTA`.
- **Ação Cypress:** digitar letras/símbolos; desfocar.
- **Asserção:** valor não numérico é rejeitado ou criticado.
- **Impacto:** Altera rascunho.

#### RENDA-CONJ-03

- **Regra da cliente:** O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados
- **Massa/pré-condição:** fixture versionada de profissões.
- **Alvo técnico:** `CONJUGE.CO_PROFISSAO`.
- **Ação Cypress:** comparar opções com fixture da Prognum.
- **Asserção:** lista corresponde à origem e exclui as sete profissões proibidas.
- **Impacto:** Leitura.

#### RENDA-CONJ-04

- **Regra da cliente:** O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.CO_PROFISSAO`.
- **Ação Cypress:** digitar parte de uma profissão.
- **Asserção:** combo filtra opções.
- **Impacto:** Leitura.

#### RENDA-CONJ-05

- **Regra da cliente:** O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.CO_ATIVIDADE_PROFISSIONAL`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém as oito opções definidas.
- **Impacto:** Leitura.

#### RENDA-CONJ-06

- **Regra da cliente:** Deve ser obrigatório o preenchimento de “Autorizo a consulta de dados dos demais participantes no Sistema de informações de crédito (SCR) e demais instituições de proteções e fraudes, lavagem de dinheiro e risco de crédito
- **Massa/pré-condição:** `propostaComConjugeId`.
- **Alvo técnico:** `CONJUGE.IN_AUTORZC`.
- **Ação Cypress:** tentar salvar sem autorizar e depois marcar a autorização.
- **Asserção:** sem autorização há crítica; marcada, a crítica desaparece.
- **Impacto:** Altera rascunho.

### 8 - Composição de renda com terceiros

- **Spec:** `cypress/e2e/cliente/08-composicao-renda-terceiros.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** abrir a proposta com terceiro; em "Composição de Renda", marcar "Sim" e "Outra pessoa".
- **Escopo de seleção:** grupo visível "Dados do Parente para Composição de Renda"
- **Massa-base:** `propostaComTerceiroId`

#### RENDA-TERC-01

- **Regra da cliente:** Se terceiro, habilitar campos: Nome Completo, CPF, Data de Nascimento Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail para preenchimento.
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.NO_PESSOA`, `PESSOA.NU_CPFCNPJ`, `PESSOA.DT_NASCIMENTO`, `PESSOA.VA_RENDA_BRUTA`, `PESSOA.CO_PROFISSAO`, `PESSOA.CO_ATIVIDADE_PROFISSIONAL`, telefone e e-mail.
- **Ação Cypress:** selecionar "Outra pessoa".
- **Asserção:** todos os campos previstos aparecem no grupo do terceiro.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-02

- **Regra da cliente:** Para preenchimento obrigatório temos: Nome Completo, CPF, Data de Nascimento, Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail E por isso são sinalizados com (*)
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** mesmos campos do terceiro.
- **Ação Cypress:** inspecionar rótulos e tentar salvar vazios.
- **Asserção:** todos têm `*` e entram na crítica.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-03

- **Regra da cliente:** O campo CPF seve ser um campo válido
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.NU_CPFCNPJ` dentro do grupo do terceiro.
- **Ação Cypress:** digitar CPF inválido.
- **Asserção:** mensagem de CPF inválido é exibida.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-04

- **Regra da cliente:** Data de nascimento deverá permitir apenas números
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.DT_NASCIMENTO` dentro do grupo do terceiro.
- **Ação Cypress:** digitar letras.
- **Asserção:** somente números válidos para a máscara permanecem.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-05

- **Regra da cliente:** Telefone deverá permitir apenas números
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.NU_DDD_CEL` e `PESSOA.NU_CELULAR` dentro do grupo do terceiro.
- **Ação Cypress:** digitar letras.
- **Asserção:** somente números permanecem.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-06

- **Regra da cliente:** Não será permitido finalizar o nome e e-mail com espaço
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.NO_PESSOA` e `PESSOA.NO_EMAIL` dentro do grupo do terceiro.
- **Ação Cypress:** informar espaços finais; salvar e recarregar.
- **Asserção:** espaços finais não são persistidos.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-07

- **Regra da cliente:** O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.VA_RENDA_BRUTA` dentro do grupo do terceiro.
- **Ação Cypress:** digitar letras/símbolos.
- **Asserção:** valor não numérico é rejeitado ou criticado.
- **Impacto:** Altera rascunho.

#### RENDA-TERC-08

- **Regra da cliente:** O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados
- **Massa/pré-condição:** fixture versionada de profissões.
- **Alvo técnico:** `PESSOA.CO_PROFISSAO` dentro do grupo do terceiro.
- **Ação Cypress:** comparar opções com fixture da Prognum.
- **Asserção:** lista corresponde à origem e exclui as sete opções proibidas.
- **Impacto:** Leitura.
- **Nota/pendência:** A planilha chama o campo de profissão do cônjuge; neste bloco foi interpretado como profissão do terceiro.

#### RENDA-TERC-09

- **Regra da cliente:** O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.CO_PROFISSAO` dentro do grupo do terceiro.
- **Ação Cypress:** digitar parte de uma profissão.
- **Asserção:** combo filtra opções.
- **Impacto:** Leitura.
- **Nota/pendência:** Interpretado como profissão do terceiro.

#### RENDA-TERC-10

- **Regra da cliente:** O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.CO_ATIVIDADE_PROFISSIONAL` dentro do grupo do terceiro.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém as oito opções definidas.
- **Impacto:** Leitura.
- **Nota/pendência:** Interpretado como tipo de profissão do terceiro.

#### RENDA-TERC-11

- **Regra da cliente:** Deve ser obrigatório o preenchimento de “Autorizo a consulta de dados dos demais participantes no Sistema de informações de crédito (SCR) e demais instituições de proteções e fraudes, lavagem de dinheiro e risco de crédito
- **Massa/pré-condição:** `propostaComTerceiroId`.
- **Alvo técnico:** `PESSOA.IN_AUTORZC` dentro do grupo do terceiro.
- **Ação Cypress:** salvar sem autorizar e depois marcar.
- **Asserção:** autorização é obrigatória.
- **Impacto:** Altera rascunho.

### 9 - Motivo da contratação

- **Spec:** `cypress/e2e/cliente/09-motivo-contratacao.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`; abrir "Motivo da Contratação".
- **Escopo de seleção:** aba `[role="tabpanel"]` visível de "Motivo da Contratação"
- **Massa-base:** `propostaPadraoId`

#### MOTIVO-01

- **Regra da cliente:** Valor solicitado do Crédito, Prazo estimado, Tipo de juros devem ser preenchidos com dados do lead
- **Massa/pré-condição:** lead com crédito, prazo e juros conhecidos.
- **Alvo técnico:** valor solicitado, prazo estimado e tipo de juros exibidos na seção/resumo.
- **Ação Cypress:** abrir lead com valores conhecidos.
- **Asserção:** os três valores correspondem ao lead e são somente leitura quando aplicável.
- **Impacto:** Leitura.
- **Nota/pendência:** Na tela observada, esses dados não estavam claramente expostos na aba; confirmar o componente de destino antes de codificar.

#### MOTIVO-02

- **Regra da cliente:** Finalidade do crédito será preenchida com a lista da prognum, permitindo os campos: “Outros”; Construções e/ou reformas; Quitar dívidas bancárias; Quitar dívidas não bancárias; Adquirir bens; Investir; Saúde
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `CO_MOTIVO_EMPRESTIMO`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém Outros, Construção e/ou reformas, Quitar dívidas bancárias, Quitar dívidas não bancárias, Adquirir bens, Investir e Saúde.
- **Impacto:** Leitura.

#### MOTIVO-03

- **Regra da cliente:** Descrição profissional / Defesa para o crédito deverá ser “Utilize esse espaço para nos contar mais sobre você e seus objetivos financeiros no momento” e esse campo deverá validar texto para não permitir palavras soltas ou menor que 10 palavras
- **Massa/pré-condição:** `propostaPadraoId`.
- **Alvo técnico:** `OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO`.
- **Ação Cypress:** validar texto de orientação; testar menos de 10 palavras e depois 10 ou mais.
- **Asserção:** texto curto/palavras soltas são recusados; descrição válida é aceita.
- **Impacto:** Altera rascunho.

### 10 - Imóvel

- **Spec:** `cypress/e2e/cliente/10-imovel.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** `cy.openDefaultProposal()`; abrir "Imóvel".
- **Escopo de seleção:** aba `[role="tabpanel"]` visível de "Imóvel"
- **Massa-base:** `propostaPadraoId` e propostas por condição do imóvel

#### IMOVEL-01

- **Regra da cliente:** Valor Estimado do Imóvel, Endereço do Imóvel de garantia devem ser preenchidos com informações do lead
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `OPERACAO_CREDITO.VA_PRECO_IMOVEL` e endereço `IMOVEL_OPERACAO.*`.
- **Ação Cypress:** abrir lead com imóvel conhecido.
- **Asserção:** valor e endereço correspondem ao lead.
- **Impacto:** Leitura.

#### IMOVEL-02

- **Regra da cliente:** Terá uma mensagem informativa para o cliente: “Alteração das informações da simulação poderá ser feita no momento de negociação Comercial"
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** texto informativo da aba.
- **Ação Cypress:** abrir Imóvel.
- **Asserção:** mensagem contém "Alteração das informações da simulação poderá ser feita no momento de negociação Comercial".
- **Impacto:** Leitura.

#### IMOVEL-03

- **Regra da cliente:** Tipo de Imóvel deve permitir: “Residencial”; “Comercial”
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IMOVEL_OPERACAO.IN_TIPO_IMOVEL`.
- **Ação Cypress:** abrir a lista em condição que permita edição.
- **Asserção:** opções disponíveis são Residencial e Comercial.
- **Impacto:** Leitura.

#### IMOVEL-04

- **Regra da cliente:** O campo uso do imóvel deve ser uma lista composta por: Casa, Apartamento, Casa em condomínio, Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, Sobrado, Flat,Terreno em condominio
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IMOVEL_OPERACAO.IN_USO_DO_IMOVEL`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém os 12 usos/tipos descritos na regra, sem opções extras.
- **Impacto:** Leitura.

#### IMOVEL-05

- **Regra da cliente:** Se marcado Casa em condomínio o campo tipo do imóvel deverá ser residencial por default e não habilita para alteração
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IN_USO_DO_IMOVEL=Casa em condomínio` e `IN_TIPO_IMOVEL`.
- **Ação Cypress:** selecionar Casa em condomínio.
- **Asserção:** tipo fica Residencial e desabilitado.
- **Impacto:** Altera rascunho.

#### IMOVEL-06

- **Regra da cliente:** Se marcado Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, o campo tipo do imóvel deverá ser comercial por default e não habilita para alteração
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IN_USO_DO_IMOVEL` comercial e `IN_TIPO_IMOVEL`.
- **Ação Cypress:** testar Loja, Sala Comercial, Misto, prédios comerciais e Laje corporativa.
- **Asserção:** tipo fica Comercial e desabilitado em cada opção.
- **Impacto:** Altera rascunho.

#### IMOVEL-07

- **Regra da cliente:** Se marcado Casa, Apartamento, Sobrado, Flat e Terreno em condomínio o cliente deve escolher o tipo sendo campo obrigatório
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IN_USO_DO_IMOVEL` residencial/misto e `IN_TIPO_IMOVEL`.
- **Ação Cypress:** testar Casa, Apartamento, Sobrado, Flat e Terreno em condomínio.
- **Asserção:** tipo permanece habilitado e obrigatório.
- **Impacto:** Altera rascunho.

#### IMOVEL-08

- **Regra da cliente:** Após o endereço do imóvel deve vir a pergunta “Você reside neste imóvel?”
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** pergunta após o endereço e `PESSOA.IN_RESIDE_NO_IMOVEL`.
- **Ação Cypress:** abrir a aba.
- **Asserção:** a pergunta "Você reside neste imóvel?" aparece após o bloco de endereço.
- **Impacto:** Leitura.

#### IMOVEL-09

- **Regra da cliente:** Quando o cliente selecionar “Não” deve habilitar o campo de endereço de residência para preenchimento
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `PESSOA.IN_RESIDE_NO_IMOVEL` e endereço residencial `PESSOA.NU_CEP` etc..
- **Ação Cypress:** selecionar "Não".
- **Asserção:** campos de endereço de residência aparecem e ficam preenchíveis.
- **Impacto:** Altera rascunho.
- **Nota/pendência:** Os campos pertencem ao participante, embora a regra esteja no bloco Imóvel.

#### IMOVEL-10

- **Regra da cliente:** Número do imóvel que vem do lead poderá vir em número, mas deverá ser concatenado para integração com a tela da prognum
- **Massa/pré-condição:** lead com número de imóvel conhecido.
- **Alvo técnico:** número/endereço recebido do lead e payload salvo.
- **Ação Cypress:** abrir lead cujo número é numérico; salvar sem alteração; inspecionar request.
- **Asserção:** o número é serializado/concatenado no formato aceito pela Prognum.
- **Impacto:** Altera rascunho.
- **Nota/pendência:** A regra não define o formato final; registrar o payload real antes de fixar a asserção.

#### IMOVEL-11

- **Regra da cliente:** Condição do imóvel deverá ter a lista: Próprio, quitado; Próprio, alienado/ financiado, De terceiro, quitado; De terceiro, alienado/financiado; Em nome de empresa (CNPJ), quitado; Em nome de empresa (CNPJ), alienado/financiado
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL`.
- **Ação Cypress:** abrir a lista.
- **Asserção:** contém exatamente as seis condições descritas.
- **Impacto:** Leitura.

#### IMOVEL-12

- **Regra da cliente:** Caso preenchido alienado habilita campos Valor estimado saldo devedor e instituição para preenchimento obrigatório e portando deve ter “(*)”
- **Massa/pré-condição:** `propostaPadraoId` e propostas por condição do imóvel.
- **Alvo técnico:** `OPERACAO_CREDITO.VA_INTERVENIENTE` e `IMOVEL_OPERACAO.NO_INSTITUICAO_FINANCEIRA`.
- **Ação Cypress:** selecionar condição alienada PF e PJ.
- **Asserção:** saldo devedor e instituição aparecem com `*`.
- **Impacto:** Altera rascunho.
- **Nota/pendência:** No schema observado, instituição possui expressão de lista que pode mantê-la oculta; validar em massa alienada.

### 11 - Garantidor PF

- **Spec:** `cypress/e2e/cliente/11-garantidor-pf.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** abrir `propostaGarantidorPfId`; navegar até a seção de garantidor.
- **Escopo de seleção:** grupo/fieldset visível do garantidor PF
- **Massa-base:** `propostaGarantidorPfId`

#### GAR-PF-01

- **Regra da cliente:** Caso preenchido de terceiro quitado ou alienado, habilita garantidor PF
- **Massa/pré-condição:** proposta descartável com condição editável.
- **Alvo técnico:** `IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL` e grupo do garantidor PF.
- **Ação Cypress:** selecionar De terceiro quitado e De terceiro alienado/financiado.
- **Asserção:** garantidor PF aparece nas duas condições.
- **Impacto:** Altera rascunho.

#### GAR-PF-02

- **Regra da cliente:** Quando Garantidor PF habilitado, os campos “Nome do proprietário”, “CPF do proprietário”, “Estado Civil”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF”, Telefone de contato”, “E-mail” e “Data de Nascimento são de preenchimento obrigatório e por isso devem ter “(*)”
- **Massa/pré-condição:** `propostaGarantidorPfId`.
- **Alvo técnico:** `PESSOA.NO_PESSOA`, `NU_CPFCNPJ`, `CO_ESTCIV`, `DT_NASCIMENTO`, telefone, e-mail e endereço dentro do garantidor.
- **Ação Cypress:** inspecionar rótulos e salvar vazios.
- **Asserção:** todos os campos listados possuem `*` e são criticados.
- **Impacto:** Leitura.

#### GAR-PF-03

- **Regra da cliente:** Telefone deve permitir apenas celular
- **Massa/pré-condição:** `propostaGarantidorPfId`.
- **Alvo técnico:** `PESSOA.NU_CELULAR` dentro do garantidor.
- **Ação Cypress:** digitar telefone fixo e celular válido.
- **Asserção:** fixo é rejeitado; celular é aceito.
- **Impacto:** Altera rascunho.

#### GAR-PF-04

- **Regra da cliente:** Quando Garantidor PF, o campo “Complemento” é opcional
- **Massa/pré-condição:** `propostaGarantidorPfId`.
- **Alvo técnico:** `PESSOA.NO_COMPLEMENTO` dentro do garantidor.
- **Ação Cypress:** inspecionar rótulo e salvar vazio.
- **Asserção:** campo é opcional e não entra na crítica.
- **Impacto:** Leitura.

#### GAR-PF-05

- **Regra da cliente:** Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente
- **Massa/pré-condição:** CEP estável para automação.
- **Alvo técnico:** `PESSOA.NU_CEP` e botão `[aria-label="Buscar endereço pelo CEP"]` dentro do garantidor.
- **Ação Cypress:** digitar CEP válido e acionar busca.
- **Asserção:** endereço, bairro, município e UF são preenchidos automaticamente.
- **Impacto:** Altera rascunho.

#### GAR-PF-06

- **Regra da cliente:** Deve existir em tela uma indicação que o endereço é do proprietário do imóvel
- **Massa/pré-condição:** `propostaGarantidorPfId`.
- **Alvo técnico:** título/texto do bloco de endereço do garantidor.
- **Ação Cypress:** abrir garantidor PF.
- **Asserção:** texto identifica que o endereço pertence ao proprietário do imóvel.
- **Impacto:** Leitura.
- **Nota/pendência:** A cliente registrou que a identificação não foi encontrada.

### 12 - Garantidor PJ

- **Spec:** `cypress/e2e/cliente/12-garantidor-pj.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** abrir `propostaGarantidorPjId`; navegar até a seção de garantidor.
- **Escopo de seleção:** grupo/fieldset visível do garantidor PJ e painel "Sócio"
- **Massa-base:** `propostaGarantidorPjId`

#### GAR-PJ-01

- **Regra da cliente:** Caso preenchido em nome de empresa quitado ou alienado, habilita garantidor PJ
- **Massa/pré-condição:** proposta descartável com condição editável.
- **Alvo técnico:** `IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL` e grupo do garantidor PJ.
- **Ação Cypress:** selecionar Em nome de empresa quitado e alienado/financiado.
- **Asserção:** garantidor PJ aparece nas duas condições, sem escolha manual PF/PJ.
- **Impacto:** Altera rascunho.

#### GAR-PJ-02

- **Regra da cliente:** Quando Garantidor PJ habilitado, os campos “Razão Social da Empresa”, “CNPJ”, “Estado Civil”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF” são de preenchimento obrigatório e por isso devem ter “(*)”
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** `PESSOA.NO_PESSOA`, `NU_CPFCNPJ`, endereço e demais campos dentro do garantidor PJ.
- **Ação Cypress:** inspecionar rótulos e salvar vazios.
- **Asserção:** Razão Social, CNPJ, CEP, Endereço, Número, Bairro, Município e UF possuem `*`.
- **Impacto:** Leitura.
- **Nota/pendência:** O schema observado não apresenta Estado Civil no bloco PJ; manter a asserção separada para evidenciar a decisão funcional.

#### GAR-PJ-03

- **Regra da cliente:** Quando Garantidor PJ, os campos “Telefone de contato”, “E-mail” e “Complemento” são opcionais
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** `PESSOA.NU_TELEFONE_COM`, `PESSOA.NO_EMAIL`, `PESSOA.NO_COMPLEMENTO` no garantidor PJ.
- **Ação Cypress:** inspecionar rótulos e salvar vazios.
- **Asserção:** os três são opcionais e não entram na crítica.
- **Impacto:** Leitura.

#### GAR-PJ-04

- **Regra da cliente:** Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente
- **Massa/pré-condição:** CEP estável para automação.
- **Alvo técnico:** `PESSOA.NU_CEP` e busca de CEP dentro do garantidor PJ.
- **Ação Cypress:** digitar CEP válido e buscar.
- **Asserção:** endereço, bairro, município e UF são preenchidos.
- **Impacto:** Altera rascunho.

#### GAR-PJ-05

- **Regra da cliente:** Deve existir em tela uma indicação que o endereço é da empresa do imóvel
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** título/texto do endereço do garantidor PJ.
- **Ação Cypress:** abrir garantidor PJ.
- **Asserção:** texto identifica que o endereço é da empresa proprietária do imóvel.
- **Impacto:** Leitura.

#### GAR-PJ-06

- **Regra da cliente:** Indicar que este preenchimento de sócios deve ser feito quando aplicável, e que em casos de não existir sócios (apenas 1 dono), preencher com a informação da pessoa que é dona
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** orientação do painel de sócios e botão "Adicionar sócio".
- **Ação Cypress:** abrir garantidor PJ.
- **Asserção:** orientação explica quando preencher e que empresa com um único dono deve informar esse proprietário.
- **Impacto:** Leitura.

#### GAR-PJ-07

- **Regra da cliente:** Campo “Nome Completo”, “CPF”, “Telefone”, “Data de nascimento” e “E-mail” são obrigatórias para todos os sócios e por isso devem ter “(*)”
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** `NO_PESSOA`, `NU_CPFCNPJ`, `DT_NASCIMENTO`, `NU_DDD_CEL`, `NU_CELULAR`, `NO_EMAIL` dentro de cada painel Sócio.
- **Ação Cypress:** adicionar sócio; inspecionar rótulos; tentar salvar vazio.
- **Asserção:** Nome, CPF, telefone, nascimento e e-mail possuem `*` em todos os sócios.
- **Impacto:** Altera rascunho.

#### GAR-PJ-08

- **Regra da cliente:** Telefone deve permitir apenas celular
- **Massa/pré-condição:** `propostaGarantidorPjId`.
- **Alvo técnico:** `NU_DDD_CEL` e `NU_CELULAR` dentro do painel Sócio.
- **Ação Cypress:** digitar telefone fixo e celular válido.
- **Asserção:** fixo é rejeitado; celular é aceito.
- **Impacto:** Altera rascunho.

### 13 - Detalhamento

- **Spec:** `cypress/e2e/cliente/13-detalhamento.cy.ts`
- **Rota:** `/propostas/:id`
- **Entrada padrão:** abrir uma proposta incompleta e outra com cadastro completo.
- **Escopo de seleção:** botão "Ver Detalhes da Operação" e jornada após a proposta
- **Massa-base:** `propostaPadraoId` e `propostaCadastroCompletoId`

#### DETALHE-01

- **Regra da cliente:** O botão não estará em tela, será via jornada a partir da proposta e será habilitado apenas quando cadastro completo
- **Massa/pré-condição:** `propostaPadraoId` e `propostaCadastroCompletoId`.
- **Alvo técnico:** botão "Ver Detalhes da Operação".
- **Ação Cypress:** comparar proposta incompleta e proposta com cadastro concluído.
- **Asserção:** não aparece no cadastro incompleto; é habilitado pela jornada somente após conclusão.
- **Impacto:** Leitura.
- **Nota/pendência:** Na proposta 72 o botão apareceu com cadastro incompleto; o teste deve registrar a divergência.

## Critérios de pronto por caso

Um caso só deixa de ser `PENDENTE DE AUTOMAÇÃO` quando:

1. A massa exigida existe e está declarada em `connect.example.ts` sem dados sensíveis.
2. O teste usa o ID da planilha no título.
3. A seleção está limitada à tela ou grupo correto.
4. Existe ao menos uma asserção sobre o resultado de negócio, não apenas visibilidade genérica.
5. Alterações persistentes usam massa descartável ou rotina de restauração.
6. O teste passa isoladamente e na execução completa, sem depender da ordem de specs.
7. Divergências reais do portal falham com mensagem que indique a regra esperada.

## Pontos ainda não fechados

- Endpoint/contrato exato para preparar fases, cancelamentos e prazos na Prognum.
- Formato esperado da concatenação do número do imóvel em `IMOVEL-10`.
- Local definitivo de exibição dos dados do lead em `MOTIVO-01`.
- Contêiner semântico exato dos grupos dinâmicos de cônjuge, terceiro, garantidor e sócio; confirmar no DOM antes de criar helper global.
- Calendário de feriados aplicável ao cálculo de dias úteis de `PROP-14`.
- Persistência esperada do fechamento de alertas: navegador, usuário ou proposta.

Esses pontos não impedem os demais testes. Cada um deve continuar pendente apenas no caso diretamente afetado, sem bloquear o arquivo inteiro.
