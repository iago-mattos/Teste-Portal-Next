# Auditoria de Especificidade da Suíte Playwright por Cliente

## Objetivo

Este documento classifica quanto a suíte Playwright atual depende do contrato histórico do C6, quanto pertence ao produto Portal/SCCI da Prognum e quanto pode ser reaproveitado em outras esteiras sem alteração funcional.

A análise responde principalmente a três perguntas:

1. o teste valida uma regra geral, uma regra do produto ou uma decisão específica de cliente?
2. trocar de ambiente exige apenas novas URLs e massas ou exige mudar o resultado esperado?
3. uma falha em outro cliente representa defeito do produto ou apenas diferença legítima de configuração?

O objetivo não é reduzir cobertura nem desconsiderar o contrato do C6. É impedir que regras históricas de um cliente sejam tratadas como regras universais do Portal.

## Escopo e fotografia atual

A classificação considera a suíte coletada em 14/07/2026:

- 129 testes Playwright em 32 arquivos;
- 108 casos funcionais originados da planilha `TestesPortalC6(1).xlsx`;
- 21 testes adicionais de setup, smoke, simulador e integração Portal → SCCI/AEJS;
- projetos `setup`, `aejs-setup`, `smoke`, `functional-readonly`, `functional-mutation`, `integration` e `simulator-integration`;
- configuração atual por perfil de ambiente, massas e contratos de workflow.

Esta é uma análise estática da responsabilidade funcional dos testes, complementada pelas evidências das execuções já realizadas em C6/HT, DESENV e EsteiraHT. Ela não declara que todos os casos estão passando no ambiente atual.

## Modelo de classificação

| Classe | Grau | Definição | Comportamento ao trocar de cliente |
|---|---:|---|---|
| A — Portável | Baixo | Validação técnica ou de formulário que representa comportamento amplamente reutilizável. | Deve executar sem mudança funcional, alterando no máximo massa e autenticação. |
| B — Núcleo Prognum/Crédito | Médio | Regra do Portal imobiliário ou da integração com SCCI, mas não claramente exclusiva do C6. | Reutilizável se o novo cliente contratar o mesmo módulo e jornada. |
| C — Contrato parametrizável | Alto | Texto, domínio, prazo, estado, obrigatoriedade ou jornada que pode variar por cliente. | Só deve executar após o cliente possuir um contrato de expectativas explícito. |
| D — Contrato histórico C6 | Muito alto | Regra derivada diretamente de decisão do C6, URL externa do C6 ou desenho histórico que já divergiu em outra esteira. | Não deve ser executada como regra global. Deve ficar associada ao perfil C6 ou ser substituída por contrato aprovado do novo cliente. |
| E — Ambiente/estado consumível | Muito alto operacional | Fluxo depende de operação, CPF, estado externo, documento, workflow ou SCCI específico. Não significa necessariamente que seja C6. | Exige massa dedicada, configuração e controle de lifecycle; trocar somente a URL não basta. |

### Como interpretar a classificação

Especificidade funcional e acoplamento técnico são dimensões diferentes. Um teste pode ser:

- tecnicamente bem implementado e ainda assim ser exclusivo do C6;
- funcionalmente genérico, mas depender de uma massa específica do ambiente;
- específico do SCCI/Prognum sem ser específico do C6;
- parametrizado por variável de ambiente, mas continuar validando uma regra de negócio particular.

Parametrizar um valor não transforma automaticamente a regra em universal. Por exemplo, os códigos 997/998/996 já são configuráveis, mas a existência e a ordem dessas tarefas ainda são um contrato da esteira escolhida.

## Resumo executivo

### Distribuição dos 108 casos funcionais oficiais

