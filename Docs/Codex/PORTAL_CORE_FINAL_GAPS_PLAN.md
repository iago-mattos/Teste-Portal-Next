# Plano Final de Gaps — Portal Core

## 1. Resumo executivo

Este documento revisa exclusivamente os **49 IDs `MISSING`** e os **15 IDs `PARTIAL`** registrados em `PLAYWRIGHT_PORTAL_CORE_COVERAGE_AUDIT.md` após o CORE-6. A matriz original não foi alterada e nenhum ID foi promovido para `COVERED` nesta etapa.

A análise considera o risco ainda não comprovado, as evidências de CORE-1 a CORE-6, os 108/108 casos funcionais e as 12 regressões ativas. O resultado principal é que os 64 IDs não justificam 64 novos testes:

- 16 podem ser executados agora, consolidados em cerca de 6 cenários;
- 19 dependem de massa restaurável ou estado reproduzível, principalmente documentos;
- 12 precisam de decisão explícita de domínio antes de qualquer assertion;
- 5 já possuem cenário suficiente, mas a pós-condição está bloqueada por defeito conhecido do produto;
- 8 repetem riscos já cobertos por outro mecanismo ou ID;
- 2 não agregam evidência automatizável relevante no produto atual;
- 2 devem ter a evidência existente revisada como candidatas a reclassificação;
- nenhum dos 64 gaps depende de segunda identidade. Essa dependência continua existindo apenas nos IDs já classificados como `BLOCKED`, fora deste recorte.

Estimativa final: **aproximadamente 15 novos cenários compostos**, e não 64 specs, seriam suficientes para concluir o conjunto que ainda merece automação caso massas e contratos sejam disponibilizados. Desses, **6 cenários** podem ser implementados imediatamente; os demais devem aguardar pré-condições explícitas.

## 2. Contagem por categoria

| Categoria | IDs | Interpretação |
|---|---:|---|
| `EXECUTABLE_NOW` | 16 | Há contrato e massa suficientes; pode ser consolidado em poucos cenários sem ampliar arquitetura. |
| `OVERLAPS_EXISTING` | 8 | O risco já é exercitado por mecanismo equivalente ou deve ser absorvido por outro ID, sem cenário próprio. |
| `REQUIRES_PRODUCT_FIX` | 5 | O cenário já existe ou sua continuação depende diretamente de regressão ativa. Não criar teste duplicado. |
| `REQUIRES_DOMAIN_CONTRACT` | 12 | Falta definir resultado correto, limite ou política server-side. Automatizar agora criaria expectativa arbitrária. |
| `REQUIRES_RESTORABLE_MASS` | 19 | A prova exige persistência real, reset, dois estados comparáveis ou operação consumível restaurável. |
| `REQUIRES_SECOND_IDENTITY` | 0 | Nenhum ID `MISSING`/`PARTIAL` deste recorte exige nova identidade. |
| `NOT_WORTH_AUTOMATING` | 2 | O caso não adiciona risco material além do mecanismo já coberto ou não é comprovável pela emulação atual. |
| `RECLASSIFICATION_CANDIDATE` | 2 | A evidência atual pode ser suficiente, mas deve ser revisada formalmente antes de mudar a matriz. |
| **Total** | **64** | **49 `MISSING` + 15 `PARTIAL`.** |

## 3. Matriz completa dos 64 IDs

