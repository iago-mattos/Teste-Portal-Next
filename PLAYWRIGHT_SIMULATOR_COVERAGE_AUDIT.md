# Auditoria de cobertura do Simulador — Portal React

Data da inspeção: 17/09/2026  
Ambiente: `https://portal-desenv.prognum.com.br/`  
Escopo: Simulador público acessado por **Realizar nova simulação**  
Natureza da inspeção: leitura e navegação controlada; nenhuma proposta foi enviada.

## 1. Resumo executivo

O Simulador não possui hoje o mesmo nível de proteção automatizada do Portal de Cadastro.

A suíte atual comprova uma única jornada principal:

`Financiamento Imobiliário → Pessoa Física → Imóvel Residencial → Imóvel da Esteira Digital → Taxa Referencial (TR) → SAC → carência 30 → MAPFRE → envio → reflexão no SCCI`.

Ela também comprova que cinco campos numéricos rejeitam letras. Essa cobertura é útil, mas não representa a superfície funcional real observada. O produto oferece duas modalidades, PF/PJ, imóvel residencial/comercial, três origens, três indexadores, SAC/Price, três carências, composição de renda, seguradoras dinâmicas, despesas incorporáveis, resultado em três visões, downloads e envio com validações próprias.

O principal limitador técnico está no contrato tipado: `SimulationJourneyInput` aceita somente a jornada principal e `DigitalMortgageSimulationScenario` aceita somente a seguradora MAPFRE. Portanto, as demais jornadas não estão apenas sem specs; elas sequer podem ser descritas pelo modelo atual sem alterar os tipos e o Page Object.

Parecer: **COBERTURA INSUFICIENTE PARA DECLARAR O SIMULADOR PROTEGIDO NO MESMO NÍVEL DO PORTAL**.

Não é recomendável automatizar o produto cartesiano completo. A estratégia adequada é combinar:

- cobertura representativa de cada mecanismo;
- pares de dimensões de negócio;
- boundaries dos campos;
- falhas controladas de rede;
- poucas jornadas mutáveis com reflexão real no SCCI.

Estimativa inicial: **22 a 28 cenários compostos**, distribuídos em 6 a 8 arquivos, conseguem cobrir os riscos abaixo sem criar um teste para cada combinação.

## 2. Método e limites da auditoria

Foram confrontados:

- a interface real do Portal DESENV;
- `tests/pages/portal/portal-simulator.page.ts`;
- `tests/integrations/portal-aejs/create-and-validate-simulation.spec.ts`;
- `tests/test-data/simulator-data.ts`;
- `tests/types/simulator.ts`;
- a demonstração do simulador existente.

Durante a inspeção foram percorridos, sem envio final:

1. Crédito Garantia de Imóvel / PF até Resultado e Envio;
2. Crédito Garantia de Imóvel / PJ até Dados;
3. Financiamento Imobiliário / PF / Residencial / Imóvel Particular / TR até Seguradoras;
4. validações vazias das telas Dados e Envio;
5. composição de renda e seus campos condicionais;
6. abas Parcelas, Correção projetada e Detalhamento.

Classificação usada:

- `COVERED`: há assertion automatizada suficiente;
- `PARTIAL`: parte do risco é exercitada, mas falta uma pós-condição relevante;
- `MISSING`: não há prova automatizada;
- `CONTRACT`: o comportamento precisa de definição funcional antes da expectativa;
- `OBSERVED`: confirmado na inspeção ao vivo, ainda sem teste.

As combinações não percorridas ao vivo estão explicitamente marcadas como contrato a confirmar; não foram promovidas a fato apenas porque a interface sugere reutilização dos mesmos componentes.

## 3. Mapa funcional observado

### 3.1 Entrada

A página inicial apresenta três acessos:

- Consultar proposta;
- Realizar nova simulação;
- Portal do Correspondente.

O simulador possui seis etapas visuais:

1. Modalidade;
2. Tipo;
3. Dados;
4. Seguradora;
5. Resultado;
6. Envio.

### 3.2 Árvore de jornadas

```text
Realizar nova simulação
├── Financiamento Imobiliário
│   ├── Pessoa Física
│   │   ├── Imóvel Residencial
│   │   └── Imóvel Comercial
│   └── Pessoa Jurídica
│       ├── Imóvel Comercial
│       └── Imóvel Residencial
│
│   Para os ramos inspecionados:
│   ├── Empreendimento Financiado pela Esteira Digital
│   ├── Imóvel da Esteira Digital
│   └── Imóvel Particular
│       ├── Taxa Referencial (TR)
│       ├── IPCA
│       └── Poupança
│
└── Crédito Garantia de Imóvel
    ├── Pessoa Física
    │   └── Imóvel
    └── Pessoa Jurídica
        └── Imóvel
```

As três origens e os três indexadores foram confirmados em PF/Residencial e PF/Comercial. A disponibilidade exata para os dois ramos PJ deve ser confirmada por contrato ou por nova inspeção antes de montar uma matriz rígida.

Se todas as opções forem uniformes, somente Financiamento Imobiliário produz até 36 combinações de navegação (`2 compradores × 2 tipos × 3 origens × 3 indexadores`). Isso não significa que devam existir 36 testes E2E mutáveis.

### 3.3 Dados da simulação

Campos comuns observados:

- Valor do imóvel;
- Valor do financiamento/Valor do empréstimo;
- prazo sugerido: 120, 180, 240, 300, 360 ou 420 meses;
- prazo customizado;
- sistema de amortização:
  - SAC — Sistema de amortização constante;
  - TP — Tabela Price;
- carência:
  - Selecione;
  - 30;
  - 60;
  - 90;
- data de nascimento;
- renda líquida (PF) ou faturamento líquido (PJ);
- Compor renda com co-adquirente.

Ao marcar composição de renda, são exibidos:

- Data de nascimento do co-adquirente;
- Renda do co-adquirente.

No HTML inspecionado, os campos principais não expõem `required`, `min`, `max`, `maxlength` ou `pattern`. As regras são aplicadas pelo componente ou pelo backend e precisam ser validadas por comportamento, não apenas por atributos.

Mensagens observadas no envio vazio da etapa Dados:

- `Valor do imovel abaixo do minimo permitido.`;
- `Informe o valor a financiar.`;
- `Informe o prazo.`;
- `É necessario ter ao menos 18 anos.`;
- `Informe a renda.`.

### 3.4 Seguradoras

A tela apresenta:

- texto legal sobre MIP e DFI;
- juros nominais e efetivos;
- despesas previstas;
- opção de incorporar ITBI/Custas ao financiamento, quando aplicável;
- tarifa de avaliação;
- cards dinâmicos de seguradora;
- indicação `Menor parcela`;
- primeira parcela, amortização + juros, MIP, DFI, manutenção, renda mínima e CET;
- avanço bloqueado até selecionar uma seguradora.

Na jornada de Financiamento Imobiliário inspecionada foram exibidos SOMPO, TOO, MAPFRE, AMERICAN LIFE e ZURICH. Na jornada Crédito Garantia, foram exibidos AMERICAN LIFE, MAPFRE e TOO.

Achado para confirmação funcional: na comparação de Financiamento Imobiliário, um card da TOO apareceu duas vezes com plano e valores idênticos; uma das ocorrências também não possuía nome acessível completo. Antes de abrir defeito, deve-se confirmar se representam ofertas tecnicamente distintas.

### 3.5 Resultado

A tela apresenta:

- seguradora e plano selecionados;
- Baixar planilha;
- Baixar PDF;
- juros nominais e efetivos;
- total de parcelas;
- primeira e última parcela;
- aba Parcelas;
- aba Correção projetada;
- aba Detalhamento.

A tabela de parcelas contém:

- parcela;
- prestação;
- amortização;
- juros;
- seguros MIP + DFI;
- saldo devedor.

Para o cenário de 120 meses inspecionado, foram exibidas 120 linhas e saldo final `R$ 0,00`.

Detalhamento apresentou:

- primeira parcela;
- CET;
- juros nominais e efetivos;
- amortização + juros;
- DFI;
- MIP;
- taxa de administração;
- renda necessária;
- prêmio total.

Achado para confirmação funcional: na jornada Crédito Garantia/PF, a aba Correção projetada apresentou conteúdo visualmente equivalente à tabela de Parcelas. É necessário confirmar se esse é o contrato para essa modalidade ou se falta uma projeção distinta.

### 3.6 Envio

Campos:

- CPF;
- Nome;
- Email;
- Celular.

Mensagens observadas com envio vazio:

- `CPF invalido.`;
- `Informe o nome.`;
- `E-mail invalido.`;
- `Informe o telefone.`.

O Page Object atual também trata:

- diálogo `Confirmar envio`;
- aviso de proposta existente para o mesmo CPF;
- leitura do protocolo real retornado pela aplicação.

## 4. Cobertura automatizada atual

| Comportamento | Evidência atual | Status | Lacuna principal |
|---|---|---:|---|
| Abrir o simulador | `PortalSimulatorPage.startNewSimulation()` | COVERED | Sem falha/empty state da carga de modalidades |
| Jornada Financiamento/PF/Residencial/Esteira/TR | `create-and-validate-simulation.spec.ts` | COVERED | Somente uma combinação |
| Rejeição de letras em cinco inputs numéricos | `verifyNumericInputsRejectLetters()` | COVERED | Não cobre paste, sinais, decimais e boundaries |
| Valores padrão válidos | `fillSimulationData()` | COVERED | Só SAC, 120, carência 30 e sem co-adquirente |
| Carregamento das seguradoras | espera do status desaparecer | PARTIAL | Sem erro, vazio, timeout ou reordenação |
| Seleção de MAPFRE | `selectInsurer()` | COVERED | Só uma seguradora e nenhum contrato comparativo |
| Resultado carregado | heading visível | PARTIAL | Nenhuma consistência financeira ou aba validada |
| Envio e protocolo | `submitProposal()` | COVERED | Sem validações negativas, duplo envio ou falha de rede |
| Reflexão no SCCI | cenário de integração | COVERED | Só a jornada principal e seus campos atuais |
| Modalidade Crédito Garantia | nenhuma | MISSING | Toda a modalidade |
| Pessoa Jurídica | nenhuma | MISSING | Labels, regras e reflexão próprias |
| Imóvel Comercial | nenhuma | MISSING | Jornada e produto refletido |
| Outras origens | nenhuma | MISSING | Empreendimento financiado e particular |
| IPCA e Poupança | nenhuma | MISSING | Cálculo, projeção e reflexão |
| Tabela Price | nenhuma | MISSING | Cálculo e reflexão |
| Carências 60/90 | nenhuma | MISSING | Cálculo e reflexão |
| Composição de renda | nenhuma | MISSING | Campos condicionais e soma refletida |
| Downloads | nenhuma | MISSING | Conteúdo, nome e integridade |
| Voltar/preservar estado | nenhuma | MISSING | Risco de perda ou contaminação |
| Mobile e acessibilidade | nenhuma específica | MISSING | Fluxo completo não comprovado |

A spec de demonstração reutiliza o mesmo caminho feliz. Ela melhora a apresentação, mas não adiciona cobertura funcional independente.

## 5. Inventário de riscos e cenários

O inventário abaixo contém **116 riscos funcionais**, e não 116 specs propostas. Vários IDs devem compartilhar a mesma preparação e ser comprovados por um único cenário composto.