| Classe | Casos | Percentual | Leitura |
|---|---:|---:|---|
| A — Portável | 25 | 23,1% | Pode formar uma base comum com pouca ou nenhuma adaptação. |
| B — Núcleo Prognum/Crédito | 27 | 25,0% | Reutilizável entre clientes que usem a mesma jornada de crédito imobiliário. |
| C — Contrato parametrizável | 26 | 24,1% | Precisa de expectativas aprovadas por cliente. |
| D — Contrato histórico C6 | 30 | 27,8% | Não deve ser aplicado automaticamente a outra esteira. |

Conclusão quantitativa: **51,9% dos 108 casos oficiais possuem alta ou muito alta sensibilidade ao cliente**. Somente 23,1% são razoavelmente portáveis sem revisão funcional. Os outros 25,0% pertencem ao núcleo do produto e só são reutilizáveis quando o cliente utiliza a mesma jornada.

Portanto, a suíte atual não é uma suíte universal do Portal. Ela é uma boa suíte de aceitação do contrato C6, acrescida de integrações e do novo simulador da Esteira Digital.

## Evidências concretas de especificidade

As execuções recentes na EsteiraHT comprovaram diferenças funcionais em pontos classificados como C ou D:

- `TIMELINE-03`: a Esteira não apresentou a linha do tempo histórica de oito fases esperada pelo C6;
- `PART-10`, `RENDA-CONJ-05` e `RENDA-TERC-10`: o domínio de atividade/tipo profissional divergiu do contrato histórico, incluindo `EMPREGADO REGIDO PELA CLT` em vez de `ASSALARIADO`;
- `IMOVEL-04` a `IMOVEL-07`: os usos do imóvel disponíveis na Esteira são diferentes da lista histórica C6;
- `PROP-08`: a massa preparada como reprovada foi apresentada como cancelada, demonstrando dependência de estado e de mapeamento de fases;
- `PROP-10`: a regra de ocultar proposta expirada há mais de 30 dias continuou sendo um comportamento contratual verificável, mas depende de preparação correta da massa;
- `PROP-16`: o destino `https://c6imobiliario.com.br` é, por definição, exclusivo do C6.

Esses resultados não justificam enfraquecer assertions. Eles mostram que o resultado esperado precisa ser escolhido pelo perfil funcional correto.

## Matriz dos 108 casos funcionais

### Login

| Casos | Classe | Motivo |
|---|---|---|
| `LOGIN-01`, `LOGIN-02` | C | Magic link tokenizado e regra de unicidade fazem parte da estratégia de acesso contratada. Outro cliente pode usar login direto, SSO ou outro ciclo de token. |
| `LOGIN-03` | B | Listar as propostas/simulações do cliente é núcleo do Portal, desde que o produto contratado preserve essa página. |
| `LOGIN-04` | A | Rejeição de CPF/CNPJ inválido antes de solicitar login é validação reutilizável no contexto brasileiro. |

### Resumo de propostas

| Casos | Classe | Motivo |
|---|---|---|
| `PROP-01`, `PROP-12`, `PROP-18` | B | Reflexão de dados do lead/SCCI, cancelamento sincronizado e roteamento para a jornada atual pertencem ao núcleo do Portal. |
| `PROP-02`, `PROP-03`, `PROP-07`, `PROP-13`, `PROP-15` | C | Mutabilidade, expiração e cálculo/exibição de prazo dependem de configuração e regras aprovadas para o cliente. |
| `PROP-04`, `PROP-05`, `PROP-06` | D | O próprio contrato cita parametrização C6, divisão cadastral/documental e prazos definidos pelo C6. |
| `PROP-08`, `PROP-09` | D | Fases que disparam bloqueio e a mensagem exata de contato pertencem ao desenho histórico do C6. |
| `PROP-10`, `PROP-11` | D | A janela de 30 dias e a visibilidade de propostas canceladas/expiradas são política histórica do cliente. |
| `PROP-14` | D | Contabilização exclusiva em dias úteis precisa de decisão do cliente e calendário aplicável. |
| `PROP-16` | D | Nome do botão e redirecionamento para `c6imobiliario.com.br` são exclusivos do C6. |
| `PROP-17`, `PROP-19` | D | Modal pós-cadastro e opção de mostrar apenas a data de vencimento são decisões específicas de experiência do cliente. |

