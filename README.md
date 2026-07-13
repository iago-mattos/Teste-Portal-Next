# PortalNext - Testes E2E

Suite Playwright + Cypress + TypeScript baseada nos casos de
`Docs/TestesPortalC6(1).xlsx`.

Para continuar o trabalho em outro computador ou em uma nova conversa, leia
primeiro `Docs/HANDOFF_CODEX.md`. Ele registra o estado dos 169 casos, as
massas que devem ser preservadas e o ponto exato de retomada.

## Configurar a conexao

Copie `.env.example` para `.env.local` e informe apenas dados dos ambientes
DEV/HT. Playwright e Cypress carregam esse arquivo local, que e ignorado pelo
Git. Os grupos principais sao:

- `PORTAL_ENV`: `dev` ou `ht`;
- `PORTAL_URL` e `PORTAL_ACCESS_URL`: Portal e magic link opcional;
- `PORTAL_ADMIN_URL`: URL do painel administrativo;
- `PORTAL_ADMIN_USER` e `PORTAL_ADMIN_PASSWORD`: credenciais de QA;
- `PORTAL_TEST_CPF`: CPF exclusivo das massas de teste;
- `AEJS_URL`, `AEJS_USERNAME`, `AEJS_PASSWORD` e `AEJS_PATH`: SCCI/AEJS;
- `PORTAL_PROPOSAL_*`: propostas usadas pelos casos funcionais;
- `PORTAL_INTEGRATION_*_OPERATION`: uma operacao dedicada para cada integracao;
- `PORTAL_EXPECTED_*`: contrato visual da proposta padrao.

Quando o Admin esta configurado, o setup entra no painel, gera o magic link,
acessa o Portal e guarda a sessao automaticamente. `PORTAL_ACCESS_URL` e apenas
o fallback manual. O SCCI autentica dentro do ciclo de vida da fixture porque a
sessao ExtJS nao pode ser restaurada por `storageState`.

As variaveis JSON antigas continuam aceitas apenas para compatibilidade:

- `PORTAL_TEST_DATA_JSON`;
- `PORTAL_EXPECTED_PROPOSAL_JSON`;
- `PORTAL_CASE_ACCESS_URLS_JSON`;
- `PORTAL_CASE_PROPOSAL_IDS_JSON`.

Os antigos `connect.ts`, `connect.ht.ts` e `aejs.ts` tambem continuam aceitos
como fallback local, mas novas trocas de ambiente devem ser feitas somente no
`.env.local`.

Nao utilize credenciais, links ou dados de clientes reais.

### Finalidade das propostas funcionais

| Variavel | Estado exigido | Responsabilidade |
| --- | --- | --- |
| `PORTAL_PROPOSAL_DEFAULT` | Visivel e em Cadastro | Proposta principal dos smokes, formularios e validacoes gerais. Deve continuar acessivel. |
| `PORTAL_PROPOSAL_EXPIRED` | Expirada ha no maximo 30 dias | Comprova que uma proposta expirada ainda aparece em modo de consulta. |
| `PORTAL_PROPOSAL_EXPIRED_OVER_30_DAYS` | Expirada ha mais de 30 dias | Comprova que a proposta nao aparece mais. Se aparecer, o PROP-10 deve falhar. |
| `PORTAL_PROPOSAL_TIMELINE_CADASTRO` | Parada em Cadastro | Abre a jornada `Cadastro da Proposta` pela timeline. |
| `PORTAL_PROPOSAL_TIMELINE_DOCUMENTS` | Parada em Documentos | Abre a jornada `Documentos da proposta`; nao use uma operacao que ja avancou para 996. |

Ao trocar uma proposta, preserve o estado descrito na tabela. Apenas substituir
o numero por qualquer operacao existente pode fazer o teste validar a jornada
errada.

## Executar

Instalacao e validacao estatica:

```powershell
npm ci
npm run pw:install
npm run check
```

Coleta sem abrir navegador:

```powershell
npm run pw:test:list
```

Playwright seguro, sem integracoes e sem mutacoes:

```powershell
npm run pw:test:safe
```

Execucoes Playwright por grupo:

```powershell
npm run pw:test:smoke
npm run pw:test:functional:readonly
npm run pw:test:integration:readonly
```

Testes mutaveis exigem `ALLOW_TEST_MUTATION=true` no `.env.local`:

```powershell
npm run pw:test:functional:mutation
npm run pw:test:integration:mutation
```

Arquivo ou caso isolado:

```powershell
npx playwright test tests/caminho/arquivo.spec.ts
npx playwright test -g "texto do caso"
```

Relatorio HTML da ultima execucao:

```powershell
npm run pw:report
```

Comandos legados do Cypress:

```powershell
npm run cy:open
```

```powershell
npm run cy:run
```

O comando padrao executa apenas os smokes seguros. Verificacoes locais de
qualidade, sem acesso a sistemas externos, podem ser executadas com:

```powershell
npm test
```

Smokes de autenticacao e abertura da proposta:

```powershell
npm run cy:run:smoke
```

Casos funcionais:

```powershell
npm run cy:run:functional
```