### 5.1 Navegação e jornadas

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-NAV-01 | Entrada pelo card Realizar nova simulação | P1 | COVERED |
| SIM-NAV-02 | Falha ao carregar modalidades com erro visível e retry | P1 | MISSING |
| SIM-NAV-03 | Modalidades vazias sem loading infinito | P1 | MISSING |
| SIM-NAV-04 | Financiamento / PF / Residencial / Esteira / TR | P0 | COVERED |
| SIM-NAV-05 | Financiamento / PF / Comercial | P1 | MISSING |
| SIM-NAV-06 | Financiamento / PJ / Residencial | P1 | MISSING |
| SIM-NAV-07 | Financiamento / PJ / Comercial | P1 | MISSING |
| SIM-NAV-08 | Origem Empreendimento financiado | P1 | MISSING |
| SIM-NAV-09 | Origem Imóvel particular | P1 | MISSING |
| SIM-NAV-10 | Indexador IPCA | P0 | MISSING |
| SIM-NAV-11 | Indexador Poupança | P0 | MISSING |
| SIM-NAV-12 | Crédito Garantia / PF / Imóvel | P0 | MISSING |
| SIM-NAV-13 | Crédito Garantia / PJ / Imóvel | P0 | MISSING |
| SIM-NAV-14 | Voltar uma etapa preserva escolhas compatíveis | P1 | MISSING |
| SIM-NAV-15 | Alterar escolha anterior limpa dependências incompatíveis | P0 | MISSING |
| SIM-NAV-16 | Refresh por etapa mantém ou rejeita estado de forma controlada | P1 | MISSING |

### 5.2 Campos e regras financeiras

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-DATA-01 | Submit vazio apresenta todos os erros principais | P0 | OBSERVED |
| SIM-DATA-02 | Letras são rejeitadas nos campos numéricos | P1 | COVERED |
| SIM-DATA-03 | Paste com formatação monetária é normalizado | P1 | MISSING |
| SIM-DATA-04 | Valor mínimo do imóvel: abaixo, exato e acima | P0 | CONTRACT |
| SIM-DATA-05 | Valor mínimo do financiamento: abaixo, exato e acima | P0 | CONTRACT |
| SIM-DATA-06 | Financiamento superior ao valor do imóvel | P0 | MISSING |
| SIM-DATA-07 | Financiamento igual ao valor do imóvel | P1 | MISSING |
| SIM-DATA-08 | Limite percentual de financiamento por produto | P0 | CONTRACT |
| SIM-DATA-09 | Zero nos valores monetários | P1 | PARTIAL |
| SIM-DATA-10 | Valor monetário extremo sem overflow | P1 | MISSING |
| SIM-DATA-11 | Cada prazo sugerido é aceito | P1 | PARTIAL |
| SIM-DATA-12 | Prazo customizado válido | P1 | MISSING |
| SIM-DATA-13 | Prazo customizado abaixo/acima do permitido | P0 | CONTRACT |
| SIM-DATA-14 | Trocar botão de prazo por prazo customizado | P1 | MISSING |
| SIM-DATA-15 | SAC produz proposta consistente | P0 | PARTIAL |
| SIM-DATA-16 | Price produz proposta consistente | P0 | MISSING |
| SIM-DATA-17 | Carência não selecionada | P1 | MISSING |
| SIM-DATA-18 | Carências 30, 60 e 90 alteram cálculo corretamente | P0 | PARTIAL |
| SIM-DATA-19 | Maioridade: dia anterior, dia exato e dia posterior | P0 | CONTRACT |
| SIM-DATA-20 | Data bissexta válida | P1 | MISSING |
| SIM-DATA-21 | Data inexistente e data parcial | P1 | MISSING |
| SIM-DATA-22 | Data futura | P0 | MISSING |
| SIM-DATA-23 | Renda zero, mínima e incompatível com parcela | P0 | CONTRACT |
| SIM-DATA-24 | Marcar composição exibe os dois campos | P1 | OBSERVED |
| SIM-DATA-25 | Co-adquirente exige nascimento e renda | P0 | MISSING |
| SIM-DATA-26 | Desmarcar composição remove dados condicionais do cálculo | P0 | MISSING |
| SIM-DATA-27 | Renda familiar soma principal e co-adquirente | P0 | MISSING |
| SIM-DATA-28 | Labels e payload PF versus PJ | P0 | MISSING |
| SIM-DATA-29 | Duplo clique em Avançar gera uma única simulação | P1 | MISSING |
| SIM-DATA-30 | Falha/timeout do cálculo mantém formulário utilizável | P0 | MISSING |

### 5.3 Seguradoras e despesas

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-INS-01 | Loading bloqueia avanço e termina corretamente | P1 | PARTIAL |
| SIM-INS-02 | Seleção habilita avanço | P0 | COVERED |
| SIM-INS-03 | Menor parcela corresponde ao menor valor real | P0 | MISSING |
| SIM-INS-04 | Cards não duplicam a mesma oferta | P0 | CONTRACT |
| SIM-INS-05 | Cada card possui nome acessível único | P1 | PARTIAL |
| SIM-INS-06 | Valores do card são internamente consistentes | P0 | MISSING |
| SIM-INS-07 | Erro HTTP apresenta feedback e retry | P0 | MISSING |
| SIM-INS-08 | Resposta vazia não deixa loading infinito | P0 | MISSING |
| SIM-INS-09 | Resposta lenta não permite avanço prematuro | P1 | MISSING |
| SIM-INS-10 | Respostas fora de ordem não mostram cálculo anterior | P0 | MISSING |
| SIM-INS-11 | Incorporar ITBI altera financiamento e parcelas uma vez | P0 | MISSING |
| SIM-INS-12 | Desmarcar ITBI restaura valores originais | P0 | MISSING |
| SIM-INS-13 | Seguradoras variam conforme modalidade/produto | P1 | MISSING |
| SIM-INS-14 | Voltar e recalcular invalida seleção incompatível | P0 | MISSING |

### 5.4 Resultado e downloads

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-RES-01 | Resultado identifica seguradora/plano escolhidos | P0 | PARTIAL |
| SIM-RES-02 | Total de linhas corresponde ao prazo | P0 | OBSERVED |
| SIM-RES-03 | Saldo devedor final é zero | P0 | OBSERVED |
| SIM-RES-04 | Amortização reduz o saldo de forma válida | P0 | MISSING |
| SIM-RES-05 | Primeira/última parcela batem com a tabela | P0 | MISSING |
| SIM-RES-06 | Juros nominais/efetivos batem entre telas | P0 | MISSING |
| SIM-RES-07 | CET e prêmio são consistentes | P0 | MISSING |
| SIM-RES-08 | Aba Correção projetada segue contrato de TR | P1 | CONTRACT |
| SIM-RES-09 | Aba Correção projetada segue contrato de IPCA | P0 | MISSING |
| SIM-RES-10 | Aba Correção projetada segue contrato de Poupança | P0 | MISSING |
| SIM-RES-11 | Detalhamento apresenta todos os componentes | P1 | OBSERVED |
| SIM-RES-12 | PDF baixa, abre e contém a simulação correta | P0 | MISSING |
| SIM-RES-13 | Planilha baixa, abre e contém a simulação correta | P0 | MISSING |
| SIM-RES-14 | Falha de download não corrompe o estado da simulação | P1 | MISSING |

### 5.5 Identificação, confirmação e envio

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-SEND-01 | Campos vazios apresentam mensagens específicas | P0 | OBSERVED |
| SIM-SEND-02 | CPF válido é mascarado e enviado corretamente | P0 | PARTIAL |
| SIM-SEND-03 | CPF inválido é bloqueado | P0 | OBSERVED |
| SIM-SEND-04 | Nome vazio/só espaços é bloqueado | P1 | PARTIAL |
| SIM-SEND-05 | Nome Unicode válido é preservado | P1 | MISSING |
| SIM-SEND-06 | Email inválido é bloqueado | P1 | OBSERVED |
| SIM-SEND-07 | Celular incompleto/inválido é bloqueado | P1 | OBSERVED |
| SIM-SEND-08 | Cancelar diálogo não envia proposta | P0 | MISSING |
| SIM-SEND-09 | Confirmar envia uma única requisição | P0 | PARTIAL |
| SIM-SEND-10 | Duplo clique não cria duas operações | P0 | MISSING |
| SIM-SEND-11 | HTTP 4xx/5xx não apresenta protocolo falso | P0 | MISSING |
| SIM-SEND-12 | Timeout permite retry seguro sem duplicidade | P0 | MISSING |
| SIM-SEND-13 | Aviso de CPF existente segue contrato aprovado | P0 | PARTIAL |
| SIM-SEND-14 | Protocolo exibido é o retornado pelo backend | P0 | COVERED |
| SIM-SEND-15 | Refresh/Voltar antes da confirmação não envia proposta | P1 | MISSING |

### 5.6 Reflexão SCCI e contratos de integração

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-INT-01 | Jornada principal reflete dados pessoais/contato e simulação | P0 | COVERED |
| SIM-INT-02 | Price reflete o sistema correto | P0 | MISSING |
| SIM-INT-03 | IPCA reflete índice e produto corretos | P0 | MISSING |
| SIM-INT-04 | Poupança reflete índice e produto corretos | P0 | MISSING |
| SIM-INT-05 | Imóvel particular reflete origem correta | P1 | MISSING |
| SIM-INT-06 | Empreendimento financiado reflete origem correta | P1 | MISSING |
| SIM-INT-07 | Imóvel comercial reflete tipo correto | P0 | MISSING |
| SIM-INT-08 | Pessoa Jurídica reflete comprador/faturamento | P0 | MISSING |
| SIM-INT-09 | Crédito Garantia reflete modalidade/produto | P0 | MISSING |
| SIM-INT-10 | Co-adquirente e renda familiar refletem corretamente | P0 | MISSING |
| SIM-INT-11 | Seguradora escolhida reflete corretamente | P0 | PARTIAL |
| SIM-INT-12 | Valores, prazo e data mantêm precisão/formato | P0 | COVERED |

### 5.7 Sessão, concorrência, segurança, mobile e acessibilidade

| ID | Cenário | Prioridade | Estado atual |
|---|---|---:|---:|
| SIM-ROB-01 | Sessão expira durante a simulação sem envio silencioso | P0 | MISSING |
| SIM-ROB-02 | Refresh durante cálculo não mistura resultado antigo | P0 | MISSING |
| SIM-ROB-03 | Duas abas mantêm simulações isoladas | P0 | MISSING |
| SIM-ROB-04 | Dados da simulação A não contaminam B | P0 | MISSING |
| SIM-ROB-05 | Resposta atrasada de A não substitui B | P0 | MISSING |
| SIM-ROB-06 | Deep link sem estado é tratado de forma segura | P1 | MISSING |
| SIM-ROB-07 | Fluxo representativo funciona em viewport mobile | P1 | MISSING |
| SIM-ROB-08 | Sem overflow horizontal nas seis etapas | P1 | MISSING |
| SIM-ROB-09 | Teclado percorre escolhas, formulário, seguradora e modal | P1 | MISSING |
| SIM-ROB-10 | Foco vai ao primeiro erro após submit inválido | P1 | MISSING |
| SIM-ROB-11 | Erros usam semântica acessível | P1 | MISSING |
| SIM-ROB-12 | Cards de seguradora têm nome acessível e seleção anunciada | P1 | PARTIAL |
| SIM-ROB-13 | Diálogo mantém foco, Escape e retorno de foco | P1 | MISSING |
| SIM-ROB-14 | Progresso das etapas anuncia etapa atual | P2 | PARTIAL |
| SIM-ROB-15 | Valores e tabelas são legíveis em zoom de 200% | P2 | MISSING |

## 6. Divergências e riscos encontrados

### P0 — Cobertura de negócio ausente

1. Modalidade Crédito Garantia não possui cobertura automatizada.
2. Pessoa Jurídica não possui cobertura automatizada.
3. IPCA, Poupança e Price não possuem cobertura de cálculo ou reflexão.
4. Resultado é validado apenas pela presença do título; cálculos, parcelas e downloads podem regredir sem falhar o teste.
5. Falhas de cálculo e de envio podem gerar loading infinito, falsa confirmação ou duplicidade sem detecção atual.
6. Composição de renda não é exercitada nem refletida no SCCI.

### P1 — Falso positivo e fragilidade