### Linha do tempo e detalhamento

| Casos | Classe | Motivo |
|---|---|---|
| `TIMELINE-01`, `TIMELINE-04`, `TIMELINE-05`, `TIMELINE-11` | B | Cabeçalho, acesso pela jornada, sincronização com a plataforma e evolução do cadastro são funções centrais do produto. |
| `TIMELINE-06`, `TIMELINE-08`, `TIMELINE-10` | C | Bloqueio por expiração, aviso obrigatório e prazo por proposta exigem configuração/contrato da esteira. |
| `TIMELINE-09` | A | Persistir o fechamento de um aviso é comportamento de interface amplamente reutilizável. |
| `TIMELINE-02` | D | Remover CNPJ e manter somente CPF restringe a jornada a pessoa física conforme o contrato histórico. |
| `TIMELINE-03` | D | A sequência exata Simulação → Cadastro → Crédito → Negociação → Análise de Documentos → Análise Técnica → Formalização → Liberação já divergiu na EsteiraHT. |
| `TIMELINE-07` | D | Texto e momento do aviso de fim do cadastro são decisões da experiência histórica. |
| `TIMELINE-12` | D | A ausência do botão “Ver documentos” até a liberação cadastral é decisão específica da jornada. |
| `DETALHE-01` | D | Ausência do botão e habilitação apenas após cadastro completo são contrato de navegação histórico, não regra técnica universal. |

### Participantes e composição de renda

| Casos | Classe | Motivo |
|---|---|---|
| `PART-03`, `PART-09` | A | Máscara numérica e filtro digitável são comportamentos reutilizáveis de campo. |
| `PART-02`, `PART-06`, `PART-12`, `PART-13` | B | Obrigatoriedade básica, estado civil, salvamento entre abas e crítica sem perda pertencem ao formulário central do produto. |
| `PART-04`, `PART-05`, `PART-07` | C | Origem WEB/APP/API, renda inicial e nacionalidade padrão dependem do canal e da configuração do cliente. |
| `PART-01`, `PART-08`, `PART-10`, `PART-11` | D | Abas iniciais, exclusões da lista de profissões, domínio de atividade profissional e ausência do botão Voltar já mostraram variação entre esteiras. |
| `RENDA-01`, `RENDA-02`, `RENDA-03` | B | Decisão de compor renda e escolha entre cônjuge/terceiro são parte do produto de crédito imobiliário. |

### Cônjuge

| Casos | Classe | Motivo |
|---|---|---|
| `CONJ-04`, `CONJ-05`, `CONJ-06`, `CONJ-07`, `CONJ-08`, `CONJ-09` | A | DDD, CPF, datas, telefone e trim de nome/e-mail são validações reutilizáveis. |
| `CONJ-01` | B | Habilitação de cônjuge conforme estado civil é regra central do domínio. |
| `CONJ-02`, `CONJ-03`, `CONJ-10` | C | Campos obrigatórios/opcionais e regimes de comunhão aceitos devem ser confirmados por perfil de produto/cliente. |

### Renda do cônjuge e de terceiros

