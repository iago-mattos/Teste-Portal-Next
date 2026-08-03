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
C6_PROVISION_PROPERTY_POSTAL_CODE=24120440
C6_PROVISION_PROPERTY_STREET="Rua Doutor Carlos Imbassahy"
C6_PROVISION_PROPERTY_NUMBER=70
C6_PROVISION_PROPERTY_COMPLEMENT="casa 3"
```

Depois de gravar cada proposta, o mesmo fluxo abre a operação no SCCI, entra em
`Alterar → Imóvel Operação → Dados do imóvel`, informa o CEP e o complemento,
normaliza o logradouro para `endereço, número`, salva e reabre a operação para
comprovar a persistência. Somente então o Portal é aberto em modo de leitura
para validar o reflexo desses dados.

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
Por padrão, cada slot fresco recebe CPF próprio. A exceção intencional é
`TIMELINE_DOCUMENTS`: o registry reutiliza automaticamente o CPF criado para
`DEFAULT`, grava uma segunda operação com o nome `Playwright BASE 02` e depois
a leva à etapa de Documentos. Para essa segunda operação, o provisionador
confirma o aviso de proposta existente, renova o login do SCCI e reabre a
operação antes de preparar o CEP. Isso mantém duas propostas reais visíveis no
mesmo login para os contratos de múltiplas jornadas.

Para criar e preparar manualmente um lote fresco completo, incluindo fases e
massas documentais, use:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npm run pw:provision:c6:fresh-suite
```

Se a preparação for interrompida depois que as propostas já tiverem sido
criadas, corrija a pré-condição do ambiente e retome exatamente o mesmo lote:

```bash
PW_PROFILE=ht ALLOW_TEST_MUTATION=true npm run pw:provision:c6:resume
```

A retomada valida que todos os slots frescos pertencem ao manifesto ativo e
possuem operação. Ela não reinicia o simulador nem cria novas propostas.

As transições de crédito preparadas diretamente no SCCI são automatizadas pelos
slots oficiais abaixo:

| Slot | Fase SCCI | Reflexo exigido no Portal |
| --- | --- | --- |
| `CREDIT_REJECTED` | `101 — Crédito Reprovado` | Crédito Reprovado, orientação de contato e cadastro indisponível. |
| `CREDIT_APPROVED` | `50 — Cadastro da Proposta` | Etapa Concluída, Fase Atual Cadastro e mensagem explícita de cadastro concluído. |