1. O teste feliz passa mesmo se abas e downloads do resultado estiverem quebrados.
2. A espera das seguradoras comprova apenas que o loading sumiu, não que a resposta é válida e única.
3. O tipo TypeScript dá aparência de contrato forte, mas bloqueia todas as alternativas do produto.
4. A mesma jornada da demonstração não aumenta a diversidade funcional.
5. Navegação Voltar, refresh e troca de escolhas não são protegidos.

### Achados que exigem confirmação

1. Card TOO duplicado na comparação do financiamento.
2. Conteúdo aparentemente igual entre Parcelas e Correção projetada no Crédito Garantia/TR.
3. Limites mínimos/máximos de valor, prazo, idade, renda e percentual financiável.
4. Matriz de opções permitidas para os ramos PJ.
5. Regra exata do aviso de CPF com proposta existente.

Esses itens não devem virar assertions arbitrárias antes da resposta funcional.

## 7. Cenários compostos recomendados

Uma implementação eficiente pode ser organizada assim:

1. **Navegação e matriz de produtos** — 4 cenários read-only cobrindo todas as opções com pairwise PF/PJ, residencial/comercial, origens e indexadores.
2. **Validações financeiras** — 4 a 5 cenários compostos para valores, prazo, sistemas, carências, datas e renda.
3. **Composição de renda** — 2 cenários: incluir/calcular/refletir e remover/limpar.
4. **Seguradoras** — 3 cenários: comparação/seleção, falha/retry e concorrência/resposta fora de ordem.
5. **Resultado** — 3 cenários: invariantes SAC, invariantes Price/correção e downloads.
6. **Envio** — 3 cenários: validações, cancelar/confirmar uma vez e falha/retry sem duplicidade.
7. **Integração SCCI** — 3 a 4 jornadas mutáveis representativas:
   - financiamento PF/TR/SAC;
   - financiamento PJ/IPCA/Price;
   - crédito garantia PF;
   - composição de renda, se não coberta por uma das anteriores.
8. **Robustez e acessibilidade** — 3 cenários: duas abas/latência, mobile e teclado/modal.

Total estimado: 22 a 28 cenários compostos. Os testes de navegação, validação e falhas controladas não precisam criar propostas. Somente as jornadas de reflexão SCCI devem consumir massa.

## 8. Arquitetura recomendada

### 8.1 Contratos tipados

Substituir os literais únicos por uniões que representem o produto real, mantendo combinações inválidas fora do contrato. Não usar um objeto livre de strings.

Separar:

- jornada comercial;
- dados financeiros PF/PJ;
- composição de renda;
- despesas incorporáveis;
- oferta de seguradora;
- expectativas de cálculo;
- reflexão no SCCI.

### 8.2 Page Objects

Preservar o `PortalSimulatorPage`, mas dividir responsabilidades internas:

- seleção da jornada;
- formulário financeiro;
- comparação de seguradoras;
- resultado/downloads;
- identificação e envio.

Os métodos devem permitir testar uma etapa sem serem obrigados a executar `completeSimulation()` inteiro.

### 8.3 Massa e mutação

- cenários de validação: sem envio;
- rede controlada: `page.route()` apenas para falha, atraso e ordem de resposta;
- cálculos finais: backend real;
- integração: proposta nova e consumível por execução;
- protocolo: sempre lido da resposta/tela, nunca inferido;
- nenhuma retry automática depois de tentativa de envio com resultado incerto.

### 8.4 Evidência

Cada cenário deve anexar:

- jornada escolhida;
- entradas financeiras sem dados pessoais;
- seguradora/oferta selecionada;
- resumo do resultado;
- protocolo somente quando houver envio;
- campos refletidos no SCCI quando aplicável;
- screenshot de tela inteira e trace conforme política atual do projeto.

## 9. Contratos de domínio necessários

Antes de automatizar expectativas rígidas, Produto/Negócio deve confirmar:

1. combinações permitidas por modalidade, comprador, imóvel, origem e indexador;
2. mínimos, máximos e percentuais de financiamento;
3. prazos permitidos por produto;
4. regra de maioridade e idade máxima ao término;
5. carência opcional ou obrigatória por produto;
6. cálculo de renda mínima;
7. regra de `Menor parcela`;
8. comportamento de ITBI/Custas incorporados;
9. significado da aba Correção projetada para TR;
10. conteúdo mínimo dos arquivos PDF e XLSX;
11. comportamento aprovado para CPF com proposta existente;
12. se ofertas visualmente idênticas de uma seguradora podem coexistir.

## 10. Ordem proposta

1. Contratos e tipos das jornadas, sem executar propostas;
2. navegação e validações de Dados;
3. seguradoras e falhas controladas;
4. invariantes do Resultado e downloads;
5. Envio, confirmação e idempotência;
6. três ou quatro reflexões representativas no SCCI;
7. concorrência, mobile e acessibilidade;
8. auditoria final da matriz e atualização da documentação.

## 11. Critério de conclusão

O Simulador poderá ser considerado protegido quando:

- cada mecanismo funcional tiver ao menos uma prova positiva e uma negativa relevante;
- cada modalidade e tipo de comprador tiver uma jornada real;
- TR, IPCA, Poupança, SAC e Price tiverem cálculo representativo;
- falhas de cálculo e envio não produzirem falsa confirmação ou duplicidade;
- resultado e downloads tiverem consistência automatizada;
- as jornadas semanticamente distintas refletirem corretamente no SCCI;
- mobile, teclado e acessibilidade básica forem comprovados;
- nenhum cenário depender de literal arbitrário não aprovado pelo domínio.

Até lá, os testes existentes devem ser tratados como **prova da jornada principal e infraestrutura de provisionamento**, não como validação completa do Simulador.

## 12. Atualização de 09/11/2026 — Lote 1 (somente leitura, sem envio de proposta)

Ambiente: `https://portal-desenv.prognum.com.br/`, perfil `PW_PROFILE=desenv`.
O perfil `ht` (`minhaproposta-dev`) **não oferece** "Realizar nova simulação"; o projeto novo falha com mensagem explícita nesse perfil.
Natureza: backend real, leitura. Projeto `simulator-readonly` (`npm run pw:test:simulator:readonly`). A fixture `tests/simulator/simulator.fixture.ts` aborta e reprova qualquer escrita HTTP fora de `POST /api/simulacao/tipo-operacao` (consulta de classificação, sem proposta).

### 12.1 Divergências em relação à auditoria de 17/09/2026 (reconfirmadas ao vivo)

1. PF + Imóvel Comercial oferece **somente TR e IPCA** (sem Poupança) nas três origens. A seção 3.2 dizia que os três indexadores existiam em PF/Comercial.
2. Pessoa Jurídica **não tem etapa de indexador**: a origem leva direto aos Dados. A origem se chama "Imóvel Esteira Digital" (sem "da"); PJ/Residencial tem uma quarta origem, "Holding Familiar".
3. Crédito Garantia PF e PJ têm um único tipo, "Imóvel". PF usa "Valor do financiamento"/"Renda liquida"; PJ usa "Valor do emprestimo"/"Faturamento liquido" (em Financiamento e em Crédito Garantia).
4. Total de **24 jornadas** de navegação: PF 15 (Residencial 9, Comercial 6), PJ 7, Crédito Garantia 2.
5. As etapas Tipo, Imóvel e Origem compartilham a URL `/tipo-financiamento`; Dados é `/dados-simulacao`.
6. Na tela Dados há dois botões "Voltar" (cabeçalho e rodapé do formulário); nas demais etapas há um.

### 12.2 Achados novos

| ID | Achado | Estado |
|---|---|---|
| DEF-SIM-01 | `31/02/2001` não é recusada pelo formulário: o front envia `"dataNascimento":"2001-02-31"` a `POST /api/simulacao/tipo-operacao`, o backend responde 400 `Failed to read request` e o usuário vê só "Nao foi possivel identificar o tipo de operacao. Tente novamente." Datas futuras, menores de 18 e datas incompletas são recusadas no formulário, sem chamar o backend. | Defeito de UX observado; coberto por teste `test.fail()` (remover ao corrigir). Severidade a confirmar com Produto. |
| OBS-SIM-02 | Em PJ o campo se chama "Faturamento liquido", mas a mensagem de envio vazio é "Informe a renda." (igual à de PF). | Observação para Produto; o teste só exige que a mensagem seja a mesma em todas as jornadas. |

### 12.3 Matriz do lote

| IDs | Teste | Origem da expectativa | Perfil | Resultado |
|---|---|---|---|---|
| SIM-NAV-04..13 | `tests/simulator/journeys.spec.ts` › menu de jornadas (13 casos: opções exatas por etapa) | Inspeção ao vivo de 09/11/2026 (contrato observado; matriz permitida pendente de Produto) | desenv | 13 aprovados |
| SIM-NAV-04..13, SIM-DATA-28 | `journeys.spec.ts` › chegada à tela Dados (24 casos, uma por jornada: URL, rótulo acima do título, rótulos PF×PJ, 6 prazos, amortização, carência) | idem | desenv | 24 aprovados |
| SIM-NAV-14 | `journeys.spec.ts` › Voltar retorna uma etapa por vez | idem | desenv | 1 aprovado |
| SIM-NAV-15 | `journeys.spec.ts` › trocar PF por PJ não carrega rótulos anteriores | idem | desenv | 1 aprovado |
| SIM-DATA-01 | `tests/simulator/data-step.spec.ts` › envio vazio (4 jornadas: PF, PJ Holding, Crédito PF, Crédito PJ) — 5 mensagens, sem cálculo | Mensagens exibidas pelo produto | desenv | 4 aprovados |
| SIM-DATA-06 | › financiamento superior ao imóvel | Mensagem do produto: "Valor financiado superior ao valor do imovel." | desenv | 1 aprovado |
| SIM-DATA-19, 22 | › idade mínima: 17a364d e data futura bloqueadas; 19 anos não recusada | Mensagem do produto: "ao menos 18 anos". O dia exato do 18º aniversário **não** é assertado (contrato pendente) | desenv | 3 aprovados |
| SIM-DATA-21 | › data incompleta recusada sem cálculo; 31/02/2001 não avança e mostra erro | Observação ao vivo | desenv | 2 aprovados |
| SIM-DATA-21 / DEF-SIM-01 | › 31/02/2001 recusada no formulário, sem chamar o backend | Data inexistente é inválida por definição de calendário | desenv | 1 falha esperada (`test.fail`); falha pelo motivo certo (verificado removendo o `test.fail` numa cópia temporária) |
| SIM-DATA-24, 25, 26 | › co-adquirente: campos condicionais, 2 mensagens, remoção ao desmarcar | Observação ao vivo | desenv | 1 aprovado |

Total do lote: **51 casos novos** (50 aprovados, 1 falha esperada documentada). Execução: `PW_PROFILE=desenv npx playwright test --project=simulator-readonly`, 51 aprovados em 5,4 min (o `test.fail` conta como aprovado).

### 12.4 Pendências do lote (continuam abertas)

- Mínimos/máximos de valor, percentual financiável, prazo customizado, idade máxima e dia exato da maioridade: dependem de Produto (seção 9, itens 2–4). Nenhuma assertion arbitrária foi criada.
- Cálculo (seguradoras, resultado, downloads), envio e reflexão no SCCI: não tocados neste lote. Seguradoras exige `Avancar` válido (consulta de cálculo) e falhas controladas via `page.route`; envio e SCCI dependem de autorização e massa.
- Mobile, teclado e acessibilidade: não iniciados. Observação para esse lote: dois "Voltar" com o mesmo nome acessível na tela Dados.


## 13. Referência de domínio no SCCI (esteira-ht) — leitura de 09/11/2026

Fonte: `https://esteiradigital-ht.prognum.com.br/` (usuário de teste do projeto), **Manutenção > Tabelas > Originação**: *Grupos de tipos de operação* (299 grupos), *Tipo de operação* (427 tipos, após Pesquisar) e *Faixa LTV por tipo de operação* (405 faixas). Somente leitura; nada foi alterado. Cópia bruta fora do repositório, em `/Users/iagolealdemattos/OpenBot/Shared/scci-referencia-esteira-ht-2026-11-09/*.json` (grupos, tipos, faixas LTV e faixas de renda).

