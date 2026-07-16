# Portal Core — Plano do Batch Consumível

## 1. Objetivo e limites

Este documento define a ordem de execução futura do lote consumível do perfil `ht`, formado por:

- DOC A: `PORTAL_CORE_DOCUMENT_A_OPERATION`;
- DOC B: `PORTAL_CORE_DOCUMENT_B_OPERATION`;
- FINAL: `PORTAL_CORE_FINALIZATION_OPERATION`.

O objetivo é maximizar a evidência obtida antes de consumir slots documentais ou finalizar uma proposta. Este documento não autoriza a execução do lote e não transforma massas consumíveis em restauráveis.

Regras obrigatórias do lote:

- execução serial, com um worker e sem retries automáticos;
- reserva exclusiva das três operações durante a execução;
- nenhum uso fora do perfil `ht`;
- nenhum dado pessoal em fixtures, logs ou relatórios versionados;
- nenhuma inclusão no comando `pw:test:all`;
- nenhuma continuação silenciosa quando o estado observado divergir do checkpoint esperado;
- toda operação com estado incerto passa para `QUARANTINED`.

## 2. Inventário read-only

Inspeção realizada sem selecionar arquivos e sem acionar confirmação/finalização.

### 2.1 DOC A

- Estado funcional da tela: checklist de documentos acessível.
- Quantidade total: 5 slots.
- Quantidade vazia: 5 slots.
- Quantidade preenchida: 0 slots.
- Formatos declarados por todos os inputs: `.pdf`, `.jpg`, `.jpeg`, `.png`.
- Seleção múltipla: não suportada pelo mesmo input.
- Ação antes do primeiro upload: `Escolher arquivo`.
- Ação `Enviar novamente`: ausente enquanto o slot está pendente; aparece somente após upload aceito.

### 2.2 DOC B

- Estado funcional da tela: checklist de documentos acessível.
- Quantidade total: 5 slots.
- Quantidade vazia: 5 slots.
- Quantidade preenchida: 0 slots.
- Formatos declarados por todos os inputs: `.pdf`, `.jpg`, `.jpeg`, `.png`.
- Seleção múltipla: não suportada pelo mesmo input.
- Ação antes do primeiro upload: `Escolher arquivo`.
- Ação `Enviar novamente`: ausente enquanto o slot está pendente; aparece somente após upload aceito.

### 2.3 Contrato técnico observado do upload

- Endpoint: `POST /api/portal/propostas/{operacao}/documentos`.
- A operação de destino está explícita na URL.
- O multipart contém `arquivo`, `documentoId` e `pessoaId`.
- O slot e a pessoa de destino estão, portanto, explícitos na request.
- O frontend só muda o item para o estado enviado após receber resposta HTTP aceita e processar o JSON de sucesso.
- Selecionar o arquivo coloca o controle em fila/envio, mas não comprova persistência.
- O frontend valida extensão e tamanho; a validação do conteúdo real precisa ser comprovada pelo backend.
- Limite configurado observado no perfil `ht`: 10 MB. As fixtures deste lote serão pequenas e não exercitarão o limite tenant.
- Concorrência configurada observada: 1 upload por vez na fila da página.
- Seleções rápidas em controles diferentes são suportadas como ações concorrentes do usuário, mas as requests são serializadas pela fila. O teste não deve afirmar paralelismo de rede.
- Visualização/download usa a operação e o identificador do documento; o conteúdo final deve ser comprovado por nome e digest, não apenas pelo texto da UI.

### 2.4 FINAL

Estado observado:

- a operação abre em `Cadastro da Proposta`;
- a aba ativa ainda é `Sobre Você`;
- existem campos obrigatórios pendentes em `Sobre Você` e `Imóvel`;
- a ação disponível é `Confirmar e avançar cadastro`;
- não existe, no estado atual, a ação final `Confirmar` da última aba aplicável;
- a operação não está no ponto imediatamente anterior ao `POST /finalizar`.

Classificação obrigatória atual: `QUARANTINED`.

