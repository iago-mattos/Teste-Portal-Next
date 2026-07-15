# Auditoria de Cobertura Playwright — Portal Core

## 1. Objetivo

Esta auditoria compara os 198 casos propostos em `PORTAL_CORE_PLAYWRIGHT_VALIDATION_PLAN.md` com a suíte Playwright atual. A comparação foi feita pelo risco funcional realmente comprovado, não pelo nome do teste, quantidade de specs ou localização do arquivo.

Nenhum teste novo foi implementado. A auditoria considera:

- 129 testes atualmente coletados em 32 arquivos;
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
| `NOT_APPLICABLE` | A função não existe na interface atual observada ou o Portal atual não oferece essa ação. |
| `BLOCKED` | O caso é válido, mas requer identidade, massa ou capacidade controlada que a arquitetura atual ainda não declara com segurança. |

### Regras críticas aplicadas

- Um toast `Rascunho salvo`, sozinho, não prova persistência no servidor.
- Validar que um campo é obrigatório não equivale a testar vazio, whitespace, limite ou erro após submit.
- Usar `getByRole` não equivale, sozinho, a uma auditoria completa de acessibilidade; ele pode comprovar nome acessível de controles representativos.
- Um fluxo Portal → SCCI pode cobrir o risco frontend → backend de um valor, mesmo estando em uma spec de integração.
- Ter suporte a `Enviar novamente` no Page Object não cobre substituição enquanto nenhuma spec executar e validar a consequência.
- Todos os casos com rede controlada continuam `MISSING`: a suíte atual não usa `page.route()` nem mecanismo equivalente para simular 401, 403, 409, 413, 415, 500, timeout ou respostas fora de ordem.

## 3. Resumo executivo

| Status | Quantidade | Percentual |
|---|---:|---:|
| `COVERED` | 20 | 10,1% |
| `PARTIAL` | 10 | 5,1% |
| `MISSING` | 161 | 81,3% |
| `NOT_APPLICABLE` | 2 | 1,0% |
| `BLOCKED` | 5 | 2,5% |
| **Total** | **198** | **100%** |

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
- ações duplicadas e concorrência entre abas;
- isolamento entre propostas e usuários;
- autorização server-side/IDOR;
- falhas e interrupções de upload;
- consistência diante de respostas atrasadas ou fora de ordem;
- recuperação, retry e loading após erro.

O número de testes atuais não deve ser usado como indicador dessa cobertura. A maior parte dos 129 testes valida contratos funcionais felizes e específicos, enquanto 81,3% dos riscos CORE propostos permanecem sem teste equivalente.

## 4. Cobertura atual por grupo

| Grupo | Covered | Partial | Missing | N/A | Blocked | Total |
|---|---:|---:|---:|---:|---:|---:|
| Navegação e persistência | 1 | 0 | 9 | 0 | 0 | 10 |
| Salvamento e perda de dados | 1 | 3 | 13 | 0 | 0 | 17 |
| Upload e gerenciamento | 3 | 1 | 21 | 2 | 0 | 27 |
| Validação real de arquivo | 0 | 0 | 8 | 0 | 0 | 8 |
| Falhas durante upload | 0 | 0 | 12 | 0 | 0 | 12 |
| Campos de texto | 1 | 0 | 12 | 0 | 0 | 13 |
| Campos numéricos | 1 | 0 | 7 | 0 | 0 | 8 |
| Datas | 0 | 0 | 11 | 0 | 0 | 11 |
| CEP e endereço | 1 | 1 | 10 | 0 | 0 | 12 |
| Sessão e autorização | 2 | 1 | 6 | 0 | 3 | 12 |
| Concorrência | 0 | 0 | 9 | 0 | 0 | 9 |
| Loading e estados intermediários | 0 | 1 | 8 | 0 | 1 | 10 |
| Mobile | 0 | 0 | 15 | 0 | 0 | 15 |
| Acessibilidade | 3 | 1 | 6 | 0 | 0 | 10 |
| Frontend → API | 7 | 0 | 3 | 0 | 0 | 10 |
| Isolamento | 0 | 0 | 8 | 0 | 1 | 9 |
| Jornadas Core | 0 | 2 | 3 | 0 | 0 | 5 |
| **Total** | **20** | **10** | **161** | **2** | **5** | **198** |

## 5. Matriz caso a caso

### 5.1 Navegação e persistência

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-NAV-01 | COVERED | `CONJ-09` e `RENDA-TERC-06` preenchem, trocam de aba, retornam e conferem o valor. | Nenhuma para o mecanismo representativo. | P0 | Reutilizar; não duplicar. |
| CORE-NAV-02 | MISSING | Nenhuma spec salva, recarrega e compara o dado. | Persistência após `reload`. | P0 | Criar cenário dedicado. |
| CORE-NAV-03 | MISSING | Specs reabrem propostas apenas como pré-condição. | Fechar/reabrir depois da própria alteração. | P0 | Massa mutável dedicada. |
| CORE-NAV-04 | MISSING | Há navegação por cards; não há validação de deep link preservando estado. | URL interna direta. | P1 | Cobrir rota protegida válida. |
| CORE-NAV-05 | MISSING | Nenhum duplo clique controlado em Continuar. | Consequência lógica duplicada. | P0 | Instrumentar request/estado. |
| CORE-NAV-06 | MISSING | Navegação entre abas é sequencial. | Troca rápida e estado final. | P1 | Teste de estresse controlado. |
| CORE-NAV-07 | MISSING | `PART-11` apenas confirma ausência do botão Voltar. | Executar `page.goBack()` e retomar. | P1 | Criar caso Core. |
| CORE-NAV-08 | MISSING | Nenhum refresh durante request pendente. | Integridade após interrupção. | P0 | Rede controlada. |
| CORE-NAV-09 | MISSING | Nenhum teste abre a mesma proposta em duas páginas. | Conflito/last-write-wins. | P0 | Duas páginas, massa exclusiva. |
| CORE-NAV-10 | MISSING | Fixture renova sessão antes do uso, não durante edição. | Expiração com rascunho em andamento. | P0 | Simular 401 durante cadastro. |