### 13.1 O que foi entendido

1. **O menu do Simulador é a árvore de grupos do SCCI.** Sob `009 Nova Operação` ficam `500 Financiamento Imobiliário` e `501 Crédito Garantia de Imóvel`; as telas Tipo, Imóvel, Origem e Indexador são os níveis dessa árvore. O Simulador envia o grupo da folha (ex.: `"grupo":"220"` = TR < Imóvel da Esteira Digital < Imóvel Residencial < Pessoa Física).
2. **Grupos ativos = jornadas visíveis.** Dos 40 grupos sob 500/501 sem ancestral "Modalidade Inativa", 24 são folhas com tipo de operação — exatamente as 24 jornadas do contrato observado (seção 12). Grupos inativos (Lote, Construção PF) não aparecem no Simulador.
3. **Cada folha tem 1 a 3 tipos de operação** (ex.: grupo 220 tem `100 SFIMOBILIARIO - TR` e `060 SFHABITACAO - TR`; Crédito Garantia PF tem 30%, 50% e 60%). A regra que escolhe o tipo (valor do imóvel, LTV, SFH×SFI) **ainda não foi confirmada**.
4. Cada tipo traz: valor mínimo/máximo da operação, valor máximo do imóvel, prazo mínimo/máximo, idade mínima/máxima, idade + prazo máximo e prestação mínima. O LTV e o comprometimento de renda (40% em todas as faixas lidas) estão na tabela de faixas LTV.
5. **PF: idade 18–80, idade + prazo ≤ 80. PJ: idade 0/0 (sem regra de idade).** O "ao menos 18 anos" do Simulador coincide com `NU_IDADE_MINIMA = 18` para PF.

### 13.2 Limites por jornada (todos os tipos da folha; valores como gravados no SCCI, em reais a confirmar)

| Grupo | Jornada | Tipos | Mín. operação | Máx. operação | Prazo (meses) | Idade | Idade+prazo | LTV % |
|---|---|---:|---:|---:|---|---|---:|---|
| 094 | Pessoa Jurídica > Imóvel Comercial > Empreendimento | 1 | 20.000 | 50.000.000 | 36–180 | 0–0 | 0 | 70 |
| 095 | Pessoa Jurídica > Imóvel Comercial > Imóvel Esteira | 1 | 20.000 | 150.000.000 | 36–180 | 0–0 | 0 | 90 |
| 096 | Pessoa Jurídica > Imóvel Comercial > Imóvel Particular | 1 | 20.000 | 1.500.000.000 ⚠ | 36–180 | 0–0 | 0 | 70 |
| 110 | Pessoa Jurídica > Imóvel Residencial > Empreendimento | 1 | 20.000 | 15.000.000 | 36–120 | 0–0 | 0 | 70 |
| 111 | Pessoa Jurídica > Imóvel Residencial > Imóvel Esteira | 1 | 20.000 | 15.000.000 | 36–180 | 0–0 | 0 | 90 |
| 112 | Pessoa Jurídica > Imóvel Residencial > Imóvel Particular | 1 | 20.000 | 1.500.000.000 ⚠ | 36–120 | 0–0 | 0 | 70 |
| 115 | Pessoa Jurídica > Imóvel Residencial > Holding Familiar | 1 | 35.000 | 150.000.000 | 36–420 | 0–0 | 0 | 80 |
| 201 | Pessoa Física > Imóvel Residencial > Empreendimento > IPCA | 2 | 20.000 | 50.000.000 | 36–360 | 18–80 | 80 | 90 |
| 206 | Pessoa Física > Imóvel Residencial > Imóvel Particular > TR | 2 | 20.000 | 50.000.000 | 36–420 | 18–80 | 80 | 80/90 |
| 207 | Pessoa Física > Imóvel Residencial > Imóvel Particular > IPCA | 2 | 20.000 | 50.000.000 | 36–360 | 18–80 | 80 | 80/90 |
| 212 | Pessoa Física > Imóvel Comercial > Empreendimento > TR | 3 | 20.000 | 50.000.000 | 36–180 | 18–80 | 80 | 60/70/90 |
| 213 | Pessoa Física > Imóvel Comercial > Empreendimento > IPCA | 3 | 20.000 | 50.000.000 | 36–180 | 18–80 | 80 | 60/70/90 |
| 216 | Pessoa Física > Imóvel Comercial > Imóvel Particular > TR | 3 | 20.000 | 50.000.000 | 36–180 | 18–80 | 80 | 80/90 |
| 217 | Pessoa Física > Imóvel Comercial > Imóvel Particular > IPCA | 3 | 20.000 | 50.000.000 | 36–180 | 18–80 | 80 | 80/90 |
| 220 | Pessoa Física > Imóvel Residencial > Imóvel Esteira > TR | 2 | 20.000 | 15.000.000 | 36–420 | 18–80 | 80 | 90 |
| 221 | Pessoa Física > Imóvel Residencial > Imóvel Esteira > IPCA | 2 | 20.000 | 15.000.000 | 36–360 | 18–80 | 80 | 90 |
| 226 | Pessoa Física > Imóvel Comercial > Imóvel Esteira > TR | 1 | 20.000 | 1.500.000.000.000 ⚠ | 36–180 | 18–80 | 80 | 90 |
| 227 | Pessoa Física > Imóvel Comercial > Imóvel Esteira > IPCA | 1 | 20.000 | 15.000.000 | 36–180 | 18–80 | 80 | 90 |
| 230 | Pessoa Física > Imóvel Residencial > Empreendimento > Poupança | 2 | 20.000 | 50.000.000 | 36–420 | 18–80 | 80 | 90 |
| 232 | Pessoa Física > Imóvel Residencial > Imóvel Esteira > Poupança | 2 | 20.000 | 15.000.000 | 36–240 | 18–80 | 80 | 90 |
| 234 | Pessoa Física > Imóvel Residencial > Imóvel Particular > Poupança | 2 | 20.000 | 50.000.000 | 36–420 | 18–80 | 80 | 80 |
| 299 | Pessoa Física > Imóvel Residencial > Empreendimento > TR | 2 | 20.000 | 50.000.000 | 36–420 | 18–80 | 80 | 90 |
| 402 | Pessoa Física > Imóvel | 3 | 30.000 | 10.000.000 | 1–240 | 18–80 | 80 | 30/40/50/60 |
| 404 | Pessoa Jurídica > Imóvel | 3 | 30.000 | 10.500.000 | 1–180 | 0–0 | 0 | 30/50/60 |

⚠ = valor aparentemente fora de escala (grupo 226 PF/Comercial/Imóvel Esteira/TR: máximo 1.500.000.000.000). Prestação mínima: 0 ou 1 conforme o grupo.

### 13.3 O que isso muda nos testes

- **Prazo:** o Simulador oferece 120–420 meses em **todas** as jornadas, mas há folhas com prazo máximo de 120, 180, 240 e 360 (ex.: PJ Comercial = 180; PJ Residencial/Empreendimento = 120; Crédito Garantia PF = 240, PJ = 180). Hipótese a verificar ao vivo (consulta de cálculo, sem proposta): prazo acima do máximo da folha é recusado, ou aparece como opção inválida.
- **Mínimo da operação (20.000 em quase todos os grupos; 30.000 em Crédito Garantia; 35.000 na Holding)** é candidato a oráculo para SIM-DATA-04/05, ainda sem confirmar se o "abaixo do minimo permitido" do Simulador usa o mesmo valor e a mesma unidade.
- **Idade:** PF 18–80 e idade+prazo ≤ 80 permitem fronteiras objetivas (a regra "idade+prazo" ainda precisa de confirmação de interpretação: anos completos, fração em meses). PJ não tem regra de idade no SCCI, embora o Simulador mostre "É necessario ter ao menos 18 anos." para PJ (**observação para Produto**).
- **Anomalias de configuração que o teste deve tolerar ou sinalizar, nunca copiar:** máximos com sufixo `.01`/`.02` (parecem separar tipos no mesmo grupo), máximo de 1,5 trilhão no grupo 226, `Modalidade suspensa = T` em grupos visíveis no Simulador (005 Imóvel Residencial PF, 023 Imóvel Residencial PJ, 115 Holding) — significado de "suspensa" a confirmar com Produto.

### 13.4 Respostas de Produto e fase inicial (09/11/2026)

Confirmado por Produto/usuário:
1. No esteira-ht o SCCI **bloqueia** proposta com CPF já existente (comportamento para SIM-SEND-13 nesse ambiente; DESENV e HT não foram confirmados).
2. O Simulador externo pede somente CPF, nome, e-mail e celular.

Lido no SCCI (Manutenção > Tabelas > Originação > Configurações e Fases da operação):
- `NU_FASE_SIMULACAO = 100` → fase **100 "CADASTRAMENTO DA PROPOSTA"** (primeira das 29 fases).
- `CO_TAREFA_SIMULACAO = 010` e `CO_TAREFA_ENVIO_PROPOSTA = 010` (tarefa inicial padrão); `NU_FASE_CANCELAMENTO = 1200`.
- Esses são os valores esperados da fase e da tarefa de uma proposta recém-criada pelo Simulador no esteira-ht (a ser comprovado na primeira criação autorizada).
- Em Tabelas > Seguros só existe "Cadastro da Seguradora"; a tela que liga seguradora a tipo de operação (`SEGURADORA_TIPO_OPERACAO`) ainda não foi localizada.
- Custos padrão (certidões, registro, TEAG, ITBI %) estão em 0 em Configurações; as despesas exibidas no Simulador vêm de outra fonte (`DESPESA_ORIGINACAO`, não lida).

### 13.5 Seguradora por tipo de operação (esteira-ht, 09/11/2026)

Caminho: Manutenção > Tabelas > Originação > Tipo de operação > Pesquisar > (linha) Consultar > botão **Seguradoras** (também há **Séries** e **Carências**). O cadastro geral fica em Tabelas > Terceiros > Seguradora (1 Padrão SFH, 2 Hipotecário, 3 Icatu, 4 Mapfre, 5 Sompo, 6 Allianz, 7 American Life, 8 Zurich, 9 TOO, 98 Sem seguros, 99 Suspensão); lá há idade máxima de início/término por seguradora (0 na Mapfre). Dados brutos dos 45 tipos das 24 jornadas em `/Users/iagolealdemattos/OpenBot/Shared/scci-referencia-esteira-ht-2026-11-09/seguradoras-por-tipo.json`.

- **Confere com o Simulador:** tipo 100 (PF/Residencial/Imóvel Esteira/TR) → Sompo, Mapfre, American Life, TOO e Zurich (as 5 que o Simulador exibe); Crédito Garantia PF → American Life, Mapfre, TOO (as 3 observadas); Crédito Garantia PJ → American Life e Mapfre.
- **Oráculo de SIM-INS-13:** o conjunto de seguradoras esperado por jornada vem da tabela do tipo, não do Simulador. Atenção: uma jornada pode ter 2–3 tipos e o conjunto muda por tipo (ex.: PJ Comercial/Imóvel Particular, tipo 198, inclui Allianz e "Sem seguros").
- **Duplicidades de configuração (provável origem do card TOO duplicado, hipótese a confirmar na tela):** 7 dos 45 tipos repetem seguradora. Tipo 900 (grupo 206, PF Residencial/Imóvel Particular/TR, SFH): **TOO duas vezes com a mesma apólice 9500**; tipo 574, 221, 217 e 198 repetem Mapfre/Zurich/"Sem seguros" com a mesma apólice; tipo 232 repete TOO com apólices diferentes (9500 e 9400). Decisão de Produto: dado de configuração a corrigir ou o Simulador deve deduplicar por seguradora+apólice?
- **Carências:** a tela Carências do tipo 100 está vazia, mas o Simulador oferece 30/60/90. Origem da lista de carência ainda desconhecida.