| Casos | Classe | Motivo |
|---|---|---|
| `RENDA-CONJ-02`, `RENDA-CONJ-04` | A | Entrada numérica e filtro de profissão são reutilizáveis. |
| `RENDA-CONJ-01` | B | Campos de renda do cônjuge pertencem ao núcleo da composição de renda. |
| `RENDA-CONJ-06` | C | Texto e obrigatoriedade da autorização SCR devem ser contratados por cliente. |
| `RENDA-CONJ-03`, `RENDA-CONJ-05` | D | Listas/exclusões de profissão e tipo profissional são do contrato histórico e já divergiram na Esteira. |
| `RENDA-TERC-03`, `RENDA-TERC-04`, `RENDA-TERC-05`, `RENDA-TERC-06`, `RENDA-TERC-07`, `RENDA-TERC-09` | A | CPF, data, telefone, trim, renda numérica e busca são validações reutilizáveis. |
| `RENDA-TERC-01` | B | Existência dos dados do terceiro é núcleo da composição de renda. |
| `RENDA-TERC-02`, `RENDA-TERC-11` | C | Obrigatoriedade dos campos e autorização SCR variam conforme política do cliente. |
| `RENDA-TERC-08`, `RENDA-TERC-10` | D | Domínios de profissão/atividade são os mesmos contratos históricos que divergiram na EsteiraHT. |

### Motivo da contratação

| Casos | Classe | Motivo |
|---|---|---|
| `MOTIVO-01` | B | Reflexão de valor, prazo e juros do lead é comportamento central do produto. |
| `MOTIVO-02` | C | A lista de finalidades é domínio Prognum, mas pode ser habilitada/restringida por produto e cliente. |
| `MOTIVO-03` | D | Placeholder exato e mínimo de dez palavras são decisões específicas de conteúdo e validação. |

### Imóvel

| Casos | Classe | Motivo |
|---|---|---|
| `IMOVEL-01`, `IMOVEL-03`, `IMOVEL-08`, `IMOVEL-09`, `IMOVEL-10`, `IMOVEL-12` | B | Dados do lead, tipo, residência, endereço alternativo, concatenação e saldo devedor pertencem ao domínio imobiliário central. |
| `IMOVEL-11` | C | As condições permitidas podem variar por produto, inclusive existência de garantidor/interveniente. |
| `IMOVEL-02`, `IMOVEL-04`, `IMOVEL-05`, `IMOVEL-06`, `IMOVEL-07` | D | Texto informativo, lista de usos e relação uso/tipo são contratos que já divergiram na EsteiraHT. |

### Garantidor PF

| Casos | Classe | Motivo |
|---|---|---|
| `GAR-PF-03`, `GAR-PF-04`, `GAR-PF-05` | A | Telefone celular, complemento opcional e preenchimento por CEP são comportamentos reutilizáveis. |
| `GAR-PF-01` | B | Habilitação por propriedade de terceiro pertence ao domínio do crédito com garantia. |
| `GAR-PF-02`, `GAR-PF-06` | C | Obrigatoriedade exata e texto que identifica o endereço do proprietário precisam de contrato por esteira. |

### Garantidor PJ

| Casos | Classe | Motivo |
|---|---|---|
| `GAR-PJ-03`, `GAR-PJ-04`, `GAR-PJ-06`, `GAR-PJ-08` | A | Opcionalidade de contato, CEP, inclusão de sócio e telefone celular são amplamente reaproveitáveis dentro do módulo. |
| `GAR-PJ-01` | B | Habilitação por imóvel em nome de empresa é regra central do produto. |
| `GAR-PJ-02`, `GAR-PJ-05`, `GAR-PJ-07` | C | Obrigatoriedade, texto do endereço e dados exigidos dos sócios podem variar por política do cliente. |

## Classificação dos 21 testes adicionais