FINAL não pode ser usada para `CORE-CONC-03` até ser requalificada por uma atividade separada e aprovada. O lote documental pode prosseguir independentemente, mas a etapa de finalização deve ser ignorada.

## 3. Mapa exato de slots

Os índices abaixo são lógicos e devem ser resolvidos pelo rótulo exato, nunca por posição estrutural isolada.

| Operação | Slot lógico | Rótulo exato | Estado observado | Uso reservado |
|---|---:|---|---|---|
| DOC A | A0 | `Holerite 1*` | vazio | JPG, reenvio e substituição |
| DOC A | A1 | `Holerite 2*` | vazio | PNG aceito e seleção concorrente |
| DOC A | A2 | `Holerite 3*` | vazio | falha 500 e retry real |
| DOC A | A3 | `IRPF - Imposto de Renda*` | vazio | refresh durante upload |
| DOC A | A4 | `IRPF - Recibo de entrega*` | vazio | alternância A/B com seleção pendente e abortada |
| DOC B | B0 | `Holerite 1*` | vazio | conteúdo PNG com extensão PDF; JPG renomeado se necessário |
| DOC B | B1 | `Holerite 2*` | vazio | extensão e MIME incompatíveis |
| DOC B | B2 | `Holerite 3*` | vazio | PDF válido renomeado para JPG |
| DOC B | B3 | `IRPF - Imposto de Renda*` | vazio | PDF corrompido |
| DOC B | B4 | `IRPF - Recibo de entrega*` | vazio | PDF válido e isolamento persistente A/B |

O asterisco faz parte do texto visual de obrigatoriedade, mas a resolução do locator deve tolerar sua representação semântica separada quando necessário.

## 4. Fixtures determinísticas

As fixtures deverão ser geradas em memória ou em diretório temporário por execução. Nenhuma fixture grande será versionada.

| Fixture lógica | Conteúdo real | Nome/extensão apresentada | MIME declarado | Finalidade |
|---|---|---|---|---|
| `valid-pdf` | PDF mínimo válido com marcador textual único | `.pdf` | `application/pdf` | persistência, retry e refresh |
| `valid-jpg-v1` | JPEG mínimo válido com marcador/digest V1 | `core-collision.jpg` | `image/jpeg` | formato permitido e primeira versão |
| `valid-jpg-v2` | JPEG mínimo válido com conteúdo/digest V2 | `core-collision.jpg` | `image/jpeg` | colisão de nome e substituição |
| `valid-png` | PNG mínimo válido com marcador/digest único | `.png` | `image/png` | formato permitido |
| `corrupt-pdf` | cabeçalho/estrutura PDF incompleta, sem fechamento válido | `.pdf` | `application/pdf` | rejeição real de PDF corrompido |
| `png-as-pdf` | bytes PNG | `.pdf` | `application/pdf` | extensão não compatível com conteúdo |
| `png-mime-mismatch` | bytes PNG | `.pdf` | `image/png` | divergência entre conteúdo, extensão e MIME |
| `jpg-as-pdf` | bytes JPEG | `.pdf` | `image/jpeg` | JPG renomeado |
| `pdf-as-jpg` | bytes PDF válido | `.jpg` | `image/jpeg` | PDF renomeado |

Cada conteúdo aceito terá digest SHA-256 conhecido. A visualização/download posterior deverá reproduzir esse digest ou, quando o visualizador transformar o arquivo, comprovar um marcador interno inequívoco.

## 5. Cenários documentais compostos

### D1 — Destino pendente A/B sem persistência

Objetivo: provar que uma seleção destinada a DOC A não é enviada ou reaproveitada em DOC B durante alternância de proposta.

Sequência:

1. reservar DOC A e DOC B;
2. abrir A4 em DOC A;
3. interceptar o POST exato de DOC A antes de encaminhá-lo ao backend;
4. selecionar `valid-pdf` em A4 e manter a request bloqueada antes de `continue`/`fetch`;
5. abrir DOC B e confirmar que nenhum POST com a operação B foi produzido;
6. confirmar que o nome do arquivo de A não aparece em B;
7. abortar a request ainda não encaminhada;
8. recarregar DOC A e DOC B;
9. comprovar que A4 e todos os slots de B continuam vazios.

