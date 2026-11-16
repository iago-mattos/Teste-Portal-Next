# Simulador do Portal — resumo das validações automatizadas

Data da execução: 09/11/2026 · Ambientes: Portal DESENV (`portal-desenv.prognum.com.br`) e SCCI esteira-ht (`esteiradigital-ht.prognum.com.br`) · Perfil: `esteira-ht`
Escopo: Simulador público (Playwright/TypeScript). Este resumo **não** declara o Simulador inteiro protegido: cobre apenas o que está listado abaixo.

## 1. Resultado (resultado mais recente de cada grupo, em rodadas diferentes do mesmo dia; não é uma execução única)

| Grupo | Testes | Aprovados | Reprovados |
|---|---:|---:|---:|
| Leitura (sem proposta): navegação, validações, regras do admin, limites, seguradoras | 115 | 99 | 16 |
| Criação real de propostas e conferência no SCCI | 4 | 3 | 1 |
| Conferência do cadastro do SCCI (grupos, tipos, seguradoras, LTV, carência, fase) | 1 | 1 | 0 |
| **Total** | **120** | **103** | **17** |

Nenhuma das 17 reprovações foi atribuída a ambiente. Os testes **reprovam** quando o Simulador diverge do esperado do teste; nada está escondido como "falha esperada". Atenção: só 31/02, card sem nome acessível e a mensagem de LTV são defeitos confirmados. Price, prazo mínimo, card repetido, telefone da PJ, escolha do tipo no Crédito Garantia, modalidade suspensa e visibilidade da Carência são **hipóteses a confirmar com Produto/Castilho** (tags `@pendente-produto`, `@investigacao`, `@depende-decisao`; ver seção 10).

## 2. O que foi validado e passou

- **Navegação (39 casos):** as 24 jornadas do menu (Financiamento PF/PJ, Residencial/Comercial, origens, indexadores; Crédito Garantia PF/PJ) chegam à tela Dados com os rótulos corretos (PF "Valor do financiamento/Renda"; PJ "Valor do emprestimo/Faturamento"); opções exatas de cada etapa; "Voltar" e troca de ramo sem resíduo.
- **Tela Dados (11 de 12):** mensagens do envio vazio em 4 famílias de jornada; financiamento maior que o imóvel; idade mínima de 18 anos (17 anos e 364 dias, data futura, 19 anos); data incompleta; composição de renda (campos obrigatórios e remoção ao desmarcar).
- **Regras do admin (8):** valor mínimo do imóvel R$ 50.000 (49.999,99 recusado; 50.000,00 aceito); prazo customizado 12–420 (11 e 421 recusados); botões de prazo e lista de carência iguais ao admin.
- **Limites do backend contra o cadastro do SCCI (15):** valor mínimo da operação (R$ 20.000) em PF e PJ; valor máximo do imóvel (R$ 15.000.000) em PF e PJ; idade máxima de 80 anos e 3 meses; idade + prazo (70 anos: 123 meses aceito, 124 recusado); LTV máximo (90% PF, 70% PJ); prazo máximo e máximo + 1.
- **Seguradoras (18 de 24 jornadas):** as seguradoras exibidas existem no cadastro do tipo de operação do SCCI e as comuns a todos os tipos aparecem.
- **Propostas criadas e conferidas no SCCI (3 de 4):** número, prazo, fase "CADASTRAMENTO DA PROPOSTA" (lida do SCCI), tipo de operação no título, tarefas 010 e 020 e dados do proponente PF; produto, comprador, tipo do imóvel, origem/indexador, valores, sistema de amortização, seguradora e código do grupo só são conferidos quando o rótulo existe na tela (rótulo ausente passou em silêncio nas versões anteriores; agora reprova) (nome, CPF, nascimento, e-mail, celular).
- **Cadastro do SCCI estável:** a leitura de 24 jornadas, 45 tipos de operação, seguradoras, faixas de LTV, regras de carência e fase inicial coincide com o snapshot versionado.

## 3. Defeitos encontrados (17 reprovações = 6 defeitos)

