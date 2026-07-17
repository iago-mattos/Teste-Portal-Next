# Regressões Ativas — Portal Core

## Objetivo

Este documento registra divergências funcionais comprovadas pela suíte Portal Core. Ele não representa falhas da automação e não autoriza enfraquecer as assertions que preservam o contrato esperado do produto.

Ambientes das observações em 15/07/2026: **HT**, perfil `.env.ht.local`, para CORE-1 e CORE-3; e **EsteiraHT**, perfil `.env.esteira-ht.local`, para CORE-5, CORE-6 e o bloco imediato pós-CORE-6. CORE-1 usa a massa mutável e restaurável configurada por `PORTAL_CORE_PERSISTENCE_OPERATION`; CORE-3 usa a massa documental configurada por `PORTAL_CORE_DOCUMENT_OPERATION` sem persistir arquivos; CORE-5 e o bloco imediato reutilizam a proposta padrão em Cadastro e restauram os campos alterados; CORE-6 usa as massas read-only de Cadastro e Documentos no projeto mobile isolado. Falhas controladas de save/upload e nomes inválidos do bloco imediato não persistem dados nem arquivos.

## CORE-REG-001 — Salvamento confirma sucesso, mas a renda não persiste

- **Severidade sugerida:** P0 — Crítica.
- **Ambiente observado:** Portal HT.
- **Pré-condição:** proposta dedicada em Cadastro, formulário acessível e renda editável.
- **Passos:**
  1. abrir a proposta dedicada;
  2. alterar a renda;
  3. trocar de aba para disparar o salvamento automático;
  4. confirmar a resposta do `PUT /api/portal/propostas/{operação}/cadastro`;
  5. retornar à aba Sobre Você;
  6. recarregar ou reabrir a proposta.
- **Resultado atual:** o endpoint retorna HTTP 200 e `success: true`, mas, após reload/reabertura, a renda volta como `R$ 0,00`.
- **Resultado esperado:** depois de uma resposta positiva do backend, a renda salva deve ser devolvida e exibida com o mesmo valor após reload e reabertura.
- **Evidência automatizada relacionada:** `tests/core/persistence/persistence.spec.ts`, cenários `CORE-1 | salva rascunho parcial, recarrega, reabre, remove e restaura o valor` e `CORE-1 | rejeita HTTP 500 sem sucesso falso, preserva o dado e persiste no retry real`; trace, screenshot e vídeo são publicados pelo Playwright quando a execução falha.
- **IDs CORE relacionados:** `CORE-NAV-02`, `CORE-NAV-03`, `CORE-SAVE-02`, `CORE-SAVE-03`, `CORE-SAVE-04`, `CORE-SAVE-17`, `CORE-JOURNEY-01`, `CORE-JOURNEY-04`.

## CORE-REG-002 — Falhas HTTP 500/403 no rascunho não são informadas ao usuário

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal HT (HTTP 500) e EsteiraHT (HTTP 403).
- **Pré-condição:** proposta dedicada em Cadastro, formulário acessível e uma alteração local ainda não persistida.
- **Passos:**
  1. alterar a renda;
  2. controlar exclusivamente o próximo `PUT /api/portal/propostas/{operação}/cadastro` para responder HTTP 500 ou 403;
  3. trocar de aba para disparar o salvamento;
  4. observar o feedback e o conteúdo local do formulário.
- **Resultado atual:** o Portal não apresenta uma mensagem de erro ao usuário após HTTP 500 nem a mensagem explícita retornada no HTTP 403.
- **Resultado esperado:** o Portal deve informar inequivocamente que o rascunho não foi salvo e permitir uma nova tentativa consciente.
- **Evidência automatizada relacionada:** `tests/core/persistence/persistence.spec.ts`, cenário `CORE-1 | rejeita HTTP 500 sem sucesso falso, preserva o dado e persiste no retry real`; e `tests/core/navigation/immediate-gaps.spec.ts`, cenário `CORE imediato | trata HTTP 403 no save e upload sem sucesso falso`, reproduzido consecutivamente.
- **IDs CORE relacionados:** `CORE-SAVE-11`, `CORE-SAVE-15`, `CORE-SAVE-16`, `CORE-SAVE-17`, `CORE-STATE-03`, `CORE-STATE-06`, `CORE-STATE-08`, `CORE-STATE-09`.