### 3.1 Navegação e salvamento

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `CORE-NAV-03` | `PARTIAL` | `REQUIRES_PRODUCT_FIX` | CORE-1 já reabre pela listagem, mas não chega à etapa porque o primeiro reload perde a renda (`CORE-REG-001`). | Reexecutar o cenário existente após correção; não criar outro teste. |
| `CORE-NAV-04` | `MISSING` | `RECLASSIFICATION_CANDIDATE` | CORE-4 abre URL protegida diretamente, comprova negação anônima e preservação autenticada após refresh. | Revisar se `openProposal()` + refresh autenticado já satisfaz integralmente o deep link válido. |
| `CORE-NAV-05` | `MISSING` | `OVERLAPS_EXISTING` | CORE-2 já comprova consequência única diante de duplo clique durante save. A parte de transição final pertence a `CORE-CONC-03`. | Não criar cenário isolado para “Continuar”; absorver somente se a finalização ganhar massa restaurável. |
| `CORE-NAV-06` | `MISSING` | `EXECUTABLE_NOW` | Falta alternar rapidamente entre seções e comprovar que a última seção e os valores locais vencem. | Unificar com histórico/retorno do navegador em um cenário de continuidade de navegação. |
| `CORE-NAV-07` | `MISSING` | `EXECUTABLE_NOW` | `PART-11` valida apenas a ausência do botão; falta usar histórico real e retomar a proposta correta. | Mesmo cenário composto de `CORE-NAV-06`, sem persistir alterações. |
| `CORE-NAV-09` | `PARTIAL` | `REQUIRES_DOMAIN_CONTRACT` | CORE-2 prova isolamento local e respostas invertidas, mas não existe política declarada de conflito persistente: rejeição, versão, first-write ou last-write-wins. | Definir contrato server-side antes de testar duas escritas reais. |
| `CORE-SAVE-04` | `PARTIAL` | `REQUIRES_PRODUCT_FIX` | CORE-1 já limpa, recarrega e restaura; a execução não alcança a limpeza por `CORE-REG-001`. | Reexecutar após correção do Portal. |
| `CORE-SAVE-11` | `MISSING` | `EXECUTABLE_NOW` | Falta comprovar feedback, ausência de sucesso falso e preservação local após HTTP 403. | Acrescentar ao cenário composto de falhas controladas de autorização, no endpoint exato. |
| `CORE-SAVE-12` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Não há contrato para HTTP 409: mensagem, merge, recarga obrigatória ou rejeição da edição. | Definir política de conflito antes de criar assertion. |

### 3.2 Documentos — formato, nome e interação

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `DOC-CORE-03` | `COVERED` | evidência executada | JPEG aceito, persistido e relido por digest após reload e nova sessão. | Nenhum novo cenário; massa consumida. |
| `DOC-CORE-04` | `COVERED` | evidência executada | PNG aceito, persistido e relido no slot correto. | Nenhum novo cenário; massa consumida. |
| `DOC-CORE-11` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Não existe tamanho máximo declarado para nome de arquivo. | Não inventar boundary; obter limite frontend/API/storage. |
| `DOC-CORE-12` | `MISSING` | `EXECUTABLE_NOW` | Falta comprovar que espaços no nome chegam corretamente ao request sem quebrar a UI. | Consolidar em uma única fixture de nome representativo. |
| `DOC-CORE-13` | `MISSING` | `EXECUTABLE_NOW` | Falta nome de arquivo com acentos. | Mesma fixture composta de `DOC-CORE-12`. |
| `DOC-CORE-14` | `MISSING` | `EXECUTABLE_NOW` | Falta `ç` no nome do arquivo. | Mesma fixture composta; não criar caso separado. |
| `DOC-CORE-15` | `MISSING` | `EXECUTABLE_NOW` | Falta parêntese no nome. | Mesma fixture composta; validar nome serializado e estado local. |
| `DOC-CORE-16` | `MISSING` | `EXECUTABLE_NOW` | Falta confirmar que o sufixo terminal é interpretado corretamente com múltiplos pontos. | Mesma fixture composta; usar extensão terminal permitida. |
| `DOC-CORE-17` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | “Caracteres especiais” não define conjunto aceito, normalizado ou proibido. | Definir allowlist/normalização antes de automatizar. |
| `DOC-CORE-18` | `COVERED` | evidência executada | Dois conteúdos distintos com o mesmo nome resultaram no digest V2 no único item lógico. | Nenhum novo cenário. |
| `DOC-CORE-19` | `COVERED` | evidência executada | Reenvio do mesmo arquivo preservou um único item e o mesmo digest. | Nenhum novo cenário. |
| `DOC-CORE-20` | `COVERED` | evidência executada | Seleções rápidas em slots distintos foram serializadas com destinos e conteúdos corretos. | Nenhum novo cenário; não afirmar paralelismo de rede. |
| `DOC-CORE-21` | `MISSING` | `EXECUTABLE_NOW` | Falta cancelar o seletor e comprovar zero request, zero loading e slot intacto. | Incluir no cenário frontend de nomes/seleção, sem massa consumível. |
| `DOC-CORE-28` | `REQUIRES_DOMAIN_CONTRACT` | `REQUIRES_DOMAIN_CONTRACT` | O backend aceitou e persistiu PNG apresentado como PDF; os bytes foram relidos. | Definir política de assinatura/conteúdo antes de classificar o resultado. |
| `DOC-CORE-29` | `REQUIRES_DOMAIN_CONTRACT` | `REQUIRES_DOMAIN_CONTRACT` | Conteúdo, extensão e MIME incompatíveis foram aceitos e persistidos. | Definir política de coerência MIME/extensão/conteúdo. |
| `DOC-CORE-30` | `REQUIRES_DOMAIN_CONTRACT` | `REQUIRES_DOMAIN_CONTRACT` | JPG renomeado foi aceito, normalizado no nome e relido. | Definir se normalização ou rejeição é o contrato. |
| `DOC-CORE-31` | `REQUIRES_DOMAIN_CONTRACT` | `REQUIRES_DOMAIN_CONTRACT` | PDF renomeado foi aceito, normalizado no nome e relido. | Definir se normalização ou rejeição é o contrato. |
| `DOC-CORE-32` | `REQUIRES_DOMAIN_CONTRACT` | `REQUIRES_DOMAIN_CONTRACT` | PDF corrompido foi aceito e persistido; renderização/processamento não foram comprovados. | Definir integridade mínima exigida. |
| `DOC-CORE-33` | `MISSING` | `EXECUTABLE_NOW` | O contrato de extensões do input permite exigir bloqueio de arquivo sem extensão e feedback consistente. | Juntar à fixture de nomes inválidos, sem persistência. |
| `DOC-CORE-34` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Não está definido se extensão em caixa alta deve ser aceita ou rejeitada. | Declarar normalização case-insensitive ou política estrita. |
| `DOC-CORE-35` | `MISSING` | `EXECUTABLE_NOW` | Falta provar que apenas a extensão terminal decide o contrato e que múltiplos sufixos não fazem bypass. | Juntar ao cenário de nomes inválidos. |