### 13.6 Primeira proposta criada no esteira-ht (09/11/2026, autorizada por Iago Mattos)

- Execução: `PW_PROFILE=esteira-ht ALLOW_TEST_MUTATION=true PORTAL_PROVISION_SLOT=RESERVE npx playwright test tests/integrations/portal-aejs/create-and-validate-simulation.spec.ts --project=simulator-integration` (o `ALLOW_TEST_MUTATION` foi passado só no comando; o perfil não foi editado).
- Resultado: **1 proposta criada, protocolo `000000668`**, slot `RESERVE` (registro em `.playwright/generated-simulations/esteira-ht.json`, backup anterior em `/Users/iagolealdemattos/OpenBot/Shared/backup-registro-esteira-ht/`). Jornada: Financiamento > PF > Residencial > Imóvel da Esteira Digital > TR, SAC, MAPFRE. Dados pessoais, contato e simulação refletidos no SCCI (cobertura já existente): aprovado.
- **Novo (SIM-SEND / pós-condição):** etapa "valida a fase inicial e o andamento do processo" no mesmo teste. Esperado, com origem em Configurações e Fases do SCCI: fase atual **CADASTRAMENTO DA PROPOSTA (100)**; Andamento do Processo com exatamente 2 tarefas: **010 Registrar Proposta / Proposta Registrada** e **020 Complementar dados da proposta / Disponível**. Aprovado na proposta 000000668 (nova execução sem criar outra, pois o slot já tinha protocolo).
- Observado, não assertado: tarefa 010 executada pela entidade "Plataforma Web", setor "Atendimento".
- Pendente: duplicidade de CPF (o esteira-ht bloqueia, segundo Iago Mattos) ainda sem teste; tipo de operação escolhido pelo SCCI (hoje não visível na tela da simulação) e despesas gravadas ainda não conferidos.

## 14. Admin do Portal (portal-desenv) — leitura de 09/11/2026

Fonte: `https://portal-desenv.prognum.com.br/admin/` (usuário `cypress`; credencial guardada no Vault do OpenBot, nunca em arquivo do projeto). Somente leitura; nenhum valor foi salvo. 576 chaves: 343 default, 85 herdando, 148 sobrescritas. O admin configura o **front do Simulador** ("o app público reflete as mudanças sem rebuild"); o SCCI continua sendo a fonte das regras por tipo de operação (seção 13).

### 14.1 Simulador > Limites e Regras (todos no default do catálogo, 0 sobrescritas)

| Chave | Valor | O que explica no Simulador |
|---|---|---|
| `regras.valorMinImovel` | 50000 (reais) | Origem de "Valor do imovel abaixo do minimo permitido." → fronteira objetiva para SIM-DATA-04 (49.999,99 × 50.000,00); **diferente** do mínimo da operação no SCCI (20.000/30.000/35.000) |
| `regras.valoresPrazo` | [120,180,240,300,360,420] | Botões de prazo, iguais para **todas** as jornadas |
| `regras.prazoMinimo` / `prazoMaximo` | 12 / 420 | Limites globais do campo de prazo customizado; o SCCI tem máximos por tipo (120, 180, 240, 360, 420) → o Simulador não filtra prazo por jornada |
| `regras.valoresCampoCarencia` | [0,30,60,90] | Origem da lista de carência (resolve a dúvida da seção 13.5; a tabela Carências do SCCI está vazia) |
| `regras.idadeMaisPrazoMaxMeses` | 0 | Sem regra de idade+prazo no front (o SCCI tem 80 para PF) |
| `regras.fasesPrazoCadastro` | 30 (dias) | Prazo para concluir o cadastro |
| Upload | 10 MB; `pdf,jpg,jpeg,png`; concorrência 1 | — |

### 14.2 Simulador > Telas do simulador (177 chaves, 15 sobrescritas)

- Dados da simulação: "Valor do imovel" (obrigatório), "Valor a financiar" (rótulo do admin, usado na mensagem "Informe o valor a financiar."), "Prazo (meses)", "Data de nascimento", "Compor renda com co-adquirente?" (**não obrigatório**), "Carencia" (**não obrigatória**, por isso "Selecione" é válido), "Sistema de amortizacao" com opções `SAC:2` e `Tabela Price:1` e valor padrão `2` (SAC).
- Ocultos por configuração: Relacionamento, Tipo de carência, Origem do imóvel, Índice de correção, Valor de construção, "Compor renda 2".
- Feature flags relevantes: barra de ambiente e "Tag DEMO" ligadas (explica o selo **DEMO** no cabeçalho do Simulador em portal-desenv); "Consultar proposta" ligada; OCR automático desligado; "Login somente CPF" ligado.

### 14.3 Consequências para os testes

1. Valor mínimo do imóvel passa a ter **oráculo**: ler `regras.valorMinImovel` do admin em tempo de execução e testar 49.999,99 (recusado), 50.000,00 (aceito) e 50.000,01.
2. Opções de prazo e carência do formulário devem coincidir com `valoresPrazo` e `valoresCampoCarencia` do admin (teste de consistência admin × tela).
3. Divergência a decidir com Produto: o front oferece 420 meses em qualquer jornada, mas o SCCI limita o prazo por tipo. Falta verificar o que o backend faz ao receber um prazo acima do máximo do tipo.
4. Valor mínimo do financiamento: não há chave no admin; o mínimo da operação (20.000) vem do SCCI e ainda não foi testado.

## 15. Lote 2 — regras do admin, limites do backend e seguradoras por jornada (09/11/2026)

### 15.1 O que o backend do Simulador faz (consultas de cálculo, sem proposta)

`POST /api/simulacao/tipo-operacao` classifica o tipo; `POST /api/simulacao/evolucao` calcula e **recusa com HTTP 422**, exibindo a mensagem na tela de seguradoras (sem cards):

| Situação (portal-desenv) | Resultado observado |
|---|---|
| PJ Comercial/Imóvel Particular, prazo 180 | aceito (200, 5 cards) |
| mesma jornada, prazo **181** | **422** "Prazo do financiamento não é permitido para idade do proponente" (confere com o máximo 180 do SCCI, tipo 198; a mensagem fala de idade, mas PJ não tem regra de idade → **mensagem imprecisa**) |
| mesma jornada, prazo **35** (mínimo SCCI = 36) | **aceito** (200, 5 cards) → **divergência SCCI × Simulador a confirmar**: o prazo mínimo do tipo não é aplicado |
| PF TR/Esteira, prazo 12 (renda 50 mil) | 422 "A renda mínima necessária permitido para esta operação é ( 113.061,15)" (bloqueio por renda, não por prazo) |
| PJ Comercial/Imóvel Particular, prazo 420 | 422 (mesma mensagem de idade) |

Fronteiras só do formulário (admin, sem chamar o backend): imóvel 49.999,99 → "abaixo do minimo"; 50.000,00 e 50.000,01 → aceitos; prazo customizado 11 → "Prazo mínimo: 12 meses.", 421 → "Prazo máximo: 420 meses.", 12 e 420 aceitos.

### 15.2 Seguradoras por jornada × cadastro do SCCI

- Cada card começa com o nome da seguradora do SCCI e segue com a apólice (ex.: "MAPFRE" + "MAPFRE SEGUROS FX ETARIA_NV").
- **Causa do card duplicado/sem nome confirmada:** quando o cadastro do tipo repete a mesma seguradora (mesma apólice ou apólice diferente), o Simulador mostra um card **extra com nome acessível vazio**. Casos no snapshot: tipos 900 e 901 (PF Residencial/Imóvel Particular/TR), 220 e 574 (Esteira/Particular, IPCA/Poupança), 232 (TOO 9500 e 9400; MAPFRE ×2), 217 e 198. Decisão de Produto pendente: corrigir o cadastro do SCCI ou deduplicar no Simulador (o card sem nome também é problema de acessibilidade).
- PJ aparece com seguradoras próprias (ALLIANZ, "SEM SEGUROS"), PJ Residencial sem a SOMPO, Holding só MAPFRE e TOO, Crédito Garantia PF com AMERICAN LIFE/MAPFRE/TOO e PJ com AMERICAN LIFE/MAPFRE. Tudo coerente com o SCCI.
- ICATU aparece em PF Comercial/Empreendimento/TR (um tipo do grupo 212 a lista).
- O tipo de operação escolhido pelo Simulador depende do valor do imóvel; as expectativas usam "toda seguradora comum a todos os tipos é exibida e toda exibida existe em algum tipo".

### 15.3 Testes novos deste lote

| IDs | Teste | Origem da expectativa | Resultado |
|---|---|---|---|
| SIM-DATA-04 | `tests/simulator/admin-rules.spec.ts` › valor mínimo do imóvel (3 casos) | admin `regras.valorMinImovel` (lido do HTML público) | 3 aprovados |
| SIM-DATA-13 | › prazo customizado nos limites do admin (4 casos) | admin `prazoMinimo`/`prazoMaximo` | 4 aprovados |
| SIM-DATA-11, 17 | › botões de prazo e carência = admin | admin `valoresPrazo`/`valoresCampoCarencia` | 1 aprovado |
| SIM-INS-04/05/13 | `tests/simulator/insurers.spec.ts` (24 jornadas) | snapshot do SCCI `tests/test-data/scci-reference.esteira-ht.json` | ver 15.4 |
| referência | `tests/integrations/scci-reference/scci-reference.spec.ts` | leitura de Grupos, Tipos e Seguradoras no SCCI; confere o snapshot (`SCCI_REFERENCE_UPDATE=true` atualiza) | gerado e conferido (2 execuções, 1 min cada) |

### 15.4 Pendências e riscos do lote
- Na última execução completa de `insurers.spec.ts` os 24 casos falharam porque `GET /api/simulacao/opcoes` respondeu **504** (backend do Simulador fora do ar), ambiente e não teste. A execução anterior com diagnóstico passou 24/24 (4,8 min). A execução final com as expectativas definitivas depende do ambiente voltar.
- Valores do imóvel por faixa que decidem SFH×SFI (hipótese: ≤ R$ 1,5 mi → SFH) e os mínimos por tipo do SCCI ainda sem teste.

## 16. Reverificação após a atualização do ambiente (09/11/2026, portal-desenv)

O backend ficou indisponível (504 em `/api/simulacao/opcoes`, 12:33–13:31) durante a atualização do ambiente para a versão 985, segundo Iago Mattos. Ao voltar, o endpoint ainda deu um 504 isolado e depois 200 estável. Execução completa do projeto `simulator-readonly` com `PW_PROFILE=esteira-ht`:

- **83 de 83 aprovados em 7,7 min** (3 workers): 51 do lote 1 (navegação das 24 jornadas, menus, Voltar, validações da tela Dados, composição de renda, data inexistente com `test.fail()` esperado), 8 de regras do admin e 24 de seguradoras por jornada com as expectativas definitivas (substitui a execução com diagnóstico do item 15.4).
- Snapshot do SCCI (`tests/integrations/scci-reference`, modo conferência): **aprovado** em 1 min; o cadastro de grupos, tipos e seguradoras não mudou.
- Conclusão: a versão 985 não alterou os contratos observados nas telas, mensagens, regras do admin nem o cadastro do SCCI usados por esses testes. Não prova que nada mais mudou: criação de proposta, resultado, downloads e envio não foram exercitados nesta rodada.
- Pendente: criação das propostas das outras jornadas (cenários em `tests/test-data/simulator-proposal-scenarios.ts` e registro em `tests/services/simulator-qa-runs.ts`, escritos e com `tsc` limpo, mas ainda sem o teste que os usa e sem execução).

## 17. Propostas criadas no esteira-ht por jornada (09/11/2026, autorizado por Iago Mattos)

