# PortalNext - Testes E2E

Suite Cypress + TypeScript baseada nos casos de
`Docs/TestesPortalC6(1).xlsx`.

Para continuar o trabalho em outro computador ou em uma nova conversa, leia
primeiro `Docs/HANDOFF_CODEX.md`. Ele registra o estado dos 169 casos, as
massas que devem ser preservadas e o ponto exato de retomada.

## Configurar a conexao

Copie `.env.example` para `.env.local` e informe apenas dados dos ambientes
DEV/HT. A configuracao e carregada antes da inicializacao do Cypress e validada
em um unico ponto:

- `PORTAL_ENV`: `dev` ou `ht`;
- `PORTAL_URL`: URL base do Portal;
- `PORTAL_ADMIN_URL`: URL do painel administrativo;
- `PORTAL_ADMIN_USER` e `PORTAL_ADMIN_PASSWORD`: credenciais de QA;
- `PORTAL_TEST_CPF`: CPF exclusivo da massa descartavel.

O Cypress entra no Admin, abre Backend, gera e copia o magic link, acessa o
Portal e guarda a sessao automaticamente. Quando a sessao deixa de ser valida,
um link novo e gerado. O fluxo e bloqueado quando Admin e Portal nao pertencem
ao mesmo host DEV/HT.

As massas podem ser fornecidas como objetos JSON nas variaveis:

- `PORTAL_TEST_DATA_JSON`;
- `PORTAL_EXPECTED_PROPOSAL_JSON`;
- `PORTAL_CASE_ACCESS_URLS_JSON`;
- `PORTAL_CASE_PROPOSAL_IDS_JSON`.

Os antigos `connect.ts`, `connect.ht.ts` e `aejs.ts` continuam aceitos somente
como compatibilidade local. Eles sao opcionais, ignorados pelo Git e nao sao
mais imports obrigatorios; um checkout limpo compila sem esses arquivos.

Nao utilize credenciais, links ou dados de clientes reais.

## Executar

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

## Integracao Portal para AEJS

O fluxo de preparacao confirma propostas e, por isso, exige massa descartavel e
opt-in explicito. Preencha no `.env.local`:

```text
PORTAL_INTEGRATION_CASE_ID=INT-CONFIRM-PJ
PORTAL_INTEGRATION_OPERATION=000436021
ALLOW_TEST_MUTATION=true
```

Depois execute:

```powershell
npm run cy:run:integration
```

A preparacao mantem em memoria, apenas durante a execucao atual, o caso, perfil
e operacao efetivamente usados. O spec do AEJS le esse contexto, pesquisa
exatamente a mesma operacao e confirma o numero aberto antes de validar os
campos. Cookies e magic links nao sao persistidos em disco.

O fluxo automatizado esta dividido em:

- `14-preparar-integracao.cy.ts`: preenche o Portal, confirma a proposta e
  publica o contexto para o processo atual do Cypress;
- `16-verificar-aejs.cy.ts`: abre a mesma operacao no AEJS e valida os dados
  persistidos;
- `integration-data.ts`: centraliza os valores esperados e as operacoes de
  cada perfil.

Massas de integracao conhecidas:

| Caso | Operacao | Cobertura |
| --- | --- | --- |
| `INT-CONFIRM-PJ` | `000436021` | Titular, conjuge, garantidor PJ, socios e interveniente |
| `INT-CONFIRM-PF` | `000436020` | Terceiro na renda e garantidor PF |
| `INT-CONFIRM-QUITADO` | `000436019` | Sem composicao de renda e imovel quitado |
| `INT-CONFIRM-WORKFLOW` | `000436018` | Tarefas, documentos, fluxo e cancelamento |

As operacoes acima ja foram confirmadas e devem ser preservadas. Nao execute a
preparacao novamente sem uma massa descartavel ou sem a intencao explicita de
alterar seu estado.

### Resultado das integracoes

As integracoes representam 59 regras da planilha:

- 54 regras possuem validacao completa aprovada no AEJS;
- regra 4 possui validacao parcial, pois o AEJS exibe a autorizacao SCR e a
  data, mas nao a hora;
- regras 1, 2 e 5 falham por divergencias de tarefas/documentos no fluxo;
- regra 23 falha porque a operacao `000436019`, preparada sem composicao de
  renda, chegou ao AEJS com `PESSOA$IN_EADQUIRENTE` marcado.

Essas quatro falhas sao divergencias funcionais comprovadas, nao falhas de
seletor do Cypress. Os caminhos e campos do AEJS estao detalhados em
`Docs/scci.md`; o estado completo e as evidencias estao em
`cypress/ANDAMENTO_EXECUCAO.md` e `Docs/HANDOFF_CODEX.md`.

No total, a cobertura do projeto e composta por 108 casos funcionais, 59 regras
de integracao e 2 transicoes controladas (`Confirmar` e `Cancelar`), totalizando
169 casos.

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