### 3.3 Documentos — rede e persistência

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `DOC-NET-01` | `MISSING` | `EXECUTABLE_NOW` | Falta falha de transporte antes do upload e desbloqueio da UI. | Um cenário composto com `route.abort()` antes/durante request. |
| `DOC-NET-02` | `MISSING` | `EXECUTABLE_NOW` | Falta queda após início do upload, sem confirmação ou documento fantasma. | Mesmo cenário de transporte de `DOC-NET-01`. |
| `DOC-NET-07` | `MISSING` | `EXECUTABLE_NOW` | Falta HTTP 403 no upload com feedback, desbloqueio e ausência de documento. | Consolidar com o cenário de autorização 403. |
| `DOC-NET-09` | `MISSING` | `OVERLAPS_EXISTING` | É a mesma recuperação de request abortada de `DOC-NET-01/02`. | Não criar terceiro teste; registrar a mesma evidência para o ID após execução. |
| `DOC-NET-10` | `COVERED` | evidência executada | HTTP 500 deixou o slot vazio/desbloqueado; retry real persistiu o conteúdo correto após reload. | Nenhum novo cenário. |
| `DOC-NET-12` | `COVERED` | evidência executada | Abort antes do backend não deixou fantasma; aceite antes do refresh persistiu exatamente uma vez. | Nenhum novo cenário. |

