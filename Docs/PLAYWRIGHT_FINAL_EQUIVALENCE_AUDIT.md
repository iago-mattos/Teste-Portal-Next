# Auditoria Final de Equivalência Cypress → Playwright

## Objetivo

Consolidar o encerramento funcional da migração, comparando os contratos históricos de integração Cypress com a cobertura Playwright aprovada ao término da Fase 7.

## Classificação

- **S1 — Migrado e aprovado em Playwright:** existe cobertura equivalente executada e aprovada.
- **S2 — Migrado com contrato corrigido:** a cobertura foi implementada após validação funcional do comportamento real, sem preservar uma premissa histórica incorreta.
- **S3 — Não migrado por ausência de contrato Cypress válido:** havia código ou expectativa histórica, mas não existe execução funcional aprovada ou o comportamento não corresponde à aplicação atual.
- **S4 — Evolução futura:** comportamento novo ou ampliação de cobertura que não é necessário para equivalência.
- **S5 — Pendente de migração real:** contrato Cypress funcionalmente aprovado ainda sem equivalente Playwright.

## Matriz de equivalência

| Comportamento | Origem Cypress | Playwright equivalente | Status | Observações | Commit(s) |
| --- | --- | --- | --- | --- | --- |
| Preparação PJ | `14-preparar-integracao.cy.ts` | `prepare-pj.spec.ts` | S1 | Cenário autocontido com dados atuais tipados. | `0647f55`, `baf7a4e` |
| Confirmação PJ | `14-preparar-integracao.cy.ts` e sobreposição histórica de `15-finalizar-cancelar-integracao.cy.ts` | `prepare-pj.spec.ts` | S1 | Confirmação preservada na última aba aplicável, Garantidor PJ. | `baf7a4e` |
| Reflexão AEJS PJ | `validateTitularAndConjuge()`, `validateFinalidadeCredito()`, `validateImovel()` e `validateGarantidorPj()` em `16-verificar-aejs.cy.ts` | `validate-confirmed-pj-aejs.spec.ts` | S1 | Titular, cônjuge, SCR, finalidade, imóvel, garantidor PJ e sócios usam a massa atual e expectativas tipadas. | `20a98aa`, `9d517c1` |
| Interveniente Quitante PJ | `validateInterveniente()` em `16-verificar-aejs.cy.ts` | `validate-pj-settlement-intervenor-aejs.spec.ts` | S1 | Edição temporária é cancelada; a reabertura comprova ausência de persistência. | `b134496` |
| Preparação PF | `14-preparar-integracao.cy.ts` | `prepare-pf.spec.ts` | S1 | Titular, terceiro, motivo, imóvel e garantidor PF usam contrato próprio. | `7db5336`, `e6d73d3` |
| Confirmação PF | `14-preparar-integracao.cy.ts` | `prepare-pf.spec.ts` | S1 | Confirmação ocorre na aba Garantidor PF. | `e6d73d3` |
| Reflexão AEJS PF | `validateTerceiroComposicao()` e `validateGarantidorPf()` em `16-verificar-aejs.cy.ts` | `validate-confirmed-pf-aejs.spec.ts` | S1 | Preservada a cobertura histórica aprovada de terceiro, SCR e garantidor PF. | `0293e0a` |
| Preparação e confirmação do imóvel quitado | `14-preparar-integracao.cy.ts` | `prepare-quitado.spec.ts` | S1 | Sem composição, terceiro, garantidor ou interveniente; confirmação na aba Imóvel. | `130a3b6`, `011edfb` |
| Flags do titular no AEJS para imóvel quitado | `validateSemComposicaoRenda()` em `16-verificar-aejs.cy.ts` | `validate-confirmed-quitado-aejs.spec.ts` | S2 | O contrato real confirmou `IN_E_PRINCIPAL` e `IN_EADQUIRENTE` marcados; não existe correspondência direta com “Composição de renda = Não” do Portal. | `629e847` |
| Preparação e confirmação workflow | `14-preparar-integracao.cy.ts` | `prepare-workflow.spec.ts` | S1 | Massa exclusiva `000436036`, sem composição ou garantidor, confirmada na aba Imóvel. | `37ff1ce`, `2896af9` |
| Andamento 997 → 998 e ausência de 996 | Premissa de workflow de `16-verificar-aejs.cy.ts`, corrigida pela validação funcional | `validate-workflow-progress-aejs.spec.ts` | S2 | A sequência correta é validada em Andamento do processo: 997 Finalizada, 998 Disponível e 996 ausente. | `3e1fab2` |
| Tarefa intermediária na área Tarefas | `validateIntermediateTask()` em `16-verificar-aejs.cy.ts` | Não aplicável | S3 | O Cypress procurava a sequência de workflow na área errada. A tarefa operacional 000 não representa 997/998/996 e não há execução Cypress aprovada desse contrato. | — |
| Composição histórica de tarefas | `validateTaskComposition()` em `16-verificar-aejs.cy.ts` | Não aplicável | S3 | Assertions históricas não possuem evidência de execução aprovada e não representam o contrato confirmado de Andamento do processo. | — |
| Documento recebido no AEJS | `validateReceivedDocuments()` em `16-verificar-aejs.cy.ts` | Não aplicável | S3 | O caso histórico usava outra operação (`000436009`), fora do pipeline atual, e não possui execução aprovada registrada em `scci.md`. | — |
| Conclusão futura da fase documental e avanço para 996 | Sem contrato Cypress aprovado de ponta a ponta | Não aplicável | S4 | Exige novo fluxo mutável de documentos e nova validação; é evolução, não equivalência. | — |
| Autorização SCR | Campos validados nos blocos PJ e PF de `16-verificar-aejs.cy.ts` | Specs AEJS PJ e PF | S1 | A autorização e sua reflexão foram preservadas dentro dos cenários que efetivamente gravam esses dados. | `0293e0a`, `9d517c1` |
| Cancelamento controlado | `INT-CANCEL` em `15-finalizar-cancelar-integracao.cy.ts` | Não aplicável | S3 | Existe código Cypress, mas não há evidência de execução aprovada. Na aplicação atual, a operação confirmada abre Documentos; Cadastro é somente leitura e nenhuma tela ou menu expõe Cancelar. Nenhum `POST /finalizar` foi enviado durante o diagnóstico. | — |
| Reintrodução futura do cancelamento | Não existe contrato funcional atual | Não aplicável | S4 | Se o produto voltar a oferecer o controle ou definir outro fluxo oficial, deverá ser tratado como nova funcionalidade e receber massa restaurável própria. | — |