Projeto `simulator-journeys` (`PW_PROFILE=esteira-ht ALLOW_TEST_MUTATION=true npx playwright test --project=simulator-journeys --grep <id>`; script `npm run pw:test:simulator:journeys`). Registro próprio em `.playwright/simulator-qa-runs/esteira-ht.json` (não consome slots do provisionamento): uma proposta por cenário; com protocolo, só a verificação roda; tentativa de envio sem protocolo bloqueia nova criação. Teste: `tests/integrations/simulator-journeys/create-and-verify-proposals.spec.ts`.

| Cenário | Protocolo | Tipo de operação escolhido pelo SCCI | Resultado |
|---|---|---|---|
| PF-SFI-ACIMA-TETO-SFH (PF/Residencial/Esteira/TR, imóvel R$ 1,6 mi) | 000000672 | 81 SFIMOBILIARIO - TR (tipo 100) | aprovado |
| PJ-COMERCIAL-PARTICULAR (CNPJ) | 000000673 | 81 SFIMOBILIARIO - PJ (tipo 198) | aprovado |
| CREDITO-GARANTIA-PF (imóvel R$ 1,5 mi, financ. R$ 500 mil = 33%) | 000000674 | 83 Credito com Garantia de Imovel - **60%** (tipo 402) | aprovado (tipo só registrado) |
| PF-IPCA-CARENCIA60 (imóvel R$ 1,2 mi, SAC, carência 60) | 000000675 | 279 SFHABITACAO - IPCA (tipo 567) | aprovado |

Mais a proposta anterior 000000668 (slot RESERVE, SFH 279 - TR, imóvel R$ 1,5 mi). Total de propostas criadas nesta conversa: 5.

Verificado no SCCI em cada uma: número da operação, prazo, fase atual (CADASTRAMENTO DA PROPOSTA), tipo de operação no título, produto, comprador, tipo do imóvel, origem/indexador, valores de compra/avaliação/financiamento, sistema de amortização (código), seguradora (código do cadastro), código do grupo-folha da jornada e andamento do processo (tarefas 010 e 020).

### 17.1 Achados
1. **Regra SFH×SFI por valor confirmada:** imóvel até R$ 1.500.000 → SFH (279); acima → SFI (81).
2. **Crédito Garantia:** LTV 33% foi classificado no tipo de **60%** (402), não no de 30% nem 50%; regra de escolha desconhecida (Produto).
3. **Tabela Price recusada:** HTTP 422 "O valor de financiamento solicitado ultrapassou o percentual máximo permitido para esta operação" em PF/TR, PJ, Crédito Garantia e PF/IPCA, com 33% de financiamento; SAC passa nas mesmas condições. No SCCI as 59 faixas de LTV das 24 jornadas existem só para SAC (sistema 2). A mensagem não diz a causa real. Teste `tests/simulator/amortization.spec.ts` (4 casos, `test.fail()`, falha verificada pelo motivo certo). Confirmação de Produto pendente.
4. **PJ no SCCI:** o rótulo do tipo do imóvel é "Tipo de imóvel" (PF: "Tipo do imóvel"; Crédito: "Imóvel"); sem indexador, o código do grupo-folha fica em "Origem do Imóvel".
5. **Tela de envio da PJ:** CNPJ, Nome da empresa, Email e Telefone (não CPF/Nome/Celular).
6. **Instabilidade:** o menu de modalidades chegou a ficar em "Carregando modalidades..." por 30 s em duas execuções seguidas, antes de qualquer envio (backend com 504 intermitente após a atualização do ambiente).

### 17.2 Pendências
Carência 60 e Price não têm leitura no SCCI assertada (rótulo não localizado/recusado); composição de renda, duplicidade de CPF no esteira-ht, resultado/downloads e envio com falha de rede ainda sem teste.

## 18. Falhas visíveis: `test.fail()` removido (09/11/2026)

Por decisão de Iago Mattos, defeitos conhecidos **não** ficam mais mascarados como verde: o `test.fail()` foi removido dos testes do 31/02 e da Tabela Price, o teste de seguradoras reprova card sem nome acessível, e foi criado `tests/simulator/term-limits.spec.ts` (prazo mínimo e máximo por jornada, lidos do SCCI).

Execução do projeto `simulator-readonly` (98 casos, `PW_PROFILE=esteira-ht`, portal-desenv):
- 1ª execução: 46 aprovados, 52 reprovados. **45 reprovações foram queda intermitente do portal** (`page.goto` com timeout de 30 s) e 1 foi instabilidade de navegação; não contam como defeito.
- Reexecução dos 52 (`--last-failed`) com o portal estável: **38 aprovados, 14 reprovados, 0 por ambiente.**
- Consolidado: **84 aprovados e 14 reprovados** (execuções distintas; não há relatório único).

### 18.1 As 14 reprovações são defeitos do produto/configuração

| Qtde | Teste | Falha observada | Esperado (fonte) |
|---|---|---|---|
| 1 | `data-step.spec.ts` › 31/02/2001 recusada no formulário | o front envia `dataNascimento: 2001-02-31` ao backend (POST `tipo-operacao`), que responde 400 | data inexistente barrada na tela (confirmado por Iago Mattos) |
| 4 | `amortization.spec.ts` › Tabela Price aceita (PF/TR, PJ, Crédito Garantia, PF/IPCA) | 422 "O valor de financiamento solicitado ultrapassou o percentual máximo permitido para esta operação" com 33% de financiamento | Price oferecida na tela deve calcular, como o SAC; no SCCI as faixas de LTV só existem para SAC |
| 3 | `term-limits.spec.ts` › prazo 35 deve ser recusado (PJ Comercial/Particular 36–180; PJ Residencial/Empreendimento 36–120; PF TR/Esteira 36–420) | prazo 35 é aceito (200, com seguradoras) | prazo mínimo do tipo no SCCI = 36 |
| 6 | `insurers.spec.ts` › card sem nome acessível (PF Residencial/Esteira IPCA, Esteira Poupança [2 cards], Particular TR, Particular Poupança; PF Comercial/Particular IPCA; PJ Comercial/Particular) | card extra sem nome, causado por seguradora repetida no cadastro do tipo | todo card com nome acessível |

Passaram (e protegem): prazo máximo do tipo aceito e máximo+1 recusado; prazo mínimo do tipo aceito; as 8 regras do admin; 24 jornadas de navegação; validações da tela Dados; seguradoras da jornada coincidem com o cadastro do SCCI.

## 19. Lacunas cobertas: limites de valor/idade/LTV, proponente e fase lida do SCCI (09/11/2026)

### 19.1 O que o snapshot do SCCI passou a conter
`tests/test-data/scci-reference.esteira-ht.json` (gerado por `tests/integrations/scci-reference`, somente leitura): por jornada, os tipos de operação (valor mínimo/máximo da operação, valor máximo do imóvel, prazo, idade máxima e fração em meses, idade+prazo e fração, seguradoras com apólice) e as **faixas de LTV** (Faixa LTV por tipo de operação: LTV máximo, comprometimento de renda e sistema de amortização); e, global, `process`: **fase inicial** (`NU_FASE_SIMULACAO` → nome em Fases da operação) e **tarefa inicial** (`CO_TAREFA_ENVIO_PROPOSTA`), lidas de Originação > Configurações. O modo de conferência reprova se qualquer cadastro mudar.

### 19.2 Testes novos (`PW_PROFILE=esteira-ht`, portal-desenv, consulta de cálculo sem proposta)
| Arquivo | Casos | Limite lido do SCCI | Resultado |
|---|---:|---|---|
| `tests/simulator/operation-limits.spec.ts` | 15 | valor mínimo da operação (20.000) em PF e PJ; valor máximo do imóvel (15.000.000) em PF e PJ; idade máxima 80 anos e 3 meses; idade+prazo (70 anos: 123 meses aceito, 124 recusado); LTV máximo (90% PF, 70% PJ) | **15 aprovados** (o backend respeita o cadastro) |
| `tests/simulator/scci-config.spec.ts` | 1 | cada sistema oferecido pelo Simulador (SAC=2, Price=1, lidos do HTML público) precisa ter faixa de LTV no SCCI em todas as 24 jornadas | **reprovado**: 24 combinações sem faixa (Price) |

Mensagens do backend observadas: "O valor de financiamento é inferior ao valor mínimo permitido para esta operação ( 20.000,00)", "Valor do imóvel superior ao máximo permitido.", "Impossível dar sequencia,o valor solicitado pelo proponente ultrapassa o permitido pela idade (acima de 80 anos e 3 meses)", "...ultrapassou o percentual máximo permitido para esta operação...".

### 19.3 Dados do proponente no SCCI (`tests/integrations/simulator-journeys`)
Verificado no cadastro do pretendente das 4 propostas criadas (000000672 a 675): nome/razão social, CPF/CNPJ, e-mail e, na PF, data de nascimento, DDD e celular.
- PF (3 propostas): **aprovado**.
- PJ (000000673): CNPJ, razão social e e-mail conferem (o e-mail aparece no cabeçalho em minúsculas). **Reprovado: o telefone informado no Simulador não aparece em nenhuma aba do cadastro da PJ** (Identificação Pessoa Jurídica, Sócios/Representantes, Outras Informações; busca nos campos e nas grades visíveis). A PJ não tem a aba "Dados de Contato"; o telefone pode estar em outra tela ainda não localizada. Falha mantida visível.

### 19.4 Fase e tarefa lidas do SCCI
`SIMULATOR_INITIAL_PROCESS_STATE` (usado pelos testes de proposta) deriva a fase e o código da tarefa inicial do snapshot (100 CADASTRAMENTO DA PROPOSTA; tarefa 010). Título/status da 010 e a tarefa 020 continuam constantes observadas na operação 000000668. Teste antigo da jornada principal reexecutado em modo só verificação: aprovado.

### 19.5 Ainda sem teste
Faixas de renda (todas zeradas no cadastro; sem regra a assertar); renda mínima calculada (comprometimento de 40%); valor máximo da operação distinto do máximo do imóvel; idade de PJ (sem regra no SCCI); carência 60 e despesas no SCCI; composição de renda; duplicidade de CPF; resultado e downloads.

## 20. Onde a carência é gravada? (investigação de 09/11/2026)

Pergunta de Iago Mattos. Resposta: **em lugar nenhum que se consiga ver no SCCI.** (CORREÇÃO em 21: o Simulador envia a carência na requisição do Resultado, `prazoCarencia`; a conclusão "não é enviada" desta seção estava errada.)

Evidências (portal-desenv e SCCI esteira-ht, somente leitura):
1. **Requisição de cálculo (`evolucao`, tela de seguradoras):** o corpo de `POST /api/simulacao/evolucao` é idêntico com carência 30 e com 60 e não tem nenhum campo de carência (só `tipoPessoa`, `grupo`, `sistemaAmortizacao`, `valorImovel`, `valorFinanciamento`, `prazoMeses`, `dataNascimento`, `rendaTitular`, `listaSeguroForaFaixaContratacao`).
2. **Resultado do Simulador:** com carência 30 e 60 a tabela de parcelas é idêntica (120 linhas, amortização desde a parcela 1).
3. **SCCI:** comparadas as operações 000000672 (carência 30) e 000000675 (carência 60) em "Simulação" e em todas as abas de "Dados da Operação" (Capacidade de Pagamento, Resumo, Alterações de parâmetros da simulação, Tarifas e outros custos, Resumo Completo, Terceiros): nenhum rótulo "carência" e nenhum campo difere por causa dela. A "Evolução da Simulação" de ambas também não mostra carência (parcela 1 já amortiza).
4. **Admin:** a carência é opcional e as opções são `[0,30,60,90]`; a tabela "Carências" do tipo 100 no SCCI está vazia.

Teste: `tests/simulator/grace-period.spec.ts` (reprova: a requisição e as parcelas não mudam entre carência 30 e 60). A lista de consultas permitidas da trava de leitura ganhou `/api/simulacao/planilha` (tabela de parcelas do Resultado).