| # | Defeito | Evidência | Esperado | Situação |
|---|---|---|---|---|
| 1 | **Data inexistente (31/02/2001) aceita pelo formulário** (1 teste) | o front envia `dataNascimento: 2001-02-31`; backend responde 400 e a tela mostra só "Nao foi possivel identificar o tipo de operacao" | barrar na tela | confirmado (Iago Mattos) |
| 2 | **Campo Carência aparece sempre** (ATUALIZAÇÃO 11/11: o campo deixou de aparecer na tela Dados do portal-desenv, 24 de 24 jornadas; o teste de visibilidade passou) (1 teste; 24 de 24 jornadas) | o campo aparece em todas; nenhum dos 93 tipos lidos tem carência cadastrada em Tipo de operação > Carências; a carência é enviada na requisição do Resultado (`prazoCarencia`), mas os valores saem **iguais com e sem carência** (30, 60, 90), no Simulador e no SCCI (120 parcelas idênticas nas propostas 000000675 e 000000676) | aparecer só em momento específico, controlado por cadastro do SCCI | confirmado (Castilho, Mestre da Originação); **local exato do cadastro a confirmar** |
| 3 | **Tabela Price recusada** (5 testes) | backend responde 422 "O valor de financiamento solicitado ultrapassou o percentual máximo permitido" em PF/TR, PJ, Crédito Garantia e PF/IPCA, com 33% de financiamento; SAC passa nas mesmas condições; no SCCI as 59 faixas de LTV das 24 jornadas existem só para SAC | Price oferecida na tela deve calcular | a confirmar com Produto; mensagem também não indica a causa real |
| 4 | **Prazo mínimo do tipo não é aplicado** (3 testes) | prazo 35 aceito em PJ Comercial (36–180), PJ Residencial/Empreendimento (36–120) e PF TR/Esteira (36–420) | recusar abaixo do mínimo do cadastro | a confirmar com Produto |
| 5 | **Card de seguradora extra sem nome acessível** (6 testes) | o cadastro do SCCI repete a mesma seguradora no tipo (ex.: TOO duas vezes no tipo 900) e o Simulador exibe a linha repetida como card extra sem nome | um card por seguradora, todos com nome | a confirmar: corrigir o cadastro ou deduplicar no Simulador |
| 6 | **Telefone da PJ não aparece no SCCI** (1 teste, proposta 000000673) | CNPJ, razão social e e-mail chegam; o telefone informado não é encontrado em nenhuma aba do cadastro da PJ (a PF grava DDD e celular) | telefone gravado | a confirmar: pode estar em outra tela |

## 4. Propostas criadas (esteira-ht, autorizadas)

| Protocolo | Jornada | Tipo de operação escolhido pelo SCCI |
|---|---|---|
| 000000668 | PF Residencial/Esteira/TR, imóvel R$ 1,5 mi | 279 SFHABITACAO - TR |
| 000000672 | PF Residencial/Esteira/TR, imóvel R$ 1,6 mi | 81 SFIMOBILIARIO - TR |
| 000000673 | PJ Comercial/Particular (CNPJ) | 81 SFIMOBILIARIO - PJ |
| 000000674 | Crédito Garantia PF | 83 Credito com Garantia de Imovel - 60% |
| 000000675 | PF Residencial/Particular/IPCA, SAC, carência 60 | 279 SFHABITACAO - IPCA |
| 000000676 | PF Residencial/Particular/IPCA, SAC, sem carência (mesmas condições da 675) | 279 SFHABITACAO - IPCA |

Regra confirmada: imóvel até R$ 1.500.000 → tipo SFH; acima → SFI.

## 5. Observações para Produto (sem teste reprovando)
- Em PJ o campo se chama "Faturamento liquido", mas a mensagem do envio vazio é "Informe a renda.".
- Prazo acima do máximo em PJ recebe a mensagem "Prazo do financiamento não é permitido para idade do proponente", embora PJ não tenha regra de idade.
- O Simulador exibe a mensagem "É necessario ter ao menos 18 anos." também para PJ; o SCCI não tem regra de idade para PJ.
- No SCCI, a aba "Resumo Completo" da operação mostra zeros em financiamento, prestação, taxas e CET; o significado não foi confirmado.
- Grupos marcados como "suspensos" no SCCI (Imóvel Residencial PF, Imóvel Residencial PJ, Holding Familiar) continuam visíveis no Simulador.
- Máximo de R$ 1,5 trilhão no tipo 092 (PF Comercial/Imóvel Esteira/TR) parece erro de cadastro.
- O backend do Simulador ficou indisponível (HTTP 504) durante a atualização do ambiente para a versão 985; depois estabilizou.

## 6. O que ainda falta

**Decisões/confirmações de domínio (bloqueiam expectativas):**
1. Castilho: onde fica o cadastro que controla a carência (hipótese usada: Tipo de operação > Carências) e o que o SCCI grava quando há carência. Cadastrar uma carência em um tipo de teste do esteira-ht para testar o caso positivo.
2. Produto: o Price deve funcionar? (faixa de LTV para Price); o prazo mínimo do tipo deve ser aplicado?; card duplicado: corrigir cadastro ou deduplicar?; onde fica o telefone da PJ?
3. Regra de escolha do tipo no Crédito Garantia (LTV 33% foi para o tipo de 60%); significado de "Modalidade suspensa"; contrato do aviso de CPF existente.

