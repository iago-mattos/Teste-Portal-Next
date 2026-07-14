# Handoff histórico do Cypress

Snapshot de continuidade em 30/06/2026.

> **Documento legado:** este snapshot preserva o estado histórico anterior à
> migração. A suíte principal atual é Playwright. Para instalação, execução e
> configuração vigentes, consulte `README.md`; para decisões oficiais, consulte
> `Docs/PLAYWRIGHT_MIGRATION.md` e `Docs/PLAYWRIGHT_ARCHITECTURE.md`.

Este documento deve ser consultado apenas quando for necessário recuperar o
contexto histórico do Cypress. Para o estado atual, leia:

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

`portalSession()` em `cypress/support/commands.ts` reutiliza a sessao apenas
dentro da execucao atual do Cypress. Quando necessario, acessa o Admin, gera um
magic link para o CPF de teste e entra no Portal. Cookie e magic link nao sao
persistidos em disco.

O Admin e o Portal devem pertencer ao mesmo ambiente. Evite varias invocacoes
Cypress isoladas em sequencia: prefira um lote com token novo para reduzir o
risco de HTTP 429.

### Ambientes

`cypress/config/active-connect.ts` ainda seleciona:

- DEV por padrao;
- HT quando `PORTAL_ENV=ht`.

No Playwright, o `.env.local` contém somente `PW_PROFILE`. A configuração
completa vem de `.env.<perfil>.local`, por exemplo `.env.desenv.local` ou
`.env.ht.local`. `connect.ts`, `connect.ht.ts` e `aejs.ts` permanecem opcionais
apenas para compatibilidade com ambientes locais anteriores.

### Integracoes

- `14-preparar-integracao.cy.ts` preenche/confirma o Portal e publica o caso,
  perfil e operacao na memoria do processo atual do Cypress;
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
3. Criar `.env.<perfil>.local` a partir de `.env.example`.
4. Criar `.env.local` contendo somente `PW_PROFILE=<perfil>`.
5. Criar `cypress/config/connect.ts` a partir de `connect.example.ts`.
6. Criar `cypress/config/connect.ht.ts` com as massas de HT, se necessario.
7. Criar `cypress/config/aejs.ts` a partir de `aejs.example.ts`.
8. Executar `npm run config:check` antes de abrir navegador.
9. Executar primeiro `npm run cy:run:smoke`.
10. Executar `npx tsc --noEmit` antes de alterar os specs.

Nunca versionar credenciais, magic links, cookies ou CPFs reais.

## Arquivos que o Git nao leva para o computador novo

Transferir de forma segura somente quando for necessario preservar o estado
local:

- `.env.local` e os arquivos `.env.<perfil>.local`;
- `cypress/config/connect.ts`;
- `cypress/config/connect.ht.ts`;
- `cypress/config/aejs.ts`;
- `cypress/evidencias/`, para manter os videos finais;
- `cypress/results/`, para manter os JSON/HTML Mochawesome.

Nao e necessario transferir `.codex-tmp`: sessoes, cookies e contexto de
execucao devem ser regenerados no computador novo. As operações Playwright não
possuem fallback histórico; todas as massas devem estar explícitas no perfil
selecionado.

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