Não verificado: o corpo do `POST` do envio da proposta (cria proposta); só se confirma pela captura em uma criação autorizada. Hipóteses em aberto: a carência é um campo decorativo no front, ou é enviada só no envio e guardada em local fora das telas lidas (o desenho de mapeamento cita o snapshot opcional `SIMULACAO_ORIGINACAO`).

### 20.1 Confirmação de domínio (09/11/2026)
Iago Mattos conversou com **Castilho (Mestre da Originação)**, que confirmou que **o campo de carência do Portal está errado**: no SCCI a carência funciona como um SE (condição sim/não) e o Portal a trata de forma estática. **Defeito do Portal confirmado.** Consequências:
- `tests/simulator/grace-period.spec.ts` deixa de ser "achado" e passa a ser defeito confirmado (continua reprovado).
- As opções `[0,30,60,90]` do admin (`regras.valoresCampoCarencia`) e o select de dias na tela Dados refletem o contrato errado; `admin-rules.spec.ts` só prova que a tela segue o admin, não que o contrato esteja certo.
- Pendente: confirmar com o Castilho o comportamento esperado (campo sim/não? o que o SCCI grava quando "sim"? em que tela/campo aparece) para reescrever a expectativa do teste e acrescentar a conferência no SCCI.

### 20.2 Correção do contrato da carência (09/11/2026, Iago Mattos após Castilho)
O entendimento anterior (seção 20.1) foi corrigido: **escolher o valor na tela e a lista no admin estão certos; o erro é o campo aparecer SEMPRE.** Ele deve aparecer em momento específico, controlado por cadastro do SCCI na parte de Originação (tipo de operação ou outra tabela; local exato a confirmar com o Castilho).

Leitura no SCCI (somente leitura): **Tipo de operação > Consultar > Carências** é uma tabela por tipo (colunas: Tipo juros na carência, Meses de carência 1ª prestação, Carência 1ª prestação, Cobra seguro 1ª prestação, Nº máx. meses p/ carência). **Nenhum dos 93 tipos lidos tem linha** (45 das 24 jornadas e 48 de amostra, 13 deles de construção); não houve controle positivo (nenhum tipo com carência para validar a leitura), mas o mesmo método lê as seguradoras. O snapshot passou a guardar `graceRules` por tipo (todos vazios).

Teste: `tests/simulator/grace-visibility.spec.ts` (substitui `grace-period.spec.ts`, cuja premissa "a carência muda o cálculo" só vale onde o campo for legítimo): **reprovado em 24 de 24 jornadas**, pois o campo "Carencia" aparece em todas e nenhum tipo tem carência cadastrada. Fonte adotada (hipótese a confirmar): Tipo de operação > Carências. Pendências: confirmar o local do cadastro; avaliar se o valor escolhido é enviado e altera o cálculo quando houver tipo com carência (hoje a requisição de cálculo não leva carência e o resultado não muda com 30 × 60).


## 21. Valores com e sem carência; correção da seção 20 (09/11/2026)

**Correção:** a carência **é enviada**. A requisição da tela de Resultado, `POST /api/simulacao/planilha`, leva `prazoCarencia` (30, 60 ou 90; o campo some com "Selecione"), além de `codigoSeguradora`, `codigoApolice`, `codigoSistemaAmortizacao`, `rendaFamiliar` e `nuSimulacao`. Eu havia concluído que ela não era enviada olhando só a requisição `evolucao` (tela anterior).

**Verificação pedida pelo Castilho (os valores saem iguais com e sem carência?): sim, saem iguais.**
- Simulador (consulta, PF/Residencial/Imóvel Particular/IPCA, SAC, imóvel R$ 1,2 mi, financiamento R$ 400 mil, 120 meses): sem carência, 30, 60 e 90 geram as mesmas seguradoras, as mesmas 121 linhas (cabeçalho + 120 parcelas), a mesma primeira parcela (R$ 5.833,33; amortização R$ 3.333,33; juros R$ 2.500,00) e a mesma última (R$ 3.354,57).
- SCCI: criada a proposta **000000676** (sem carência, mesmas condições da 000000675, que tem carência 60; ambas no tipo "279 SFHABITACAO - IPCA"). A "Evolução da Simulação" das duas tem as **mesmas 120 parcelas, valor a valor**. Teste: `tests/integrations/simulator-journeys/grace-values-in-scci.spec.ts` (3 testes em série, aprovados).

**Efeito colateral a registrar:** `/api/simulacao/planilha` leva `nuSimulacao` e o desenho de mapeamento cita `GravaSimulacaoOriginacao` (insert/update em `SIMULACAO_ORIGINACAO`), então ela pode **gravar o registro da simulação** no SCCI. Eu havia liberado esse endpoint na trava de leitura do Simulador (por engano, supondo que fosse só cálculo). Efeito: algumas simulações de teste podem ter sido gravadas no esteira-ht/portal-desenv em consultas feitas até o Resultado (sondagens de carência e do Price pelo navegador e o teste de carência 30 × 60 antigo). Nenhuma proposta foi criada por isso. A liberação foi **revertida**: nenhum teste de leitura alcança o Resultado agora; só os testes de criação de propostas (que criam proposta de qualquer forma).


## 22. Respostas às perguntas de Produto e novos achados (09/11/2026)

### 22.1 Respostas
| Pergunta (Iago Mattos) | Resposta com evidência |
|---|---|
| **Price: dá para configurar?** | As 17 faixas de LTV com Price existem só em tipos antigos (COT, ISO, COJ, RET, IST, 497 a 499, CCF, CST...), com LTV de 70 a 90% e comprometimento de 20 a 35%; nenhum dos 45 tipos do Simulador tem. Na tela de Faixa LTV o usuário de teste tem **Alterar habilitado e Incluir/Excluir desabilitados** (não conclusivo). Cadastrar a faixa muda cadastro compartilhado e define um LTV de negócio: **não foi feito**; depende de autorização e dos valores. |
| **Prazo mínimo: salva no SCCI com 35?** | **Sim.** Proposta **000000677** (PF/TR/Esteira, prazo digitado 35, tipo 060 com mínimo 36): o envio foi aceito e o SCCI gravou prazo 35. Teste `PF-PRAZO-35` reprova ("Prazo gravado no SCCI (35) abaixo do mínimo do tipo 060 (36 meses)"). |
| **Card duplicado: erro na base ou no Simulador?** | **Nos dois.** A base repete a mesma seguradora no tipo (origem). O Simulador não trata a repetição: os cards seguem o padrão `seg-<código>-label`, e o card repetido fica com `aria-labelledby` vazio (sem nome acessível). |
| **Telefone: envia e não grava em lugar nenhum?** | O Simulador **envia**: `POST /api/proposta` leva `celularTelefone` (11 dígitos) também na PJ (capturado em envio da PJ). No SCCI o telefone da PJ **não aparece** em nenhuma das 3 abas do pretendente (a PF mostra DDD e celular em "Dados de Contato"). Não foi possível afirmar que não grava: não foi achado em lugar nenhum visível. |
| **Tipo no Crédito Garantia** | Validado sem criar proposta: o tipo escolhido vem em `resumo.codigoTipoOperacao` da resposta de `/api/simulacao/evolucao`. Imóvel R$ 1 mi: LTV até 30% → tipo 400; **31% a 60% → tipo 402 (60%)**; o tipo 401 (50%) nunca é escolhido; 61% → 422 com mensagem "percentual máximo (**50.00%**)", embora 51% a 60% sejam aceitos. O prazo não influencia (24, 60, 120, 240 iguais). Testes `operation-type-selection.spec.ts`: 4 reprovados (31%, 40%, 50% e a mensagem). A regra correta depende de Produto. |
| **"Modalidade suspensa" não deve aparecer?** | Teste `suspended-modalities.spec.ts`: **13 de 13** jornadas com grupo suspenso no SCCI (005 e 023 "Imóvel Residencial"; 115 "Holding Familiar") continuam percorríveis no Simulador, com controle positivo aprovado. Expectativa assumida a partir da resposta do Iago; confirmação de Produto pendente. |

### 22.2 Achados novos
1. **Nome com mais de 40 caracteres:** `POST /api/proposta` → 422 `ORA-12899: valor muito grande para a coluna "CAIXA2"."PESSOA_PRETENDENTE"."NO_PESSOA" (real: 66, máximo: 40)`. O campo "Nome"/"Nome da empresa" não limita o tamanho, o front envia mesmo assim e **a tela exibe o erro cru do Oracle** (esquema, tabela e coluna). Teste `applicant-name-length.spec.ts` (mutável, não cria proposta quando o banco recusa): 3 verificações reprovadas. Correção ao que eu havia afirmado: a tela mostra o erro; o que travava era o meu Page Object, que só reconhecia protocolo ou aviso de CPF (agora reconhece alerta de erro).
2. **`POST /api/simulacao/tipo-operacao`** responde HTTP 200 `{"success":false,"message":"Rotina PostIdentificaTipoOperacao nao encontrada"}` mesmo com dados válidos; a tela ignora e segue (o tipo vem depois na resposta de `evolucao`). Observado em portal-desenv após a atualização 985; não comparado com a versão anterior.
3. **A carência não é enviada na proposta:** `POST /api/proposta` não tem `prazoCarencia` (só `POST /api/simulacao/planilha`, tela de Resultado, leva). Campos do envio: cpfCnpj, nome, email, celularTelefone, valorImovel, valorFinanciamento, dataNascimento, rendaFamiliar, prazoMeses, grupo, codigoTipoOperacao, codigoSeguradora, codigoApolice, codigoPlano, codigoSistemaAmortizacao, seguroForaFaixa, modalidadeFinancPj, nuSimulacao, nuSessao.
4. **Propostas criadas nesta rodada:** 000000676 (PF/IPCA sem carência) e 000000677 (PF/TR prazo 35). A tentativa de PJ com nome de 43 caracteres falhou sem gravar nada (operações 678 a 680 inexistentes, conferido por busca calibrada).

### 22.3 Cadastro da faixa de LTV de Price (tentativa autorizada em 09/11/2026)
Iago Mattos autorizou incluir uma faixa de teste de Price no SCCI (esteira-ht). **Não foi possível**: em Tabelas > Originação > Faixa LTV por tipo de operação o usuário de teste (`supervisor`) tem **Incluir e Excluir desabilitados, inclusive com uma linha selecionada** (a linha do grupo 220 foi selecionada); só Alterar está habilitado. Nada foi alterado, e **não se usou Alterar** em linha existente (editar o sistema de uma faixa SAC quebraria o cálculo atual, e isso não foi autorizado).

Para quem tem permissão cadastrar (referência: faixa LTV nº 659 do grupo 220): grupo 220 "Taxa Referencial (TR)" (vale para os tipos 060 e 100), **Sistema de amortização = Price (1)**, **% LTV 90**, **% comprometimento de renda 40**, valor início/fim da faixa 0/0, faixa ativa. Depois disso os 5 testes de Price (`amortization.spec.ts` e `scci-config.spec.ts`) devem ser reexecutados: o de PF/TR/Esteira deve passar; os demais continuam reprovados até cada jornada ter a sua faixa.

### 22.4 Faixa de LTV de Price cadastrada no SCCI (09/11/2026, autorizada por Iago Mattos)
O **Incluir só habilita depois de clicar em Alterar** (modo de edição; o menu fica travado e aparecem Salvar e Cancelar). Foi incluída **uma faixa de teste** em Manutenção > Tabelas > Originação > Faixa LTV por tipo de operação: **faixa nº 1393** — Grupo 220 "Taxa Referencial (TR)", Tipo de operação **060 "279 SFHABITACAO - TR"**, **Sistema de Amortização = Price (TP - TABELA PRICE, código 1)**, **% LTV 90**, **% comprometimento de renda 40**, valor início/fim 0/0, demais campos como na faixa SAC nº 659; a tabela passou de 405 para 406 faixas.