Resultado esperado: nenhuma persistência e nenhum slot consumido.

IDs: `ISOLATION-08` e evidência preparatória de `ISOLATION-02`.

Falha crítica: se não for possível provar que a request não alcançou o backend, DOC A será `QUARANTINED`.

### D2 — Validação real de conteúdo incompatível

Objetivo: exercitar o backend real antes dos uploads válidos e aproveitar slots ainda vazios.

Sequência planejada em DOC B:

- B0: `png-as-pdf`;
- B0, após a primeira resposta e apenas se o estado permanecer conhecido: `jpg-as-pdf`;
- B1: `png-mime-mismatch`;
- B2: `pdf-as-jpg`;
- B3: `corrupt-pdf`.

Contrato por tentativa:

- observar a resposta real, sem presumir previamente HTTP 415;
- se rejeitada: exigir ausência de confirmação, slot vazio após reload e controle novamente utilizável;
- se aceita: registrar falha funcional do contrato de conteúdo, comprovar o conteúdo persistido e marcar o slot como consumido;
- nunca apagar ou chamar de restaurado um documento aceito;
- interromper o uso da operação se a resposta ou o conteúdo final não puderem ser determinados.

Resultado esperado pelo risco testado: cinco rejeições reais e nenhum slot consumido. Uma aceitação inesperada é evidência automatizada de regressão e muda DOC B para `PARTIALLY_CONSUMED`.

IDs: `DOC-CORE-28`, `DOC-CORE-29`, `DOC-CORE-30`, `DOC-CORE-31`, `DOC-CORE-32`.

### D3 — Formatos aceitos, reenvio, colisão, substituição e fila

#### D3.1 — A0: JPG, reenvio e conteúdo com mesmo nome

1. enviar `valid-jpg-v1` para A0;
2. exigir sucesso real, visualizar/baixar e comprovar digest V1;
3. usar `Enviar novamente` no mesmo slot com o mesmo arquivo V1;
4. exigir um único item lógico no slot e digest V1;
5. usar `Enviar novamente` com `valid-jpg-v2`, mantendo o mesmo nome;
6. exigir um único item lógico no slot e digest V2, diferente de V1.

Resultado: três uploads aceitos no mesmo slot; A0 consumido com V2.

IDs: `DOC-CORE-03`, `DOC-CORE-18`, `DOC-CORE-19`, `DOC-CORE-23`.

`DOC-CORE-23` deixa de depender de restauração porque o contrato aqui é substituição real numa massa consumível. O conteúdo anterior não é restaurado.

#### D3.2 — A1/A2: ações concorrentes, falha e retry

1. selecionar rapidamente `valid-png` em A1 e `valid-pdf` em A2;
2. permitir sucesso real de A1;
3. responder HTTP 500 controlado somente para a tentativa de A2;
4. comprovar no máximo uma request ativa por vez;
5. comprovar operação, `documentoId` e `pessoaId` corretos para cada controle;
6. exigir A1 persistido e A2 vazio/desbloqueado após a falha;
7. repetir A2 contra o backend real;
8. exigir sucesso, reload e conteúdo correto em A2.

Resultado: A1 e A2 consumidos; uma falha controlada sem falsa persistência; retry real aceito.

IDs: `DOC-CORE-04`, `DOC-CORE-20`, `CORE-CONC-07`, `DOC-NET-10`.

O risco comprovado é o tratamento seguro de ações concorrentes do usuário com fila serial. Não será alegada simultaneidade de requests que a UI não suporta.

### D4 — Refresh durante upload

Objetivo: distinguir request abortada, persistência aceita pelo backend e estado fantasma somente no frontend.

Fase A — aborto antes do backend:

1. bloquear a tentativa de `valid-pdf` para A3 antes de encaminhá-la;
2. recarregar a página;
3. abortar a request;
4. reabrir a proposta e exigir A3 vazio, sem nome ou status fantasma.

Fase B — backend aceitou antes do refresh:

1. iniciar nova tentativa em A3;
2. encaminhar com `route.fetch()` e aguardar a resposta real de sucesso do backend;
3. reter apenas a entrega da resposta ao frontend;
4. recarregar a página antes de entregar essa resposta à página antiga;
5. fazer nova leitura real do checklist;
6. exigir exatamente um documento em A3;
7. visualizar/baixar e comprovar o digest esperado.

Resultado: uma tentativa abortada sem persistência e uma tentativa aceita com exatamente uma persistência.

IDs: `DOC-NET-12`, `DOC-CORE-26`, `CORE-JOURNEY-03`.

### D5 — Isolamento persistente A/B e nova sessão

1. enviar um `valid-pdf` distinto para B4;
2. exigir sucesso real e comprovar seu digest;
3. recarregar DOC A e DOC B;
4. comprovar que os nomes/digests de A aparecem somente em A;
5. comprovar que o nome/digest de B4 aparece somente em B;
6. comprovar pelas requests a operação, o `documentoId` e o `pessoaId` corretos;
7. encerrar a sessão autenticada do Portal e obter uma sessão genuinamente nova pelo fluxo oficial;
8. reabrir A e B;
9. repetir as provas de persistência, conteúdo e ausência de cruzamento.

Resultado: B4 consumido; persistência real após refresh e nova sessão; isolamento A/B comprovado.

IDs: `ISOLATION-02`, `DOC-CORE-26`, `DOC-CORE-27`, `CORE-JOURNEY-03`.

## 6. Finalização futura — F1

F1 não é executável com a massa FINAL no estado observado.

### Pré-condição para retirar FINAL da quarentena

Uma atividade separada deverá comprovar:

- cadastro integralmente preenchido e salvo;
- última aba aplicável `Imóvel` ativa;
- botão final exato `Confirmar` visível e habilitado;
- nenhum `POST /api/portal/propostas/{FINAL}/finalizar` anterior;
- estado pré-finalização reproduzível numa nova leitura.

### Gatilho duplicado planejado

- Se `Confirmar` abrir um diálogo intermediário: clicar uma vez no botão da página e aplicar o gatilho duplicado no botão `Confirmar` do diálogo, pois esse é o disparador real do POST.
- Se não houver diálogo: aplicar duplo clique real no botão final da página.
- Armar o contador da request exata imediatamente antes do gatilho que efetivamente dispara `/finalizar`.

### Contrato esperado

- exatamente um `POST /api/portal/propostas/{FINAL}/finalizar`;
- HTTP 200 e corpo com sucesso verdadeiro;
- ação desabilitada durante a request pendente;
- um único feedback/transição funcional;
- nenhuma segunda consequência;
- após reload, a operação não permanece no estado pré-finalização;
- massa marcada como `CONSUMED`.

ID principal: `CORE-CONC-03`.

`CORE-NAV-05` só será considerado coberto se a mesma execução provar integralmente que o gatilho duplicado produziu uma única transição lógica. Não será criado cenário artificial separado. Como FINAL está em quarentena, ambos permanecem sem nova evidência neste momento.

## 7. Matriz cenário, operação, slot e cobertura