| Teste ou grupo | Classe predominante | Especificidade real |
|---|---|---|
| `auth.setup.ts` | C/E | Depende de Admin, CPF, geração de magic link e storage state. É específico da estratégia de autenticação do Portal atual. |
| `aejs-auth.setup.ts` | B/E | Valida configuração do SCCI/AEJS. Não é C6, mas só se aplica a clientes integrados ao SCCI. |
| Smoke de sessão | B/E | Reutilizável com a mesma autenticação, porém depende de sessão real do ambiente. |
| Smoke de abertura de proposta | B/E | Fluxo simples, mas exige operação e CPF associados corretamente. |
| `confirm-operation.spec.ts` | B/E | Contrato central Portal → SCCI; altamente dependente de ambiente e massa, não de C6. |
| `confirm-applicant.spec.ts` | B/E | Navegação central do SCCI, dependente da operação integrada. |
| Preparações PJ, PF e quitado | C/E | Jornada de dados é reutilizável, mas domínios, obrigatoriedades, instituições e estados da operação variam por cliente. |
| Preparação/avanço de workflow | C/E | Códigos, títulos e status são configuráveis, mas a topologia do workflow continua sendo contrato da esteira. |
| Validações AEJS de PJ, PF e quitado | B/E | São específicas do modelo de dados e telas ExtJS do SCCI; não são automaticamente exclusivas do C6. |
| Interveniente quitante | C/E | Existência, instituição e exposição do saldo dependem do produto e da massa. |
| Envio/visualização de documentos | C/E | Nomes, quantidade, limite e classificação documental variam por produto/cliente. |
| Reflexão de documentos no SCCI | C/E | Específica da integração e da árvore documental contratada. |
| Limite de 10 MB | C/E | É um contrato configurável; não deve ser assumido para outro cliente sem confirmação. |
| Workflow 997/998/996 | C/E | Já parametrizado por ambiente, mas a sequência precisa ser aprovada para cada esteira. |
| `create-and-validate-simulation.spec.ts` | C/E — Esteira Digital | Não é legado C6: é específico do simulador da Esteira Digital, incluindo produto, origem do imóvel, TR, MAPFRE e reflexão esperada no SCCI. |

## Acoplamentos C6 que ainda existem no código atual

### Explícitos

- `PROP-16` valida redirecionamento para `https://c6imobiliario.com.br`;
- `.env.example` ainda usa essa URL como valor padrão de `PORTAL_EXTERNAL_SIMULATION_URL`;
- títulos de `PROP-04` e `PROP-06` dizem expressamente que fase/prazo são parametrizados pelo C6;
- `integration-data.ts` contém `Banco C6 S.A.` como interveniente em cenários PJ/PF;
- a fonte oficial dos 108 casos continua sendo `TestesPortalC6(1).xlsx`.

### Implícitos

- listas exatas de profissão, atividade profissional, uso e condição do imóvel;
- sequência e nomes de fases;
- mensagens pós-crédito e política de visibilidade por 30 dias;
- obrigatoriedade/opcionalidade de vários campos;
- ausência ou presença de botões e abas;
- prazo em dias úteis e conteúdo de alertas;
- quantidade, nome e classificação de documentos.

Esses contratos implícitos são mais relevantes que a presença literal da palavra “C6”, porque são os que podem produzir falsos defeitos ao executar em uma nova esteira.

## O que já está bem parametrizado

A arquitetura atual já reduz bastante o acoplamento operacional:

- URLs do Portal, Admin e SCCI;
- credenciais e modalidade de login do SCCI;
- CPF padrão e mapa operação → CPF;
- operações funcionais e de integração;
- dados visuais esperados da proposta padrão;
- códigos, títulos e status do workflow;
- atividade profissional e usos de imóvel utilizados nas preparações;
- path e acesso direto/plataforma no SCCI;
- quantidade e registro das massas provisionadas pelo simulador.

Isso facilita trocar de ambiente. Ainda não resolve, sozinho, a troca de contrato funcional entre clientes.

## O que não deve ir para `.env`

Não é recomendável transformar todos os textos, listas e regras em dezenas de variáveis soltas. Variáveis de ambiente são adequadas para endpoints, segredos, operações e pequenas diferenças operacionais. Contratos funcionais extensos devem ser versionados e revisáveis.

Exemplos que devem permanecer em contrato tipado, e não em `.env`:

- lista completa de fases;
- campos obrigatórios por módulo;
- domínios de profissão e uso do imóvel;
- política de expiração e visibilidade;
- catálogo documental;
- mensagens funcionais completas;
- capacidades habilitadas por cliente.

