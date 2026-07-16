# Plano de Massas Restauráveis — Portal Core

## Contexto e decisão principal

Este documento prepara exclusivamente a infraestrutura de massas necessária para os gaps persistentes remanescentes do Portal Core em **EsteiraHT**. A baseline protegida permanece em **158 testes em 42 arquivos**, com **108/108 casos funcionais**, CORE-1 a CORE-6, o bloco imediato e as 12 regressões ativas.

A análise encontrou três lifecycles diferentes. Eles não devem ser tratados como equivalentes:

- propostas de **Cadastro** podem se tornar realmente restauráveis quando os valores originais forem capturados, restaurados pelo backend real e comprovados após nova leitura;
- propostas de **Documentos** não são restauráveis com a infraestrutura atual, porque não existe remoção legítima do arquivo persistido; elas devem ser descartadas e reprovisionadas;
- propostas em **pré-finalização** são consumidas pela própria transição que se pretende testar; devem ser criadas novamente para cada execução.

Portanto, o provisionamento de uma nova operação equivalente não será chamado de teardown nem de restauração. Esse lifecycle será classificado como `SEEDABLE_CONSUMABLE`.

Números de operação e CPFs não devem ser fixados neste documento. A associação deve permanecer no registro local de provisionamento e no overlay de massas do perfil, evitando dados pessoais e contratos de ambiente em documentação versionada.

## Estado operacional após a preparação

Em 15/07/2026, o conjunto dedicado foi preparado no perfil **C6 HT**, escolhido operacionalmente para esta execução. As associações reais permanecem exclusivamente no overlay local `ht`:

| Massa lógica | Estado comprovado | Lifecycle comprovado |
|---|---|---|
| DOC A | Batch D1–D5 concluído; quatro slots ocupados e um vazio; operação não reutilizável | `SEEDABLE_CONSUMABLE` — `CONSUMED` |
| DOC B | Batch D1–D5 concluído; cinco slots ocupados; operação não reutilizável | `SEEDABLE_CONSUMABLE` — `CONSUMED` |
| FINAL | Não foi acessada pelo batch; permanece fora do ponto final comprovado | `SEEDABLE_CONSUMABLE` — `QUARANTINED` |
| CAD A | Marcador temporário persistido, relido, restaurado e relido novamente | `RESTORABLE` |
| CAD B | Marcador temporário persistido, relido, restaurado e relido novamente | `RESTORABLE` |

A preparação é executada separadamente da suíte regular por `pw:provision:core-masses`. DOC A/B e FINAL não podem ser reprovisionadas sobre as mesmas operações depois do consumo. A qualificação de CAD A/B exige resposta do `PUT /cadastro` correspondente ao valor enviado e nova leitura do backend após a restauração.

## 1. Capacidades necessárias

| Grupo | Capacidade mínima | Estado inicial exigido | Mutação dos futuros cenários | Pós-condição de infraestrutura |
|---|---|---|---|---|
| Documentos A/B | Duas propostas do mesmo usuário, ambas em Documentos, com pelo menos dois slots vazios e utilizáveis | Mesma identidade autenticável, etapa Documentos, nenhum arquivo nos slots reservados | Upload real, reenvio, substituição, concorrência e refresh | Cada operação deve ser descartada após persistir arquivo, salvo se surgir mecanismo legítimo de remoção e prova de reset |
| Pré-finalização | Uma proposta com Cadastro completo, último passo aplicável ativo e ação final habilitada | Todos os PUTs obrigatórios concluídos, nenhum POST de finalização executado | Disparo repetido da conclusão | Operação marcada como consumida após a primeira transição bem-sucedida |
| Cadastro A/B | Duas propostas comparáveis, do mesmo usuário, simultaneamente editáveis em Cadastro | Mesmos mecanismos de formulário e baseline conhecida por operação | Marcadores distintos, payload A/B, troca de seção/aba e isolamento de aviso | Valores restaurados pelo backend real e comprovados após reload/nova leitura |

Capacidade adicional obrigatória para todos os grupos:

- reserva exclusiva por execução, sem compartilhamento com os 108 casos funcionais;
- registro de operação, finalidade, ambiente, identidade lógica, estado e lifecycle;
- validação do estado real antes do teste, sem confiar apenas no status do arquivo de registro;
- serialização por par ou seed para impedir consumo concorrente;
- falha explícita quando setup, transição ou restauração não puderem ser comprovados.

## 2. Massas atuais disponíveis

O lote atual de EsteiraHT possui 15 slots registrados. Nenhuma operação atual satisfaz integralmente a cadeia exigida para ser chamada de `RESTORABLE` nos novos cenários persistentes.

| Massa lógica atual | Estado/finalidade atual | Lifecycle honesto | Pode ser usada nos novos gaps? | Motivo |
|---|---|---|---|---|
| `DEFAULT` | Cadastro; baseline funcional e visual | `REUSABLE_READ_ONLY` para a baseline e mutável apenas nos testes que já restauram seus próprios campos | Não deve ser realocada | É massa central dos testes existentes |
| `TIMELINE_REGISTRATION` | Cadastro; timeline | `REUSABLE_READ_ONLY` | Não | É contrato funcional existente e possui identidade diferente de `DEFAULT` |
| `TIMELINE_DOCUMENTS` | Documentos; mesmo usuário de `DEFAULT` | `REUSABLE_READ_ONLY` para a baseline documental/timeline | Não | Está em estado diferente de `DEFAULT`; não forma par comparável de Cadastro |
| `DOCUMENT_PERSISTENCE` | Documentos; envio completo consome a operação | `SEEDABLE_CONSUMABLE` histórico | Não como seed limpo | O fluxo existente envia todos os documentos e avança a etapa; o registro `ready` não prova slots vazios |
| `DOCUMENT_SIZE` | Documentos; apenas arquivos rejeitados | `REUSABLE_READ_ONLY` | Somente para o contrato tenant já existente | Persistir arquivo nela quebraria a repetibilidade do teste de limite |
| `INTEGRATION_PJ/PF/PAID_OFF/WORKFLOW` | Estados dedicados às integrações Portal → SCCI | `MUTABLE_DEDICATED` ou já consumidas pelo fluxo proprietário | Não | Não podem ser desviadas sem impactar integrações aprovadas |
| `RESERVE` | Cadastro; reserva ainda não publicada como massa funcional | `MUTABLE_DEDICATED` | Condicionalmente, uma única vez, como seed de pré-finalização | O uso a consumiria e eliminaria a reserva operacional do lote |

Conclusão sobre reaproveitamento:

- **zero massas atuais** podem ser realocadas com segurança para os novos cenários persistentes sem alterar a finalidade da baseline;
- a massa `RESERVE` é a única candidata técnica para uma execução inicial de idempotência, mas seu uso exige decisão explícita de consumir a reserva;
- a recomendação é preservar o lote atual e provisionar seeds Core separados.

## 3. Capacidades reutilizáveis do simulador

### O que já existe

O fluxo atual do simulador:

1. cria uma simulação imobiliária pela UI real;
2. gera um CPF válido e ainda não usado no registro local;
3. envia a proposta e captura o protocolo real;
4. registra cenário, identidade, finalidade e operação em `.playwright/generated-simulations/<perfil>.json`;
5. valida a reflexão básica da simulação no SCCI;
6. produz inicialmente uma proposta na etapa de Cadastro.

Também já existem:

- autenticação do Portal por CPF/operação;
- registro manual de uma segunda proposta que compartilha o CPF de um slot existente (`manual-shared`);
- preparação completa de Cadastro e transição para Documentos nos fluxos de integração;
- Page Objects para Cadastro e Documentos;
- captura exata de `PUT /cadastro`, `POST /finalizar` e `POST /documentos`;
- validação de documento enviado, abertura do conteúdo e releitura da proposta;
- restauração real de campos individuais em testes existentes.

### Limites comprovados

O simulador, isoladamente, **não** atende às três capacidades solicitadas:

- ele cria uma proposta em Cadastro, não em Documentos nem em pré-finalização;
- uma nova criação usa CPF diferente;
- o Portal rejeita nova proposta pelo simulador quando já existe proposta para o mesmo CPF;
- o segundo membro de um par do mesmo usuário precisa hoje ser criado fora do simulador e registrado como `manual-shared`;
- o registro atual possui slots fixos e devolve a operação já associada ao slot; ele não cria gerações descartáveis sucessivas;
- `mark-ready` registra uma declaração operacional, mas não verifica automaticamente etapa, slots vazios ou conteúdo persistido;
- não existe no projeto ação legítima de DELETE/reset de documento nem retorno de proposta finalizada para Cadastro.

Assim, o simulador é reutilizável como **semeador do primeiro membro e de propostas consumíveis individuais**, mas precisa de uma camada futura de geração/lifecycle para suportar seeds descartáveis por execução.

## 4. Estratégia proposta por grupo

### 4.1 Duas propostas documentais do mesmo usuário

#### Criação e identidade

- criar a proposta documental A pelo simulador, com CPF válido novo;
- criar a proposta documental B com o mesmo CPF por um mecanismo legítimo externo já aceito pelo projeto;
- registrar B como `manual-shared` de A;
- não publicar CPF completo em documentação ou logs de relatório.

O projeto não possui hoje automação para criar B. O Admin automatizado apenas gera o link de acesso; ele não cria propostas.

#### Estado produzido e preparação

As duas propostas nascem em Cadastro. Para levá-las a Documentos, a infraestrutura futura deve reutilizar a jornada já comprovada em `prepare-workflow.spec.ts`:

1. preencher os campos obrigatórios do perfil mínimo;
2. salvar cada etapa pelo `PUT /api/portal/propostas/{operação}/cadastro`;
3. confirmar a última aba aplicável;
4. validar o `POST /api/portal/propostas/{operação}/finalizar` com sucesso real;
5. reabrir a proposta em nova leitura;
6. comprovar a etapa Documentos;
7. comprovar pelo menos dois slots utilizáveis e vazios.

A lógica funcional pode ser extraída posteriormente da preparação existente, mas não deve ser copiada para uma segunda jornada independente.

#### Lifecycle

Classificação: **`SEEDABLE_CONSUMABLE`**.

O Portal oferece `Escolher arquivo`/`Enviar novamente` e visualização, mas não oferece remoção. O projeto não contém endpoint legítimo de DELETE/reset documental. Depois de um upload real, o mesmo slot da mesma operação não pode ser declarado restaurado.

Existem duas estratégias válidas, com lifecycles diferentes:

- **restaurar o mesmo slot da mesma operação:** `BLOCKED`;
- **descartar o par e provisionar outro par equivalente:** viável como `SEEDABLE_CONSUMABLE`, mas não é teardown.

Com apenas dois slots garantidos, cenários documentais que precisem de estados limpos distintos devem receber um novo par ou ser organizados em um único batch serial cuja ordem e consumo sejam explícitos.

### 4.2 Proposta pré-finalização para idempotência

#### Criação e preparação

- criar uma proposta nova pelo simulador, com identidade própria;
- reutilizar os dados tipados e a sequência mínima da preparação de workflow;
- preencher e salvar todas as abas aplicáveis;
- parar no último passo antes do clique final;
- comprovar ação `Confirmar` visível e habilitada;
- comprovar que nenhum `POST /finalizar` ocorreu durante o setup.

O fluxo atual `prepare-workflow.spec.ts` não oferece esse ponto de parada: ele preenche e finaliza no mesmo teste. A futura infraestrutura deve reutilizar a jornada, separando apenas o boundary entre “Cadastro preparado” e “transição final”, sem duplicar regras de preenchimento.

#### Lifecycle

Classificação: **`SEEDABLE_CONSUMABLE`**.

A primeira conclusão bem-sucedida muda a fase da operação. Não existe retorno legítimo automatizado à pré-finalização. O cenário de dupla conclusão deve receber uma operação nova por execução.

O slot `RESERVE` poderia servir apenas à primeira prova, mas a estratégia permanente exige geração descartável. O registro atual precisa aceitar gerações/run IDs novos em vez de reutilizar silenciosamente um protocolo já associado ao mesmo slot.