### 3.4 Texto, número, data e CEP

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `CORE-TEXT-05` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Não está definido se espaços internos devem ser preservados, colapsados ou rejeitados. | Não inferir política de normalização. |
| `CORE-TEXT-06` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Um caractere só é inválido se o campo declarar tamanho mínimo ou regra semântica. | Reusar MOTIVO-03 quando aplicável; não generalizar. |
| `CORE-TEXT-10` | `MISSING` | `NOT_WORTH_AUTOMATING` | Unicode representativo já é coberto; emoji não possui contrato nem risco adicional identificado. | Não automatizar até surgir campo/defeito que trate emoji de modo distinto. |
| `CORE-TEXT-12` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Quebra de linha pode ser válida em textarea e inválida em input; não existe política declarada. | Definir por campo, especialmente descrição do motivo. |
| `CORE-NUM-04` | `PARTIAL` | `REQUIRES_DOMAIN_CONTRACT` | A máscara aceita e normaliza zero; falta regra de domínio sobre aceitar ou rejeitar. | Não converter comportamento observado em regra de negócio. |
| `CORE-NUM-06` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | Não há `max`, `maxlength` ou limite de API para valor monetário extremo. | Obter limite real antes de escolher boundary. |
| `CORE-DATE-04` | `MISSING` | `OVERLAPS_EXISTING` | `31/04` já prova mês com quantidade inválida de dias e preserva `CORE-REG-007`; `31/06` não adiciona mecanismo. | Não criar novo caso. |
| `CORE-DATE-05` | `MISSING` | `OVERLAPS_EXISTING` | Data impossível e parcial já são cobertas; `00/00` repete o parser inválido. | Não criar novo caso sem comportamento distinto. |
| `CORE-DATE-06` | `MISSING` | `OVERLAPS_EXISTING` | Dia impossível já é exercitado por `31/04`; dia 32 não comprova risco novo. | Não criar novo caso. |
| `CORE-DATE-08` | `MISSING` | `REQUIRES_DOMAIN_CONTRACT` | “Muito antiga” exige idade mínima/máxima ou data mínima formal. | Definir boundary de domínio. |
| `CORE-DATE-11` | `MISSING` | `REQUIRES_PRODUCT_FIX` | O mecanismo de limpar/recarregar já existe em CORE-1, mas a persistência inicial falha por `CORE-REG-001`. | Corrigir persistência antes de decidir se data precisa de amostra própria. |
| `CORE-CEP-10` | `PARTIAL` | `EXECUTABLE_NOW` | Label opcional está coberta; falta salvar endereço com complemento vazio, reabrir e comprovar que o backend não o torna obrigatório. | Um cenário curto com restauração do endereço original. |

### 3.5 Concorrência, mobile, API e isolamento

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `CORE-CONC-02` | `MISSING` | `OVERLAPS_EXISTING` | É o mesmo risco de `CORE-NAV-05`; CORE-2 já prova consequência única em save. | Não criar teste separado. |
| `CORE-CONC-03` | `MISSING` | `REQUIRES_RESTORABLE_MASS` | Dupla finalização só é honesta com proposta pré-finalização que possa ser restaurada após consumo. | Uma massa seedável e cenário único de idempotência final. |
| `CORE-CONC-05` | `MISSING` | `OVERLAPS_EXISTING` | Enter repetido é outro gatilho para o risco de ação lógica duplicada já coberto por duplo clique. | Só automatizar se o handler de teclado for tecnicamente distinto. |
| `CORE-CONC-06` | `PARTIAL` | `REQUIRES_DOMAIN_CONTRACT` | Falta política persistente de conflito entre duas escritas reais. | Mesmo contrato necessário para `CORE-NAV-09` e SAVE 409. |
| `CORE-CONC-07` | `COVERED` | evidência executada | A mesma prova de `DOC-CORE-20` confirmou consequência correta por controle. | Nenhum cenário separado. |
| `CORE-CONC-09` | `MISSING` | `RECLASSIFICATION_CANDIDATE` | CORE-2 conta um PUT sob duplo clique; CORE-3 conta um POST sob tentativa duplicada. | Revisar se duas consequências representativas já satisfazem idempotência lógica Core. |
| `CORE-MOBILE-09` | `MISSING` | `NOT_WORTH_AUTOMATING` | Playwright emula viewport/touch, mas não prova teclado virtual do sistema operacional; máscara/data desktop e formulário mobile já cobrem os mecanismos web observáveis. | Não criar cenário exclusivo enquanto não existir componente mobile específico ou `type=date` distinto. |
| `CORE-API-10` | `MISSING` | `EXECUTABLE_NOW` | CORE-4 comprova isolamento de GET/DOM A→B, mas não captura dois payloads mutáveis para provar ausência de campos cruzados. | Capturar PUT controlado de A e B, sem persistir, e comparar somente chaves/marcadores do cenário. |
| `ISOLATION-02` | `COVERED` | evidência executada | Alternância, reload e nova sessão mantiveram nomes/digests exclusivos de DOC A/B. | Nenhum novo cenário. |
| `ISOLATION-04` | `MISSING` | `REQUIRES_RESTORABLE_MASS` | Falta comparar estado de seção/aba entre duas propostas equivalentes em Cadastro. | Duas massas de Cadastro comparáveis e restauráveis. |
| `ISOLATION-05` | `MISSING` | `REQUIRES_RESTORABLE_MASS` | TIMELINE-09 cobre persistência do alerta em uma proposta, não escopo A/B. | Duas propostas no mesmo estado com avisos independentes. |
| `ISOLATION-08` | `COVERED` | evidência executada | Seleção pendente de A foi abortada antes do backend e nunca gerou request ou documento em B. | Nenhum novo cenário. |