### 5.2 Salvamento e perda de dados

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-SAVE-01 | COVERED | Preparações PJ/PF/quitado/workflow validam `PUT /cadastro`, corpo de sucesso e conclusão; reflexos são conferidos no SCCI. | Nenhuma para save válido representativo. | P0 | Reusar cobertura existente. |
| CORE-SAVE-02 | PARTIAL | `PART-13` obtém `Rascunho salvo` com cadastro incompleto. | Não recarrega/reabre para provar persistência. | P1 | Acrescentar pós-condição em futuro Core. |
| CORE-SAVE-03 | PARTIAL | `CONJ-09` e cenários de preparação alteram e salvam campos. | Não parte explicitamente de valor persistido e não reabre no Portal. | P0 | Validar antes/depois/reload. |
| CORE-SAVE-04 | PARTIAL | Teardowns limpam campos e navegam para salvar. | Limpeza não é revalidada após reload. | P0 | Teste explícito com restauração. |
| CORE-SAVE-05 | MISSING | Nenhuma ação dupla. | Duplo save. | P0 | Criar com contagem lógica. |
| CORE-SAVE-06 | MISSING | Specs aguardam save antes de navegar. | Navegar durante save. | P0 | Atrasar resposta. |
| CORE-SAVE-07 | MISSING | Sem mock de rede. | Falha HTTP genérica. | P0 | `page.route()` no endpoint exato. |
| CORE-SAVE-08 | MISSING | Sem mock de rede. | Timeout de save. | P1 | Resposta pendente controlada. |
| CORE-SAVE-09 | MISSING | Sem mock de rede. | HTTP 500. | P0 | Mock e validar UI/dados. |
| CORE-SAVE-10 | MISSING | Renovação atual não cobre save em andamento. | HTTP 401 durante save. | P0 | Mock/session controlada. |
| CORE-SAVE-11 | MISSING | Sem cenário 403. | Feedback e estado após proibição. | P1 | Mock 403. |
| CORE-SAVE-12 | MISSING | Sem cenário 409. | Tratamento de conflito. | P1 | Mock 409. |
| CORE-SAVE-13 | MISSING | Sem resposta lenta controlada. | Edição durante save lento. | P1 | Atrasar resposta. |
| CORE-SAVE-14 | MISSING | Apenas sucesso e críticas funcionais são testados. | Feedback compreensível após falha técnica. | P0 | Contrato Core de erro. |
| CORE-SAVE-15 | MISSING | Nenhuma spec contrapõe falha da API a toast de sucesso. | Falso positivo de persistência. | P0 | Prioridade máxima CORE-1. |
| CORE-SAVE-16 | MISSING | Nenhuma falha controlada preserva inputs. | Dados locais após erro. | P0 | Validar valores digitados. |
| CORE-SAVE-17 | MISSING | Não há retry após falha. | Nova tentativa e request válida. | P0 | Mock falha→sucesso. |

