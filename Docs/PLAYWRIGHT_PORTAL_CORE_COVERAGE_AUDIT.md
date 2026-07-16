# Auditoria de Cobertura Playwright — Portal Core

## 1. Objetivo

Esta auditoria compara os 198 casos propostos em `PORTAL_CORE_PLAYWRIGHT_VALIDATION_PLAN.md` com a suíte Playwright atual. A comparação foi feita pelo risco funcional realmente comprovado, não pelo nome do teste, quantidade de specs ou localização do arquivo.

Baseline aprovada antes do CORE-2 (já incluindo o CORE-1):

- 131 testes coletados em 33 arquivos;
- 108 casos funcionais herdados do contrato C6;
- setup, smoke, simulador e integrações Portal → SCCI/AEJS;
- assertions, pré-condições, lifecycle e respostas de rede realmente observadas no código;
- resultados das execuções recentes no Portal DESENV/EsteiraHT;
- indisponibilidades recentes do Portal (`504`) e SCCI (timeout) apenas como contexto operacional, sem transformar toda lacuna em `BLOCKED`.

## 2. Critério de classificação

| Status | Critério usado nesta auditoria |
|---|---|
| `COVERED` | Existe teste que comprova o mesmo risco com assertion suficiente, mesmo que o nome, ID ou camada sejam diferentes. |
| `PARTIAL` | O fluxo toca o risco, mas não prova uma pós-condição essencial, um boundary ou a persistência real. |
| `MISSING` | Não existe teste equivalente. Ter locator, Page Object ou helper não conta como cobertura. |
| `REQUIRES_DOMAIN_CONTRACT` | A automação comprovou frontend, resposta real, persistência e conteúdo, mas o produto ainda não definiu qual resultado é correto. Não transformar o comportamento observado em regra sem decisão de domínio. |
| `NOT_APPLICABLE` | A função não existe na interface atual observada ou o Portal atual não oferece essa ação. |
| `BLOCKED` | O caso é válido, mas requer identidade, massa ou capacidade controlada que a arquitetura atual ainda não declara com segurança. |

### Regras críticas aplicadas

- Um toast `Rascunho salvo`, sozinho, não prova persistência no servidor.
- Validar que um campo é obrigatório não equivale a testar vazio, whitespace, limite ou erro após submit.
- Usar `getByRole` não equivale, sozinho, a uma auditoria completa de acessibilidade; ele pode comprovar nome acessível de controles representativos.
- Um fluxo Portal → SCCI pode cobrir o risco frontend → backend de um valor, mesmo estando em uma spec de integração.
- Ter suporte a `Enviar novamente` no Page Object não cobre substituição enquanto nenhuma spec executar e validar a consequência.
- CORE-1 controla HTTP 500 com `page.route()` somente no endpoint exato de rascunho.
- CORE-2 controla lentidão, timeout e ordem de respostas no mesmo endpoint, sem persistir os valores simulados no backend.
- Cobertura com rede controlada só foi marcada como completa quando a pós-condição observável do frontend foi comprovada. Resolução persistente de conflito entre duas páginas permanece `PARTIAL`.
- CORE-4B usa uma operação estrangeira real e cadastrada no ambiente, com ownership distinto comprovado pelo catálogo local tipado; nenhum ID aleatório ou mock de autorização é usado.

## 3. Resumo executivo

| Status | Quantidade | Percentual |
|---|---:|---:|
| `COVERED` | 159 | 80,3% |
| `PARTIAL` | 6 | 3,0% |
| `MISSING` | 20 | 10,1% |
| `REQUIRES_DOMAIN_CONTRACT` | 5 | 2,5% |
| `NOT_APPLICABLE` | 4 | 2,0% |
| `BLOCKED` | 4 | 2,0% |
| **Total** | **198** | **100%** |

### Evolução da coleta até o CORE-6

| Momento | Testes | Arquivos | Variação |
|---|---:|---:|---:|
| Baseline aprovada após CORE-1 | 131 | 33 | — |
| Encerramento do CORE-2 | 135 | 34 | +4 testes / +1 arquivo |
| Encerramento do CORE-3 | 139 | 35 | +4 testes / +1 arquivo |
| Encerramento do CORE-4A | 144 | 36 | +5 testes / +1 arquivo |
| Encerramento do CORE-4B | 145 | 37 | +1 teste / +1 arquivo |
| Encerramento do CORE-5 | 150 | 39 | +5 testes / +2 arquivos |
| Encerramento do CORE-6 | 153 | 40 | +3 testes / +1 arquivo |
| Bloco imediato pós-CORE-6 | 158 | 42 | +5 testes / +2 arquivos |
| Bloco restaurável de Cadastro A/B | 162 | 43 | +4 testes / +1 arquivo |
| Batch documental consumível | 162 regulares | 43 regulares | 2 casos consumíveis isolados fora da coleta padrão; a execução dedicada possui ainda o setup |

O contrato funcional permanece em **108/108 casos migrados**. CORE-1 a CORE-6, o bloco imediato e o bloco restaurável de Cadastro A/B acrescentam 33 cenários compostos sem alterar os casos funcionais nem o teste tenant de 10 MB. O batch documental existe em arquivo próprio, mas `playwright.config.ts` o exclui da coleta regular; somente o comando explícito habilita `PW_INCLUDE_CONSUMABLE=true`.

### Parecer executivo

A suíte atual **não possui ainda uma camada Portal Core suficiente**. Ela tem boa cobertura de:

- regras de aceite de formulários;
- autenticação real e abertura de propostas;
- upload e visualização imediata de PDF;
- preparação de cenários Portal → SCCI;
- reflexão de texto, moeda, datas, telefones, selects e alguns checkboxes no SCCI;
- captura automática de `pageerror`.

As maiores lacunas estão nos riscos P0 de produto:

- falha de salvamento e falsa confirmação de sucesso;
- perda de dados após refresh, reabertura ou sessão expirada;
- ações duplicadas de finalização/upload e política persistente de concorrência entre abas;
- isolamento entre propostas e usuários;
- autorização server-side/IDOR;
- falhas e interrupções de upload;
- consistência diante de respostas atrasadas ou fora de ordem;
- recuperação, retry e loading após erro.

O número de testes atuais não deve ser usado isoladamente como indicador dessa cobertura. A maior parte da baseline valida contratos funcionais felizes e específicos; após o batch documental, 10,1% dos riscos CORE propostos permanecem sem teste equivalente e 2,5% dependem de contrato de domínio.

## 4. Cobertura atual por grupo

| Grupo | Covered | Partial | Missing | Contrato | N/A | Blocked | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Navegação e persistência | 7 | 2 | 1 | 0 | 0 | 0 | 10 |
| Salvamento e perda de dados | 15 | 1 | 1 | 0 | 0 | 0 | 17 |
| Upload e gerenciamento | 23 | 0 | 2 | 0 | 2 | 0 | 27 |
| Validação real de arquivo | 2 | 0 | 1 | 5 | 0 | 0 | 8 |
| Falhas durante upload | 12 | 0 | 0 | 0 | 0 | 0 | 12 |
| Campos de texto | 9 | 0 | 4 | 0 | 0 | 0 | 13 |
| Campos numéricos | 6 | 1 | 1 | 0 | 0 | 0 | 8 |
| Datas | 6 | 0 | 5 | 0 | 0 | 0 | 11 |
| CEP e endereço | 12 | 0 | 0 | 0 | 0 | 0 | 12 |
| Sessão e autorização | 9 | 0 | 0 | 0 | 2 | 1 | 12 |
| Concorrência | 5 | 1 | 3 | 0 | 0 | 0 | 9 |
| Loading e estados intermediários | 9 | 0 | 0 | 0 | 0 | 1 | 10 |
| Mobile | 14 | 0 | 1 | 0 | 0 | 0 | 15 |
| Acessibilidade | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Frontend → API | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Isolamento | 7 | 0 | 0 | 0 | 0 | 2 | 9 |
| Jornadas Core | 3 | 1 | 1 | 0 | 0 | 0 | 5 |
| **Total** | **159** | **6** | **20** | **5** | **4** | **4** | **198** |

## 5. Matriz caso a caso