Para executar somente um caso:

```powershell
npm run cy:run -- --spec "cypress/e2e/cliente/01-login.cy.ts" --env caseId=LOGIN-04
```

## Integracao Portal para SCCI/AEJS

Os cenarios mutaveis confirmam propostas ou enviam documentos e, por isso,
exigem massas descartaveis dedicadas e opt-in explicito. Cada operacao possui
uma variavel propria no `.env.local`:

```text
PORTAL_INTEGRATION_PJ_OPERATION=000000000
PORTAL_INTEGRATION_PF_OPERATION=000000000
PORTAL_INTEGRATION_PAID_OFF_OPERATION=000000000
PORTAL_INTEGRATION_WORKFLOW_OPERATION=000000000
PORTAL_INTEGRATION_DOCUMENT_PERSISTENCE_OPERATION=000000000
PORTAL_INTEGRATION_DOCUMENT_SIZE_OPERATION=000000000
ALLOW_TEST_MUTATION=true
```

Use `pw:test:integration:readonly` para validacoes que nao alteram estado e
`pw:test:integration:mutation` apenas quando as massas estiverem preparadas.
`PORTAL_INTEGRATION_CASE_ID` e `PORTAL_INTEGRATION_OPERATION` permanecem como
overrides temporarios governados, nao como configuracao principal.

Cobertura Playwright configuravel:

| Caso | Variavel | Finalidade e estado esperado | Reexecucao |
| --- | --- | --- | --- |
| `INT-CONFIRM-PJ` | `PORTAL_INTEGRATION_PJ_OPERATION` | Titular, conjuge, garantidor PJ, socios e interveniente refletidos no SCCI. | Preparacao mutavel somente com massa nova/restaurada; validacao SCCI e read-only. |
| `INT-CONFIRM-PF` | `PORTAL_INTEGRATION_PF_OPERATION` | Terceiro na renda e garantidor PF refletidos no SCCI. | Preparacao mutavel somente com massa nova/restaurada; validacao SCCI e read-only. |
| `INT-CONFIRM-QUITADO` | `PORTAL_INTEGRATION_PAID_OFF_OPERATION` | Imovel quitado, sem composicao, terceiro ou garantidor. | Preparacao mutavel somente com massa nova/restaurada; validacao SCCI e read-only. |
| `INT-CONFIRM-WORKFLOW` | `PORTAL_INTEGRATION_WORKFLOW_OPERATION` | Depois dos documentos: tarefas 997 e 998 finalizadas e 996 disponivel. | Fluxo Portal consome a massa; depois execute somente as validacoes read-only. |
| `INT-DOCUMENT-PERSISTENCE` | `PORTAL_INTEGRATION_DOCUMENT_PERSISTENCE_OPERATION` | Todos os documentos enviados no Portal devem abrir em `Documentos → Renda PF` no SCCI. | Envio consome a massa; validacao dos PDFs pode ser repetida. |
| `INT-DOCUMENT-SIZE` | `PORTAL_INTEGRATION_DOCUMENT_SIZE_OPERATION` | Cada seletor deve rejeitar PDFs de 25 MB e 50 MB porque o limite e 10 MB. | Reutilizavel: os arquivos rejeitados nao sao persistidos. |

Operacoes consumidas por confirmacao ou avanco de workflow nao sao
reexecutaveis sem restauracao externa. A tag `@mutation` e o opt-in evitam uma
execucao destrutiva acidental.

## Organizacao

Os specs em `cypress/e2e/cliente` seguem os nomes da primeira coluna da
planilha. Os arquivos possuem prefixos de `01` a `13`, preservando a ordem
funcional do documento:

1. Login
2. Minhas propostas
3. Linha do Tempo e Alertas
4. Participantes
5. Dados do Conjuge
6. Composicao de Renda
7. Composicao de Renda com conjuge
8. Composicao de Renda com terceiros
9. Motivo da Contratacao
10. Imovel
11. Garantidor PF
12. Garantidor PJ
13. Detalhamento

Cada caso possui ID, regra, status e observacao de origem.

Casos automatizados sao executados normalmente. Casos ainda sem codigo
precisam estar declarados em `cypress/config/known-pending.json`, com motivo e
data de revisao. `npm test` falha quando surge uma pendencia nao declarada.

Arquivos `.env.local`, links, videos e relatorios nao sao versionados.

## Quality gate e CI

O gate executado em toda pull request inclui TypeScript, ESLint e consistencia
entre o catalogo de casos e suas implementacoes:

```powershell
npm test
```

O smoke com credenciais e executado manualmente pelo workflow `CI`, usando o
ambiente protegido `qa`. Fluxos de confirmacao/cancelamento nunca fazem parte
do gate padrao e exigem `ALLOW_TEST_MUTATION=true`.

O defeito conhecido de hidratacao React #418 falha por padrao. Enquanto a
correcao do frontend nao estiver implantada, uma execucao diagnostica pode usar
`ALLOW_REACT_418_QUARANTINE=true`; a excecao fica explicita no log e deve ser
revisada ate 31/08/2026.