### 5.3 Upload e gerenciamento de documentos

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-CORE-01 | COVERED | `send-and-view-portal-documents` envia arquivo válido em todos os controles. | Nenhuma para upload feliz representativo. | P0 | Reusar. |
| DOC-CORE-02 | COVERED | O mesmo cenário envia PDF real, valida nome/status e conteúdo HTTP. | Nenhuma. | P1 | Não duplicar. |
| DOC-CORE-03 | MISSING | Somente PDF é usado. | JPG permitido. | P1 | Descobrir contrato e testar. |
| DOC-CORE-04 | MISSING | Somente PDF é usado. | PNG permitido. | P1 | Descobrir contrato e testar. |
| DOC-CORE-05 | MISSING | Nenhum arquivo com extensão proibida. | Rejeição e ausência de persistência. | P0 | Fixture inválida pequena. |
| DOC-CORE-06 | MISSING | Nenhum arquivo de 0 bytes. | Rejeição de vazio. | P0 | Gerar fixture. |
| DOC-CORE-07 | PARTIAL | `validate-document-size-limits` rejeita 25/50 MB e mantém todos pendentes. | Limite está fixado em 10 MB e não testa boundary configurado. | P0 | Parametrizar limite e preservar teste atual como tenant. |
| DOC-CORE-08 | MISSING | Sem arquivo no limite exato. | Boundary inclusivo. | P1 | Gerador determinístico. |
| DOC-CORE-09 | MISSING | Sem limite −1 byte. | Boundary inferior. | P2 | Gerador determinístico. |
| DOC-CORE-10 | MISSING | 25/50 MB não prova limite +1 byte. | Boundary superior imediato. | P1 | Gerador determinístico. |
| DOC-CORE-11 | MISSING | Nome usado é curto/fixo. | Nome muito grande. | P2 | Fixture gerada. |
| DOC-CORE-12 | MISSING | Sem nome com espaços. | Preservação/normalização. | P2 | Adicionar fixture. |
| DOC-CORE-13 | MISSING | Sem nome com acentos. | Unicode. | P2 | Adicionar fixture. |
| DOC-CORE-14 | MISSING | Sem `ç`. | Unicode específico. | P2 | Adicionar fixture. |
| DOC-CORE-15 | MISSING | Sem parênteses. | Nome suportado. | P2 | Adicionar fixture. |
| DOC-CORE-16 | MISSING | Sem múltiplos pontos. | Parse seguro do sufixo. | P2 | Adicionar fixture. |
| DOC-CORE-17 | MISSING | Sem caracteres especiais representativos. | Sanitização segura. | P2 | Definir conjunto suportado. |
| DOC-CORE-18 | MISSING | Upload atual usa o mesmo PDF em slots distintos, não dois conteúdos com mesmo nome. | Colisão por nome. | P1 | Dois arquivos distintos. |
| DOC-CORE-19 | MISSING | Não reenvia o mesmo arquivo no mesmo documento. | Duplicidade lógica. | P1 | Validar estado final. |
| DOC-CORE-20 | MISSING | Upload é estritamente sequencial. | Upload concorrente em controles distintos. | P1 | Promessas simultâneas controladas. |
| DOC-CORE-21 | MISSING | File chooser sempre recebe arquivo. | Cancelamento sem efeito colateral. | P2 | Cancelar seletor. |
| DOC-CORE-22 | NOT_APPLICABLE | Tela atual observada expõe escolher, reenviar, visualizar e enviar para análise; não há remover. | Capacidade ausente. | P0 | Reavaliar se produto ganhar remoção. |
| DOC-CORE-23 | MISSING | Page Object reconhece `Enviar novamente`, mas nenhuma spec substitui e valida conteúdo novo. | Consequência da substituição. | P0 | Massa documental dedicada. |
| DOC-CORE-24 | COVERED | Spec abre `Ver arquivo`, exige HTTP 200, PDF e corpo não vazio. | Nenhuma para visualização imediata. | P0 | Reusar. |
| DOC-CORE-25 | NOT_APPLICABLE | Não há ação dedicada de download na tela atual; existe visualização em nova página. | Capacidade ausente. | P1 | Reavaliar se download surgir. |
| DOC-CORE-26 | MISSING | Documento é aberto imediatamente após upload. | Persistência após refresh. | P0 | Reload e revalidar link/conteúdo. |
| DOC-CORE-27 | MISSING | Não há novo login após upload. | Persistência entre sessões. | P0 | Reautenticar com mesma operação. |

### 5.4 Validação real do arquivo

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-CORE-28 | MISSING | Apenas PDF válido. | `.pdf` com conteúdo falso. | P1 | Criar fixture. |
| DOC-CORE-29 | MISSING | MIME inválido não é testado. | Conteúdo incompatível. | P1 | Upload controlado. |
| DOC-CORE-30 | MISSING | Sem JPG renomeado. | Validação por conteúdo. | P1 | Criar fixture. |
| DOC-CORE-31 | MISSING | Sem PDF renomeado. | Validação por conteúdo. | P1 | Criar fixture. |
| DOC-CORE-32 | MISSING | Sem PDF corrompido. | Tratamento frontend/API. | P1 | Criar fixture. |
| DOC-CORE-33 | MISSING | Sem arquivo sem extensão. | Política de extensão. | P2 | Criar fixture. |
| DOC-CORE-34 | MISSING | Sem extensão em caixa alta. | Normalização. | P2 | Criar fixture. |
| DOC-CORE-35 | MISSING | Sem múltiplos sufixos. | Prevenir bypass. | P2 | Criar fixture. |

### 5.5 Falhas durante upload

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| DOC-NET-01 | MISSING | Sem rede controlada. | Falha antes do upload. | P0 | Mock abortado. |
| DOC-NET-02 | MISSING | Sem rede controlada. | Queda durante upload. | P0 | Abort após início. |
| DOC-NET-03 | MISSING | Sem HTTP 500. | UI, loading e retry. | P0 | Mock 500. |
| DOC-NET-04 | MISSING | Limite atual é validação feliz do frontend, não resposta 413. | Tratamento 413 da API. | P0 | Mock 413. |
| DOC-NET-05 | MISSING | Sem HTTP 415. | Tipo não suportado. | P0 | Mock 415. |
| DOC-NET-06 | MISSING | Sem 401 durante upload. | Sessão e arquivo selecionado. | P0 | Mock/session. |
| DOC-NET-07 | MISSING | Sem 403. | Desbloqueio e feedback. | P1 | Mock 403. |
| DOC-NET-08 | MISSING | Sem upload lento. | Loading e bloqueio. | P1 | Delay controlado. |
| DOC-NET-09 | MISSING | Sem request abortada. | Recuperação. | P0 | Abort controlado. |
| DOC-NET-10 | MISSING | Sem retry. | Falha→nova tentativa. | P0 | Respostas sequenciais. |
| DOC-NET-11 | MISSING | Nenhum clique/seleção duplicada. | Documento duplicado. | P0 | Contar consequência. |
| DOC-NET-12 | MISSING | Nenhum refresh durante upload. | Documento fantasma. | P0 | Massa exclusiva. |