### 3.6 Jornadas Core

| ID | Atual | Categoria | Risco/pós-condição ainda não comprovada | Decisão recomendada |
|---|---|---|---|---|
| `CORE-JOURNEY-01` | `PARTIAL` | `REQUIRES_PRODUCT_FIX` | Save, reload e reabertura já estão implementados; `CORE-REG-001` impede a pós-condição. | Nenhum teste novo; reexecutar CORE-1 após correção. |
| `CORE-JOURNEY-02` | `MISSING` | `REQUIRES_PRODUCT_FIX` | Retomar em nova autenticação só é significativo depois que o dado salvo sobrevive ao reload. | Corrigir `CORE-REG-001`; depois incorporar logout/renovação ao cenário existente. |
| `CORE-JOURNEY-03` | `COVERED` | evidência executada | Upload, reload, leitura de bytes, renovação de sessão e nova leitura preservaram destino e conteúdo. | Nenhum novo cenário. |
| `CORE-JOURNEY-05` | `PARTIAL` | `REQUIRES_RESTORABLE_MASS` | CORE-4 prova identidade/estado A/B e resposta atrasada, mas não persistência de marcador em A e ausência em B. | Duas massas de Cadastro comparáveis, com restauração comprovada. |

## 4. Grupos de riscos sobrepostos

### 4.1 Ação lógica única

`CORE-NAV-05`, `CORE-CONC-02`, `CORE-CONC-05` e `CORE-CONC-09` descrevem variações de um mesmo risco. CORE-2 já cobre duplo clique/PUT único e CORE-3 cobre bloqueio de POST documental duplicado. Somente a finalização real de `CORE-CONC-03` permanece materialmente diferente, pois consome estado.

### 4.2 Navegação e concorrência entre páginas

`CORE-NAV-06` e `CORE-NAV-07` podem formar uma única jornada sem persistência. `CORE-NAV-09` e `CORE-CONC-06` são a mesma lacuna server-side e devem aguardar uma política de conflito. Não devem ser implementados como dois testes.

### 4.3 Nomes de documentos

`DOC-CORE-12` a `DOC-CORE-16` podem ser comprovados por uma única fixture cujo nome contenha espaço, acento, `ç`, parênteses e múltiplos pontos. `DOC-CORE-33` e `DOC-CORE-35` formam uma amostra inválida separada. `DOC-CORE-11`, `DOC-CORE-17` e `DOC-CORE-34` exigem contrato antes de qualquer expectativa.

### 4.4 Conteúdo e persistência documental

O batch consumível executou `DOC-CORE-03`, `DOC-CORE-04`, `DOC-NET-10`, `DOC-NET-12` e `CORE-JOURNEY-03` com backend real, reload e nova sessão. `DOC-CORE-28` a `DOC-CORE-32` também foram exercitados contra o backend real, mas ficam em `REQUIRES_DOMAIN_CONTRACT` porque a política de assinatura, MIME, extensão e integridade ainda não foi definida. Não repetir o batch para obter a mesma evidência.

### 4.5 Concorrência e isolamento documental

`DOC-CORE-18` a `DOC-CORE-20`, `CORE-CONC-07`, `ISOLATION-02` e `ISOLATION-08` foram comprovados pelo par consumível DOC A/B. O resultado inclui destino multipart, reload, digest e nova sessão, não apenas contagem de requests.

### 4.6 Falhas de transporte

`DOC-NET-01`, `DOC-NET-02` e `DOC-NET-09` são uma família única. Um cenário pode abortar antes e durante o POST, exigindo desbloqueio, ausência de sucesso/documento e capacidade de nova tentativa. HTTP 403 de save/upload pode compor um segundo cenário de autorização controlada.

### 4.7 Boundaries de texto, número e data

`31/06`, `00/00` e dia 32 não acrescentam mecanismo ao calendário inválido já coberto por `31/04` e 29/02 não bissexto. Emoji não adiciona evidência ao Unicode sem um contrato específico. Espaços internos, quebra de linha, zero, valor extremo e data mínima dependem de regra de domínio; testar antes dessa definição produziria falso contrato.

### 4.8 Isolamento A/B