**Cobertura ainda sem teste:**
- Composição de renda com co-adquirente até o SCCI; CPF duplicado (o esteira-ht bloqueia, sem teste); renda mínima calculada (comprometimento de 40%); despesas e ITBI incorporado; 
- Resultado: abas Parcelas, Correção projetada e Detalhamento; invariantes dos cálculos; downloads PDF e planilha.
- Envio: cancelar confirmação, duplo clique, falha de rede e retry sem duplicidade; resposta incerta.
- Robustez: sessão expirada, duas abas, resposta fora de ordem; mobile, teclado e acessibilidade (exceto o card sem nome).
- Outros ambientes: DESENV, HT (`minhaproposta-dev` não oferece o Simulador) e C6 não foram cobertos; tudo acima é do esteira-ht.
- Propostas para jornadas ainda não criadas (hoje 4 famílias: PF/TR, PJ, Crédito Garantia PF, PF/IPCA).

## 7. Como reproduzir (projeto `Portal-Next`)
- Leitura: `PW_PROFILE=esteira-ht npx playwright test --project=simulator-readonly`
- Propostas (mutável; o próprio teste exige `ALLOW_TEST_MUTATION=true` e falha sem ele; só verifica se já criadas): `PW_PROFILE=esteira-ht ALLOW_TEST_MUTATION=true npx playwright test --project=simulator-journeys`
- Conjunto validador da leitura (sem hipóteses): `PW_PROFILE=esteira-ht npm run pw:test:simulator:validator`
- Cadastro do SCCI (confere o snapshot; `SCCI_REFERENCE_UPDATE=true` atualiza): `PW_PROFILE=esteira-ht npx playwright test tests/integrations/scci-reference --project=integration`
- Detalhes, matrizes e evidências: `PLAYWRIGHT_SIMULATOR_COVERAGE_AUDIT.md` (seções 12 a 20).

Limitações: o teste de seguradoras e os de prazo comparam com um arquivo gerado do SCCI (não abrem o SCCI na hora; o teste de cadastro avisa se o arquivo ficou velho). O Simulador sofreu 504 intermitente no ambiente durante o trabalho.

## 8. Correção e efeito colateral (carência)
- Corrigido: a carência escolhida **é enviada** (campo `prazoCarencia` na requisição da tela de Resultado). Antes eu havia dito que não era enviada. Conferência pedida pelo Castilho: os valores saem **iguais com e sem carência**, no Simulador (sem carência, 30, 60 e 90) e no SCCI (propostas 000000675 e 000000676, 120 parcelas idênticas).
- A requisição do Resultado (`/api/simulacao/planilha`) leva `nuSimulacao` e pode gravar o registro da simulação no SCCI. Sondagens feitas até o Resultado no portal-desenv podem ter gravado simulações de teste (nenhuma proposta). A liberação desse endpoint na trava de leitura foi revertida.

## 9. Atualização posterior (cada teste novo executado uma vez; as contagens da seção 1 são da execução completa anterior)
- **Prazo mínimo chega ao SCCI:** proposta 000000677 (prazo 35, mínimo do tipo 36) foi aceita e gravada com 35. Teste reprovado.
- **Escolha do tipo no Crédito Garantia (lida da resposta do cálculo, sem proposta):** LTV até 30% → tipo 400; 31% a 60% → tipo 402; o tipo 401 (50%) nunca é escolhido; 61% é recusado citando "50.00%" embora 51% a 60% sejam aceitos. 4 testes reprovados; regra a confirmar com Produto. SFH×SFI por valor (R$ 1.500.000 → SFH; acima → SFI): 2 testes aprovados.
- **Modalidade suspensa:** 13 de 13 jornadas com grupo suspenso no SCCI continuam disponíveis no Simulador (teste reprovado, com controle positivo).
- **Nome acima de 40 caracteres:** o campo não limita, o front envia e a tela mostra o erro cru do Oracle (`ORA-12899 ... "CAIXA2"."PESSOA_PRETENDENTE"."NO_PESSOA" (real: 66, máximo: 40)`). 3 verificações reprovadas; nenhuma proposta criada.
- **Telefone da PJ:** é enviado (`celularTelefone`), mas não aparece no SCCI.
- **Card repetido:** a base repete a seguradora e o Simulador mostra o card repetido sem rótulo (`aria-labelledby` vazio): problema nos dois lados.
- `POST /api/simulacao/tipo-operacao` responde `success:false` "Rotina PostIdentificaTipoOperacao nao encontrada" mesmo com dados válidos; a tela segue em frente.
- Propostas criadas no total: 000000668, 672, 673, 674, 675, 676 e 677.