### 5.1 Navegação e persistência

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-NAV-01 | COVERED | `CONJ-09` e `RENDA-TERC-06` preenchem, trocam de aba, retornam e conferem o valor. | Nenhuma para o mecanismo representativo. | P0 | Reutilizar; não duplicar. |
| CORE-NAV-02 | COVERED | CORE-1 envia valor marcador no `PUT /cadastro` real e compara após `reload`. A assertion detecta regressão ativa no HT: HTTP 200/`success: true`, mas a renda retorna `R$ 0,00`. | Nenhuma lacuna de cobertura; o produto não atende à pós-condição. | P0 | Corrigir o Portal e manter a assertion. |
| CORE-NAV-03 | PARTIAL | CORE-1 possui reabertura pela listagem na mesma massa dedicada. | A execução não alcança essa etapa enquanto CORE-NAV-02 falhar antes. | P0 | Reexecutar após corrigir a persistência no Portal. |
| CORE-NAV-04 | COVERED | `restorable-cadastro.spec.ts` abre diretamente o deep link autenticado de CAD A, observa o GET real e exato da operação, comprova identidade/estado e repete a leitura após reload. | Nenhuma. | P1 | Manter o cenário read-only. |
| CORE-NAV-05 | MISSING | Nenhum duplo clique controlado em Continuar. | Consequência lógica duplicada. | P0 | Instrumentar request/estado. |
| CORE-NAV-06 | COVERED | O bloco imediato alterna quatro seções, exige a última seção selecionada e preserva o valor local representativo. | Nenhuma para continuidade frontend representativa. | P1 | Reutilizar; não duplicar. |
| CORE-NAV-07 | COVERED | O mesmo cenário usa histórico real Voltar/Avançar, reencontra o card e retoma a mesma proposta com o valor preservado. | Nenhuma. | P1 | Reutilizar; não duplicar. |
| CORE-NAV-08 | COVERED | CORE-2 inicia refresh enquanto o `PUT /cadastro` está pendente e exige reabertura íntegra da mesma proposta, sem valor simulado persistido. | Nenhuma para recuperação frontend após interrupção. | P0 | Reutilizar; não duplicar. |
| CORE-NAV-09 | PARTIAL | CORE-2 abre a mesma proposta em duas páginas, mantém marcadores locais distintos e conclui as respostas em ordem inversa. | A rede controlada não prova política server-side de conflito/last-write-wins. | P0 | Exigir contrato de concorrência do backend antes de ampliar. |
| CORE-NAV-10 | COVERED | CORE-4 controla 401 no `PUT /cadastro`, comprova remoção do conteúdo protegido e reabre a massa após nova autenticação. | Nenhuma para expiração representativa durante cadastro. | P0 | Reutilizar; não duplicar. |

### 5.2 Salvamento e perda de dados

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-SAVE-01 | COVERED | Preparações PJ/PF/quitado/workflow validam `PUT /cadastro`, corpo de sucesso e conclusão; reflexos são conferidos no SCCI. | Nenhuma para save válido representativo. | P0 | Reusar cobertura existente. |
| CORE-SAVE-02 | COVERED | CORE-1 salva somente a renda em cadastro incompleto, recebe sucesso do backend e exige o mesmo valor após reload. | A pós-condição falha no HT por regressão funcional ativa. | P1 | Corrigir o Portal e manter a assertion. |
| CORE-SAVE-03 | COVERED | CORE-1 captura o baseline, envia marcador distinto e compara o valor carregado novamente. | A pós-condição falha no HT por regressão funcional ativa. | P0 | Corrigir o Portal e manter a assertion. |
| CORE-SAVE-04 | PARTIAL | CORE-1 implementa remoção, reload e restauração comprovada do valor original. | A execução não alcança a remoção enquanto a primeira persistência falhar. | P0 | Reexecutar após corrigir a persistência no Portal. |
| CORE-SAVE-05 | COVERED | CORE-2 executa duplo clique durante save lento e conta exatamente um `PUT /cadastro`. | Nenhuma para consequência lógica representativa. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-06 | COVERED | CORE-2 dispara refresh com o save pendente e comprova recuperação da proposta. | Nenhuma para navegação interrompendo save representativo. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-07 | COVERED | CORE-1 intercepta exclusivamente o `PUT /api/portal/propostas/{operacao}/cadastro` e devolve falha controlada. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-08 | COVERED | CORE-2 aborta a primeira request como `timedout`, exige saída do estado de loading e executa retry. | Nenhuma. | P1 | Reutilizar; não duplicar. |
| CORE-SAVE-09 | COVERED | CORE-1 devolve HTTP 500 com o contrato real `success/message` do endpoint. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-10 | COVERED | CORE-4 devolve 401 no endpoint exato, exige ausência de `Rascunho salvo` e comprova que o marcador não foi persistido após reautenticação. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-11 | COVERED | O bloco imediato devolve 403 no PUT exato, exige ausência de sucesso falso, preservação local e feedback. A execução detecta ausência de mensagem no Portal. | Nenhuma lacuna de cobertura; o feedback continua como regressão ativa. | P1 | Corrigir o Portal e manter a assertion. |
| CORE-SAVE-12 | MISSING | Sem cenário 409. | Tratamento de conflito. | P1 | Mock 409. |
| CORE-SAVE-13 | COVERED | CORE-2 mantém o `PUT` pendente, observa `Salvando`, impede sucesso prematuro e só conclui após liberar a resposta. | Nenhuma para o estado intermediário representativo. | P1 | Reutilizar; não duplicar. |
| CORE-SAVE-14 | COVERED | CORE-1 exige feedback explícito após HTTP 500. A assertion detecta regressão ativa no HT: nenhum erro é apresentado. | Nenhuma lacuna de cobertura; o produto não atende ao contrato. | P0 | Corrigir o Portal e manter a assertion. |
| CORE-SAVE-15 | COVERED | CORE-1 comprova que `Rascunho salvo` permanece ausente após HTTP 500. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-16 | COVERED | CORE-1 mantém a falha controlada ao retornar à aba original e comprova que o valor digitado foi preservado localmente. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-SAVE-17 | COVERED | CORE-1 remove a rota controlada, executa novo `PUT` real e exige persistência após reload. O retry recebe sucesso, mas a pós-condição falha no HT. | Nenhuma lacuna de cobertura; o produto não persiste o valor. | P0 | Corrigir o Portal e manter a assertion. |

### 5.3 Upload e gerenciamento de documentos

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-CORE-01 | COVERED | `send-and-view-portal-documents` envia arquivo válido em todos os controles. | Nenhuma para upload feliz representativo. | P0 | Reusar. |
| DOC-CORE-02 | COVERED | O mesmo cenário envia PDF real, valida nome/status e conteúdo HTTP. | Nenhuma. | P1 | Não duplicar. |
| DOC-CORE-03 | COVERED | O batch consumível envia JPEG real, recebe sucesso do backend, comprova operação/slot e relê o digest persistido após reload e nova sessão. | Nenhuma para JPG/JPEG permitido. | P1 | Não reutilizar a massa consumida. |
| DOC-CORE-04 | COVERED | O batch envia PNG real em slot dedicado, comprova resposta aceita, destino correto e bytes persistidos após nova leitura. | Nenhuma para PNG permitido. | P1 | Não reutilizar a massa consumida. |
| DOC-CORE-05 | COVERED | CORE-3 seleciona `.txt`, exige ausência de request/documento e feedback. Detecta regressão ativa: bloqueio silencioso. | Nenhuma lacuna de cobertura frontend. | P0 | Corrigir feedback no Portal e manter assertion. |
| DOC-CORE-06 | COVERED | CORE-3 gera PDF de zero byte, exige bloqueio antes da rede e feedback. Detecta regressão ativa: o arquivo chega ao endpoint e falha silenciosamente. | Nenhuma lacuna de cobertura; o produto viola o contrato. | P0 | Corrigir validação no Portal e manter assertion. |
| DOC-CORE-07 | COVERED | CORE-3 usa `PORTAL_CORE_DOCUMENT_MAX_SIZE_BYTES`; o teste tenant de 10 MB permanece intacto. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| DOC-CORE-08 | COVERED | Arquivo gerado com tamanho exato chega ao endpoint e não dispara erro de tamanho; a resposta é falha controlada para não persistir. | Nenhuma para o boundary frontend. | P1 | Reutilizar. |
| DOC-CORE-09 | COVERED | Arquivo gerado com limite −1 byte chega ao endpoint sem erro de tamanho. | Nenhuma para o boundary frontend. | P2 | Reutilizar. |
| DOC-CORE-10 | COVERED | Arquivo gerado com limite +1 byte é bloqueado antes da request e mantém o slot vazio. | Nenhuma. | P1 | Reutilizar. |
| DOC-CORE-11 | MISSING | Nome usado é curto/fixo. | Nome muito grande. | P2 | Fixture gerada. |
| DOC-CORE-12 | COVERED | Um único arquivo válido com espaços, acento, `ç`, parênteses e múltiplos pontos preserva o nome no input e no multipart. | Nenhuma. | P2 | Reutilizar a fixture composta. |
| DOC-CORE-13 | COVERED | A mesma fixture comprova Unicode acentuado no nome serializado. | Nenhuma. | P2 | Reutilizar. |
| DOC-CORE-14 | COVERED | A mesma fixture comprova `ç` no nome serializado. | Nenhuma. | P2 | Reutilizar. |
| DOC-CORE-15 | COVERED | A mesma fixture comprova parênteses no nome serializado. | Nenhuma. | P2 | Reutilizar. |
| DOC-CORE-16 | COVERED | A extensão terminal `.pdf` continua aceita em nome com múltiplos pontos e alcança o endpoint exato. | Nenhuma. | P2 | Reutilizar. |
| DOC-CORE-17 | MISSING | Sem caracteres especiais representativos. | Sanitização segura. | P2 | Definir conjunto suportado. |
| DOC-CORE-18 | COVERED | O batch envia dois JPEGs com o mesmo nome e conteúdos/digests distintos no mesmo slot; a releitura comprova somente o digest V2. | Nenhuma. | P1 | Reutilizar a evidência consumível. |
| DOC-CORE-19 | COVERED | O mesmo JPEG é reenviado no mesmo slot, mantendo um único item lógico e o mesmo digest. | Nenhuma. | P1 | Reutilizar. |
| DOC-CORE-20 | COVERED | Duas seleções rápidas em slots distintos são serializadas pela fila; operação, `documentoId`, `pessoaId`, nome e conteúdo permanecem associados ao slot correto. | Não há paralelismo de rede porque a UI declara fila unitária; o risco funcional foi comprovado. | P1 | Não afirmar simultaneidade de requests. |
| DOC-CORE-21 | COVERED | O bloco imediato cancela o file chooser e comprova zero request, zero loading e slot intacto. | Nenhuma. | P2 | Reutilizar. |
| DOC-CORE-22 | NOT_APPLICABLE | Tela atual observada expõe escolher, reenviar, visualizar e enviar para análise; não há remover. | Capacidade ausente. | P0 | Reavaliar se produto ganhar remoção. |
| DOC-CORE-23 | COVERED | `Enviar novamente` substitui o conteúdo V1 pelo V2 no mesmo `documentoId`; após releitura existe um item lógico e o digest final é V2. | Restaurar uma versão anterior continua sem capacidade de produto, mas não faz parte do contrato de substituição deste ID. | P0 | Não reutilizar o slot consumido. |
| DOC-CORE-24 | COVERED | Spec abre `Ver arquivo`, exige HTTP 200, PDF e corpo não vazio. | Nenhuma para visualização imediata. | P0 | Reusar. |
| DOC-CORE-25 | NOT_APPLICABLE | Não há ação dedicada de download na tela atual; existe visualização em nova página. | Capacidade ausente. | P1 | Reavaliar se download surgir. |
| DOC-CORE-26 | COVERED | O batch recarrega após aborto e exige slot vazio; depois confirma que um upload aceito antes do refresh aparece exatamente uma vez e com o digest correto. | Nenhuma. | P0 | Massa DOC A permanece consumida. |
| DOC-CORE-27 | COVERED | Após limpar a sessão e renová-la pelo fluxo oficial, DOC A/B mantêm nomes, destinos e digests corretos. | Nenhuma. | P0 | Massa DOC A/B permanece consumida. |