CORE-4 já prova GET, identidade, rota, DOM e resposta atrasada A→B. `CORE-API-10` ainda precisa comparar payloads mutáveis, mas pode fazê-lo com requests controladas sem persistência. `ISOLATION-04`, `ISOLATION-05` e `CORE-JOURNEY-05` exigem duas propostas comparáveis/restauráveis. `ISOLATION-02/08` exigem duas propostas documentais.

## 5. Cenários compostos recomendados

### Executáveis agora — aproximadamente 6 cenários

1. **Continuidade de navegação:** troca rápida de seções, histórico Voltar/Avançar e retomada da proposta (`CORE-NAV-06/07`).
2. **Autorização controlada 403:** save e upload sem falso sucesso, com dado/controle preservado (`CORE-SAVE-11`, `DOC-NET-07`).
3. **Seleção e nomes documentais:** nome composto válido, cancelamento do chooser, arquivo sem extensão e múltiplos sufixos, sem persistência (`DOC-CORE-12` a `16`, `21`, `33`, `35`).
4. **Queda de transporte documental:** abort antes/durante upload, desbloqueio e retry disponível (`DOC-NET-01/02/09`).
5. **Opcionalidade persistida:** endereço válido com complemento vazio, reload e restauração (`CORE-CEP-10`).
6. **Payload A/B controlado:** comparar PUTs de duas propostas sem enviar marcador de A em B (`CORE-API-10`).

### Após massa restaurável — aproximadamente 6 cenários

1. JPG/JPEG/PNG permitidos com persistência e visualização real.
2. Conteúdo/extensão incompatível e PDF corrompido contra backend real.
3. Colisão, reenvio e substituição de arquivo com conteúdo final comprovado.
4. Upload concorrente em slots e propostas distintas, sem cruzamento.
5. Retry, refresh e nova sessão após upload real.
6. Idempotência de finalização e isolamento de estado/alerta entre propostas comparáveis.

### Após contratos de domínio — aproximadamente 3 cenários

1. Política 409 e conflito persistente entre duas páginas.
2. Política de nomes/extensões de documentos.
3. Boundaries formalizados de texto, número e data.

Nenhum cenário novo deve ser criado para os cinco IDs bloqueados por correção do produto, para os oito overlaps, para os dois casos sem valor adicional ou antes da revisão dos dois candidatos de reclassificação.

## 6. Massas e contratos necessários

### Massas

- **Duas propostas documentais restauráveis**, do mesmo usuário controlado, com ao menos dois slots vazios e mecanismo confiável de reset.
- **Uma proposta pré-finalização seedável/restaurável** para provar idempotência sem consumir permanentemente a operação.
- **Duas propostas de Cadastro comparáveis**, reutilizáveis, para aba, alerta e marcador persistente A/B.
- Lifecycle obrigatório: estado inicial tipado, teardown verificável e falha explícita quando a restauração não ocorrer.

Não é necessária segunda identidade para nenhum dos 64 IDs. Os casos de autorização bidirecional já `BLOCKED` continuam fora deste plano.

### Contratos

- política de HTTP 409 e concorrência: versionamento, rejeição ou vencedor;
- aceitação de zero e limites monetários;
- idade/data mínima;
- trim de espaços internos e quebras de linha por tipo de campo;
- limite e caracteres permitidos em nomes de arquivos;
- tratamento case-insensitive ou estrito de extensões;
- comportamento esperado para conteúdos incompatíveis com extensão/MIME.

### Correções do produto

`CORE-NAV-03`, `CORE-SAVE-04`, `CORE-DATE-11`, `CORE-JOURNEY-01` e `CORE-JOURNEY-02` não justificam novos testes antes da correção de `CORE-REG-001`. A prova de persistência/reabertura já está implementada e deve ser simplesmente reexecutada.

## 7. IDs que não justificam novo teste

### Cobertura sobreposta

- `CORE-NAV-05`, `CORE-CONC-02`, `CORE-CONC-05`: ação duplicada já possui mecanismos representativos; finalização é tratada separadamente.
- `DOC-NET-09`: será evidência do mesmo cenário de `DOC-NET-01/02`.
- `CORE-DATE-04`, `CORE-DATE-05`, `CORE-DATE-06`: repetem calendário inválido já coberto.
- `CORE-CONC-07`: deve ser absorvido por `DOC-CORE-20`.