## 10. Rodada de revisão independente (11/11/2026)
O Revisor QA do Simulador (parecer AJUSTES, revisão estática) apontou falsos-verdes e falsos-vermelhos; correções aplicadas:
- Gate `ALLOW_TEST_MUTATION` agora dentro dos specs que criam proposta (`tests/helpers/mutation-gate.ts`).
- Teste de nome > 40: sem `catch` que engole erro, registra a tentativa no registro de execuções, aceita `maxlength` 40 **ou** recusa amigável, reprova erro cru do banco ou proposta criada. Tag `@pendente-produto`.
- PRAZO-35 virou cenário de investigação (`@investigacao`): registra o resultado, não afirma certo/errado.
- Contradições resolvidas: `journeys.spec` não confere mais a Carência (contrato do `grace-visibility.spec`); navegação por jornadas com grupo suspenso leva `@depende-decisao`.
- Prazos: recusa exige HTTP 422 e mensagem de prazo; HTTP 5xx vira erro de **ambiente**, não "recusado"; casos fora de 12–420 aparecem como ignorados com motivo.
- Leitor do SCCI: confere colunas esperadas por grade, detecta grade paginada, não troca coluna ausente por 0 e não se autoaprova quando o snapshot não existe.
- Conferências do SCCI: rótulo esperado ausente reprova; telefone da PJ é investigação.
- Observação (igualdade de parcelas com e sem carência) agora valida 120 parcelas numeradas e é `@pendente-produto`; ela **não prova** que a carência foi gravada.
- Cópias soltas dos arquivos (erro de empacotamento meu) removidas de `tests/pages/portal/`; `tsc` limpo.

### Execução válida da rodada 2 (11/11/2026, `simulator-readonly`, esteira-ht, portal-desenv com VPN)
- Ambientes em HTTP 200 (portal-desenv, SCCI e controle externo), duas vezes antes e duas depois; nenhum erro de rede ou 5xx na rodada. JSON: `logs/readonly-rodada2c.json` (workspace do QA).
- 127 coletados: **107 aprovados, 19 reprovados, 1 ignorado** (421 meses, fora de 12–420; coberto em `admin-rules`). Flaky: 0.
- Conjunto validador (90): **81 aprovados, 8 reprovados, 1 ignorado**. Os 8: 31/02 (1), card sem nome acessível (6) e mensagem de LTV (1), todos defeitos confirmados.
- Fora do validador: `@pendente-produto` 17 (6 aprovados, 11 reprovados: Price 3, LTV Crédito Garantia 3, Price/faixa 1, suspensa 1, prazo 35 x3) e `@depende-decisao` 20 (todos aprovados).
- Tentativas anteriores invalidadas e descartadas: rede caiu (VPN) na primeira; na segunda, 79 reprovações por `selectOption` do campo Carência, que **sumiu da tela Dados** do portal-desenv em 24 de 24 jornadas (captura do `grace-visibility`); o Page Object agora só escolhe a carência quando o campo existe.
- Leitura do SCCI com os novos controles de coluna/paginação: 2 aprovados, sem divergência do snapshot; as colunas de carência existem no modelo da grade, então "0 regras" é leitura válida.
- Não executado nesta rodada: `simulator-journeys` (criam proposta; exigem opt-in) e `simulator-integration`.

### Rodada 3 (11/11/2026): correções finais do parecer da rodada 2 (R2-1 a R2-10)
- Corrigidos: CNPJ do registro no teste de nome (R2-1); decisão só depois do protocolo ou da mensagem (R2-2); `requireGracePeriod` no cenário PF-IPCA-CARENCIA60, que aborta se o campo Carência não existe (R2-3); alerta novo, não preexistente (R2-4); documentado que o teste de nome é de execução única por entrada (R2-5); só o nó do grupo suspenso e abaixo vão para `@depende-decisao` (R2-6); unicidade de seguradora em teste próprio `@pendente-produto` (R2-7); cálculo sem resposta vira erro e a resposta é zerada após a leitura (R2-8); tela e API separadas (R2-10); overlay de carregamento que não some vira "AMBIENTE".
- Coleta: 133 testes de leitura (92 validador, 18 `@depende-decisao`, 23 `@pendente-produto`); 11 em `simulator-journeys`.
- Execução (`simulator-readonly`, ambientes em HTTP 200 antes e depois, 0 erro de rede): **112 aprovados, 20 reprovados, 1 ignorado de 133**. Um reprovado (`LTV de 51%`) e dois com mensagem de timeout foram causados pelo overlay "Carregando modalidades..." lento; reexecutados os 3: `LTV de 51%` aprovou e os outros dois reprovaram pelo motivo correto (suspensa e prazo 35). Total consolidado: **113 aprovados, 19 reprovados, 1 ignorado**; é a soma de duas execuções (a de 133 mais a reexecução de 3), não uma execução única.
- Validador (92): 83 aprovados, 8 reprovados (31/02, card sem nome x6, mensagem de LTV), 1 ignorado.
- Não executado: `simulator-journeys` (cria proposta, sem opt-in) e `simulator-integration`.