## Contratos corrigidos oficialmente

1. Os dados validados no AEJS são aqueles gravados pelas massas Playwright atuais; valores históricos de `scci.md` não são expectativas globais.
2. A flag `PESSOA$IN_EADQUIRENTE` permanece marcada no cenário quitado, independentemente de “Composição de renda = Não” no Portal.
3. As fases 997, 998 e 996 pertencem a **Andamento do processo**, não à área operacional **Tarefas**.
4. O Interveniente Quitante exige edição temporária, cancelamento e comprovação explícita de descarte.
5. `INT-CANCEL` não constitui contrato válido de equivalência: o Cypress não possui execução aprovada e o controle não existe no estado atual da aplicação.

## Verificação de pendências S5

Após os commits `9d517c1` e `b134496`, os dois gaps de cobertura AEJS PJ foram encerrados. O cancelamento foi reclassificado como S3 após diagnóstico do Cypress e da aplicação atual.

**Resultado: não existe item S5 remanescente.**

## Parecer binário

# MIGRAÇÃO CONCLUÍDA

A equivalência funcional Cypress → Playwright está concluída. Itens S3 não possuem contrato funcional aprovado a migrar; itens S4 são evoluções futuras e não bloqueiam o encerramento. CI/CD, cutover operacional e remoção física do Cypress continuam fases posteriores e não alteram este parecer de equivalência funcional.