### 5.4 Validação real do arquivo

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-CORE-28 | REQUIRES_DOMAIN_CONTRACT | Bytes PNG apresentados como `.pdf` foram aceitos pelo backend, persistidos e relidos com digest idêntico. | Não existe contrato explícito exigindo validação por assinatura/magic bytes. | P1 | Produto deve decidir se aceita, normaliza ou rejeita. |
| DOC-CORE-29 | REQUIRES_DOMAIN_CONTRACT | Conteúdo PNG, nome `.pdf` e MIME divergente foram aceitos e persistidos. | Política de consistência entre MIME, extensão e conteúdo não está definida. | P1 | Definir contrato antes de criar regressão. |
| DOC-CORE-30 | REQUIRES_DOMAIN_CONTRACT | JPEG renomeado como PDF foi aceito; o backend acrescentou extensão coerente ao conteúdo e os bytes foram relidos. | Não há regra formal sobre normalização ou rejeição. | P1 | Definir contrato. |
| DOC-CORE-31 | REQUIRES_DOMAIN_CONTRACT | PDF renomeado como JPG foi aceito; o backend normalizou o nome e preservou o conteúdo. | Não há regra formal sobre normalização ou rejeição. | P1 | Definir contrato. |
| DOC-CORE-32 | REQUIRES_DOMAIN_CONTRACT | PDF estruturalmente corrompido recebeu sucesso, persistiu e pôde ser relido como bytes; a capacidade de abertura/processamento não foi comprovada. | Integridade mínima exigida para PDF não está formalizada. | P1 | Definir validação de integridade e comportamento esperado. |
| DOC-CORE-33 | COVERED | Arquivo sem extensão é bloqueado antes do endpoint e não cria documento. A ausência de feedback reproduz a regressão de bloqueio silencioso. | Nenhuma lacuna de cobertura frontend. | P2 | Corrigir feedback no Portal. |
| DOC-CORE-34 | MISSING | Sem extensão em caixa alta. | Normalização. | P2 | Criar fixture. |
| DOC-CORE-35 | COVERED | `arquivo.pdf.exe` é bloqueado pela extensão terminal, sem request ou documento. A ausência de feedback reproduz a regressão de bloqueio silencioso. | Nenhuma lacuna de cobertura frontend. | P2 | Corrigir feedback no Portal. |

### 5.5 Falhas durante upload

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-NET-01 | COVERED | O bloco imediato aborta o POST antes da resposta e exige slot vazio, UI desbloqueada e nova tentativa possível. | Nenhuma. | P0 | Reutilizar. |
| DOC-NET-02 | COVERED | O mesmo cenário mantém o POST iniciado, observa loading, aborta a conexão e exige recuperação sem documento fantasma. | Nenhuma. | P0 | Reutilizar. |
| DOC-NET-03 | COVERED | CORE-3 controla HTTP 500, loading, desbloqueio, ausência de sucesso falso e retry. Detecta ausência de feedback. | Nenhuma lacuna de cobertura; regressão ativa no Portal. | P0 | Corrigir feedback e manter assertion. |
| DOC-NET-04 | COVERED | CORE-3 responde 413 no endpoint exato e exige erro sem documento falso. O feedback não aparece no HT. | Nenhuma lacuna de cobertura. | P0 | Corrigir Portal. |
| DOC-NET-05 | COVERED | CORE-3 responde 415 para conteúdo incompatível/corrompido e exige feedback sem persistência. O feedback não aparece. | Nenhuma lacuna de cobertura UI. | P0 | Corrigir Portal. |
| DOC-NET-06 | COVERED | CORE-4 devolve 401 no POST documental exato e comprova mensagem de sessão expirada, ausência de documento/link e controle novamente habilitado. | Nenhuma. | P0 | Reutilizar. |
| DOC-NET-07 | COVERED | O bloco imediato devolve 403 no POST exato, exige ausência de documento, desbloqueio e feedback. A mensagem retornada não aparece no Portal. | Nenhuma lacuna de cobertura; o feedback continua como regressão ativa. | P1 | Corrigir Portal e manter assertion. |
| DOC-NET-08 | COVERED | CORE-3 mantém o POST pendente, exige loading visível e bloqueio do controle até a resposta. | Nenhuma. | P1 | Reutilizar. |
| DOC-NET-09 | COVERED | A recuperação e o retry após request abortada são comprovados pelo mesmo cenário de DOC-NET-01/02. | Nenhuma; risco sobreposto comprovado sem teste adicional. | P0 | Reutilizar. |
| DOC-NET-10 | COVERED | Após HTTP 500 controlado, o loading termina, o slot permanece vazio, o controle libera e o retry contra backend real persiste o PDF correto após reload. | Nenhuma. | P0 | Reutilizar a evidência consumível. |
| DOC-NET-11 | COVERED | Durante request lenta, CORE-3 tenta nova ação, comprova bloqueio e conta somente um POST. | Nenhuma para consequência duplicada frontend. | P0 | Reutilizar. |
| DOC-NET-12 | COVERED | O batch comprova aborto antes do backend sem documento fantasma e sucesso do backend antes do refresh com exatamente um documento persistido. | Nenhuma. | P0 | Reutilizar. |