### 5.6 Campos de texto

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-TEXT-01 | MISSING | Há labels obrigatórias, mas nenhum texto vazio representativo é submetido e validado. | Erro de vazio. | P1 | Teste representativo. |
| CORE-TEXT-02 | MISSING | Sem whitespace-only. | Normalização/erro. | P1 | Teste representativo. |
| CORE-TEXT-03 | MISSING | Sem espaço inicial. | Trim inicial. | P1 | Acrescentar ao grupo trim. |
| CORE-TEXT-04 | COVERED | `CONJ-09` e `RENDA-TERC-06` salvam valores com espaço final e conferem trim. | Nenhuma. | P1 | Reusar. |
| CORE-TEXT-05 | MISSING | Sem múltiplos espaços internos. | Política de normalização. | P2 | Descobrir e documentar. |
| CORE-TEXT-06 | MISSING | `MOTIVO-03` testa duas palavras, não um caractere como mecanismo genérico. | Boundary mínimo. | P2 | Testar componente escolhido. |
| CORE-TEXT-07 | MISSING | Sem tamanho máximo. | Limite aceito. | P1 | Descobrir `maxlength`/API. |
| CORE-TEXT-08 | MISSING | Sem máximo +1. | Truncamento ou erro. | P1 | Boundary. |
| CORE-TEXT-09 | MISSING | Dados com acento existem, mas aceitação/persistência não é objetivo de nenhuma assertion. | Prova explícita. | P2 | Teste representativo. |
| CORE-TEXT-10 | MISSING | Sem emoji. | Unicode não usual. | P2 | Definir campo aplicável. |
| CORE-TEXT-11 | MISSING | Sem caracteres especiais. | Sanitização/aceitação. | P2 | Teste representativo. |
| CORE-TEXT-12 | MISSING | Sem quebra de linha. | Campo multiline. | P2 | Aplicar à descrição. |
| CORE-TEXT-13 | MISSING | Specs usam `fill`/digitação, não clipboard. | Colar valor. | P1 | Validar evento de paste. |

### 5.7 Campos numéricos

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-NUM-01 | COVERED | `PART-03`, rendas, telefone e simulador comprovam rejeição de letras. | Nenhuma para mecanismo representativo. | P1 | Não duplicar. |
| CORE-NUM-02 | MISSING | Letras não cobrem caracteres especiais. | Símbolos. | P1 | Acrescentar boundary. |
| CORE-NUM-03 | MISSING | Sem valor negativo. | Sinal e validação. | P1 | Campo monetário representativo. |
| CORE-NUM-04 | MISSING | Sem zero. | Regra de domínio/erro. | P1 | Definir campo aplicável. |
| CORE-NUM-05 | MISSING | Sem decimal digitado. | Máscara e escala. | P1 | Teste monetário. |
| CORE-NUM-06 | MISSING | Sem valor extremo. | Overflow/limite. | P2 | Boundary seguro. |
| CORE-NUM-07 | MISSING | Sem zeros à esquerda. | Normalização. | P2 | Teste representativo. |
| CORE-NUM-08 | MISSING | Sem paste inválido. | Bypass da máscara. | P1 | Clipboard. |

### 5.8 Datas

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-DATE-01 | MISSING | Datas válidas fixas não cobrem bissexto. | 29/02 válido. | P1 | Criar matriz pequena. |
| CORE-DATE-02 | MISSING | Sem 29/02 inválido. | Ano não bissexto. | P1 | Criar matriz pequena. |
| CORE-DATE-03 | MISSING | Sem 31/04. | Calendário inválido. | P1 | Testar blur/submit. |
| CORE-DATE-04 | MISSING | Sem 31/06. | Calendário inválido. | P1 | Testar blur/submit. |
| CORE-DATE-05 | MISSING | Sem zeros. | Data impossível. | P1 | Testar validação. |
| CORE-DATE-06 | MISSING | Sem dia 32. | Data impossível. | P1 | Testar validação. |
| CORE-DATE-07 | MISSING | Sem data futura. | Regra etária/contextual. | P1 | Campo de nascimento. |
| CORE-DATE-08 | MISSING | Sem data muito antiga. | Boundary mínimo. | P2 | Definir limite esperado. |
| CORE-DATE-09 | MISSING | Testes atuais rejeitam letras, mas não submetem data parcial. | Incompletude. | P1 | Testar blur/submit. |
| CORE-DATE-10 | MISSING | Sem paste de data. | Máscara via clipboard. | P1 | Testar paste. |
| CORE-DATE-11 | MISSING | Campos são limpos em teardown sem confirmar remoção persistida. | Limpeza após reload. | P1 | Massa dedicada. |