| Ordem | Cenário | Operação | Slot(s) | Requests aceitas planejadas | Rejeitadas/controladas | IDs principais | Dependência posterior |
|---:|---|---|---|---:|---:|---|---|
| 1 | D1 destino pendente | DOC A/B | A4; leitura de B | 0 | 1 abortada antes do backend | `ISOLATION-08` | A4 deve permanecer vazio |
| 2 | D2 conteúdo incompatível | DOC B | B0, B1, B2, B3 | 0 esperadas | 5 rejeições reais esperadas | `DOC-CORE-28` a `32` aplicáveis | B4 deve permanecer vazio; B0-B3 idealmente vazios |
| 3 | D3.1 reenvio/substituição | DOC A | A0 | 3 | 0 | `DOC-CORE-03`, `18`, `19`, `23` | digest V2 vira estado final de A0 |
| 4 | D3.2 fila, 500 e retry | DOC A | A1, A2 | 2 | 1 HTTP 500 controlado | `DOC-CORE-04`, `20`, `CORE-CONC-07`, `DOC-NET-10` | A1/A2 persistidos |
| 5 | D4 refresh | DOC A | A3 | 1 | 1 abortada antes do backend | `DOC-NET-12`, `DOC-CORE-26`, `CORE-JOURNEY-03` | A3 persistido uma vez |
| 6 | D5 isolamento e sessão | DOC A/B | leitura A0-A3; upload B4 | 1 | 0 | `ISOLATION-02`, `DOC-CORE-26`, `27`, `CORE-JOURNEY-03` | A/B consumidas |
| 7 | F1 dupla finalização | FINAL | não aplicável | 1 POST de finalização | segunda consequência deve ser 0 | `CORE-CONC-03`; talvez `CORE-NAV-05` | bloqueado pela quarentena |

Totais documentais planejados no caminho esperado:

- 7 uploads aceitos;
- 5 slots finais consumidos: A0, A1, A2, A3 e B4;
- 5 tentativas inválidas rejeitadas pelo backend real;
- 1 tentativa com HTTP 500 controlado;
- 2 requests abortadas antes de alcançar o backend;
- 5 cenários documentais compostos.

Uma aceitação inesperada em D2 aumenta a quantidade real de uploads aceitos e consome o respectivo slot; ela não pode ser ocultada nos totais finais.

## 8. Ordem e checkpoints de consumo

1. validar novamente o inventário vazio de DOC A/B;
2. reservar DOC A/B para uma única execução;
3. executar D1, que precisa de destino pendente e não deve persistir;
4. executar D2, que precisa de slots vazios e consulta o backend real;
5. executar D3.1 no slot A0;
6. executar D3.2 nos slots A1/A2;
7. executar D4 no slot A3;
8. executar D5 usando os documentos já persistidos em A e o slot B4;
9. emitir relatório final e marcar DOC A/B como consumidas;
10. não executar F1 enquanto FINAL estiver `QUARANTINED`.

## 9. Controle de estado das massas

| Estado | Definição | Próxima ação permitida |
|---|---|---|
| `READY` | inventário conhecido e pré-condições intactas | reservar para uma execução |
| `RESERVED` | operação bloqueada para o batch, sem ação iniciada | iniciar o primeiro cenário |
| `IN_PROGRESS` | cenário atual executando, sem upload aceito ainda | continuar no checkpoint atual |
| `PARTIALLY_CONSUMED` | ao menos um upload foi aceito, mas o batch não terminou | retomar somente após provar todos os slots/digests conhecidos |
| `CONSUMED` | todas as evidências planejadas foram coletadas e o estado final é conhecido | apenas leitura/auditoria; nunca reutilizar como vazia |
| `QUARANTINED` | estado, destino, resposta ou conteúdo final incerto | nenhuma reutilização até requalificação explícita |

Estado inicial após esta inspeção:

| Massa | Estado |
|---|---|
| DOC A | `READY` |
| DOC B | `READY` |
| FINAL | `QUARANTINED` |

## 10. Estratégia de falha parcial

### Falha antes do primeiro upload aceito

- abortar requests ainda retidas;
- recarregar a operação;
- provar que todos os slots continuam vazios;
- somente então retornar de `IN_PROGRESS` para `READY`;
- se a prova falhar, usar `QUARANTINED`.

### Falha depois de consumir um slot

- marcar a operação como `PARTIALLY_CONSUMED`;
- registrar slots, nomes, IDs de documento e digests confirmados;
- retomar apenas do próximo checkpoint se uma nova leitura reproduzir exatamente esse estado;
- se o estado divergir ou o conteúdo não puder ser comprovado, usar `QUARANTINED`.