### 5.6 Campos de texto

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-TEXT-01 | COVERED | CORE-5 submete o nome obrigatório do cônjuge vazio e exige erro funcional no submit. | Nenhuma. | P1 | Manter. |
| CORE-TEXT-02 | COVERED | CORE-5 preenche somente espaços, comprova normalização local para vazio e exige o mesmo erro funcional. | Nenhuma. | P1 | Manter. |
| CORE-TEXT-03 | COVERED | CORE-5 salva e recarrega nome com espaços iniciais. A cobertura detecta a regressão `CORE-REG-006`: os espaços persistem. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-TEXT-04 | COVERED | `CONJ-09` e `RENDA-TERC-06` salvam valores com espaço final e conferem trim. | Nenhuma. | P1 | Reusar. |
| CORE-TEXT-05 | MISSING | Sem múltiplos espaços internos. | Política de normalização. | P2 | Descobrir e documentar. |
| CORE-TEXT-06 | MISSING | `MOTIVO-03` testa duas palavras, não um caractere como mecanismo genérico. | Boundary mínimo. | P2 | Testar componente escolhido. |
| CORE-TEXT-07 | COVERED | CORE-5 usa o limite real `maxlength=40` do nome do cônjuge e aceita exatamente 40 caracteres. | Nenhuma para o mecanismo representativo. | P1 | Manter. |
| CORE-TEXT-08 | COVERED | CORE-5 informa 41 caracteres e comprova truncamento pelo limite real de 40. | Nenhuma para o mecanismo representativo. | P1 | Manter. |
| CORE-TEXT-09 | COVERED | CORE-5 cola, salva e recarrega nome com Unicode acentuado. | Nenhuma. | P2 | Manter. |
| CORE-TEXT-10 | MISSING | Sem emoji. | Unicode não usual. | P2 | Definir campo aplicável. |
| CORE-TEXT-11 | COVERED | O mesmo valor persistido contém apóstrofo e `#`, comprovando caracteres especiais representativos. | Nenhuma. | P2 | Manter. |
| CORE-TEXT-12 | MISSING | Sem quebra de linha. | Campo multiline. | P2 | Aplicar à descrição. |
| CORE-TEXT-13 | COVERED | CORE-5 usa clipboard real para nome Unicode e data, além de paste inválido no monetário. | Nenhuma para mecanismos representativos. | P1 | Manter. |

### 5.7 Campos numéricos

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-NUM-01 | COVERED | `PART-03`, rendas, telefone e simulador comprovam rejeição de letras. | Nenhuma para mecanismo representativo. | P1 | Não duplicar. |
| CORE-NUM-02 | COVERED | CORE-5 cola letras e `#` na renda e comprova que apenas dígitos são convertidos pela máscara monetária. | Nenhuma para o mecanismo representativo. | P1 | Manter. |
| CORE-NUM-03 | COVERED | CORE-5 cola valor com sinal negativo e comprova que o sinal não é aceito pela máscara. | Nenhuma para o mecanismo representativo. | P1 | Manter. |
| CORE-NUM-04 | PARTIAL | CORE-5 comprova que zero é normalizado como `R$ 0,00`. | Não existe regra Core declarada que determine se zero deve ser aceito ou rejeitado pelo domínio. | P1 | Definir contrato antes de ampliar. |
| CORE-NUM-05 | COVERED | CORE-5 cola `123,45` e comprova escala monetária `R$ 123,45`. | Nenhuma. | P1 | Manter. |
| CORE-NUM-06 | MISSING | Sem valor extremo. | Overflow/limite. | P2 | Boundary seguro. |
| CORE-NUM-07 | COVERED | CORE-5 cola zeros à esquerda e comprova normalização para o mesmo valor decimal. | Nenhuma. | P2 | Manter. |
| CORE-NUM-08 | COVERED | CORE-5 usa clipboard com letras, símbolo e dígitos no campo monetário. | Nenhuma. | P1 | Manter. |

### 5.8 Datas

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-DATE-01 | COVERED | CORE-5 cola `29/02/2000`, valida a máscara e comprova ausência de erro de nascimento no submit. | Nenhuma. | P1 | Manter. |
| CORE-DATE-02 | COVERED | CORE-5 submete `29/02/2001`; a ausência de rejeição preserva a regressão `CORE-REG-007`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-DATE-03 | COVERED | CORE-5 submete `31/04/2000`; a ausência de rejeição preserva a regressão `CORE-REG-007`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-DATE-04 | MISSING | Sem 31/06. | Calendário inválido. | P1 | Testar blur/submit. |
| CORE-DATE-05 | MISSING | Sem zeros. | Data impossível. | P1 | Testar validação. |
| CORE-DATE-06 | MISSING | Sem dia 32. | Data impossível. | P1 | Testar validação. |
| CORE-DATE-07 | COVERED | CORE-5 submete data de nascimento futura; a ausência de rejeição preserva a regressão `CORE-REG-007`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-DATE-08 | MISSING | Sem data muito antiga. | Boundary mínimo. | P2 | Definir limite esperado. |
| CORE-DATE-09 | COVERED | CORE-5 submete data parcial; a ausência de rejeição preserva a regressão `CORE-REG-007`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-DATE-10 | COVERED | CORE-5 cola uma data bissexta válida e comprova a máscara `dd/mm/aaaa`. | Nenhuma. | P1 | Manter. |
| CORE-DATE-11 | MISSING | Campos são limpos em teardown sem confirmar remoção persistida. | Limpeza após reload. | P1 | Massa dedicada. |

### 5.9 CEP e preenchimento de endereço

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-CEP-01 | COVERED | `GAR-PF-05` e `GAR-PJ-04` preenchem CEP válido e validam endereço, bairro, UF e município. | Nenhuma. | P1 | Reusar. |
| CORE-CEP-02 | COVERED | CORE-5 consulta CEP inexistente no serviço real (HTTP 200 vazio) e exige feedback. A ausência de mensagem preserva `CORE-REG-008`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-CEP-03 | COVERED | CORE-5 informa CEP incompleto, comprova máscara parcial e ausência de request prematura. | Nenhuma. | P1 | Manter. |
| CORE-CEP-04 | COVERED | CORE-5 informa letras e comprova rejeição pela máscara sem consulta. | Nenhuma. | P1 | Manter. |
| CORE-CEP-05 | COVERED | CORE-5 controla HTTP 500 exclusivamente no endpoint real de CEP e exige recuperação/feedback. A ausência de mensagem também integra `CORE-REG-008`. | Nenhuma lacuna de cobertura UI. | P0 | Corrigir Portal. |
| CORE-CEP-06 | COVERED | CORE-5 mantém a primeira consulta pendente e comprova que a tela permanece interativa durante a latência. | Nenhuma para o mecanismo representativo. | P1 | Manter. |
| CORE-CEP-07 | COVERED | CORE-5 troca CEP A por B durante consulta pendente e exige os dados de B. A resposta antiga vence indevidamente (`CORE-REG-009`). | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertions. |
| CORE-CEP-08 | COVERED | O cenário A→B valida endereço e bairro e detecta resíduos completos de A após a resposta atrasada. | Nenhuma lacuna de cobertura; corrigir o Portal. | P0 | Manter assertions. |
| CORE-CEP-09 | COVERED | CORE-5 preenche o número antes da resolução e detecta que a resposta atrasada o apaga. | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-CEP-10 | COVERED | O bloco imediato consulta CEP real, salva endereço com complemento vazio, recarrega, reabre o Garantidor e comprova os mesmos dados antes de restaurar a massa. | Nenhuma. | P2 | Reutilizar; não duplicar. |
| CORE-CEP-11 | COVERED | CORE-5 retorna somente logradouro e comprova que bairro/UF ausentes não reutilizam valores anteriores. | Nenhuma. | P1 | Manter. |
| CORE-CEP-12 | COVERED | CORE-5 controla A lento e B mais novo; a resposta de A sobrescreve B e preserva `CORE-REG-009`. | Nenhuma lacuna de cobertura; corrigir o Portal. | P0 | Manter assertions. |

### 5.10 Sessão, autenticação e autorização

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| SESSION-01 | COVERED | CORE-4 abre deep link real em contexto sem cookies, comprova `auth/me` não autenticado e ausência de heading/dados protegidos. | Nenhuma para negação de conteúdo. | P0 | Reutilizar. |
| SESSION-02 | COVERED | Smoke abre proposta autorizada com storage state válido. | Nenhuma. | P0 | Reusar. |
| SESSION-03 | COVERED | CORE-4 digita marcador, recebe 401 no save e comprova que o conteúdo protegido é invalidado sem sucesso falso. | Nenhuma. | P0 | Reutilizar CORE-SAVE-10. |
| SESSION-04 | COVERED | CORE-4 seleciona arquivo e recebe 401 controlado sem criar consequência documental. | Nenhuma. | P0 | Reutilizar DOC-NET-06. |
| SESSION-05 | COVERED | CORE-4 comprova reautenticação e ausência do marcador no backend depois do 401 de save. | Nenhuma. | P0 | Reutilizar. |
| SESSION-06 | COVERED | CORE-4 executa refresh autenticado e valida `auth/me`, heading da operação e proponente corretos depois do reload. | Nenhuma. | P1 | Reutilizar. |
| SESSION-07 | NOT_APPLICABLE | A superfície protegida real da EsteiraHT não expõe botão nem link `Sair`; o texto visto no simulador não pertence à página protegida de propostas. | Capacidade de logout ausente na interface auditada. | P0 | Reavaliar se logout for introduzido. |
| SESSION-08 | NOT_APPLICABLE | Sem uma ação de logout na superfície protegida, não existe fluxo de Voltar após logout. | Capacidade dependente ausente. | P0 | Reavaliar junto de SESSION-07. |
| SESSION-09 | COVERED | CORE-4B confirma acesso da sessão A à própria operação e tenta uma operação B real, existente e de ownership diferente; o backend oculta B com HTTP 404 e nenhum conteúdo protegido é apresentado. | Nenhuma para a sondagem A→B read-only. | P0 | Reutilizar a massa de segurança sem mutá-la. |
| SESSION-10 | COVERED | CORE-4B altera diretamente a operação da URL para B, observa o GET exato de B no backend e comprova ausência de proponente, formulário, documentos e campos funcionais no DOM. | Nenhuma para troca manual A→B. | P0 | Reutilizar. |
| SESSION-11 | COVERED | `PROP-05`/`TIMELINE-04` abrem operações diferentes e validam a jornada/heading correspondente. | Nenhuma para seleção correta. | P1 | Não duplicar. |
| SESSION-12 | BLOCKED | CORE-4B comprova A→B, mas o risco definido exige matriz bidirecional A→B e B→A. Não existe autenticação controlada da identidade B nem lifecycle seguro de troca. | Segunda identidade controlada e operação própria para validar B→A. | P0 | Provisionar sessão B antes. |