### 5.9 CEP e preenchimento de endereço

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-CEP-01 | COVERED | `GAR-PF-05` e `GAR-PJ-04` preenchem CEP válido e validam endereço, bairro, UF e município. | Nenhuma. | P1 | Reusar. |
| CORE-CEP-02 | MISSING | Sem CEP inexistente. | Erro/edição manual. | P1 | Testar serviço real ou mock. |
| CORE-CEP-03 | MISSING | Sem CEP incompleto. | Máscara/erro. | P1 | Teste de campo. |
| CORE-CEP-04 | MISSING | Sem letras no CEP. | Rejeição. | P1 | Teste de campo. |
| CORE-CEP-05 | MISSING | Sem falha controlada do serviço. | Recuperação. | P0 | Mock da consulta. |
| CORE-CEP-06 | MISSING | Sem consulta lenta. | Loading/edição. | P1 | Delay controlado. |
| CORE-CEP-07 | MISSING | CEP é limpo, não substituído por outro válido. | Atualização correta. | P1 | Dois CEPs. |
| CORE-CEP-08 | MISSING | Sem troca A→B. | Endereço antigo residual. | P0 | Validar todos os campos. |
| CORE-CEP-09 | MISSING | Sem número antes/depois da troca. | Política do número. | P1 | Documentar resultado. |
| CORE-CEP-10 | PARTIAL | Garantidor PF/PJ comprova label opcional, mas não salva endereço sem complemento. | Persistência sem complemento. | P2 | Salvar/reabrir. |
| CORE-CEP-11 | MISSING | Sem resposta incompleta. | Fallback/edição manual. | P1 | Mock parcial. |
| CORE-CEP-12 | MISSING | Sem respostas fora de ordem. | Race condition A→B. | P0 | Mock determinístico. |

### 5.10 Sessão, autenticação e autorização

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| SESSION-01 | MISSING | `LOGIN-04` abre a home sem sessão, não uma URL protegida. | Redirecionamento/negação de rota protegida. | P0 | Contexto vazio + deep link. |
| SESSION-02 | COVERED | Smoke abre proposta autorizada com storage state válido. | Nenhuma. | P0 | Reusar. |
| SESSION-03 | MISSING | Fixture recupera antes do teste; não expira durante cadastro. | 401 com dados digitados. | P0 | Mock/session. |
| SESSION-04 | MISSING | Sem expiração durante upload. | Arquivo/feedback. | P0 | Integrar com DOC-NET-06. |
| SESSION-05 | MISSING | Sem expiração durante save. | Rascunho/renovação. | P0 | Integrar com SAVE-10. |
| SESSION-06 | PARTIAL | `TIMELINE-09` recarrega a rota protegida, mas depois verifica somente que um alerta está oculto. | Não confirma heading, formulário ou `auth/me`; a assertion também passaria se a rota protegida fosse perdida. | P1 | Após reload, provar sessão e conteúdo protegido. |
| SESSION-07 | MISSING | Nenhuma spec executa logout; a superfície do simulador atual exibe `Sair`, portanto ausência de cobertura não pode ser tratada como não aplicável. | Invalidar sessão e negar deep link. | P0 | Mapear a ação real e testar. |
| SESSION-08 | MISSING | Nenhuma spec usa Voltar após sair. | Cache do conteúdo protegido. | P0 | Implementar junto ao SESSION-07. |
| SESSION-09 | BLOCKED | Não há fixture oficial que declare usuário A e proposta de B para teste de autorização. | Identidades controladas e autorização para sondagem. | P0 | Criar massa/fixture de segurança antes. |
| SESSION-10 | BLOCKED | Alterar ID sem uma operação sabidamente alheia provaria apenas 404. | Par A/B controlado. | P0 | Mesma preparação de segurança. |
| SESSION-11 | COVERED | `PROP-05`/`TIMELINE-04` abrem operações diferentes e validam a jornada/heading correspondente. | Nenhuma para seleção correta. | P1 | Não duplicar. |
| SESSION-12 | BLOCKED | Não há contrato seguro de duas identidades com ownership conhecido. | Usuários A/B dedicados. | P0 | Provisionar par de segurança. |

### 5.11 Concorrência e ações duplicadas

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-CONC-01 | MISSING | Sem duplo clique em Salvar. | Consequência única. | P0 | Contar alteração lógica. |
| CORE-CONC-02 | MISSING | Sem duplo clique em Continuar. | Consequência única. | P0 | Unificar com NAV-05. |
| CORE-CONC-03 | MISSING | Preparadores clicam uma vez em Confirmar. | Dupla finalização. | P0 | Massa consumível exclusiva. |
| CORE-CONC-04 | MISSING | Upload é sequencial e único. | Duplo envio. | P0 | Unificar com DOC-NET-11. |
| CORE-CONC-05 | MISSING | Sem Enter repetido. | Submit repetido. | P1 | Escolher formulário representativo. |
| CORE-CONC-06 | MISSING | Sem duas abas. | Conflito de save. | P0 | Unificar com NAV-09. |
| CORE-CONC-07 | MISSING | Sem uploads concorrentes. | Consequência por controle. | P1 | Unificar com DOC-CORE-20. |
| CORE-CONC-08 | MISSING | Sem respostas fora de ordem. | Estado final correto. | P0 | Mock determinístico. |
| CORE-CONC-09 | MISSING | Requests reais são aguardadas, não repetidas. | Idempotência lógica. | P0 | Instrumentar endpoint representativo. |