### Evidências preservadas no mesmo cenário

- nenhuma mensagem falsa `Rascunho salvo` é exibida após o HTTP 500;
- o valor digitado permanece localmente no formulário depois da falha;
- a ausência de feedback de erro é a regressão; essas duas garantias positivas não devem ser removidas nem relaxadas.

## CORE-REG-003 — Arquivo vazio inicia upload sem validação explícita

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal HT.
- **Pré-condição:** proposta na etapa Documentos, com slot pendente e massa documental reutilizável.
- **Passos:**
  1. selecionar um arquivo `.pdf` determinístico de zero byte;
  2. observar a rede e o estado do slot documental;
  3. impedir persistência respondendo 415 somente ao endpoint exato de upload.
- **Resultado atual:** o arquivo vazio chega ao `POST /api/portal/propostas/{operação}/documentos`; após a rejeição controlada, nenhuma mensagem explica o problema.
- **Resultado esperado:** o arquivo vazio deve ser rejeitado antes do upload, com feedback explícito, e nunca deve produzir documento ou link de visualização.
- **Evidência automatizada relacionada:** `tests/core/documents/documents.spec.ts`, cenário `CORE-3 | rejeita arquivo vazio e extensão não permitida sem request`.
- **IDs CORE relacionados:** `DOC-CORE-06`, `DOC-NET-05`.

## CORE-REG-004 — Nome/extensão não permitidos são ignorados sem feedback

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal HT (`.txt`) e EsteiraHT (sem extensão e `.pdf.exe`).
- **Pré-condição:** proposta na etapa Documentos, com slot pendente.
- **Passos:**
  1. selecionar um arquivo pequeno com extensão `.txt`, sem extensão ou com extensão terminal não permitida (`.pdf.exe`);
  2. observar a UI, a rede e o estado do slot.
- **Resultado atual:** o Portal não envia request nem persiste nenhum desses arquivos, mas também não apresenta qualquer mensagem de extensão ou formato não permitido.
- **Resultado esperado:** o bloqueio deve ser acompanhado de feedback explícito informando os formatos aceitos.
- **Evidência automatizada relacionada:** `tests/core/documents/documents.spec.ts`, cenário `CORE-3 | rejeita arquivo vazio e extensão não permitida sem request`; e `tests/core/documents/immediate-gaps.spec.ts`, cenário `CORE imediato | preserva nomes válidos e rejeita seleções inválidas sem upload`, reproduzido consecutivamente.
- **IDs CORE relacionados:** `DOC-CORE-05`, `DOC-CORE-33`, `DOC-CORE-35`.

## CORE-REG-005 — Falhas 413, 415, 500 e 403 de upload não são apresentadas ao usuário

- **Severidade sugerida:** P0 — Crítica.
- **Ambiente observado:** Portal HT (413/415/500) e EsteiraHT (403).
- **Pré-condição:** proposta na etapa Documentos, slot pendente e arquivo dentro do limite configurado.
- **Passos:**
  1. selecionar um arquivo para upload;
  2. controlar exclusivamente o `POST /api/portal/propostas/{operação}/documentos` para responder 413, 415, 500 ou 403;
  3. observar loading, feedback, desbloqueio e estado documental;
  4. repetir a seleção para comprovar que uma nova request pode ser feita.
- **Resultado atual:** o loading termina, o controle é desbloqueado, o retry aplicável gera nova request e não surge confirmação falsa; entretanto, nenhuma das mensagens de erro retornadas pela API aparece na interface.
- **Resultado esperado:** cada falha deve produzir feedback inequívoco e acionável, sem criar documento, link ou confirmação de sucesso.
- **Evidência automatizada relacionada:** `tests/core/documents/documents.spec.ts`, cenários `CORE-3 | trata 413, 415 e conteúdo inválido sem confirmação falsa` e `CORE-3 | upload lento bloqueia duplicidade, libera após 500 e permite retry`; e `tests/core/navigation/immediate-gaps.spec.ts`, cenário `CORE imediato | trata HTTP 403 no save e upload sem sucesso falso`, reproduzido consecutivamente.
- **IDs CORE relacionados:** `DOC-NET-03`, `DOC-NET-04`, `DOC-NET-05`, `DOC-NET-07`, `DOC-NET-08`, `DOC-NET-10`, `DOC-NET-11`.

