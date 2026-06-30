# PortalNext - Testes E2E

Suite Cypress + TypeScript baseada nos casos de
`Docs/TestesPortalC6(1).xlsx`.

Para continuar o trabalho em outro computador ou em uma nova conversa, leia
primeiro `Docs/HANDOFF_CODEX.md`. Ele registra o estado dos 169 casos, as
massas que devem ser preservadas e o ponto exato de retomada.

## Configurar a conexao

Copie `.env.example` para `.env.local` e informe apenas dados dos ambientes
DEV/HT:

- `PORTAL_ADMIN_URL`: URL do painel administrativo;
- `PORTAL_ADMIN_USER` e `PORTAL_ADMIN_PASSWORD`: credenciais de QA;
- `PORTAL_TEST_CPF`: CPF exclusivo da massa descartavel.

O Cypress entra no Admin, abre Backend, gera e copia o magic link, acessa o
Portal e guarda a sessao automaticamente. Quando a sessao deixa de ser valida,
um link novo e gerado. O fluxo e bloqueado quando Admin e Portal nao pertencem
ao mesmo host DEV/HT.

Edite `cypress/config/connect.ts` somente para informar:

- `portalUrl`: endereco base do portal;
- `accessUrl`: fallback para execucoes sem o Admin automatizado;
- `testData`: IDs e CPFs das massas exclusivas de QA.

O arquivo `connect.ts` e ignorado pelo Git. O modelo versionavel fica em
`cypress/config/connect.example.ts`.

Nao utilize credenciais, links ou dados de clientes reais.

## Executar

```powershell
npm run cy:open
```

```powershell
npm run cy:run
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

Preencha no `.env.local`:

```text
PORTAL_INTEGRATION_CASE_ID=INT-CONFIRM-PJ
PORTAL_INTEGRATION_OPERATION=000436021
```

Depois execute:

```powershell
npm run cy:run:integration
```

A preparacao grava um contexto temporario com o caso, perfil e operacao
efetivamente usados. O spec do AEJS le esse contexto, pesquisa exatamente a
mesma operacao e confirma o numero aberto antes de validar os campos. Atualmente
os perfis AEJS completos sao `INT-CONFIRM-PJ` e `INT-CONFIRM-PF`.

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
aparecem como `[PENDENTE DE AUTOMACAO]`, evitando aprovacoes falsas enquanto
as massas necessarias nao foram disponibilizadas.

Arquivos `.env.local`, links, cookies, contextos temporarios, videos e
relatorios nao sao versionados.