### 5.11 Concorrência e ações duplicadas

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-CONC-01 | COVERED | CORE-2 aplica duplo clique na transição que salva o rascunho e comprova uma única request lógica. | Nenhuma para o save automático representativo. | P0 | Reutilizar; não duplicar. |
| CORE-CONC-02 | MISSING | Sem duplo clique em Continuar. | Consequência única. | P0 | Unificar com NAV-05. |
| CORE-CONC-03 | MISSING | Preparadores clicam uma vez em Confirmar. | Dupla finalização. | P0 | Massa consumível exclusiva. |
| CORE-CONC-04 | COVERED | CORE-3 tenta nova ação durante upload lento e comprova uma única consequência de rede. | Nenhuma. | P0 | Reutilizar DOC-NET-11. |
| CORE-CONC-05 | MISSING | Sem Enter repetido. | Submit repetido. | P1 | Escolher formulário representativo. |
| CORE-CONC-06 | PARTIAL | CORE-2 salva marcadores distintos em duas páginas da mesma proposta, com respostas controladas fora de ordem, e preserva cada estado local. | Não comprova resolução persistente do conflito no backend. | P0 | Definir política server-side antes de testar persistência real concorrente. |
| CORE-CONC-07 | COVERED | Seleções rápidas em dois controles geram fila serial e destinos distintos, sem cruzar operação, slot ou conteúdo. | Nenhuma para o mecanismo suportado pela UI. | P1 | Coberto junto de DOC-CORE-20. |
| CORE-CONC-08 | COVERED | CORE-2 libera deterministicamente a segunda resposta antes da primeira e comprova que cada página mantém seu marcador correto. | Nenhuma para consistência frontend com respostas isoladas. | P0 | Reutilizar; não duplicar. |
| CORE-CONC-09 | COVERED | Revisão formal confirmou consequências lógicas únicas em dois mecanismos: CORE-2 conta um único PUT sob duplo clique e CORE-3 conta um único POST sob tentativa documental duplicada. | Nenhuma para idempotência frontend representativa; finalização consumível permanece separada. | P0 | Reclassificado sem novo teste. |

### 5.12 Loading, empty state e estados intermediários

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-STATE-01 | COVERED | CORE-2 mantém o save pendente e exige o status `Salvando` visível antes da resposta. | Nenhuma. | P1 | Reutilizar; não duplicar. |
| CORE-STATE-02 | COVERED | CORE-2 comprova a transição `Salvando` → `Rascunho salvo` somente depois do HTTP 200 controlado. | Nenhuma. | P1 | Reutilizar; não duplicar. |
| CORE-STATE-03 | COVERED | CORE-2 aborta a request por timeout e exige que `Salvando` desapareça. | Nenhuma para encerramento do loading; HTTP 500 silencioso segue como regressão ativa separada. | P0 | Reutilizar; não duplicar. |
| CORE-STATE-04 | COVERED | CORE-3 mantém o upload pendente e comprova que o controle de envio não aceita uma segunda ação. | Nenhuma para controle documental. | P0 | Reutilizar. |
| CORE-STATE-05 | COVERED | CORE-2 dispara duplo clique sob request lenta e exige uma única consequência de rede. | Nenhuma para bloqueio lógico representativo. | P0 | Reutilizar; não duplicar. |
| CORE-STATE-06 | COVERED | CORE-2 comprova que o status de loading não permanece após timeout e que a interface aceita retry. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-STATE-07 | BLOCKED | Não existe CPF/massa oficial declarada sem propostas. | Identidade de empty state. | P1 | Provisionar usuário sem dados. |
| CORE-STATE-08 | COVERED | CORE-2 executa nova tentativa após timeout controlado e obtém sucesso. | Nenhuma para timeout; HTTP 500 sem feedback permanece regressão ativa. | P0 | Reutilizar; não duplicar. |
| CORE-STATE-09 | COVERED | CORE-2 conta duas requests distintas: tentativa abortada e retry bem-sucedido. | Nenhuma. | P0 | Reutilizar; não duplicar. |
| CORE-STATE-10 | COVERED | CORE-4 atrasa a resposta real de A, abre B e comprova que URL, heading, proponente e etapa permanecem de B após A concluir/cancelar. | Nenhuma. | P0 | Reutilizar com ISOLATION-09. |

### 5.13 Responsividade e mobile

O CORE-6 adiciona o projeto isolado `core-mobile`, baseado no descriptor nativo **Pixel 7** do Playwright (Chromium mobile, touch e viewport `412x839`). Os projetos desktop mantêm `Desktop Chrome` e viewport `1440x900`. A escolha representa um aparelho Android contemporâneo com largura pequena sem introduzir emulação customizada.

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-MOBILE-01 | COVERED | CORE-6 abre a listagem e a proposta real no Pixel 7, validando heading e conteúdo autenticado. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-02 | COVERED | CORE-6 abre a seção responsiva `Sobre Você` e usa campo e combobox representativos. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-03 | COVERED | CORE-6 mede o diálogo de validação e exige todas as bordas dentro de `412x839`. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-04 | COVERED | CORE-6 fecha o modal por Escape e comprova retorno de foco ao gatilho. | Nenhuma para o modal representativo. | P1 | Manter. |
| CORE-MOBILE-05 | COVERED | CORE-6 alcança por Tab o controle real de upload documental e comprova nome acessível e ausência de sobreposição. | Nenhuma para o controle representativo. | P1 | Manter. |
| CORE-MOBILE-06 | COVERED | CORE-6 abre o combobox de profissão e exige listbox/opção visíveis dentro da viewport. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-07 | COVERED | CORE-6 usa a ação `Sobre Você` do resumo de erro para exigir revelação do primeiro campo ausente. A etapa não é aberta no Portal atual (`CORE-REG-012`). | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-MOBILE-08 | COVERED | CORE-6 rola até `Confirmar`, mede sua posição e comprova que o centro recebe interação. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-09 | MISSING | Sem mobile. | Campo de data. | P2 | Caso representativo. |
| CORE-MOBILE-10 | COVERED | CORE-6 comprova `inputmode=numeric` no campo monetário representativo. | Nenhuma para o mecanismo de teclado declarado. | P2 | Manter. |
| CORE-MOBILE-11 | COVERED | CORE-6 valida as quatro seções responsivas de cadastro expostas como botões, sem depender das fases C6. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-12 | COVERED | CORE-6 abre a jornada documental real, exige lista não vazia e controle de upload utilizável. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-13 | COVERED | CORE-6 mede `scrollWidth <= clientWidth` no documento e no body nas jornadas de cadastro e documentos. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-14 | COVERED | CORE-6 usa `elementFromPoint` no centro da ação principal e do upload para detectar cobertura por elemento fixo. | Nenhuma. | P1 | Manter. |
| CORE-MOBILE-15 | COVERED | CORE-6 submete cadastro inválido e exige resumo de campos obrigatórios visível dentro do modal mobile. | Nenhuma. | P1 | Manter. |