### Sem valor adicional no produto atual

- `CORE-TEXT-10`: emoji não adiciona risco conhecido à cobertura Unicode atual.
- `CORE-MOBILE-09`: emulação Playwright não prova teclado virtual nativo; não há componente de data mobile distinto observado.

### Candidatos a reclassificação sem novo teste

- `CORE-NAV-04`: revisar a evidência de deep link anônimo + URL autenticada + refresh do CORE-4.
- `CORE-CONC-09`: revisar as contagens de consequência única de CORE-2 e CORE-3.

Nenhum desses IDs deve ser movido para `COVERED` sem revisão formal da matriz; esta etapa apenas identifica os candidatos.

## 8. Ordem final recomendada

1. **Revisar os dois candidatos de reclassificação**, sem escrever testes.
2. **Executar os seis cenários disponíveis agora**, começando por navegação/403 e deixando documentos frontend agrupados.
3. **Corrigir `CORE-REG-001` e reexecutar CORE-1**, liberando os cinco IDs dependentes sem criar specs novas.
4. **Formalizar contratos de concorrência, limites e normalização**; descartar expectativas sem decisão de produto.
5. **Provisionar e validar lifecycle de massas restauráveis**, primeiro documentos A/B, depois pré-finalização e Cadastro A/B.
6. **Implementar os seis cenários persistentes**, com backend real e teardown obrigatório.
7. **Implementar no máximo três cenários de boundaries/concorrência** somente após os contratos.
8. **Atualizar a matriz caso a caso**, apenas com evidência executada e pós-condição comprovada.

## 9. Estimativa final

| Bloco | Novos cenários estimados |
|---|---:|
| Executáveis agora | 6 |
| Dependentes de massa restaurável | 6 |
| Dependentes de contrato de domínio | 3 |
| Dependentes de correção do produto | 0 — reexecutar cenários existentes |
| Overlaps, sem valor adicional e candidatos à reclassificação | 0 |
| **Total máximo recomendado** | **15 cenários compostos** |

Essa estimativa é deliberadamente orientada a riscos. Ela evita criar uma spec por ID, preserva a baseline e impede que ausência de massa ou contrato seja mascarada por mocks que não provam persistência, ownership ou estado final.

## 10. Resultado do bloco imediato

Esta seção registra a execução posterior à aprovação do plano. As contagens das seções 1 a 3 permanecem como snapshot dos 64 gaps antes da implementação; a matriz oficial atualizada está em `PLAYWRIGHT_PORTAL_CORE_COVERAGE_AUDIT.md`.

### Revisão formal dos candidatos

- `CORE-NAV-04` permanece `MISSING`: o CORE-4 comprova deep link anônimo e refresh de uma sessão válida, mas a abertura autenticada inicial ainda ocorre pelo card. Refresh não substitui a prova de entrada direta em URL protegida válida.
- `CORE-CONC-09` foi reclassificado para `COVERED` sem novo teste: CORE-2 comprova um único PUT sob duplo clique e CORE-3 comprova um único POST sob tentativa documental duplicada. A finalização consumível continua fora dessa equivalência.

### Cenários implementados

Foram implementados **5 cenários compostos**:

1. continuidade entre seções e histórico real (`CORE-NAV-06/07`);
2. HTTP 403 no save e upload (`CORE-SAVE-11`, `DOC-NET-07`);
3. nome documental composto, cancelamento do chooser e extensões terminais inválidas (`DOC-CORE-12` a `16`, `21`, `33`, `35`);
4. abort antes/durante upload e recuperação (`DOC-NET-01/02/09`);
5. endereço real persistido com complemento vazio, reload e restauração (`CORE-CEP-10`).

`CORE-API-10` não foi forçado. As duas operações conhecidas do mesmo usuário estão em estados diferentes: uma em Cadastro e outra em Documentos. Comparar payloads A/B exige **duas propostas simultaneamente editáveis em Cadastro e restauráveis**; o ID passa a depender de `REQUIRES_RESTORABLE_MASS`.

## 11. Resultado do bloco restaurável de Cadastro A/B

Esta seção registra a execução posterior à qualificação das massas CAD A/B em C6 HT. As classificações das seções anteriores permanecem como snapshot histórico do planejamento; a matriz oficial atual está em `PLAYWRIGHT_PORTAL_CORE_COVERAGE_AUDIT.md`.