### Operação em estado inesperado

- não navegar artificialmente para corrigir a massa durante o batch;
- não trocar silenciosamente por outra operação;
- marcar `QUARANTINED` e interromper os cenários que dependem dela.

### Aceitação inesperada de arquivo inválido

- registrar a resposta real e a persistência como evidência de regressão;
- marcar o slot como consumido;
- continuar apenas se o conteúdo persistido e todos os próximos destinos ainda forem inequívocos;
- caso contrário, colocar DOC B em `QUARANTINED`.

### Relatório sem prova de conteúdo

- nome e status visual não bastam para colisão/substituição;
- sem digest ou marcador interno verificável, o cenário não conclui o ID;
- a operação afetada deve ficar `QUARANTINED` até inspeção controlada.

## 11. Critérios finais

### `CONSUMED`

DOC A/B só recebem `CONSUMED` quando:

- todas as requests aceitas possuem operação e slot comprovados;
- o inventário final foi relido do backend;
- todos os documentos finais têm conteúdo comprovado;
- não existe arquivo cruzado entre A e B;
- a nova sessão reproduz o mesmo estado;
- todos os desvios foram registrados.

FINAL só recebe `CONSUMED` depois de uma futura F1 aprovada e executada com exatamente uma consequência de finalização.

### `QUARANTINED`

Aplicar imediatamente quando ocorrer qualquer um destes casos:

- operação fora do estado esperado;
- request que pode ter alcançado o backend sem resposta conhecida;
- associação de operação, slot ou pessoa ambígua;
- documento visualmente presente sem conteúdo comprovável;
- divergência entre o ledger e a nova leitura;
- falha após consumo parcial sem checkpoint reproduzível.

## 12. Cobertura esperada

O planejamento, por si só, não altera a matriz atual.

### Situação antes da execução

Entre os 19 IDs documentais deste lote:

- 7 estão `PARTIAL`;
- 9 estão `MISSING`;
- 3 estão `BLOCKED`.

`CORE-CONC-03` permanece `MISSING`. `CORE-NAV-05` também permanece `MISSING`.

### Alvo após execução documental bem-sucedida

Os 19 IDs abaixo poderão passar a `COVERED`, desde que a evidência descrita seja efetivamente obtida:

- `DOC-CORE-03`;
- `DOC-CORE-04`;
- `DOC-CORE-18`;
- `DOC-CORE-19`;
- `DOC-CORE-20`;
- `DOC-CORE-23`;
- `DOC-CORE-26`;
- `DOC-CORE-27`;
- `DOC-CORE-28`;
- `DOC-CORE-29`;
- `DOC-CORE-30`;
- `DOC-CORE-31`;
- `DOC-CORE-32`;
- `DOC-NET-10`;
- `DOC-NET-12`;
- `CORE-CONC-07`;
- `ISOLATION-02`;
- `ISOLATION-08`;
- `CORE-JOURNEY-03`.

Projeção da matriz geral após somente o lote documental, sem antecipar resultados:

| Status | Atual | Alvo após evidência documental completa |
|---|---:|---:|
| `COVERED` | 145 | 164 |
| `PARTIAL` | 13 | 6 |
| `MISSING` | 29 | 20 |
| `BLOCKED` | 7 | 4 |
| `NOT_APPLICABLE` | 4 | 4 |
| Total | 198 | 198 |

Essa projeção não deve ser aplicada à matriz até os testes existirem e as evidências serem revisadas.

### Finalização

- `CORE-CONC-03`: continua `MISSING` enquanto FINAL estiver `QUARANTINED`.
- `CORE-NAV-05`: não será considerado coberto agora. Poderá ser coberto pela futura F1 apenas se a mesma evidência provar uma única transição lógica após o gatilho duplicado.

## 13. Arquivos futuros e comandos isolados

Arquivos planejados, não criados nesta etapa:

- `tests/core/consumable/document-batch.spec.ts`;
- `tests/core/consumable/finalization-batch.spec.ts`.