### 5.14 Acessibilidade básica

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-A11Y-01 | COVERED | CORE-6 percorre controles reais por Tab e comprova múltiplos destinos focáveis sem cair no body. | Nenhuma para a jornada curta representativa. | P2 | Manter. |
| CORE-A11Y-02 | COVERED | CORE-6 exige `:focus-visible` e indicador computado no primeiro controle alcançado por Tab. O indicador não existe no Portal atual (`CORE-REG-011`). | Nenhuma lacuna de cobertura; corrigir o Portal. | P2 | Manter assertion. |
| CORE-A11Y-03 | COVERED | CORE-6 comprova foco inicial dentro do diálogo e retorno ao botão `Confirmar` após fechamento. | Nenhuma para o modal representativo. | P2 | Manter. |
| CORE-A11Y-04 | COVERED | CORE-6 fecha por Escape o diálogo de revisão, onde esse comportamento é suportado pelo componente. | Nenhuma. | P2 | Manter. |
| CORE-A11Y-05 | COVERED | Helpers de required/optional localizam `label[for=id]` em vários módulos. | Nenhuma para associação representativa. | P2 | Reusar. |
| CORE-A11Y-06 | COVERED | CPF inválido usa `aria-invalid`/`role=alert`; vários campos verificam `aria-invalid`. | Nenhuma para erro representativo. | P2 | Reusar. |
| CORE-A11Y-07 | COVERED | A suíte depende de `getByRole(button, {name})` para ações principais em todas as jornadas. | Nenhuma para amostra representativa. | P2 | Não duplicar todos os botões. |
| CORE-A11Y-08 | COVERED | CORE-6 aciona o link de etapa oferecido pelo próprio resumo para exigir que o primeiro erro seja revelado. A seção permanece fechada (`CORE-REG-012`). | Nenhuma lacuna de cobertura; corrigir o Portal. | P1 | Manter assertion. |
| CORE-A11Y-09 | COVERED | CORE-6 mantém a associação `label[for]` e exige `required` ou `aria-required` no campo visualmente obrigatório. A semântica está ausente (`CORE-REG-010`). | Nenhuma lacuna de cobertura; corrigir o Portal. | P2 | Manter assertion. |
| CORE-A11Y-10 | COVERED | CORE-6 combina percurso curto por Tab, Escape no combobox/modal e foco posterior utilizável, sem aprisionamento. | Nenhuma para o percurso representativo. | P2 | Manter. |

### 5.15 Consistência frontend → API

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-API-01 | COVERED | Preparações enviam textos e validações AEJS conferem nomes/descrições refletidos. | Nenhuma para risco representativo. | P0 | Registrar que cobertura é end-to-end. |
| CORE-API-02 | COVERED | Simulador envia imóvel, financiamento e renda; spec confere valores formatados no SCCI. | Nenhuma para escala monetária. | P0 | Reusar. |
| CORE-API-03 | COVERED | Selects do simulador/preparações são conferidos semanticamente no SCCI. | Não inspeciona payload bruto, mas prova consequência final. | P0 | Não duplicar salvo diagnóstico de payload. |
| CORE-API-04 | COVERED | Preparação PJ marca autorizações/flags e validação AEJS confere estado marcado. | Nenhuma para true representativo. | P0 | Reusar. |
| CORE-API-05 | COVERED | CORE-5 marca/desmarca composição de renda, captura `PESSOA.IN_COMPOE_RENDA: "F"` no PUT real e confirma “Não” após reload. | Nenhuma. | P0 | Manter. |
| CORE-API-06 | COVERED | Nascimento digitado no simulador é validado formatado no SCCI. | Nenhuma. | P1 | Reusar. |
| CORE-API-07 | COVERED | Celular do simulador é validado por DDD/número no SCCI. | Nenhuma. | P1 | Reusar. |
| CORE-API-08 | COVERED | CORE-5 persiste marcador temporário, limpa o campo, comprova valor vazio e ausência do marcador no payload real e confirma vazio após reload. | Nenhuma. | P1 | Manter. |
| CORE-API-09 | COVERED | Cenários PJ/PF alteram dados da proposta e validam os valores novos no AEJS. | Nenhuma para alteração representativa. | P0 | Reusar. |
| CORE-API-10 | COVERED | O bloco restaurável captura PUTs reais e exatos de CAD A/B, exige o marcador exclusivo de cada proposta no payload correspondente e rejeita contaminação cruzada. O teardown restaura ambas e comprova os snapshots por nova leitura. | Nenhuma para payload representativo A/B. | P0 | Manter restauração obrigatória e falha agregada. |

### 5.16 Isolamento entre propostas e usuários

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| ISOLATION-01 | COVERED | CORE-4 alterna duas operações reais do mesmo CPF e exige operação, nome exato do proponente e estado correspondentes em cada abertura. | Nenhuma para identidade representativa A/B. | P0 | Reutilizar. |
| ISOLATION-02 | COVERED | DOC A e DOC B são alternadas, recarregadas e reabertas em nova sessão; nomes e digests de cada operação nunca aparecem na outra. | Nenhuma. | P0 | Não reutilizar as massas consumidas. |
| ISOLATION-03 | COVERED | Os proponentes `Playwright BASE` e `Playwright BASE 02` são comparados de forma exata dentro das respectivas propostas. | Nenhuma para participante principal representativo. | P0 | Reutilizar. |
| ISOLATION-04 | COVERED | Duas páginas autenticadas abrem CAD A/B, selecionam seções distintas e alternam leituras sem compartilhar a seção ativa nem a identidade da proposta. | Nenhuma para estado de seção/aba representativo A/B. | P1 | Manter o cenário read-only. |
| ISOLATION-05 | BLOCKED | `TIMELINE-09` testa persistência do alerta na mesma proposta, mas o ambiente não oferece reset legítimo e comprovável do estado “Não mostrar novamente”. | Falta lifecycle seguro para alerta A/B. | P1 | Não automatizar até existir reset legítimo ou par descartável próprio. |
| ISOLATION-06 | COVERED | Após abrir A e B, CORE-4 exige identidade/estado de B e ausência do heading de A, inclusive depois da resposta atrasada. | Nenhuma. | P0 | Reutilizar CORE-STATE-10. |
| ISOLATION-07 | BLOCKED | Não há fixture de duas identidades autorizadas e lifecycle de troca de usuário. | Usuários A/B controlados. | P0 | Preparar segurança/identidades. |
| ISOLATION-08 | COVERED | Uma seleção pendente de DOC A é abortada antes do backend; nenhuma request de DOC B é gerada e nenhuma das operações persiste o arquivo após nova leitura. | Nenhuma. | P0 | Reutilizar a evidência D1. |
| ISOLATION-09 | COVERED | CORE-4 segura somente o GET real e exato de A, navega para B e libera A sem permitir atualização cruzada. | Nenhuma para race frontend representativa. | P0 | Reutilizar. |

### 5.17 Jornadas Portal Core

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-JOURNEY-01 | PARTIAL | CORE-1 implementa save, reload e reabertura na mesma massa restaurável. | A execução não alcança a reabertura enquanto a persistência inicial falhar. | P0 | Reexecutar após corrigir a persistência no Portal. |
| CORE-JOURNEY-02 | MISSING | Nenhum cadastro sai, autentica novamente e continua. | Retomada entre sessões. | P0 | Massa dedicada. |
| CORE-JOURNEY-03 | COVERED | Upload válido, reload, leitura real dos bytes, renovação de sessão e nova leitura preservam o documento e seu destino. | Nenhuma. | P0 | Coberto junto de DOC-CORE-26/27. |
| CORE-JOURNEY-04 | COVERED | CORE-1 consolida HTTP 500, ausência de sucesso falso, preservação local, retry real e reload. Detecta ausência de feedback e perda do valor após o retry no HT. | Nenhuma lacuna de cobertura; existem regressões funcionais ativas. | P0 | Corrigir o Portal e manter a jornada composta. |
| CORE-JOURNEY-05 | COVERED | O bloco restaurável persiste marcadores distintos em CAD A/B, alterna novas leituras para comprovar ausência cruzada e restaura ambos os snapshots no final. | Nenhuma para persistência representativa A/B. | P0 | Manter o teardown obrigatório. |

## 6. Erros de frontend — requisito sem ID no plano

A fixture automática `page-errors.fixture.ts` observa todas as páginas do contexto e falha o teste por `pageerror` inesperado, anexando diagnóstico sanitizado. O React #418 pode ser colocado em quarentena por configuração explícita.

Classificação: **PARTIAL**.

Pontos cobertos:

- `pageerror` em páginas existentes e novas;
- anexos com mensagem, stack e URL sanitizadas;
- falha do teste para erro inesperado;
- quarentena explícita e restrita ao React #418.

Lacunas:

- não observa `console.error` classificado;
- não há taxonomia específica para hydration, `ChunkLoadError`, `undefined/null` ou `is not a function`;
- não há teste autocontido que prove que o mecanismo captura cada classe crítica;
- o comportamento depende de todas as specs, não de um contrato Core dedicado.

Recomendação: manter a fixture e criar poucos testes do próprio mecanismo antes de ampliar listeners. Não adicionar allowlist genérica.

## 7. Duplicidades e sobreposições reais

Os seguintes casos propostos não devem gerar specs independentes quando forem implementados:

| Risco único | IDs sobrepostos | Recomendação |
|---|---|---|
| Duplo clique em continuar | `CORE-NAV-05`, `CORE-CONC-02` | Um único teste com consequência lógica. |
| Duas abas na mesma proposta | `CORE-NAV-09`, `CORE-CONC-06` | Um cenário de concorrência. |
| Sessão expira durante save | `CORE-NAV-10`, `CORE-SAVE-10`, `SESSION-03`, `SESSION-05` | Uma jornada Core com 401 controlado. |
| Falha 500 e falsa confirmação | `CORE-SAVE-09`, `CORE-SAVE-14`, `CORE-SAVE-15`, `CORE-SAVE-16`, `CORE-SAVE-17`, `CORE-JOURNEY-04` | Uma matriz falha→retry com várias assertions. |
| Persistência documental | `DOC-CORE-26`, `DOC-CORE-27`, `CORE-JOURNEY-03` | Um cenário com refresh; novo login pode ser extensão separada. |
| Duplo upload | `DOC-NET-11`, `CORE-CONC-04` | Um único teste. |
| Upload simultâneo | `DOC-CORE-20`, `CORE-CONC-07` | Um único teste, se suportado. |
| CEP fora de ordem | `CORE-CEP-07`, `CORE-CEP-08`, `CORE-CEP-12`, `CORE-CONC-08` | Um cenário A lento → B rápido. |
| Autorização/IDOR | `SESSION-09`, `SESSION-10`, `SESSION-12` | A sondagem real A→B cobre os dois primeiros; a matriz bidirecional de `SESSION-12` permanece separada e bloqueada. |
| Cache entre propostas | `CORE-STATE-10`, `CORE-API-10`, `ISOLATION-01`, `ISOLATION-06`, `CORE-JOURNEY-05` | Uma jornada de isolamento com UI e request. |
| Required/erro acessível | `CORE-TEXT-01`, `CORE-A11Y-06`, `CORE-A11Y-08`, `CORE-A11Y-09`, `CORE-MOBILE-07`, `CORE-MOBILE-15` | Uma amostra desktop e uma mobile, sem repetir em todos os campos. |

Coberturas existentes também se repetem legitimamente:

- rejeição de letras em renda aparece em participante, cônjuge, terceiro e simulador; para Core, uma amostra é suficiente;
- trim final aparece em cônjuge e terceiro; não criar terceiro teste Core idêntico;
- CEP válido aparece em garantidor PF e PJ; ambos cobrem o mesmo mecanismo;
- labels obrigatórias são verificadas em vários módulos; acessibilidade Core deve selecionar apenas uma amostra;
- reflexos no SCCI já comprovam vários riscos de serialização frontend/backend.

## 8. Casos parcialmente cobertos

| ID | O que existe | O que falta para `COVERED` |
|---|---|---|
| CORE-NAV-03 | Reabertura pela listagem implementada no cenário CORE-1. | Corrigir a persistência anterior para alcançar e validar a etapa. |
| CORE-NAV-09 | Duas páginas mantêm estados locais distintos com respostas fora de ordem. | Definir e comprovar a política de conflito persistente do backend. |
| CORE-SAVE-04 | Remoção, reload e restauração implementados no cenário CORE-1. | Corrigir a persistência anterior para alcançar e validar a etapa. |
| CORE-NUM-04 | O campo monetário normaliza zero como `R$ 0,00`. | Contrato de domínio que determine se zero deve ser aceito ou rejeitado. |
| CORE-CONC-06 | Save concorrente foi exercitado com rede controlada. | Comprovar a pós-condição server-side sem consumir uma massa sem contrato de restauração concorrente. |
| CORE-A11Y-09 | Asterisco em label associado. | Semântica acessível de obrigatório. |
| CORE-JOURNEY-01 | Save, reload e reabertura implementados em uma jornada curta. | Corrigir a perda no primeiro reload para alcançar a reabertura. |
| CORE-JOURNEY-05 | Operação, proponente, estado e resposta atrasada são isolados entre A/B. | Salvar marcador real em A e comprovar ausência persistente em B. |

### Casos dependentes de contrato de domínio

| IDs | Comportamento comprovado | Decisão ainda necessária |
|---|---|---|
| `DOC-CORE-28` a `DOC-CORE-32` | O backend real aceitou, persistiu e devolveu os mesmos bytes de PNG/PDF/JPEG com extensão ou MIME incompatível e também de PDF corrompido. | Definir se a plataforma deve rejeitar por assinatura, MIME real, coerência de extensão ou integridade; sem esse contrato, a aceitação observada não é classificada como regressão nem como cobertura funcional aprovada. |

## 9. Casos bloqueados

| IDs | Bloqueio | Necessário para desbloquear |
|---|---|---|
| `SESSION-12` | A sondagem real A→B está coberta, mas falta autenticação segura como B para executar a direção inversa B→A. | Segunda identidade controlada, proposta própria e lifecycle de autenticação/limpeza aprovado. |
| `CORE-STATE-07` | Não existe CPF oficial sem propostas. | Identidade estável de empty state ou API/mock Core aprovado. |
| `ISOLATION-07` | Não existe lifecycle oficial de troca entre dois usuários no mesmo teste. | Compor fixture A/B e limpeza de storage/cache entre sessões. |

Indisponibilidade temporária de VPN, Portal ou SCCI não altera os 20 casos `MISSING` para `BLOCKED`; ela apenas impede execução naquele momento.

## 10. Casos não aplicáveis ao Portal atual

| IDs | Motivo |
|---|---|
| `DOC-CORE-22` | A tela documental atual não oferece remoção; oferece escolher, reenviar, visualizar e enviar para análise. |
| `DOC-CORE-25` | Não existe ação dedicada de download; existe visualização do arquivo. |
| `SESSION-07` | A superfície protegida auditada não possui botão nem link de logout. |
| `SESSION-08` | Sem logout na superfície protegida, não existe jornada de Voltar após logout. |

Esses casos devem ser reavaliados quando a capacidade aparecer. Não devem virar testes artificiais por chamada direta de endpoint sem UI/contrato aprovado.

## 11. Validação do comportamento atual

Esta auditoria não assumiu que o contrato C6 representa o Portal Core. Evidências recentes da EsteiraHT foram usadas para separar diferenças de tenant de riscos do produto:

- fases históricas C6 não apareceram na Esteira;
- domínios de profissão e uso do imóvel diferiram;
- estados de massas reprovada/cancelada divergiram;
- o simulador → SCCI passou com valores da Esteira Digital;
- a suíte já detectou proposta expirada há mais de 30 dias ainda visível;
- falhas recentes de integração por `504`/timeout foram classificadas como ambiente, não como cobertura CORE.

No CORE-3, as únicas interações documentais novas usaram falhas controladas no endpoint exato ou rejeição frontend. Nenhum upload foi confirmado como persistido e nenhuma massa documental foi consumida.

O CORE-4A foi executado em **EsteiraHT** com duas massas já existentes e pertencentes ao mesmo CPF autorizado. Nenhuma proposta nova foi criada:

| Operação | Finalidade no CORE-4A | Ambiente | Estado inicial | Lifecycle |
|---|---|---|---|---|
| `000000568` | Sessão válida, 401 de rascunho e proposta A do isolamento. | EsteiraHT | Cadastro | Reutilizável; o 401 controlado impede persistência. |
| `000000581` | 401 de upload e proposta B do isolamento. | EsteiraHT | Documentos | Reutilizável; nenhum upload é persistido. |

As operações A/B acima comprovam isolamento dentro de uma mesma identidade. Separadamente, o CORE-4B usa a operação `000000573` como massa estrangeira read-only: o catálogo local tipado comprova que ela existe, está em Cadastro e possui ownership diferente do CPF autenticado, sem versionar ou registrar o dado pessoal. A sessão A (`000000568`) acessa sua própria proposta, não encontra B na listagem e recebe HTTP 404 no GET exato de B ao trocar a URL. Como B é comprovadamente real, o 404 é o mecanismo de ocultação do backend, não evidência de operação inexistente. Nenhum nome, participante, formulário, documento ou campo funcional de B é exposto no DOM.

O CORE-5 também foi executado em **EsteiraHT**, reutilizando somente a operação `000000568`, em Cadastro. A massa é restaurada ao estado inicial pelos próprios cenários e permaneceu reutilizável; nenhuma proposta foi provisionada ou consumida. Cinco cenários compostos cobrem mecanismos representativos de texto, número, data, CEP e serialização frontend → API. A rede foi controlada apenas para falha, latência, resposta incompleta e ordem de respostas do endpoint real `GET /api/portal/cep`; as provas de `false`, remoção de valor e reload usaram o `PUT /cadastro` real.

O CORE-6 foi executado em **EsteiraHT** no projeto isolado `core-mobile`, reutilizando as operações `000000568` (Cadastro) e `000000581` (Documentos). Ambas permaneceram read-only e reutilizáveis; nenhuma proposta foi provisionada, alterada ou consumida. Três cenários compostos cobrem layout responsivo, cadastro, modal, combobox, teclado e documentos. As assertions preservam as regressões `CORE-REG-010` a `CORE-REG-012`.