| ID | Resultado | Evidência consolidada |
|---|---|---|
| `CORE-NAV-04` | `COVERED` | Deep link autenticado válido, GET real e exato, identidade/estado e reload da mesma proposta. |
| `CORE-API-10` | `COVERED` | PUTs reais A/B com marcadores exclusivos, ausência de payload cruzado e restauração comprovada. |
| `ISOLATION-04` | `COVERED` | Seções distintas em duas páginas autenticadas sem vazamento de aba ou identidade entre A/B. |
| `CORE-JOURNEY-05` | `COVERED` | Marcadores persistidos e relidos alternadamente sem contaminação; snapshots restaurados ao final. |
| `ISOLATION-05` | `BLOCKED` | O alerta não possui reset legítimo e comprovável; não foi criado teardown fictício. |

O bloco adicionou **4 cenários compostos** e foi executado duas vezes consecutivas. A restauração é parte obrigatória do contrato: B e A são restauradas independentemente, ambas são relidas, e falhas do corpo ou do teardown são propagadas em erro agregado.

Após esta execução, restam **42 IDs `MISSING`/`PARTIAL`** na matriz oficial. Os gaps documentais persistentes e a dupla conclusão continuam separados deste bloco; nenhuma massa DOC ou FINAL foi acessada ou consumida.

### Resultado das categorias ainda pendentes

Após as evidências acima, restam **47 IDs `MISSING`/`PARTIAL`**:

| Categoria pendente | IDs |
|---|---:|
| `OVERLAPS_EXISTING` | 7 |
| `REQUIRES_PRODUCT_FIX` | 5 |
| `REQUIRES_DOMAIN_CONTRACT` | 12 |
| `REQUIRES_RESTORABLE_MASS` | 20 |
| `REQUIRES_SECOND_IDENTITY` | 0 |
| `NOT_WORTH_AUTOMATING` | 2 |
| `RECLASSIFICATION_CANDIDATE` | 1 |
| **Total** | **47** |

O bloco elevou a coleta de **153 testes em 40 arquivos** para **158 testes em 42 arquivos**, preservando os **108/108 casos funcionais**. As ausências de feedback em HTTP 403 e em nomes/extensões bloqueados foram reproduzidas e consolidadas nas regressões já existentes `CORE-REG-002`, `CORE-REG-004` e `CORE-REG-005`, sem criar registros duplicados.

## 12. Resultado do batch documental consumível

O lote D1–D5 foi concluído em C6 HT, com três testes compostos, um worker, zero retries e duração aproximada de 6,2 minutos. Foram aceitos 11 uploads e houve três tentativas rejeitadas/interrompidas de forma controlada. DOC A terminou com quatro slots ocupados e DOC B com cinco; ambas passaram a `CONSUMED`. CAD A/B e FINAL não foram acessadas.

### IDs encerrados sem novo cenário

- `COVERED`: `DOC-CORE-03`, `DOC-CORE-04`, `DOC-CORE-18`, `DOC-CORE-19`, `DOC-CORE-20`, `DOC-CORE-23`, `DOC-CORE-26`, `DOC-CORE-27`, `DOC-NET-10`, `DOC-NET-12`, `CORE-CONC-07`, `ISOLATION-02`, `ISOLATION-08` e `CORE-JOURNEY-03`;
- `REQUIRES_DOMAIN_CONTRACT`: `DOC-CORE-28`, `DOC-CORE-29`, `DOC-CORE-30`, `DOC-CORE-31` e `DOC-CORE-32`.

Os cinco últimos não justificam outra execução: frontend, backend real, persistência e bytes já foram observados. O gap restante é exclusivamente definir se conteúdo/extensão/MIME incompatíveis e PDF corrompido devem ser rejeitados, normalizados ou aceitos. A impossibilidade de restaurar uma versão documental anterior continua sendo limitação de lifecycle, mas a substituição real de `DOC-CORE-23` foi comprovada.

Após essa consolidação, a matriz oficial possui **159 `COVERED`, 6 `PARTIAL`, 20 `MISSING`, 5 `REQUIRES_DOMAIN_CONTRACT`, 4 `BLOCKED` e 4 `NOT_APPLICABLE`**, totalizando 198 riscos. Restam 26 IDs `MISSING`/`PARTIAL`; os cinco contratos documentais são acompanhados separadamente.