### 5.12 Loading, empty state e estados intermediários

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-STATE-01 | MISSING | Skeleton é localizado, mas nunca se força resposta lenta nem se exige sua aparição. | Loading durante request. | P1 | Mock lento. |
| CORE-STATE-02 | PARTIAL | `ProposalsPage` e timeline exigem skeletons ausentes após carregar. | Não prova transição visível loading→sucesso. | P1 | Controlar resposta e observar ambos. |
| CORE-STATE-03 | MISSING | Sem erro controlado. | Loading desaparecer após erro. | P0 | Mock 500/abort. |
| CORE-STATE-04 | MISSING | Botões são verificados habilitados antes da ação. | Proteção durante ação. | P0 | Atrasar request. |
| CORE-STATE-05 | MISSING | Sem clique concorrente. | Bloqueio lógico intermediário. | P0 | Integrar concorrência. |
| CORE-STATE-06 | MISSING | Sem falha controlada. | Loading infinito. | P0 | Assert timeout de desbloqueio. |
| CORE-STATE-07 | BLOCKED | Não existe CPF/massa oficial declarada sem propostas. | Identidade de empty state. | P1 | Provisionar usuário sem dados. |
| CORE-STATE-08 | MISSING | Sem UI de retry exercitada. | Retry após erro. | P0 | Definir endpoint com retry. |
| CORE-STATE-09 | MISSING | Sem nova request após retry. | Prova da tentativa. | P0 | Contar requests. |
| CORE-STATE-10 | MISSING | Abertura de duas propostas não inspeciona conteúdo transitório da anterior. | Vazamento visual durante loading. | P0 | Duas propostas com dados distintos. |

### 5.13 Responsividade e mobile

Todos os projetos atuais usam `Desktop Chrome` com viewport `1440x900`; não existe projeto mobile nem spec responsiva equivalente.

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-MOBILE-01 | MISSING | Desktop apenas. | Navegação mobile. | P1 | Projeto Core mobile. |
| CORE-MOBILE-02 | MISSING | Desktop apenas. | Formulário mobile. | P1 | Cenário representativo. |
| CORE-MOBILE-03 | MISSING | Desktop apenas. | Modal na viewport. | P1 | Validar bounding box. |
| CORE-MOBILE-04 | MISSING | Desktop apenas. | Fechamento de modal. | P1 | Fluxo funcional. |
| CORE-MOBILE-05 | MISSING | Upload desktop. | Upload mobile. | P1 | Device representativo. |
| CORE-MOBILE-06 | MISSING | Combobox desktop. | Lista dentro da viewport. | P1 | Reusar componente. |
| CORE-MOBILE-07 | MISSING | Sem submit inválido mobile. | Scroll ao erro. | P1 | Formulário longo. |
| CORE-MOBILE-08 | MISSING | Sem viewport pequena. | Ação acessível. | P1 | Validar após scroll. |
| CORE-MOBILE-09 | MISSING | Sem mobile. | Campo de data. | P2 | Caso representativo. |
| CORE-MOBILE-10 | MISSING | Sem mobile. | Teclado/campo numérico. | P2 | Caso representativo. |
| CORE-MOBILE-11 | MISSING | Timeline testada só em desktop. | Etapas responsivas. | P1 | Contrato Core, sem fases C6. |
| CORE-MOBILE-12 | MISSING | Documentos só desktop. | Lista documental mobile. | P1 | Massa documental. |
| CORE-MOBILE-13 | MISSING | Sem medição de overflow. | Overflow horizontal. | P1 | Assertion de layout. |
| CORE-MOBILE-14 | MISSING | Sem inspeção de sobreposição. | Elemento fixo cobrindo ação. | P1 | Screenshot/bounding boxes. |
| CORE-MOBILE-15 | MISSING | Sem erro mobile. | Mensagem visível. | P1 | Submit inválido. |

### 5.14 Acessibilidade básica

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-A11Y-01 | MISSING | Specs clicam controles; não navegam por Tab. | Ordem/foco por teclado. | P2 | Jornada curta por teclado. |
| CORE-A11Y-02 | MISSING | Sem inspeção de foco visível. | Indicador de foco. | P2 | Assertion visual/estilo. |
| CORE-A11Y-03 | MISSING | DialogComponent não verifica foco inicial/retorno. | Gestão de foco. | P2 | Modal representativo. |
| CORE-A11Y-04 | MISSING | Nenhuma spec pressiona Escape em modal. | Fechamento por teclado. | P2 | Quando aplicável. |
| CORE-A11Y-05 | COVERED | Helpers de required/optional localizam `label[for=id]` em vários módulos. | Nenhuma para associação representativa. | P2 | Reusar. |
| CORE-A11Y-06 | COVERED | CPF inválido usa `aria-invalid`/`role=alert`; vários campos verificam `aria-invalid`. | Nenhuma para erro representativo. | P2 | Reusar. |
| CORE-A11Y-07 | COVERED | A suíte depende de `getByRole(button, {name})` para ações principais em todas as jornadas. | Nenhuma para amostra representativa. | P2 | Não duplicar todos os botões. |
| CORE-A11Y-08 | MISSING | Submit inválido valida modal/alerta, não foco/revelação do primeiro erro. | Descoberta do erro. | P1 | Prioridade de acessibilidade. |
| CORE-A11Y-09 | PARTIAL | Asterisco está dentro do label associado, mas não se valida semântica `required`/`aria-required`. | Identificação não apenas visual. | P2 | Verificar árvore acessível. |
| CORE-A11Y-10 | MISSING | Sem percurso completo de teclado. | Foco preso. | P2 | Tab/Shift+Tab/Escape. |