Efeito (reexecução): o teste de Price de **PF/TR/Esteira passou** (o backend passou a aceitar Price com imóvel de R$ 1,5 mi, tipo 060) e **continuam reprovados** Price em PJ Comercial/Particular, Crédito Garantia PF e PF/IPCA, e o teste de configuração (as demais jornadas e o tipo 100 não têm faixa de Price). Confirma a causa: **falta de faixa de LTV para Price no SCCI**.

Como desfazer: Alterar > selecionar a faixa 1393 > Excluir > Salvar. Snapshot do SCCI atualizado para refletir a nova faixa.


## 23. Revisão independente e correções (11/11/2026)

Pacote: `OpenBot/Shared/qa-simulador/trabalho/2026-11-11-validade-geral-testes/` (parecer.md do Revisor QA do Simulador: AJUSTES, revisão estática, nenhum spec executado por ele).

| Achado | Correção | Arquivo |
|---|---|---|
| A1 cópias soltas, `tsc` com 59 erros | 12 cópias idênticas removidas (erro de empacotamento do QA); `tsc` limpo | `tests/pages/portal/` |
| A2 gate só no npm | `assertMutationOptIn()` no spec, antes de reservar/navegar | `tests/helpers/mutation-gate.ts`, `create-and-verify-proposals.spec.ts`, `applicant-name-length.spec.ts` |
| A3 nome > 40 | reescrito: aceita maxlength 40 ou recusa amigável; registra tentativa; sem `catch`; `@pendente-produto` | `applicant-name-length.spec.ts` |
| A4 PRAZO-35 | `investigation` no cenário; tag `@investigacao`; resultado em anotação | `simulator-proposal-scenarios.ts`, `create-and-verify-proposals.spec.ts` |
| A5 contradições | Carência só em `grace-visibility`; navegação por grupo suspenso `@depende-decisao` | `journeys.spec.ts` |
| A6 leitor sem controle | colunas esperadas, `getTotalCount`, `num()` sem 0 silencioso, falha sem snapshot | `aejs-reference-tables.page.ts`, `scci-reference-builder.ts`, `scci-reference.spec.ts`, `scci-reference.ts` |
| M1/M2 negativos frouxos e 5xx | HTTP 422 + `/prazo/i`; 5xx = erro de ambiente | `portal-simulator.page.ts`, `term-limits.spec.ts`, `operation-type-selection.spec.ts` |
| M3 casos sumidos | `test.skip` com motivo | `term-limits.spec.ts`, `operation-type-selection.spec.ts` |
| M4 card repetido | unicidade de nomes (soft, hipótese de Produto) | `insurers.spec.ts` |
| M5/M10 hipóteses | `@pendente-produto` em Price, scci-config, Crédito Garantia (tipo), suspensas, grace | vários |
| M6 carência igual | valida 120 parcelas numeradas; observação `@pendente-produto` | `grace-values-in-scci.spec.ts` |
| M7 contagem imediata | espera o formulário renderizar | `grace-visibility.spec.ts` |
| M8 telefone PJ | investigação (anotação) | `create-and-verify-proposals.spec.ts` |
| M9 conferências puladas | rótulo ausente reprova | `create-and-verify-proposals.spec.ts` |
| B4 service workers | `serviceWorkers: "block"` no `simulator-readonly` | `playwright.config.ts` |
| B6 corpo anexado | anexa só status, tamanho e se há erro cru | `create-and-verify-proposals.spec.ts` |

Marcas: `@pendente-produto` (esperado sem fonte confirmada), `@depende-decisao` (verde só descreve o comportamento atual), `@investigacao` (registra, não afirma). Conjunto validador da leitura: `npm run pw:test:simulator:validator`.

Não corrigido nesta rodada: conferência manual por tabela (um tipo, com print) para provar o leitor do SCCI; controle positivo de carência (depende de cadastrar uma carência em tipo de teste); B1 (mensagens de data incompleta e fronteira de 18 anos), B2 (admin lido do HTML do app) e B3 (120–420 fixo em `journeys.spec`), baixa prioridade.

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

## 24. Banco do SCCI: leitura do que o Simulador grava (12/11/2026)

Documento de apoio: `Docs/SCCI_BANCO_SIMULADOR.md` (esquema, tabelas, trava, SQL de reprodução).

**Fatos medidos no banco (esteira-ht, `CAIXA2`, somente `SELECT`):**
- O usuário do banco tem a role `DBA` e o Oracle hospeda ~30 esquemas de outros clientes. A proteção contra escrita é `SET TRANSACTION READ ONLY` + trava do helper (listas permitidas de objetos e funções). Pendência da infra: usuário só com `SELECT` no próprio esquema.
- O "Avançar" da tela Dados **grava** a simulação em `SIMULACAO_ORIGINACAO` (a suíte `simulator-readonly` não cria proposta, mas cria uma linha de simulação por "Avançar"). Na avaliação, tipo de operação, seguradora e taxa ainda ficam nulos.
- 22 simulações têm mais de uma `NU_SESSAO` (até 4): a chave é `NU_SIMULACAO` + `NU_SESSAO`.
- `CARENCIA_TIPO_OPERACAO` tem 0 linhas: não há controle positivo de carência neste ambiente.
- `SEGURADORA_TIPO_OPERACAO`: 2.695 linhas, 422 tipos, 324 grupos repetidos (máximo 12).
- Acima de R$ 1.500.000,00 de imóvel o Simulador troca o tipo de operação (060 → 100, 904 → 905...). O teste novo fixa o imóvel em R$ 1.500.000,00.

**Matriz (novo):**

| ID | Teste | Origem da expectativa | Perfil | Resultado (r3) |
|---|---|---|---|---|
| SIM-DB-01 | `tests/simulator/simulation-database.spec.ts` (24 jornadas) | centavos **únicos por execução e jornada** no financiamento e na renda, mais imóvel, prazo e nascimento digitados pelo teste (independente da resposta) | `PW_PROFILE=desenv` + `SCCI_DB_SSH_HOST=cef-mip2` | 24 de 24 gravaram exatamente o digitado |
| SIM-DB-02 | idem | cadastro `SEGURADORA_TIPO_OPERACAO` + `SEGURA` do tipo devolvido pelo BFF; texto do card i = nome do BFF para o card i; nome acessível calculado pelo navegador | idem | 24 de 24: nenhum card fora do cadastro, tela = BFF (quantidade, nome e apólice por índice); **6 reprovam por card sem nome acessível** |
| (apoio) | `tests/unit/*.unit.spec.ts` | contratos puros e DOM estático: trava, parser, espera, classificação, valores únicos, texto e nome acessível por card | sem rede | 123 aprovados |

**Execuções do `simulation-database.spec.ts`** (ambientes em HTTP 200 antes e depois, 0 erro de rede, em todas):
- **r1** (17:04–17:11, versão anterior do spec, valores fixos): 18 aprovados, 6 reprovados. Serviu para achar o padrão; **não** é a versão revisada.
- **r2** (17:28–17:33): **INVÁLIDA**, arquivos renomeados com o motivo. A correção dos valores únicos somou centavos ao imóvel e o colocou acima de R$ 1.500.000,00: o tipo de operação mudou em 9 de 24 jornadas (904→905, 060→100, 220→221...) e 3 jornadas "passaram" por estarem em outro tipo, sem repetição. Erro de automação meu, corrigido (imóvel fixo; teste unitário do gerador).
- **r3** (17:35–17:41, 1 worker, **versão com hash `logs/hashes-codigo-antes-da-r3.txt`, conferida igual depois**): 24 coletados, **18 aprovados, 6 reprovados**, 0 flaky, 0 pulados, 0 retry; tipo de operação igual ao da r1 nas 24. JSON e evidências: `Shared/qa-simulador/trabalho/2026-11-12-banco-simulador/logs/` (`simulation-database-r3.json`, `evidencias-r3/` com captura e `error-context.md` de 3 jornadas).

- **r4** (17:50–17:56, versão FINAL após o parecer da rodada 2, hashes em `logs/hashes-codigo-antes-da-r4.txt` conferidos iguais depois): 24 coletados, **18 aprovados, 6 reprovados**, 0 flaky, 0 pulados, 0 retry; status e tipo de operação **iguais aos da r3 nas 24**; 0 divergência de texto/apólice por índice; 0 card que o BFF já tenha mandado sem nome (os 7 cards sem nome são perda na tela). É a rodada de referência.

**Parecer da rodada 2 do Revisor (AJUSTES; sem terceira rodada), tratado pelo QA:**
- R2-1 (trava): vírgula depois de `JOIN ... ON/USING/CROSS JOIN` e CTE definida adiante mascarando objeto real. Corrigido (vírgulas da lista FROM em qualquer ponto; CTE só vale depois do fim da sua definição); 8 recusas e 4 aceites novos nos unitários. Limite que resta: função do esquema sem parênteses.
- R2-2: o teste separa "BFF mandou sem nome" (origem base/Simulador) de "tela perdeu o nome". r4: 0 do primeiro tipo.
- R2-3: o texto do card é buscado só dentro do `radiogroup` (teste de DOM com card único) e compara também a descrição da apólice (pega troca de ordem entre apólices da mesma seguradora).
- R2-Q: o segundo `radio` de cada card é `<input type="radio" aria-hidden="true" tabindex="-1">` escondido (1 px). Não chega à árvore de acessibilidade (`getByRole` 6, `includeHidden` 12; `ariaSnapshot` padrão 1 por card). **Não é defeito** e as 18 aprovações de nome acessível não são falso-verde. Sem leitor de tela real. Evidência: `rodada2/sonda-r2q-segundo-radio.md`.

**As 6 reprovações (r3 e r4), medidas:**
- Todas têm no cadastro do tipo uma oferta repetida (seguradora + apólice: 4/4300 ×3, 9/9500, 8/8100, 98/98200), com `CO_ENQUADRAMENTO` nulo nas duas linhas, e o **BFF devolve os dois cards** (origem `base-sem-deduplicacao`: o Simulador não deduplica). Tela = BFF em quantidade e em texto.
- Há **7 cards sem nome acessível** nas 6 jornadas; **7 de 7** são o 2º card (ou posterior) de uma seguradora já listada antes. Seis são a oferta repetida; um (tipo 234) é outra apólice de uma seguradora já listada (9/9400 depois de 9/9500). Nas 18 jornadas aprovadas, 0 card sem nome.
- No DOM (sonda de 12/11), o card sem nome tem `aria-labelledby=""` (atributo vazio), e os cards com nome usam ids `seg-<código da seguradora>-label`, um elemento por id. **Medido.** O que **não** foi verificado: o código do front (hipótese da causa: o id é por seguradora, não por oferta).
- O nome aparece na tela (captura): é problema de acessibilidade (leitor de tela) mais o card repetido visível. Decisão de Produto pendente: corrigir o cadastro do SCCI ou deduplicar no Simulador; e rotular cada card com id único.
- No tipo 198 o cadastro tem 6 linhas e a tela 5: o filtro por enquadramento (ou outra regra) atua; "cards = linhas do cadastro" vale em 23 de 24.

**Correção de leitura anterior:** o defeito "6 cards de seguradora sem nome" das seções 22 e 23 é de **nome acessível**, não de nome visual.

**Limites do lote:** `visibleInsurerNames` (usado em `insurers.spec.ts`) lê o `textContent` do alvo de `aria-labelledby`; é equivalente ao nome acessível **neste front** (medido) mas não é um cálculo geral. O novo teste usa o snapshot de acessibilidade do Playwright. O enquadramento usado não é gravado na avaliação (origem da repetição pode ficar `indeterminado-enquadramento`).

**Não coberto:** telefone da PJ, carência gravada e nome acima de 40 (exigem proposta criada, `ALLOW_TEST_MUTATION`); `VA_AMAISJ_1A_PRESTACAO` (sem definição); `simulator-journeys` e `simulator-integration` não executados.