### 4.3 Duas propostas comparáveis em Cadastro

#### Criação e identidade

- criar A pelo simulador;
- criar B manualmente com o mesmo CPF e registrar `sharedCpfWith: A`;
- manter ambas em Cadastro;
- usar o mesmo cenário financeiro e o mesmo perfil funcional;
- validar que cada operação abre a própria proposta antes de qualquer mutação.

#### Mutação e restauração

Para aba, marcador persistente e payload A/B:

1. capturar o snapshot original dos campos escolhidos nas duas operações;
2. escolher campos opcionais já comprovadamente persistíveis no Portal;
3. gravar marcadores distintos por `PUT /cadastro` real;
4. alternar A/B e comprovar ausência de cruzamento;
5. restaurar os snapshots originais, novamente pelo backend real;
6. recarregar e reabrir cada proposta;
7. exigir igualdade exata com o snapshot e ausência dos marcadores temporários.

Classificação inicial: **`MUTABLE_DEDICATED`**. O par só passa a **`RESTORABLE`** depois que a cadeia acima for executada com sucesso em uma qualificação própria.

#### Alerta “Não mostrar novamente”

O teste atual comprova que o aviso permanece oculto após reload, mas não identifica nem reverte o armazenamento dessa decisão. Não é seguro presumir que o estado seja por operação, por usuário, cookie ou backend.

Consequências:

- o par de Cadastro pode ser `RESTORABLE` para campos, payloads e estado navegacional;
- `ISOLATION-05` permanece `BLOCKED` até o mecanismo real do alerta e sua restauração serem identificados;
- se não existir reset legítimo, o alerta deve usar um novo par/identidade como `SEEDABLE_CONSUMABLE`, executado por último, sem contaminar o par restaurável.

## 5. Classificação de lifecycle

| Recurso planejado | Classificação inicial | Classificação possível após qualificação | Observação |
|---|---|---|---|
| Documento A | `SEEDABLE_CONSUMABLE` | Não passa a `RESTORABLE` com a UI/API atual | Upload aceito ocupa o slot |
| Documento B, mesmo usuário de A | `SEEDABLE_CONSUMABLE` | Não passa a `RESTORABLE` com a UI/API atual | Criação ainda exige etapa manual |
| Pré-finalização | `SEEDABLE_CONSUMABLE` | Não passa a `RESTORABLE` | Finalização consome a fase |
| Cadastro A | `MUTABLE_DEDICATED` | `RESTORABLE` | Depende de snapshot, PUT de restauração e nova leitura |
| Cadastro B, mesmo usuário de A | `MUTABLE_DEDICATED` | `RESTORABLE` | Criação ainda exige etapa manual |
| Estado de alerta do usuário | `BLOCKED` | `RESTORABLE` ou `SEEDABLE_CONSUMABLE` | Depende da descoberta do armazenamento e de reset legítimo |
| Massas existentes usadas somente pela baseline | `REUSABLE_READ_ONLY` | Sem mudança | Não devem receber novas mutações persistentes |
| `RESERVE` atual | `MUTABLE_DEDICATED` | `SEEDABLE_CONSUMABLE` se alocada | Uso opcional e único para pré-finalização |

Definições adotadas:

- `RESTORABLE`: a mesma operação retorna automaticamente ao estado original e essa condição é comprovada após nova leitura;
- `REUSABLE_READ_ONLY`: pode ser lida repetidamente, mas não deve receber a mutação do novo cenário;
- `MUTABLE_DEDICATED`: reservada à qualificação/mutação, mas ainda sem restauração comprovada;
- `SEEDABLE_CONSUMABLE`: uma operação equivalente pode ser criada e preparada novamente, mas a operação usada não volta ao estado original;
- `BLOCKED`: não existe hoje criação, reset ou prova honesta suficiente.

## 6. Estratégia de setup

### 6.1 Registro futuro necessário

A infraestrutura deve manter as massas Core separadas do lote funcional publicado. Cada entrada deve registrar, no mínimo:

- identificador lógico e geração/run ID;
- operação;
- perfil `esteira-ht`;
- finalidade;
- referência à identidade lógica, sem CPF exposto em relatório;
- operação parceira, quando houver par A/B;
- estado esperado;
- lifecycle;
- timestamp de criação e preparação;
- número de slots documentais vazios, quando aplicável;
- status `reserved`, `seeded`, `qualified`, `consumed`, `quarantined` ou `restored`.

O registro de 15 slots atual não deve ser sobrescrito para simular repetibilidade. Seeds consumíveis precisam de geração nova, preservando o histórico das operações consumidas.

### 6.2 Setup documental

1. reservar o par A/B para uma única execução serial;
2. autenticar o usuário compartilhado;
3. abrir cada operação e comprovar Cadastro;
4. executar a preparação mínima reutilizada até Documentos;
5. renovar a sessão e reabrir cada operação;
6. comprovar heading/operação corretos, etapa Documentos e ao menos dois slots vazios;
7. marcar o par como `seeded` somente depois dessas provas.

### 6.3 Setup de pré-finalização

1. reservar uma geração nova;
2. comprovar Cadastro inicial;
3. preencher e salvar a jornada mínima;
4. parar antes da ação final;
5. comprovar último passo ativo, botão habilitado e ausência de POST `/finalizar`;
6. marcar como `seeded-pre-finalization`.

### 6.4 Setup de Cadastro A/B

1. comprovar mesma identidade e duas operações diferentes;
2. comprovar ambas em Cadastro e com formulário editável;
3. capturar snapshots independentes;
4. abrir A, B e novamente A para detectar cache cruzado antes da mutação;
5. persistir e restaurar um marcador de qualificação em cada uma;
6. promover o par a `RESTORABLE` somente após a prova descrita na seção 8.

## 7. Estratégia de teardown

### Documentos

Não existe teardown honesto para upload aceito.

- não enviar para análise salvo quando o próprio cenário exigir;
- ao final, marcar cada operação que recebeu arquivo como `consumed`;
- impedir nova reserva da mesma geração;
- para nova execução, provisionar outro par equivalente;
- se o backend rejeitar todos os arquivos e nenhum slot for alterado, uma nova leitura pode manter a seed utilizável, mas isso deve ser comprovado por operação e não presumido.

### Pré-finalização

Não existe rollback para a fase anterior.

- marcar a operação como `consumed` após a resposta real de finalização;
- reabrir apenas para comprovar que ela deixou a pré-finalização;
- provisionar uma nova operação na próxima execução.

### Cadastro A/B

- restaurar os valores originais de B e A, em ordem inversa às mutações;
- aguardar e validar cada `PUT /cadastro` real;
- renovar ou reabrir a sessão;
- comparar cada campo com seu snapshot original;
- comprovar ausência dos marcadores de A em B e de B em A;
- marcar `restored` somente após todas as assertions passarem.

O `teardownRegistry` atual executa callbacks em LIFO, porém captura e apenas registra erros. Esse comportamento é útil para tentar todas as limpezas, mas **não é suficiente para certificar uma massa como `RESTORABLE`**, pois uma falha de cleanup pode não falhar o teste. A futura qualificação deve propagar uma falha agregada após tentar todas as restaurações, ou executar uma verificação obrigatória posterior que falhe o cenário.

### Alerta

Nenhum teardown deve ser implementado antes de identificar onde a escolha “Não mostrar novamente” é persistida. Limpar cookies ou storage sem comprovar que esse é o mecanismo real seria um reset fictício.

## 8. Prova automatizada de restauração

### Cadeia obrigatória para Cadastro A/B

Uma operação só poderá receber o status `RESTORABLE` após executar e comprovar:

1. **estado inicial conhecido:** operação, etapa e snapshot dos campos originais;
2. **mutação:** marcador exclusivo persistido por resposta real do backend;
3. **prova da mutação:** reload/reabertura mostra o marcador correto apenas na operação alvo;
4. **restauração:** valor original enviado por request real e resposta de sucesso validada;
5. **nova leitura independente:** reload e reabertura após renovação da sessão;
6. **prova final:** igualdade exata com o snapshot e ausência de qualquer marcador temporário;
7. **resultado do teardown:** falha explícita se qualquer passo anterior falhar.