### 5.15 Consistência frontend → API

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-API-01 | COVERED | Preparações enviam textos e validações AEJS conferem nomes/descrições refletidos. | Nenhuma para risco representativo. | P0 | Registrar que cobertura é end-to-end. |
| CORE-API-02 | COVERED | Simulador envia imóvel, financiamento e renda; spec confere valores formatados no SCCI. | Nenhuma para escala monetária. | P0 | Reusar. |
| CORE-API-03 | COVERED | Selects do simulador/preparações são conferidos semanticamente no SCCI. | Não inspeciona payload bruto, mas prova consequência final. | P0 | Não duplicar salvo diagnóstico de payload. |
| CORE-API-04 | COVERED | Preparação PJ marca autorizações/flags e validação AEJS confere estado marcado. | Nenhuma para true representativo. | P0 | Reusar. |
| CORE-API-05 | MISSING | Não há checkbox desmarcado rastreado até backend/SCCI. | Estado false. | P0 | Escolher checkbox reversível. |
| CORE-API-06 | COVERED | Nascimento digitado no simulador é validado formatado no SCCI. | Nenhuma. | P1 | Reusar. |
| CORE-API-07 | COVERED | Celular do simulador é validado por DDD/número no SCCI. | Nenhuma. | P1 | Reusar. |
| CORE-API-08 | MISSING | Teardowns limpam, mas não inspecionam payload nem reabrem. | Valor antigo ausente. | P1 | Payload + reload. |
| CORE-API-09 | COVERED | Cenários PJ/PF alteram dados da proposta e validam os valores novos no AEJS. | Nenhuma para alteração representativa. | P0 | Reusar. |
| CORE-API-10 | MISSING | Nenhum teste compara payloads de duas propostas. | Contaminação entre propostas. | P0 | Integrar isolamento. |

### 5.16 Isolamento entre propostas e usuários

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| ISOLATION-01 | MISSING | `PROP-05` abre duas propostas, mas não compara dados exclusivos A/B. | Vazamento de cadastro. | P0 | Duas massas distintas. |
| ISOLATION-02 | MISSING | Sem alternância documental A/B. | Documento cruzado. | P0 | Duas propostas documentais. |
| ISOLATION-03 | MISSING | Sem alternância de participantes. | Participante cruzado. | P0 | Dados marcadores distintos. |
| ISOLATION-04 | MISSING | Estado de aba não é comparado entre rotas. | Tab compartilhada. | P1 | Alternar A/B. |
| ISOLATION-05 | MISSING | `TIMELINE-09` testa persistência do alerta na mesma proposta. | Escopo por proposta. | P1 | Alertas distintos A/B. |
| ISOLATION-06 | MISSING | Nenhuma spec observa dados durante transição de rota. | Cache visual antigo. | P0 | Integrar STATE-10. |
| ISOLATION-07 | BLOCKED | Não há fixture de duas identidades autorizadas e lifecycle de troca de usuário. | Usuários A/B controlados. | P0 | Preparar segurança/identidades. |
| ISOLATION-08 | MISSING | File chooser nunca troca de proposta com arquivo selecionado. | Associação incorreta. | P0 | Massa documental A/B. |
| ISOLATION-09 | MISSING | Sem request atrasada da proposta A após abrir B. | Race cross-route. | P0 | Mock fora de ordem. |

### 5.17 Jornadas Portal Core

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|
| CORE-JOURNEY-01 | PARTIAL | Preparações PJ/PF/quitado preenchem e salvam cadastro válido. | Não reabrem o Portal para provar persistência na mesma jornada. | P0 | Jornada pequena, não copiar preparação inteira. |
| CORE-JOURNEY-02 | MISSING | Nenhum cadastro sai, autentica novamente e continua. | Retomada entre sessões. | P0 | Massa dedicada. |
| CORE-JOURNEY-03 | PARTIAL | Documento válido é enviado e visualizado imediatamente. | Falta refresh antes da visualização. | P0 | Complementar DOC-CORE-26. |
| CORE-JOURNEY-04 | MISSING | Nenhum fluxo falha API, preserva dado e faz retry. | Recuperação completa. | P0 | Consolidar SAVE-09/14/16/17. |
| CORE-JOURNEY-05 | MISSING | Nenhum fluxo salva A e comprova ausência em B. | Isolamento funcional. | P0 | Consolidar ISOLATION-01. |

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
| Autorização/IDOR | `SESSION-09`, `SESSION-10`, `SESSION-12` | Matriz A/B no mesmo arquivo de segurança. |
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
| CORE-SAVE-02 | Toast de rascunho parcial. | Reabrir/recarregar e conferir o valor. |
| CORE-SAVE-03 | Alterações são salvas em fluxos existentes. | Baseline persistido e comparação após reload. |
| CORE-SAVE-04 | Teardowns limpam e salvam. | Assertion de remoção persistida. |
| DOC-CORE-07 | 25/50 MB rejeitados. | Limite configurável e boundary exato/+1. |
| CORE-CEP-10 | Complemento marcado opcional. | Salvar endereço sem complemento e reabrir. |
| SESSION-06 | Reload em rota protegida, seguido apenas por ausência de alerta. | Confirmar `auth/me`, heading e conteúdo protegido após refresh. |
| CORE-STATE-02 | Skeleton deve desaparecer. | Controlar request lenta e provar transição. |
| CORE-A11Y-09 | Asterisco em label associado. | Semântica acessível de obrigatório. |
| CORE-JOURNEY-01 | Cadastro válido completo. | Reabertura no Portal. |
| CORE-JOURNEY-03 | Upload e visualização imediata. | Refresh antes da visualização. |

## 9. Casos bloqueados