Tags planejadas: `@core`, `@mutation` e `@consumable`.

Execução documental isolada futura:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npx playwright test tests/core/consumable/document-batch.spec.ts --project=core --workers=1
```

Execução futura da finalização, somente após requalificar FINAL:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npx playwright test tests/core/consumable/finalization-batch.spec.ts --project=core --workers=1
```

Execução headed para diagnóstico controlado:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npx playwright test tests/core/consumable/document-batch.spec.ts --project=core --workers=1 --headed
```

O batch consumível não fará parte de `pw:test:all`. O runner atual desse comando executa smoke, funcionais, simulador e integrações, mas não o projeto `core`. Além disso, os arquivos consumíveis deverão ser sempre chamados explicitamente por caminho e tag.

## 14. Decisão final do planejamento

- DOC A: 5 slots disponíveis e apta ao lote.
- DOC B: 5 slots disponíveis e apta ao lote.
- FINAL: não apta; permanece `QUARANTINED`.
- Capacidade documental: 5 cenários compostos.
- Caminho esperado: 7 uploads aceitos, 5 rejeições reais, 1 falha HTTP controlada e 2 abortos antes do backend.
- Slots finais consumidos no caminho esperado: 5.
- Cobertura documental potencial: 19 IDs.
- Finalização potencial futura: `CORE-CONC-03`; `CORE-NAV-05` somente mediante prova integral na mesma execução.
- Maior risco de desperdício: backend aceitar conteúdo inválido e consumir B0-B3.
- Segundo maior risco: perder a certeza sobre uma request durante refresh, exigindo quarentena.
- FINAL não deve ser corrigida, avançada ou consumida dentro deste batch documental.

## 15. Resultado real do batch documental

Execução concluída em C6 HT, perfil `ht`, com um worker e retries desabilitados. O preflight read-only comprovou cinco slots vazios em DOC A e DOC B antes do primeiro upload. A execução foi retomada apenas por checkpoints explícitos depois das primeiras aceitações inesperadas; nenhum slot aceito foi reutilizado como vazio e o lote não foi reiniciado.

### 15.1 Planejamento versus execução

| Métrica | Planejado | Observado |
|---|---:|---:|
| Cenários D1–D5 | 5 aprovados | 5 aprovados |
| Testes Playwright | 3 compostos | 3 passaram |
| Workers | 1 | 1 |
| Retries | 0 | 0 |
| Uploads aceitos | 7 no caminho ideal | 11 |
| Tentativas rejeitadas/interrompidas | 8 | 3: um HTTP 500 e dois aborts controlados |
| DOC A ocupados | 4 | 4 |
| DOC B ocupados | 1 no caminho ideal | 5 |
| Duração | não estimada | aproximadamente 6,2 minutos |

A diferença principal foi D2: o backend real aceitou todas as cinco amostras incompatíveis/corrompidas. Cada aceitação foi confirmada por resposta de sucesso, estado `Documento enviado`, nova leitura e digest dos bytes persistidos.

### 15.2 Ledger final de slots

| Massa | Slot | Arquivo persistido | Resultado final |
|---|---:|---|---|
| DOC A | A0 — `Holerite 1*` | `core-collision.jpg`, conteúdo final V2 | `CONSUMED`; reenvio e substituição mantiveram um item lógico |
| DOC A | A1 — `Holerite 2*` | `core-allowed.png` | `CONSUMED` |
| DOC A | A2 — `Holerite 3*` | `core-retry.pdf` | `CONSUMED`; primeira tentativa HTTP 500, retry real aceito |
| DOC A | A3 — `IRPF - Imposto de Renda*` | `core-refresh.pdf` | `CONSUMED`; exatamente uma persistência após refresh |
| DOC A | A4 — `IRPF - Recibo de entrega*` | nenhum | `READY` no slot, mas a operação inteira permanece `CONSUMED` |
| DOC B | B0 — `Holerite 1*` | `core-content-mismatch.pdf.png` | `CONSUMED`; bytes PNG apresentados como PDF |
| DOC B | B1 — `Holerite 2*` | `core-mime-mismatch.pdf.png` | `CONSUMED`; conteúdo, extensão e MIME divergentes |
| DOC B | B2 — `Holerite 3*` | `core-pdf-renamed.jpg.pdf` | `CONSUMED`; PDF apresentado como JPG |
| DOC B | B3 — `IRPF - Imposto de Renda*` | `core-corrupted.pdf` | `CONSUMED`; PDF corrompido |
| DOC B | B4 — `IRPF - Recibo de entrega*` | `core-jpg-renamed.pdf.jpg` | `CONSUMED`; JPEG apresentado como PDF |

DOC A e DOC B usam exclusivamente as operações configuradas em `PORTAL_CORE_DOCUMENT_A_OPERATION` e `PORTAL_CORE_DOCUMENT_B_OPERATION`. Nenhum número de operação foi fixado na spec.

### 15.3 Requests e pós-condições

- todas as requests reais aceitas foram `POST /api/portal/propostas/{operação}/documentos` e retornaram sucesso;
- operação, `documentoId`, `pessoaId`, nome e slot foram conferidos no multipart;
- o HTTP 500 foi simulado somente no endpoint exato de DOC A e não produziu documento nem confirmação indevida;
- os dois aborts ocorreram antes de encaminhar a request ao backend e não deixaram documento fantasma;
- loading terminou e o controle voltou a ficar utilizável após cada falha controlada;
- o retry real persistiu o arquivo no mesmo slot esperado;
- reload e nova sessão preservaram nomes e digests;
- alternar DOC A/B não gerou request para a operação errada nem exibiu conteúdo cruzado;
- a URL real de visualização permitiu reler os bytes persistidos e comparar SHA-256; isso comprova armazenamento e recuperação, mas não afirma que um visualizador consegue renderizar PDF corrompido ou conteúdo incompatível.

### 15.4 Cobertura consolidada

Passaram para `COVERED`: `DOC-CORE-03`, `DOC-CORE-04`, `DOC-CORE-18`, `DOC-CORE-19`, `DOC-CORE-20`, `DOC-CORE-23`, `DOC-CORE-26`, `DOC-CORE-27`, `DOC-NET-10`, `DOC-NET-12`, `CORE-CONC-07`, `ISOLATION-02`, `ISOLATION-08` e `CORE-JOURNEY-03`.

`DOC-CORE-28` a `DOC-CORE-32` ficam como `REQUIRES_DOMAIN_CONTRACT`: o comportamento real foi integralmente observado, mas não existe contrato formal exigindo rejeição por assinatura/magic bytes, MIME real, coerência de extensão ou integridade. Não foi criada regressão nova. O risco residual é armazenar um arquivo que outro componente não consiga abrir, processar ou classificar.

A restauração de uma versão documental anterior continua sem mecanismo legítimo. Ela não invalida a prova de substituição de `DOC-CORE-23`, mas impede chamar o slot ou a operação de restaurável.

### 15.5 Estado operacional e proibição de reexecução

| Massa | Lifecycle | Estado final | Regra |
|---|---|---|---|
| DOC A | `SEEDABLE_CONSUMABLE` | `CONSUMED` | Quatro slots ocupados e um vazio; não reutilizar em outro batch |
| DOC B | `SEEDABLE_CONSUMABLE` | `CONSUMED` | Cinco slots ocupados; não reutilizar |
| CAD A | `RESTORABLE` | inalterada | Não foi acessada |
| CAD B | `RESTORABLE` | inalterada | Não foi acessada |
| FINAL | `SEEDABLE_CONSUMABLE` | `QUARANTINED` | Não foi acessada nem alterada |

Não executar novamente, sobre essas operações:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npm run pw:test:core:consumable-documents
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npm run pw:provision:core-masses
```

O batch permanece fora de `pw:test:all` e só pode ser usado novamente depois de provisionar e qualificar um novo par DOC A/B vazio.