O bloco imediato pós-CORE-6 também foi executado em **EsteiraHT** sobre as mesmas massas. Cinco cenários compostos acrescentam continuidade de navegação, HTTP 403 em save/upload, nomes e seleção documental, quedas de transporte e persistência de endereço sem complemento. Os fluxos documentais usam somente falha controlada ou abort e não persistem arquivos; o endereço usa backend real, reload e restauração. `CORE-API-10` permaneceu `MISSING`: existe apenas uma proposta do usuário em Cadastro e a segunda massa está em Documentos, portanto não há dois PUTs comparáveis sem provisionar massas restauráveis.

O batch documental consumível foi executado em **C6 HT**, serialmente, com um worker e sem retries. O preflight comprovou cinco slots vazios em DOC A e DOC B antes do primeiro upload. D1–D5 passaram; foram observados 11 uploads aceitos e três tentativas rejeitadas/interrompidas de forma controlada. DOC A terminou com quatro slots ocupados e um vazio; DOC B, com cinco ocupados. Ambas são `SEEDABLE_CONSUMABLE` em estado final `CONSUMED`. CAD A/B e FINAL não foram acessadas. A leitura posterior confirmou operação, slot, nome e digest; não houve cruzamento A/B. Os cinco conteúdos incompatíveis/corrompidos foram aceitos e persistidos, mas permanecem `REQUIRES_DOMAIN_CONTRACT`, pois o plano oficial não declara rejeição por assinatura, MIME ou integridade.

## 12. Plano recomendado de implementação

O plano abaixo reduz duplicidade e pode ser interrompido ao final de qualquer etapa.

### CORE-1 — Persistência e falsa confirmação de sucesso

**Implementado.** As assertions preservam as regressões `CORE-REG-001` e `CORE-REG-002`.

Prioridade máxima:

1. save válido/partial com reabertura;
2. HTTP 500 ao salvar;
3. preservar inputs após falha;
4. não exibir sucesso;
5. retry falha→sucesso;
6. refresh/reabertura após save.

Resultado esperado: cobrir uma única jornada que resolva vários IDs SAVE/NAV/JOURNEY sem criar uma spec por ID.

### CORE-2 — Concorrência e estados intermediários

**Implementado.** Quatro cenários compostos cobrem consequência lógica única, request lenta, timeout, refresh e respostas fora de ordem.

1. duplo clique em Continuar/Salvar;
2. botão/loading durante request lenta;
3. duas abas na mesma proposta;
4. resposta fora de ordem;
5. refresh durante carregamento.

Resultado esperado: provar consequência lógica única e estado final consistente.

### CORE-3 — Documentos

**Implementado até o limite seguro e depois complementado pelo batch consumível aprovado.** Foram cobertos boundaries configuráveis, arquivos inválidos, falhas 413/415/500, loading, desbloqueio, retry real, reenvio, substituição, fila, refresh, nova sessão e isolamento A/B. Os cinco casos de conteúdo/extensão/MIME/integridade permanecem dependentes de contrato de domínio, não de nova execução.

1. parametrizar limite sem remover o teste tenant de 10 MB;
2. limite−1/exato/+1;
3. extensão/conteúdo inválido;
4. falha 413/415/500 e retry;
5. substituição;
6. refresh e novo login.

Pré-condição: massa documental restaurável e arquivos pequenos gerados deterministicamente.

### CORE-4 — Sessão, autorização e isolamento

**CORE-4A e a parcela comprovável do CORE-4B implementados.** Cinco cenários compostos cobrem deep link anônimo, refresh autenticado, 401 no save/upload e isolamento A/B com resposta atrasada. Um cenário adicional comprova autorização horizontal A→B contra uma operação real de outro ownership, cobrindo `SESSION-09` e `SESSION-10`. `SESSION-12` permanece bloqueado pela ausência da sessão B necessária à matriz bidirecional; `ISOLATION-07` continua bloqueado porque exige troca real de identidade e limpeza de estado.

1. deep link sem sessão;
2. identidades A/B controladas;
3. IDOR server-side;
4. proposta A → proposta B sem cache antigo;
5. sessão expirada durante save/upload.

Pré-condição restante: disponibilizar uma segunda identidade controlada e lifecycle seguro de troca somente para os riscos bidirecionais ainda bloqueados.

### CORE-5 — Campos essenciais, CEP e contrato API

**Implementado até os contratos reais comprováveis.** Cinco cenários compostos elevaram texto, número, data, CEP e frontend → API sem criar matriz combinatória. Limite numérico extremo permaneceu ausente porque o campo representativo não declara `max`/`maxlength` nem contrato de API. Zero permaneceu `PARTIAL` por ausência de regra de domínio. As assertions preservam `CORE-REG-006` a `CORE-REG-009`.

1. boundaries representativos de texto/número/data;
2. corrida de CEP A/B;
3. checkbox false e campo limpo no backend;
4. evitar matriz combinatória por input.

### CORE-6 — Mobile e acessibilidade

**Implementado até os contratos representativos comprováveis.** O projeto `core-mobile` usa Pixel 7 sem alterar qualquer viewport desktop. Três cenários compostos cobrem cadastro, modal, combobox, documentos, overflow, sobreposição e percurso curto por teclado. Campo de data mobile permanece `MISSING`; as assertions preservam `CORE-REG-010` a `CORE-REG-012`.

1. cadastro, modal, combobox, documento e erro de submit;
2. foco inicial/retorno, Tab/Escape, labels e foco visível;
3. overflow, bounding boxes e ação principal acessível;
4. revelação do primeiro erro pelo resumo funcional.

### Bloco imediato pós-CORE-6

**Implementado até o limite honesto das massas atuais.** Cinco cenários compostos cobrem 16 IDs antes ausentes/parciais e a revisão formal reclassifica `CORE-CONC-09` sem novo teste. `CORE-NAV-04` continua `MISSING`, pois refresh autenticado não equivale a abrir inicialmente um deep link válido autenticado. `CORE-API-10` exige duas propostas do mesmo usuário em Cadastro, editáveis e restauráveis.

As execuções preservam as regressões de feedback já consolidadas em `CORE-REG-002`, `CORE-REG-004` e `CORE-REG-005`: HTTP 403 e nomes inválidos são tratados sem sucesso falso ou persistência indevida, porém permanecem silenciosos para o usuário.

### Bloco restaurável de Cadastro A/B

**Implementado e reexecutável em C6 HT.** Quatro cenários compostos usam exclusivamente o par CAD A/B qualificado e cobrem `CORE-NAV-04`, `CORE-API-10`, `ISOLATION-04` e `CORE-JOURNEY-05`. O bloco foi executado duas vezes consecutivas com sucesso. As mutações persistem marcadores distintos, capturam PUTs reais por operação e restauram os snapshots em ordem B → A; em seguida, novas leituras comprovam a restauração exata de ambas as massas.

`ISOLATION-05` permanece `BLOCKED`: não existe mecanismo legítimo e verificável para restaurar o alerta “Não mostrar novamente”. As massas documentais e a seed de pré-finalização não foram abertas, alteradas ou consumidas neste bloco. Nenhuma regressão Core nova foi registrada.

## 13. Critérios para a próxima decisão

Para encerrar a decisão documental restante do CORE-3, o produto deve formalizar a política de assinatura/magic bytes, MIME real, coerência com extensão e integridade mínima de PDF. Não é necessário repetir o batch: frontend, resposta real, persistência e bytes já foram comprovados.

Não é necessário criar um teste por cada um dos 20 gaps ainda ausentes. Muitos IDs devem continuar sendo cobertos por cenários compostos pequenos, sem confundir rede controlada com persistência real ou duas propostas do mesmo CPF com autorização A/B.

## 14. Parecer final

**A suíte atual ainda não comprova a qualidade Core do Portal de forma suficiente.**

Ela comprova bem caminhos felizes e contratos de cliente/produto e já possui cenários Core para persistência, concorrência, documentos, sessão, isolamento, campos essenciais, mobile e acessibilidade representativa. A validação real de bytes documentais foi executada; a decisão sobre aceitar ou rejeitar conteúdo incompatível/corrompido permanece de domínio. Ainda existem alguns contratos específicos e capacidades bloqueadas por lifecycle seguro, mantendo separados:

- testes Core com rede controlada;
- testes reais do produto imobiliário;
- contratos de tenant C6/Esteira;
- integrações Portal → SCCI/AEJS.

O resultado desta auditoria não recomenda expandir cobertura indiscriminadamente. Recomenda consolidar riscos duplicados em poucos cenários CORE determinísticos e provar pós-condições reais antes de considerar um comportamento coberto.