## CORE-REG-006 — Espaços iniciais são persistidos em campo de texto

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal EsteiraHT.
- **Pré-condição:** proposta reutilizável em Cadastro, estado civil que habilite cônjuge e campo de nome editável.
- **Passos:**
  1. preencher o nome do cônjuge por paste com dois espaços iniciais, Unicode e caracteres especiais;
  2. completar os campos mínimos necessários;
  3. trocar de aba para disparar o `PUT /cadastro` real;
  4. retornar à aba do cônjuge e observar o valor devolvido.
- **Resultado atual:** o backend confirma o save, mas o nome é devolvido e exibido com os dois espaços iniciais.
- **Resultado esperado:** espaços iniciais devem ser removidos antes da persistência, preservando o conteúdo Unicode válido.
- **Evidência automatizada relacionada:** `tests/core/fields/essential-fields.spec.ts`, cenário `CORE-5 | valida texto obrigatório, limite real, Unicode, trim e calendário`.
- **IDs CORE relacionados:** `CORE-TEXT-03`.

## CORE-REG-007 — Datas de nascimento inválidas não produzem erro funcional

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal EsteiraHT.
- **Pré-condição:** proposta reutilizável em Cadastro e formulário do cônjuge habilitado.
- **Passos:**
  1. preencher o restante do cônjuge com dados sintaticamente válidos;
  2. submeter separadamente `29/02/2001`, `31/04/2000`, uma data futura e uma data parcial;
  3. acionar `Confirmar e avançar cadastro` após cada valor;
  4. observar o resumo de campos inválidos.
- **Resultado atual:** nenhum dos quatro valores produz erro associado à data de nascimento do cônjuge.
- **Resultado esperado:** datas calendáricas impossíveis, incompletas ou futuras devem impedir o avanço e indicar claramente o campo inválido.
- **Evidência automatizada relacionada:** `tests/core/fields/essential-fields.spec.ts`, cenário `CORE-5 | valida texto obrigatório, limite real, Unicode, trim e calendário`.
- **IDs CORE relacionados:** `CORE-DATE-02`, `CORE-DATE-03`, `CORE-DATE-07`, `CORE-DATE-09`.

## CORE-REG-008 — CEP inexistente ou serviço indisponível não apresenta feedback

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal EsteiraHT.
- **Pré-condição:** proposta reutilizável em Cadastro e endereço do garantidor PF acessível.
- **Passos:**
  1. consultar no endpoint real um CEP inexistente que retorna HTTP 200 com endereço vazio;
  2. observar o estado dos campos e o feedback;
  3. controlar exclusivamente `GET /api/portal/cep` para retornar HTTP 500 em uma segunda consulta;
  4. observar novamente o feedback e a possibilidade de continuar editando.
- **Resultado atual:** os campos permanecem vazios, mas nenhuma mensagem informa CEP inexistente nem falha do serviço.
- **Resultado esperado:** ambas as situações devem apresentar feedback inequívoco e manter a edição disponível.
- **Evidência automatizada relacionada:** `tests/core/fields/cep-api-contract.spec.ts`, cenário `CORE-5 | valida CEP inválido, indisponibilidade e resposta incompleta`.
- **IDs CORE relacionados:** `CORE-CEP-02`, `CORE-CEP-05`.

## CORE-REG-009 — Resposta atrasada de CEP sobrescreve a consulta mais recente

- **Severidade sugerida:** P0 — Crítica.
- **Ambiente observado:** Portal EsteiraHT.
- **Pré-condição:** proposta reutilizável em Cadastro e endereço do garantidor PF acessível.
- **Passos:**
  1. iniciar consulta do CEP A e manter a resposta pendente;
  2. informar um número do imóvel;
  3. substituir por CEP B antes da conclusão de A;
  4. liberar a resposta de A e, em seguida, responder B;
  5. observar CEP, logradouro, bairro e número após ambas as respostas.
- **Resultado atual:** os dados de A prevalecem mesmo sendo a resposta antiga; a resposta de B não corrige a tela e o número informado é apagado.
- **Resultado esperado:** somente a resposta correspondente ao CEP atualmente informado pode atualizar o formulário, sem apagar dados digitados pelo usuário sem contrato explícito.
- **Evidência automatizada relacionada:** `tests/core/fields/cep-api-contract.spec.ts`, cenário `CORE-5 | troca CEP durante consulta lenta sem aplicar resposta antiga`.
- **IDs CORE relacionados:** `CORE-CEP-07`, `CORE-CEP-08`, `CORE-CEP-09`, `CORE-CEP-12`.