Prepare um slot isolado ou os dois em sequência:

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-phase -- CREDIT_REJECTED
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-phase -- CREDIT_APPROVED
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-phases
```

O fluxo localiza o campo pelo contrato ExtJS estável
`OPERACAO_CREDITO$NU_FASE_ATUAL`, salva, reabre a operação e comprova tanto a
fase persistida no SCCI quanto o reflexo funcional no Portal. A fase `700` não
faz parte deste provisionamento.

As massas documentais independentes também podem ser confirmadas pelo Portal:

| Slot | Preparação automatizada | Pós-condição |
| --- | --- | --- |
| `DOCUMENT_PERSISTENCE` | Cadastro completo sem composição ou garantidor | Documentos, com todos os slots vazios. |
| `DOCUMENT_SIZE` | Cadastro completo sem composição ou garantidor | Documentos, com todos os slots vazios. |

```bash
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-documents -- DOCUMENT_PERSISTENCE
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-documents -- DOCUMENT_SIZE
ALLOW_TEST_MUTATION=true npm run pw:provision:c6:prepare-documents-batch
```

O batch usa um worker e é retomável: se a operação já estiver em Documentos,
ele não confirma novamente e apenas relê todos os slots. A massa só é marcada
como pronta quando nenhum documento tiver sido enviado. Os testes de
persistência e limite continuam responsáveis por consumir ou exercitar seus
próprios slots posteriormente.

Somente os papéis que exigem cancelamento ou expiração continuam dependendo da
preparação externa correspondente. Depois de confirmar o estado real, marque
cada papel externo como pronto e publique o overlay:

```bash
npm run pw:provision:c6:mark-ready -- CANCELED
npm run pw:provision:c6:publish
```

O provisionador-base cria a proposta em Cadastro e preenche o CEP; os comandos
especializados preparam exclusivamente os estados de fase e documentos
declarados acima.

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

No perfil `ht`, `pw:test:all` começa criando e preparando automaticamente um
novo lote C6 para todos os slots `fresh-per-run`. As massas de expiração e
cancelamento continuam externas porque dependem de ajuste controlado de banco;
o lote só é publicado quando elas já estiverem configuradas e os novos slots
estiverem prontos. Nos demais perfis, o comando preserva as massas configuradas.

Depois do provisionamento, o comando valida a configuração publicada e executa
os blocos na ordem funcional: Portal, simulador, preparações mutáveis Portal →
SCCI e validações read-only no SCCI. Mesmo que um bloco de testes falhe, os
blocos seguintes são coletados. O relatório oficial permanece disponível em
`playwright-report/index.html`, e o relatório visual principal da suíte é
gerado em `portal-report/index.html`. Para abrir diretamente o relatório
principal:

```bash
npm run pw:report:portal:open
```

Uma falha no provisionamento ou na configuração é fail-fast para impedir testes
sobre um lote parcial. Se o provisionamento falhar, a tentativa atual também é
publicada imediatamente no relatório Portal e no PDF, com screenshot de página
inteira e trace seguro capturado após a autenticação; o relatório anterior não
é apresentado como se pertencesse à nova execução.

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

Todos os testes de negócio, aprovados ou reprovados, mantêm screenshot explícito
da página inteira e trace em `test-results/`. Em falhas, o Playwright também
mantém vídeo. Se a página não estiver mais disponível no teardown, o relatório
recebe uma evidência textual com o motivo da impossibilidade da captura, em vez
de ficar silenciosamente sem diagnóstico. Os projetos de
setup/login não capturam evidências para evitar exposição de credenciais,
tokens ou magic links.

### Relatório Portal minimalista

Além do HTML oficial do Playwright, a suíte usa o pacote independente
[`@prognum/playwright-report`](https://github.com/iago-mattos/PlaywrightReport).
Ele oferece filtros por resultado e projeto, agrupamento por projeto e domínio,
diagnóstico destacado de falhas, detalhes das etapas, lightbox de screenshots,
vídeos e controles para baixar ou abrir traces.

Para validar o visual com os smokes pequenos do perfil selecionado:

```bash
PW_PROFILE=ht npm run pw:test:report:sample
npm run pw:report:portal:open
```

Screenshot de página inteira e trace são obrigatórios inclusive nos resultados
aprovados. O vídeo permanece restrito às falhas. Nos cenários Portal → SCCI, o
relatório mantém evidências separadas dos dois sistemas e inicia o trace do SCCI
somente depois do login, descartando credenciais. Para montar ou abrir o
relatório da última execução manualmente:

```bash
npm run pw:report:portal:build
npm run pw:report:portal
```

O resultado fica em `portal-report/index.html` e não é versionado. A construção
do relatório gera automaticamente `output/pdf/playwright-report.pdf`, copia o
arquivo para o relatório e inclui o botão **Baixar PDF**. O comando
`pw:test:all` consolida automaticamente tanto o relatório oficial em
`playwright-report/` quanto o relatório Portal e seu PDF.

Para reconstruir somente o PDF executivo:

```bash
npm run pw:report:portal:pdf
```

O runner procura primeiro `PROGNUM_REPORT_PYTHON`, depois `PYTHON`, o runtime
Python disponibilizado pelo Codex e, por fim, os comandos `python3` e `python`.
Caso nenhum deles possua as dependências necessárias, instale-as com
`python3 -m pip install reportlab Pillow`.
Título, produto, cor, domínios, evidências, diretórios e opções do PDF ficam em
`prognum-report.config.mjs`.

### Atualização do pacote de relatório

O código do relatório não deve mais ser alterado neste repositório. Mudanças de
interface, reporter ou CLI devem ser implementadas e validadas no repositório
[`iago-mattos/PlaywrightReport`](https://github.com/iago-mattos/PlaywrightReport).
Depois da criação de uma nova release, atualize este projeto fixando o novo
tarball:

```bash
npm install -D "https://github.com/iago-mattos/PlaywrightReport/releases/download/vX.Y.Z/prognum-playwright-report-X.Y.Z.tgz"
npm run check
PW_PROFILE=ht npm run pw:test:report:sample
npm run pw:report:portal:open
```

Não use a branch `main` como dependência. A URL da release mantém a versão
reprodutível no `package-lock.json`. Após validar visual, screenshots, vídeos e
traces, versione juntos `package.json` e `package-lock.json`.

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

`pw:test:all` usa paralelismo somente onde o isolamento foi comprovado:

- casos Portal read-only que reutilizam a sessão padrão: até 3 workers;
- casos read-only que renovam ou trocam a sessão do Portal: 1 worker;
- casos mutáveis e provisionamento: 1 worker;
- integração Portal → SCCI/AEJS: 1 worker enquanto houver specs que
  compartilham a mesma operação;
- validações que entram temporariamente em modo de edição no SCCI, mas cancelam
  sem persistir, executam separadamente com `@transient` e 1 worker.

Os limites podem ser reduzidos por `PW_FUNCTIONAL_READONLY_WORKERS` e
`PW_INTEGRATION_WORKERS`. Não aumente esses valores sem comprovar isolamento das
massas e ausência de troca concorrente de sessão.

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