## Arquitetura recomendada para múltiplos clientes

Sem implementar nesta auditoria, a direção mais segura é separar três camadas de contrato:

1. **Core Prognum** — comportamentos A e B compartilhados;
2. **Contrato do cliente/produto** — comportamentos C e D, versionados em perfis tipados como `c6` e `esteira-digital`;
3. **Ambiente/massas** — comportamentos E configurados por `.env.<perfil>.local` e registro de provisionamento.

Um perfil funcional deveria declarar capacidades, não apenas valores. Exemplos conceituais:

- possui magic link ou login direto;
- possui linha do tempo e quais fases;
- permite PF, PJ, garantidor e interveniente;
- quais domínios profissionais e imobiliários aceita;
- política de expiração;
- catálogo e limite documental;
- workflow SCCI aplicável;
- URL e rótulo da simulação externa.

### Tags recomendadas para leitura futura

Além das tags operacionais atuais (`@readonly`, `@mutation`, `@integration`), a suíte se beneficiaria de uma dimensão funcional explícita:

- `@core` — regras A/B compartilhadas;
- `@tenant` — depende de contrato do cliente;
- `@c6` — contrato histórico C6;
- `@esteira-digital` — contrato do simulador/esteira atual;
- `@scci` — integração com SCCI;
- `@stateful-mass` — exige estado específico ou consumível.

Essas tags não substituem projetos ou contratos tipados, mas evitam executar um caso C6 em um perfil Esteira por engano.

## Prioridade de desacoplamento

### P0 — Necessário antes de considerar a suíte multi-cliente

1. separar formalmente os casos C6 (classe D) dos casos core;
2. definir um contrato funcional aprovado para a Esteira Digital;
3. impedir que casos incompatíveis sejam coletados/executados no perfil errado;
4. retirar `Banco C6 S.A.` de cenários que pretendam ser reutilizáveis fora do C6, substituindo-o por contrato tipado do perfil;
5. distinguir perfil de ambiente de perfil funcional: `HT`/`DESENV` não informa, sozinho, qual contrato de cliente está ativo.

### P1 — Necessário para manutenção sustentável

1. mover listas, fases, mensagens e capacidades de cliente para contratos tipados versionados;
2. associar cada spec ao contrato que ele valida;
3. manter `.env` focado em configuração operacional e massas;
4. documentar quais cenários do simulador são exclusivos da Esteira Digital;
5. substituir o fallback de leitura de `cypress/config/*` quando a convivência com Cypress deixar de ser necessária.

### P2 — Pode evoluir gradualmente

1. produzir relatórios separados por `core`, cliente e integração;
2. medir cobertura compartilhada por perfil;
3. provisionar massas a partir das capacidades do cliente;
4. adicionar novos clientes sem copiar specs completas, apenas quando o comportamento for realmente compartilhado.

## Parecer final

**A suíte é altamente específica, mas não integralmente específica do C6.**

- 23,1% dos casos oficiais são portáveis;
- 25,0% representam o núcleo do Portal/crédito imobiliário;
- 24,1% precisam de contrato parametrizado por cliente;
- 27,8% representam decisões históricas C6 com alta chance de divergência em outra esteira;
- praticamente todas as integrações possuem alto acoplamento operacional a massa, workflow e SCCI, embora muitas não sejam exclusivas do C6;
- o simulador novo é uma cobertura específica da Esteira Digital e deve ser tratado como tal.

Assim, executar os 129 testes indistintamente contra qualquer novo ambiente não é tecnicamente correto. O caminho seguro é manter uma base core, preservar o contrato C6 como suíte própria e criar um contrato explícito para a Esteira Digital. Dessa forma, uma diferença de fase, lista ou texto será classificada corretamente como configuração de cliente ou defeito real, em vez de gerar falsos negativos.