| IDs | Bloqueio | Necessário para desbloquear |
|---|---|---|
| `SESSION-09`, `SESSION-10`, `SESSION-12` | Não existe contrato/fixture de segurança com usuário A, usuário B e ownership conhecido. Usar IDs aleatórios não prova autorização. | Duas identidades controladas, propostas pertencentes a cada uma, permissão para sondagem read-only e resultado server-side esperado. |
| `CORE-STATE-07` | Não existe CPF oficial sem propostas. | Identidade estável de empty state ou API/mock Core aprovado. |
| `ISOLATION-07` | Não existe lifecycle oficial de troca entre dois usuários no mesmo teste. | Compor fixture A/B e limpeza de storage/cache entre sessões. |

Indisponibilidade temporária de VPN, Portal ou SCCI não altera os 161 casos `MISSING` para `BLOCKED`; ela apenas impede execução naquele momento.

## 10. Casos não aplicáveis ao Portal atual

| IDs | Motivo |
|---|---|
| `DOC-CORE-22` | A tela documental atual não oferece remoção; oferece escolher, reenviar, visualizar e enviar para análise. |
| `DOC-CORE-25` | Não existe ação dedicada de download; existe visualização do arquivo. |

Esses casos devem ser reavaliados quando a capacidade aparecer. Não devem virar testes artificiais por chamada direta de endpoint sem UI/contrato aprovado.

## 11. Validação do comportamento atual

Esta auditoria não assumiu que o contrato C6 representa o Portal Core. Evidências recentes da EsteiraHT foram usadas para separar diferenças de tenant de riscos do produto:

- fases históricas C6 não apareceram na Esteira;
- domínios de profissão e uso do imóvel diferiram;
- estados de massas reprovada/cancelada divergiram;
- o simulador → SCCI passou com valores da Esteira Digital;
- a suíte já detectou proposta expirada há mais de 30 dias ainda visível;
- falhas recentes de integração por `504`/timeout foram classificadas como ambiente, não como cobertura CORE.

Nenhuma mutação adicional foi executada nesta auditoria, porque isso consumiria massas e não seria necessário para provar a ausência estrutural de mocks, concorrência, mobile, autorização e isolamento.

## 12. Plano recomendado de implementação

O plano abaixo reduz duplicidade e pode ser interrompido ao final de qualquer etapa.

### CORE-1 — Persistência e falsa confirmação de sucesso

Prioridade máxima:

1. save válido/partial com reabertura;
2. HTTP 500 ao salvar;
3. preservar inputs após falha;
4. não exibir sucesso;
5. retry falha→sucesso;
6. refresh/reabertura após save.

Resultado esperado: cobrir uma única jornada que resolva vários IDs SAVE/NAV/JOURNEY sem criar uma spec por ID.

### CORE-2 — Concorrência e estados intermediários

1. duplo clique em Continuar/Salvar;
2. botão/loading durante request lenta;
3. duas abas na mesma proposta;
4. resposta fora de ordem;
5. refresh durante carregamento.

Resultado esperado: provar consequência lógica única e estado final consistente.

### CORE-3 — Documentos

1. parametrizar limite sem remover o teste tenant de 10 MB;
2. limite−1/exato/+1;
3. extensão/conteúdo inválido;
4. falha 413/415/500 e retry;
5. substituição;
6. refresh e novo login.

Pré-condição: massa documental restaurável e arquivos pequenos gerados deterministicamente.

### CORE-4 — Sessão, autorização e isolamento

1. deep link sem sessão;
2. identidades A/B controladas;
3. IDOR server-side;
4. proposta A → proposta B sem cache antigo;
5. sessão expirada durante save/upload.

Pré-condição: aprovar fixture de segurança e ownership das massas.

### CORE-5 — Campos essenciais, CEP e contrato API

1. boundaries representativos de texto/número/data;
2. corrida de CEP A/B;
3. checkbox false e campo limpo no backend;
4. evitar matriz combinatória por input.

### CORE-6 — Mobile e acessibilidade

1. projeto mobile pequeno;
2. cadastro, modal, combobox, documento e erro de submit;
3. foco no primeiro erro;
4. Tab/Escape/labels/foco visível;
5. overflow e ação principal acessível.

## 13. Critérios para a próxima decisão

Antes de implementar CORE-1, devem ser definidos:

- proposta mutável restaurável ou provisionada automaticamente;
- endpoint representativo de salvamento;
- valor marcador que possa ser alterado e restaurado;
- política de uso de `page.route()` sem mascarar testes reais;
- pós-condição obrigatória: reload/reabertura + valor persistido;
- teardown que falhe claramente se não conseguir restaurar a massa.

Não é necessário criar 161 testes. Muitos IDs devem ser cobertos por cenários compostos pequenos, especialmente falha→retry, concorrência, CEP fora de ordem, autorização A/B e isolamento A→B.

## 14. Parecer final

**A suíte atual ainda não comprova a qualidade Core do Portal de forma suficiente.**

Ela comprova bem caminhos felizes e contratos de cliente/produto, mas deixa sem cobertura a maioria dos riscos de confiabilidade, recuperação, segurança e isolamento. A implementação deve começar pelos P0 de persistência e falsa confirmação de sucesso, mantendo separados:

- testes Core com rede controlada;
- testes reais do produto imobiliário;
- contratos de tenant C6/Esteira;
- integrações Portal → SCCI/AEJS.

O resultado desta auditoria não recomenda expandir cobertura indiscriminadamente. Recomenda consolidar riscos duplicados em poucos cenários CORE determinísticos e provar pós-condições reais antes de considerar um comportamento coberto.
