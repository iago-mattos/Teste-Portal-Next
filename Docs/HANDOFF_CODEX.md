# Handoff PortalNext Cypress

Snapshot de continuidade em 30/06/2026.

Este documento e o ponto de entrada para retomar o projeto em outro computador
ou em uma nova conversa com o Codex. Leia tambem:

- `README.md`: instalacao, configuracao e comandos;
- `cypress/ANDAMENTO_EXECUCAO.md`: historico detalhado das execucoes;
- `Docs/scci.md`: caminhos, campos e massas mapeadas no AEJS/SCCI;
- `Docs/TestesPortalC6(1).xlsx`: fonte das regras funcionais e de integracao.

## Estado atual

A conta dos 169 casos e composta por:

- 108 casos funcionais;
- 59 regras de integracao Portal x SCCI/AEJS;
- 2 transicoes controladas de integracao: Confirmar e Cancelar.

Resultado funcional consolidado:

- 106 aprovados;
- `PROP-14` falha intencionalmente enquanto o produto usar dias corridos em
  vez de dias uteis;
- `PROP-03` esta pendente porque precisa alterar dados no SCCI e comprovar o
  reflexo no Portal.

Resultado das 59 regras de integracao:

- 54 possuem validacao completa aprovada;
- regra 4 e parcial: o AEJS permite validar a autorizacao SCR e a data, mas nao
  exibe a hora;
- regras 1, 2, 5 e 23 possuem divergencias funcionais comprovadas;
- regra 23 foi isolada em `mochawesome_395.json`: a operacao `000436019`,
  preparada sem composicao de renda, chegou ao AEJS com
  `PESSOA$IN_EADQUIRENTE` marcado.

Ultimas verificacoes tecnicas aprovadas:

```powershell
npx tsc --noEmit
git diff --check
```

Nao houve HTTP 429 na ultima bateria funcional.

## Ponto exato de retomada

1. Nao recriar nem confirmar novamente as operacoes `000436018` a
   `000436021` sem necessidade. Elas preservam os estados usados nas provas do
   AEJS.
2. Para fechar `PROP-03`, escolher uma proposta em Cadastro ou Documentos,
   alterar no SCCI um dos campos previstos pela regra e validar o novo valor no
   Portal.
3. Manter `PROP-14` falhando ate a correcao do calculo para dias uteis.
4. Manter as regras de integracao 1, 2, 5 e 23 como falhas de produto, nao como
   falhas do Cypress.
5. A regra 4 so pode ficar totalmente aprovada quando houver uma fonte
   confiavel para a hora da autorizacao SCR.

## Como a automacao funciona

### Autenticacao do Portal

`portalSession()` em `cypress/support/commands.ts` tenta restaurar a sessao
local. Quando necessario, acessa o Admin, gera um magic link para o CPF de
teste, entra no Portal e grava o cookie em `.codex-tmp`.

O Admin e o Portal devem pertencer ao mesmo ambiente. Evite varias invocacoes
Cypress isoladas em sequencia: prefira um lote com token novo para reduzir o
risco de HTTP 429.

### Ambientes

`cypress/config/active-connect.ts` seleciona:

- DEV por padrao;
- HT quando `PORTAL_ENV=ht`.

`connect.ts`, `connect.ht.ts` e `aejs.ts` sao arquivos locais ignorados pelo
Git. Use os arquivos `*.example.ts` como modelo.

### Integracoes

- `14-preparar-integracao.cy.ts` preenche/confirma o Portal e grava o caso,
  perfil e operacao em `.codex-tmp/integration-run-context.json`;
- `16-verificar-aejs.cy.ts` le esse contexto, pesquisa exatamente a mesma
  operacao no AEJS e valida os valores persistidos;
- `cypress/config/integration-data.ts` centraliza os valores esperados e os
  quatro perfis de massa.

Massas conhecidas:

| Operacao | Perfil |
| --- | --- |
| `000436021` | Conjuge, garantidor PJ, dois socios e interveniente |
| `000436020` | Terceiro na renda e garantidor PF |
| `000436019` | Sem composicao de renda e imovel quitado |
| `000436018` | Fluxo, tarefas, documentos e cancelamento |

## Preparar o computador novo

1. Clonar `https://github.com/iago-mattos/Teste-Portal-Next.git` e usar a
   branch `main`.
2. Executar `npm ci`.
3. Criar `.env.local` a partir de `.env.example`.
4. Criar `cypress/config/connect.ts` a partir de `connect.example.ts`.
5. Criar `cypress/config/connect.ht.ts` com as massas de HT, se necessario.
6. Criar `cypress/config/aejs.ts` a partir de `aejs.example.ts`.
7. Executar primeiro `npm run cy:run:smoke`.
8. Executar `npx tsc --noEmit` antes de alterar os specs.

Nunca versionar credenciais, magic links, cookies ou CPFs reais.

## Arquivos que o Git nao leva para o computador novo

Transferir de forma segura somente quando for necessario preservar o estado
local:

- `.env.local`;
- `cypress/config/connect.ts`;
- `cypress/config/connect.ht.ts`;
- `cypress/config/aejs.ts`;
- `cypress/evidencias/`, para manter os videos finais;
- `cypress/results/`, para manter os JSON/HTML Mochawesome.

Nao e necessario transferir `.codex-tmp`: sessoes, cookies e contexto de
execucao devem ser regenerados no computador novo. Se for executar apenas a
verificacao AEJS sem preparar novamente o Portal, use as operacoes fixas de
`integration-data.ts` e preserve as massas listadas acima.

## Primeira mensagem para um novo Codex

Use este texto para evitar que a investigacao recomece do zero:

```text
Leia README.md, Docs/HANDOFF_CODEX.md, cypress/ANDAMENTO_EXECUCAO.md,
Docs/scci.md e Docs/TestesPortalC6(1).xlsx antes de executar qualquer teste.
Retome do snapshot de 30/06/2026. Nao recrie as operacoes 000436018 a
000436021. Rode primeiro o smoke e o TypeScript. Preserve PROP-14 como falha
conhecida, trate PROP-03 como pendente de alteracao no SCCI e mantenha as
regras de integracao 1, 2, 5 e 23 como divergencias funcionais comprovadas.
Documente toda nova execucao em cypress/ANDAMENTO_EXECUCAO.md.
```