### Prova de seed documental

A prova não é de restauração. Antes do cenário, deve comprovar:

- etapa Documentos;
- quantidade mínima de slots;
- slots reservados sem “Documento enviado” e sem link de visualização;
- mesma identidade lógica para A/B;
- acesso correto após nova sessão.

Depois de upload aceito, a prova final deve marcar a operação como consumida. Criar outra proposta equivalente não altera esse fato.

### Prova de seed pré-finalização

Antes do cenário:

- último passo aplicável ativo;
- ação final visível e habilitada;
- saves obrigatórios concluídos;
- zero POST `/finalizar` no setup.

Depois do cenário:

- consequência final única validada;
- operação fora da pré-finalização;
- geração marcada como consumida.

## 9. Riscos de consumo ou conflito

| Risco | Impacto | Controle necessário |
|---|---|---|
| O registro indicar `ready` sem validar o estado real | Seed incorreta e falso diagnóstico do teste | Health check obrigatório por UI/backend antes da reserva |
| Reutilizar operação documental já preenchida | Colisão com arquivo anterior | Exigir slots vazios e geração exclusiva |
| Rodar dois consumidores sobre a mesma seed | Estado irreversível e resultados não determinísticos | Lock por perfil + geração e workers serializados |
| Reutilizar slot fixo já associado a protocolo | O provisionador devolve operação antiga | Geração/run ID para consumíveis; não sobrescrever histórico |
| Criar automaticamente o segundo membro do mesmo CPF | Portal rejeita duplicidade | Manter `manual-shared` até existir mecanismo legítimo automatizado |
| Quantidade documental variar por configuração | Menos slots que o cenário espera | Descoberta no setup; exigir mínimo e provisionar novo batch quando necessário |
| Tentar restaurar documento sem DELETE legítimo | Teardown fictício | Classificar como consumível e descartar a operação |
| Finalização avançar a fase | Seed não reutilizável | Uma proposta nova por execução |
| Falha silenciosa do teardown atual | Massa permanece contaminada | Propagar erro agregado e executar releitura obrigatória |
| Estado do alerta ser global ao usuário | Contaminação de todos os testes do CPF | Descobrir armazenamento/reset ou usar identidade descartável |
| Desviar massa da baseline funcional | Regressão em testes existentes | Catálogo Core separado e nenhuma reutilização implícita |

## 10. Cenários CORE desbloqueados

| Infraestrutura | Cenários compostos desbloqueados | IDs principais |
|---|---|---|
| Seed documental A/B consumível | Formatos permitidos com persistência; conteúdo/extensão real; colisão/reenvio; upload concorrente; retry/refresh/nova sessão | `DOC-CORE-03/04`, `DOC-CORE-18/19/20`, `DOC-CORE-28` a `32`, `DOC-NET-10/12`, `CORE-CONC-07`, `ISOLATION-02/08`, `CORE-JOURNEY-03` |
| Seed pré-finalização consumível | Consequência única diante de dupla conclusão | `CORE-CONC-03`; a variação de “Continuar” permanece absorvida pelo mesmo risco |
| Cadastro A/B qualificado como restaurável | Executado: payload A/B, seção/aba por proposta e marcador persistente sem cruzamento | `CORE-API-10`, `ISOLATION-04`, `CORE-JOURNEY-05` — `COVERED` |
| Reset legítimo do alerta ou par descartável próprio | Aviso independente entre propostas do mesmo usuário | `ISOLATION-05` |

Os seis cenários persistentes do plano final possuem, na prática, mais de um lifecycle no último item. A preparação proposta permite:

- executar os cinco cenários documentais, desde que cada execução/batch receba slots limpos suficientes e aceite descarte posterior;
- executar a idempotência de finalização com uma seed nova;
- executar payload, aba e marcador A/B após a qualificação do par de Cadastro;
- **não** executar honestamente o isolamento do alerta enquanto seu armazenamento/reset não for identificado ou enquanto não for aprovado um par descartável específico.

## 11. Resultado do bloco restaurável de Cadastro A/B