## CORE-REG-010 — Campo obrigatório não expõe semântica de obrigatoriedade

- **Severidade sugerida:** P2 — Média.
- **Ambiente observado:** Portal EsteiraHT, viewport Pixel 7 (`412x839`).
- **Pré-condição:** proposta reutilizável em Cadastro, seção `Sobre Você` aberta e campo Renda visualmente marcado com asterisco.
- **Passos:**
  1. abrir a proposta pelo fluxo mobile autenticado;
  2. expandir `Sobre Você`;
  3. localizar Renda por sua label associada;
  4. inspecionar a semântica exposta pelo input.
- **Resultado atual:** a label está associada ao campo e apresenta asterisco, porém o input não possui `required` nem `aria-required="true"`.
- **Resultado esperado:** a obrigatoriedade deve ser identificável programaticamente, sem depender apenas do asterisco visual.
- **Evidência automatizada relacionada:** `tests/core/mobile/mobile-accessibility.spec.ts`, cenário `CORE-6 | navega, usa formulário e combobox por toque e teclado no mobile`; falha reproduzida em execuções consecutivas.
- **IDs CORE relacionados:** `CORE-A11Y-09`.

## CORE-REG-011 — Controle alcançado por Tab não apresenta foco visível

- **Severidade sugerida:** P2 — Média.
- **Ambiente observado:** Portal EsteiraHT, viewport Pixel 7 (`412x839`).
- **Pré-condição:** proposta reutilizável em Cadastro e formulário acessível por teclado.
- **Passos:**
  1. abrir a proposta e a seção `Sobre Você`;
  2. fechar o combobox por Escape;
  3. navegar pelos controles com Tab;
  4. inspecionar `:focus-visible`, outline e box-shadow do primeiro destino.
- **Resultado atual:** o controle recebe foco real e corresponde a `:focus-visible`, mas não possui outline nem box-shadow perceptível.
- **Resultado esperado:** todo controle alcançado pelo teclado deve apresentar um indicador visual de foco distinguível.
- **Evidência automatizada relacionada:** `tests/core/mobile/mobile-accessibility.spec.ts`, cenário `CORE-6 | navega, usa formulário e combobox por toque e teclado no mobile`; falha reproduzida em execuções consecutivas.
- **IDs CORE relacionados:** `CORE-A11Y-02`.

## CORE-REG-012 — Resumo de campos obrigatórios não revela a etapa selecionada

- **Severidade sugerida:** P1 — Alta.
- **Ambiente observado:** Portal EsteiraHT, viewport Pixel 7 (`412x839`).
- **Pré-condição:** proposta incompleta em Cadastro e ação `Confirmar` disponível no fim do formulário mobile.
- **Passos:**
  1. acionar `Confirmar` com campos obrigatórios ausentes;
  2. aguardar o diálogo `Revise o cadastro antes de concluir`;
  3. acionar `Sobre Você`, conforme a instrução “Clique na etapa para ir direto até ela”;
  4. observar a seção e o primeiro campo listado, Estado Civil.
- **Resultado atual:** o diálogo é fechado, mas a seção permanece recolhida e o campo Estado Civil não é revelado nem alcançado.
- **Resultado esperado:** a ação deve abrir/rolar para a etapa indicada e tornar o primeiro erro visível ou focado.
- **Evidência automatizada relacionada:** `tests/core/mobile/mobile-accessibility.spec.ts`, cenário `CORE-6 | mantém ação, erro e modal utilizáveis dentro da viewport`; falha reproduzida em execuções consecutivas.
- **IDs CORE relacionados:** `CORE-MOBILE-07`, `CORE-A11Y-08`.

## Política de acompanhamento

- As correções pertencem ao código do Portal, não a este repositório de automação.
- Os testes CORE-1, CORE-3, CORE-5, CORE-6 e do bloco imediato devem continuar falhando enquanto os respectivos contratos acima estiverem violados.
- Uma regressão só pode ser encerrada depois de uma execução real comprovar o resultado esperado, sem `test.fail()`, `fixme`, retry funcional ou enfraquecimento de assertion.