O par CAD A/B foi usado no primeiro bloco persistente restaurável em C6 HT. Foram comprovados:

- deep link autenticado válido de CAD A;
- payloads reais e exclusivos por operação A/B;
- isolamento de seção/aba entre duas páginas autenticadas;
- persistência e ausência cruzada de marcadores distintos;
- restauração obrigatória em ordem B → A;
- nova leitura independente e comparação exata com os snapshots originais.

O bloco passou em **duas execuções consecutivas**. A rotina propaga falhas do cenário e da restauração por erro agregado; portanto, uma massa não pode ser declarada limpa quando qualquer parte do teardown falhar.

Na execução posterior do batch documental, DOC A e DOC B foram consumidas conforme o lifecycle aprovado. FINAL continuou sem acesso e em `QUARANTINED`. `ISOLATION-05` permanece `BLOCKED` até existir reset legítimo do alerta ou um par descartável próprio.

## 12. Estado após o batch documental consumível

| Massa | Estado final | Evidência | Próximo uso permitido |
|---|---|---|---|
| DOC A | `CONSUMED` | Quatro slots ocupados, um vazio, requests e digests conhecidos | Somente auditoria/leitura; não executar outro batch |
| DOC B | `CONSUMED` | Cinco slots ocupados, requests e digests conhecidos | Somente auditoria/leitura; não reutilizar |
| CAD A | `RESTORABLE` | Não acessada nem alterada no batch | Mantém o lifecycle já qualificado |
| CAD B | `RESTORABLE` | Não acessada nem alterada no batch | Mantém o lifecycle já qualificado |
| FINAL | `QUARANTINED` | Não acessada nem alterada no batch | Nenhuma finalização até atividade separada de requalificação |

O fato de A4 continuar vazio não devolve DOC A a `READY`: o estado da operação já depende de quatro uploads, reenvio, substituição, retry e refresh. Reposição por uma nova proposta equivalente será uma nova geração `SEEDABLE_CONSUMABLE`, nunca teardown da operação atual.

## Resumo final

- **Massas atuais reutilizáveis para os novos cenários persistentes:** 0 sem alterar finalidade; `RESERVE` é uma alternativa condicional e consumível para uma única seed de pré-finalização.
- **Novas propostas mínimas para qualificar um primeiro ciclo completo:** 5 — duas documentais A/B, uma pré-finalização e duas de Cadastro A/B. Se `RESERVE` for conscientemente consumida, o mínimo inicial cai para 4.
- **Criadas diretamente pelo simulador:** 3 das 5 — documento A, pré-finalização e Cadastro A.
- **Criação manual necessária com a infraestrutura atual:** 2 das 5 — documento B e Cadastro B, ambas compartilhando o CPF do respectivo A.
- **Realmente restauráveis:** somente as duas propostas de Cadastro, e apenas depois da cadeia automatizada de qualificação. No estado atual do projeto, nenhuma massa nova ou existente deve ser declarada `RESTORABLE` antecipadamente.
- **Consumíveis seedáveis:** o par documental foi consumido; uma nova geração será necessária para qualquer batch futuro. A proposta pré-finalização continua em quarentena e não foi tocada.
- **Bloqueios após o provisionamento:** restauração do mesmo slot documental; criação totalmente automática de pares do mesmo CPF; reset do alerta “Não mostrar novamente”. Os bloqueios de segunda identidade já conhecidos permanecem fora deste plano.
- **Execução dos seis cenários persistentes:** os cinco cenários documentais foram executados e aprovados; a idempotência de finalização não foi executada; payload/aba/marcador A/B já foram aprovados com o par restaurável; o fragmento de isolamento do alerta permanece bloqueado.

## Parecer

O simulador atual é uma base adequada de provisionamento, mas não é uma infraestrutura de restauração. A evolução correta é manter dois mecanismos explícitos:

1. **qualificação e restauração do mesmo recurso** para Cadastro A/B;
2. **provisionamento geracional e descarte** para Documentos e pré-finalização.

Essa separação permite implementar os gaps persistentes sem contaminar a baseline, sem chamar reposição de teardown e sem criar uma falsa garantia de repetibilidade.
