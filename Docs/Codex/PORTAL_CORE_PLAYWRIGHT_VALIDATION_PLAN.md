# Plano de Validação e Expansão da Suíte Playwright — Portal Core

## Objetivo

Este documento deve ser usado como briefing para revisar a suíte Playwright atual do Portal e identificar quais testes adicionais são necessários para validar **o produto Portal em si**, independentemente de regras específicas de clientes como C6, Esteira Digital ou outras esteiras futuras.

O Portal é, em essência, uma aplicação de:

- autenticação e acesso a propostas;
- cadastro de dados;
- navegação entre etapas;
- persistência de informações;
- envio e gerenciamento de documentos;
- comunicação com APIs e integrações;
- retomada de jornadas interrompidas.

A suíte atual possui boa cobertura funcional do contrato histórico do C6 e também cobre integrações Portal → SCCI/AEJS. Porém, a auditoria de especificidade mostrou que grande parte dos testes atuais valida regras de cliente, domínios, textos, fases e jornadas específicas.

O objetivo desta revisão é criar uma nova camada de testes:

> **Portal Core / Product Quality**

Essa camada deve responder:

> **Independentemente do cliente configurado, o Portal funciona corretamente, preserva dados, trata falhas e mantém isolamento, confiabilidade e consistência?**

---

# Instrução principal para o Codex

Analise toda a suíte Playwright atual antes de implementar qualquer novo teste.

Compare os testes existentes com os casos propostos neste documento e classifique cada caso como:

- `COVERED` — já existe teste equivalente e suficiente;
- `PARTIAL` — existe cobertura parcial, mas falta uma parte relevante;
- `MISSING` — não existe cobertura equivalente;
- `NOT_APPLICABLE` — o comportamento não existe ou não se aplica ao Portal atual;
- `BLOCKED` — o teste é válido, mas depende de massa, acesso, endpoint ou comportamento ainda não disponível.

Não duplique testes apenas porque o nome ou o ID são diferentes.

Um teste existente deve ser considerado equivalente quando valida de fato o mesmo risco funcional.

Antes de implementar, produzir uma matriz de cobertura com:

| ID proposto | Status | Teste existente relacionado | Lacuna identificada | Recomendação |
|---|---|---|---|---|

Após a análise:

1. priorizar os casos `MISSING` e `PARTIAL`;
2. implementar primeiro P0;
3. reutilizar fixtures, Page Objects, componentes e helpers existentes;
4. não copiar regras C6 para a suíte Core;
5. não enfraquecer assertions existentes;
6. não mover testes de cliente para Core apenas para aumentar cobertura;
7. evitar testes duplicados;
8. preservar a suíte Cypress atual;
9. manter os testes Playwright já existentes funcionando;
10. rodar typecheck, lint, coleta e os testes afetados após cada grupo de alterações.

---

# Arquitetura funcional esperada

A suíte deve evoluir conceitualmente para quatro camadas.

```text
CORE
↓
O Portal funciona?

PRODUCT
↓
O produto ou módulo contratado funciona?

TENANT
↓
A regra específica do cliente funciona?

INTEGRATION
↓
Portal → SCCI → AEJS funciona?
```

Estrutura conceitual sugerida:

```text
tests/
├── core/
│   ├── navigation/
│   ├── forms/
│   ├── documents/
│   ├── session/
│   ├── reliability/
│   ├── isolation/
│   └── journeys/
│
├── product/
│   └── real-estate-credit/
│
├── tenants/
│   ├── c6/
│   └── esteira-digital/
│
└── integrations/
    ├── scci/
    └── aejs/
```

A estrutura física atual não precisa ser alterada imediatamente se isso gerar uma refatoração grande.

Primeiro classificar corretamente a responsabilidade de cada teste.

---

# Princípios da suíte Portal Core

Um teste Core não deve depender de:

- nome do cliente;
- URL externa do cliente;
- nome exato das fases de uma esteira;
- lista exata de profissões;
- lista exata de usos do imóvel;
- mensagem funcional exclusiva de um cliente;
- prazo histórico definido por cliente;
- tarefa SCCI específica;
- instituição financeira específica;
- catálogo documental exclusivo.

Um teste Core pode depender de uma **capacidade declarada pelo produto**.

Exemplos:

- o Portal possui formulários;
- o Portal salva dados;
- o Portal permite retomada;
- o Portal possui upload;
- o Portal possui documentos permitidos;
- o Portal possui limite configurado de arquivo;
- o Portal protege propostas por usuário;
- o Portal consome APIs;
- o Portal possui sessão autenticada.

O teste deve validar o mecanismo, e não um valor histórico de cliente.

---

# Prioridades

## P0

Risco de:

- perda de dados;
- vazamento de dados;
- confirmação falsa de sucesso;
- documento inconsistente;
- ação duplicada;
- falha sem recuperação;
- acesso indevido;
- corrupção de estado.

## P1

Risco relevante para:

- experiência do usuário;
- confiabilidade;
- retomada da jornada;
- tratamento de erro;
- comportamento mobile;
- consistência frontend/API.

## P2

Cobertura complementar:

- limites extremos;
- casos menos frequentes;
- acessibilidade;
- variações adicionais de entrada.

---

# 1. Navegação e persistência

Arquivo ou grupo sugerido:

```text
tests/core/navigation/
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| CORE-NAV-01 | P0 | mutation | Preencher uma aba, avançar e voltar mantém os dados |
| CORE-NAV-02 | P0 | mutation | Atualizar a página mantém dados já salvos |
| CORE-NAV-03 | P0 | mutation | Fechar e reabrir a proposta mantém o progresso |
| CORE-NAV-04 | P1 | readonly/mutation | Navegar diretamente para uma URL interna válida não corrompe o cadastro |
| CORE-NAV-05 | P0 | mutation | Duplo clique em Continuar não gera ação lógica duplicada |
| CORE-NAV-06 | P1 | mutation | Navegação rápida entre abas não corrompe estado |
| CORE-NAV-07 | P1 | mutation | Botão Voltar do navegador não quebra a jornada |
| CORE-NAV-08 | P0 | mutation | Refresh durante carregamento não corrompe a proposta |
| CORE-NAV-09 | P0 | mutation | Duas abas abertas na mesma proposta não causam perda silenciosa |
| CORE-NAV-10 | P0 | mutation | Sessão expirada durante o cadastro preserva os dados previamente salvos |

## Cenário crítico — concorrência entre duas abas

Executar, quando possível:

1. abrir a mesma proposta na aba A;
2. abrir a mesma proposta na aba B;
3. alterar um campo na aba A;
4. alterar outro campo na aba B;
5. salvar na aba B;
6. salvar na aba A;
7. recarregar ambas;
8. validar o estado final.

O teste deve identificar:

- sobrescrita silenciosa;
- perda de dados;
- atualização fora de ordem;
- ausência de aviso de conflito;
- estado inconsistente entre frontend e backend.

Não assumir que a existência de last-write-wins é necessariamente um bug.

O objetivo é validar e documentar o comportamento real do produto e identificar perda silenciosa ou inconsistência.

---

# 2. Salvamento e perda de dados

Arquivo sugerido:

```text
tests/core/navigation/data-persistence.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| CORE-SAVE-01 | P0 | mutation | Salvar cadastro válido |
| CORE-SAVE-02 | P1 | mutation | Salvar cadastro parcialmente preenchido quando permitido |
| CORE-SAVE-03 | P0 | mutation | Alterar dado previamente salvo |
| CORE-SAVE-04 | P0 | mutation | Limpar campo previamente salvo |
| CORE-SAVE-05 | P0 | mutation | Salvar rapidamente duas vezes |
| CORE-SAVE-06 | P0 | mutation | Navegar enquanto salvamento está ocorrendo |
| CORE-SAVE-07 | P0 | mocked-network | Falha HTTP durante salvamento |
| CORE-SAVE-08 | P1 | mocked-network | Timeout durante salvamento |
| CORE-SAVE-09 | P0 | mocked-network | Resposta HTTP 500 ao salvar |
| CORE-SAVE-10 | P0 | mocked-network | Resposta HTTP 401 ao salvar |
| CORE-SAVE-11 | P1 | mocked-network | Resposta HTTP 403 ao salvar |
| CORE-SAVE-12 | P1 | mocked-network | Resposta HTTP 409/conflito ao salvar |
| CORE-SAVE-13 | P1 | mocked-network | Resposta lenta não gera edição inconsistente |
| CORE-SAVE-14 | P0 | mocked-network | Usuário recebe feedback compreensível após falha |
| CORE-SAVE-15 | P0 | mocked-network | Portal não exibe sucesso quando a API falha |
| CORE-SAVE-16 | P0 | mocked-network | Dados digitados permanecem disponíveis após falha de salvamento |
| CORE-SAVE-17 | P0 | mocked-network | Retry após falha realiza nova tentativa válida |

## Critério essencial

Um teste deve garantir que:

> **O Portal nunca informe que os dados foram salvos quando a chamada responsável pelo salvamento falhou.**

Validar:

- toast;
- modal;
- mensagem;
- indicador de salvamento;
- mudança de etapa;
- estado visual.

A UI não pode apresentar uma confirmação falsa de persistência.

---

# 3. Upload e gerenciamento de documentos

Arquivos sugeridos:

```text
tests/core/documents/upload.spec.ts
tests/core/documents/file-validation.spec.ts
tests/core/documents/document-persistence.spec.ts
```

## Upload básico

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| DOC-CORE-01 | P0 | mutation | Upload de arquivo válido |
| DOC-CORE-02 | P1 | mutation | Upload de PDF permitido |
| DOC-CORE-03 | P1 | mutation | Upload de JPG permitido |
| DOC-CORE-04 | P1 | mutation | Upload de PNG permitido |
| DOC-CORE-05 | P0 | mutation | Rejeitar extensão não permitida |
| DOC-CORE-06 | P0 | mutation | Rejeitar arquivo vazio de 0 bytes |
| DOC-CORE-07 | P0 | mutation | Rejeitar arquivo acima do limite configurado |
| DOC-CORE-08 | P1 | mutation | Aceitar arquivo exatamente no limite configurado |
| DOC-CORE-09 | P2 | mutation | Aceitar arquivo 1 byte abaixo do limite |
| DOC-CORE-10 | P1 | mutation | Rejeitar arquivo 1 byte acima do limite |

O limite não deve ser fixado como `10 MB` na suíte Core.

Usar o limite configurado ou o contrato funcional do perfil.

## Nome de arquivos

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| DOC-CORE-11 | P2 | mutation | Nome de arquivo muito grande |
| DOC-CORE-12 | P2 | mutation | Nome contendo espaços |
| DOC-CORE-13 | P2 | mutation | Nome contendo acentos |
| DOC-CORE-14 | P2 | mutation | Nome contendo ç |
| DOC-CORE-15 | P2 | mutation | Nome contendo parênteses |
| DOC-CORE-16 | P2 | mutation | Nome contendo múltiplos pontos |
| DOC-CORE-17 | P2 | mutation | Nome contendo caracteres especiais suportados |

## Duplicidade e múltiplos arquivos

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| DOC-CORE-18 | P1 | mutation | Dois arquivos diferentes com o mesmo nome |
| DOC-CORE-19 | P1 | mutation | Mesmo arquivo enviado duas vezes |
| DOC-CORE-20 | P1 | mutation | Upload simultâneo de múltiplos arquivos |
| DOC-CORE-21 | P2 | mutation | Cancelar seleção do arquivo |
| DOC-CORE-22 | P0 | mutation | Remover documento enviado |
| DOC-CORE-23 | P0 | mutation | Substituir documento enviado |
| DOC-CORE-24 | P0 | mutation/readonly | Visualizar documento enviado |
| DOC-CORE-25 | P1 | readonly | Baixar documento quando a função existir |
| DOC-CORE-26 | P0 | mutation | Documento permanece disponível após refresh |
| DOC-CORE-27 | P0 | mutation | Documento permanece disponível após novo login |

---

# 4. Validação real do arquivo

Arquivo sugerido:

```text
tests/core/documents/file-validation.spec.ts
```

Validar se o Portal ou a API verificam somente extensão/nome ou também o tipo real do arquivo.

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| DOC-CORE-28 | P1 | mutation | Arquivo `.pdf` com conteúdo não PDF |
| DOC-CORE-29 | P1 | mutation | MIME declarado como PDF com conteúdo inválido |
| DOC-CORE-30 | P1 | mutation | JPG renomeado para PDF |
| DOC-CORE-31 | P1 | mutation | PDF renomeado para JPG |
| DOC-CORE-32 | P1 | mutation | Arquivo corrompido |
| DOC-CORE-33 | P2 | mutation | Arquivo sem extensão |
| DOC-CORE-34 | P2 | mutation | Extensão em caixa alta |
| DOC-CORE-35 | P2 | mutation | Extensão contendo múltiplos sufixos |

Exemplo:

```text
documento.pdf.exe
```

Não afirmar previamente qual camada deve rejeitar.

A análise deve descobrir o comportamento atual:

- frontend;
- API;
- storage;
- serviço documental.

Se o frontend aceitar e a API rejeitar corretamente, o teste pode validar tratamento adequado do erro.

---

# 5. Falhas durante upload

Arquivo sugerido:

```text
tests/core/documents/upload-errors.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| DOC-NET-01 | P0 | mocked-network | Falha de rede antes do upload |
| DOC-NET-02 | P0 | mocked-network | Falha de rede durante o upload |
| DOC-NET-03 | P0 | mocked-network | API retorna 500 |
| DOC-NET-04 | P0 | mocked-network | API retorna 413 |
| DOC-NET-05 | P0 | mocked-network | API retorna 415 |
| DOC-NET-06 | P0 | mocked-network | API retorna 401 |
| DOC-NET-07 | P1 | mocked-network | API retorna 403 |
| DOC-NET-08 | P1 | mocked-network | API de upload responde lentamente |
| DOC-NET-09 | P0 | mocked-network | Request de upload é abortada |
| DOC-NET-10 | P0 | mocked-network | Retry após falha |
| DOC-NET-11 | P0 | mutation | Duplo clique em enviar não duplica documento |
| DOC-NET-12 | P0 | mutation | Refresh durante upload não gera documento fantasma |

Validar sempre:

- loading;
- desbloqueio após erro;
- possibilidade de retry;
- ausência de confirmação falsa;
- ausência de duplicidade;
- ausência de loading infinito;
- preservação do arquivo selecionado, quando aplicável;
- mensagem de erro compreensível.

---

# 6. Validação genérica de campos

Arquivos sugeridos:

```text
tests/core/forms/text-fields.spec.ts
tests/core/forms/numeric-fields.spec.ts
tests/core/forms/dates.spec.ts
```

Não duplicar os testes já existentes para CPF, telefone, DDD, trim e campos numéricos.

Criar primeiro uma matriz de cobertura dos testes atuais.

## Campos de texto

Validar nos componentes relevantes:

| ID | Prioridade | Caso |
|---|---|---|
| CORE-TEXT-01 | P1 | Valor vazio |
| CORE-TEXT-02 | P1 | Apenas espaços |
| CORE-TEXT-03 | P1 | Espaço no início |
| CORE-TEXT-04 | P1 | Espaço no final |
| CORE-TEXT-05 | P2 | Múltiplos espaços internos |
| CORE-TEXT-06 | P2 | Um caractere |
| CORE-TEXT-07 | P1 | Tamanho máximo |
| CORE-TEXT-08 | P1 | Tamanho máximo + 1 |
| CORE-TEXT-09 | P2 | Acentos |
| CORE-TEXT-10 | P2 | Emoji |
| CORE-TEXT-11 | P2 | Caracteres especiais |
| CORE-TEXT-12 | P2 | Quebra de linha |
| CORE-TEXT-13 | P1 | Copiar e colar |

Não executar todos os casos em todos os inputs.

Identificar componentes ou comportamentos reutilizados.

Testar representativamente o mecanismo.

## Campos numéricos

| ID | Prioridade | Caso |
|---|---|---|
| CORE-NUM-01 | P1 | Letras |
| CORE-NUM-02 | P1 | Caracteres especiais |
| CORE-NUM-03 | P1 | Valor negativo |
| CORE-NUM-04 | P1 | Zero |
| CORE-NUM-05 | P1 | Decimal |
| CORE-NUM-06 | P2 | Valor muito grande |
| CORE-NUM-07 | P2 | Zeros à esquerda |
| CORE-NUM-08 | P1 | Copiar e colar valor inválido |

## Datas

| ID | Prioridade | Caso |
|---|---|---|
| CORE-DATE-01 | P1 | 29/02 em ano bissexto |
| CORE-DATE-02 | P1 | 29/02 em ano não bissexto |
| CORE-DATE-03 | P1 | 31/04 |
| CORE-DATE-04 | P1 | 31/06 |
| CORE-DATE-05 | P1 | 00/00/0000 |
| CORE-DATE-06 | P1 | 32/01/2026 |
| CORE-DATE-07 | P1 | Data futura quando não permitida |
| CORE-DATE-08 | P2 | Data extremamente antiga |
| CORE-DATE-09 | P1 | Digitação parcial |
| CORE-DATE-10 | P1 | Colar data |
| CORE-DATE-11 | P1 | Apagar uma data previamente salva |

---

# 7. CEP e preenchimento de endereço

Arquivo sugerido:

```text
tests/core/forms/cep.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| CORE-CEP-01 | P1 | mutation | CEP válido |
| CORE-CEP-02 | P1 | mutation | CEP inexistente |
| CORE-CEP-03 | P1 | mutation | CEP incompleto |
| CORE-CEP-04 | P1 | mutation | CEP com letras |
| CORE-CEP-05 | P0 | mocked-network | Serviço de CEP indisponível |
| CORE-CEP-06 | P1 | mocked-network | Serviço de CEP lento |
| CORE-CEP-07 | P1 | mutation | Alterar CEP após preenchimento automático |
| CORE-CEP-08 | P0 | mutation | Novo CEP não mantém endereço incompatível do CEP anterior |
| CORE-CEP-09 | P1 | mutation | Validar comportamento do número após nova consulta |
| CORE-CEP-10 | P2 | mutation | Endereço sem complemento |
| CORE-CEP-11 | P1 | mocked-network | Serviço retorna endereço incompleto |
| CORE-CEP-12 | P0 | mocked-network | Usuário altera CEP enquanto consulta anterior está pendente |

## Cenário crítico — race condition de CEP

Simular:

1. preencher CEP A;
2. atrasar a resposta da consulta A;
3. substituir por CEP B;
4. responder rapidamente a consulta B;
5. entregar depois a resposta atrasada de A.

Validar que:

> **A resposta antiga do CEP A não sobrescreve os dados correspondentes ao CEP B.**

Caso o produto não use consulta de CEP assíncrona, classificar como `NOT_APPLICABLE`.

---

# 8. Sessão, autenticação e autorização

Arquivo sugerido:

```text
tests/core/session/session.spec.ts
tests/core/session/authorization.spec.ts
```

Não acoplar estes testes à estratégia de magic link do C6.

Validar o comportamento da sessão do Portal.

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| SESSION-01 | P0 | readonly | Usuário sem sessão acessa URL protegida |
| SESSION-02 | P0 | readonly | Sessão válida acessa proposta autorizada |
| SESSION-03 | P0 | mocked-network/session | Sessão expira durante cadastro |
| SESSION-04 | P0 | mocked-network/session | Sessão expira durante upload |
| SESSION-05 | P0 | mocked-network/session | Sessão expira durante salvamento |
| SESSION-06 | P1 | readonly | Refresh com sessão válida |
| SESSION-07 | P0 | mutation | Logout invalida acesso |
| SESSION-08 | P0 | readonly | Botão Voltar após logout não reabre conteúdo protegido |
| SESSION-09 | P0 | security | Usuário tenta acessar URL de proposta não autorizada |
| SESSION-10 | P0 | security | Alteração manual do identificador da proposta |
| SESSION-11 | P1 | readonly | Usuário com múltiplas propostas acessa a proposta correta |
| SESSION-12 | P0 | security | Usuário A tenta acessar proposta pertencente ao usuário B |

## Observação de segurança

`SESSION-09`, `SESSION-10` e `SESSION-12` devem validar autorização server-side.

Não basta validar que o botão não existe na interface.

Alterar diretamente a URL ou a request quando necessário.

Se uma proposta de outro usuário puder ser consultada apenas trocando o identificador, classificar a falha como risco de autorização/IDOR.

Não executar testes destrutivos fora de massas dedicadas.

---

# 9. Concorrência e ações duplicadas

Arquivo sugerido:

```text
tests/core/reliability/concurrency.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| CORE-CONC-01 | P0 | mutation | Duplo clique em Salvar |
| CORE-CONC-02 | P0 | mutation | Duplo clique em Continuar |
| CORE-CONC-03 | P0 | mutation | Duplo clique em Finalizar cadastro |
| CORE-CONC-04 | P0 | mutation | Duplo clique em Enviar documento |
| CORE-CONC-05 | P1 | mutation | Pressionar Enter repetidamente |
| CORE-CONC-06 | P0 | mutation | Salvar mesma proposta em duas abas |
| CORE-CONC-07 | P1 | mutation | Múltiplos uploads simultâneos |
| CORE-CONC-08 | P0 | mocked-network | Respostas HTTP fora de ordem |
| CORE-CONC-09 | P0 | mutation/network | Ação lógica não é duplicada por requests repetidas |

O objetivo não é exigir tecnicamente uma única request em todos os casos.

O objetivo é validar:

> **Uma ação do usuário deve produzir uma única consequência lógica.**

Exemplos de consequência duplicada:

- dois documentos iguais;
- duas finalizações;
- dois registros;
- duas mudanças de etapa;
- dois participantes;
- duas confirmações.

---

# 10. Erros de frontend

Arquivo sugerido:

```text
tests/core/reliability/page-errors.spec.ts
```

Revisar o helper atual `capturePageErrors`.

Transformar, se apropriado, erros críticos em contrato Core.

Capturar:

- `pageerror`;
- exceção não tratada;
- `Unhandled Promise Rejection`;
- hydration error;
- `ChunkLoadError`;
- erro React crítico;
- acesso a propriedade de `undefined/null`;
- função inexistente.

Não falhar automaticamente para todo `console.error`.

Primeiro classificar erros de terceiros e ruídos conhecidos.

Exemplo conceitual:

```ts
const criticalPatterns = [
  /uncaught/i,
  /unhandled/i,
  /hydration/i,
  /chunkloaderror/i,
  /cannot read properties/i,
  /is not a function/i,
];
```

Criar allowlist apenas para erros conhecidos, documentados e justificados.

Não criar uma regex genérica que esconda qualquer erro.

---

# 11. Loading, empty state e estados intermediários

Arquivo sugerido:

```text
tests/core/reliability/ui-states.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| CORE-STATE-01 | P1 | mocked-network | Loading aparece durante request lenta |
| CORE-STATE-02 | P1 | mocked-network | Loading desaparece após sucesso |
| CORE-STATE-03 | P0 | mocked-network | Loading desaparece após erro |
| CORE-STATE-04 | P0 | mutation | Botão fica protegido durante ação em andamento |
| CORE-STATE-05 | P0 | mutation | Estado intermediário impede ação lógica duplicada |
| CORE-STATE-06 | P0 | mocked-network | Skeleton/loading não permanece infinito após falha |
| CORE-STATE-07 | P1 | readonly | Empty state é exibido quando não existem dados |
| CORE-STATE-08 | P0 | mocked-network | Erro permite retry quando aplicável |
| CORE-STATE-09 | P0 | mocked-network | Retry realiza nova request |
| CORE-STATE-10 | P0 | isolation | Dados antigos não aparecem ao trocar de proposta |

## Cenário crítico

Validar se dados da proposta A aparecem temporariamente ao abrir a proposta B.

Se houver cache client-side, observar:

- React Query;
- Zustand;
- Context;
- cache de rota;
- estado compartilhado.

A proposta B não deve exibir visualmente dados pertencentes à proposta A, mesmo durante carregamento.

---

# 12. Responsividade e mobile

Criar um projeto Core mobile somente se a configuração atual permitir sem duplicar toda a suíte.

Exemplo conceitual:

```text
core-desktop
core-mobile
```

Não executar os 129 testes atuais em mobile.

Selecionar cerca de 15 a 20 testes Core representativos.

Viewports mínimas sugeridas:

- iPhone;
- Android comum;
- 1366x768;
- 1920x1080.

Validar:

| ID | Prioridade | Caso |
|---|---|---|
| CORE-MOBILE-01 | P1 | Navegação principal |
| CORE-MOBILE-02 | P1 | Formulário principal |
| CORE-MOBILE-03 | P1 | Modal dentro da viewport |
| CORE-MOBILE-04 | P1 | Modal pode ser fechado |
| CORE-MOBILE-05 | P1 | Upload de documento |
| CORE-MOBILE-06 | P1 | Combobox dentro da viewport |
| CORE-MOBILE-07 | P1 | Scroll até campo inválido |
| CORE-MOBILE-08 | P1 | Botão de avanço permanece acessível |
| CORE-MOBILE-09 | P2 | Campo de data |
| CORE-MOBILE-10 | P2 | Campo numérico |
| CORE-MOBILE-11 | P1 | Timeline ou navegação de etapas |
| CORE-MOBILE-12 | P1 | Lista de documentos |
| CORE-MOBILE-13 | P1 | Conteúdo não possui overflow horizontal indevido |
| CORE-MOBILE-14 | P1 | Elemento fixo não encobre ação principal |
| CORE-MOBILE-15 | P1 | Erro de formulário é visível após submit |

Considerar que usuários podem abrir links do Portal pelo WhatsApp ou e-mail em dispositivos móveis.

---

# 13. Acessibilidade básica

Arquivo sugerido:

```text
tests/core/accessibility/basic-accessibility.spec.ts
```

Não executar auditoria WCAG completa nesta fase.

Cobrir apenas comportamentos funcionais essenciais.

| ID | Prioridade | Caso |
|---|---|---|
| CORE-A11Y-01 | P2 | Formulário navegável por Tab |
| CORE-A11Y-02 | P2 | Foco visível |
| CORE-A11Y-03 | P2 | Modal gerencia foco corretamente |
| CORE-A11Y-04 | P2 | Escape fecha modal quando aplicável |
| CORE-A11Y-05 | P2 | Label associada ao input |
| CORE-A11Y-06 | P2 | Erro de campo é acessível |
| CORE-A11Y-07 | P2 | Botões principais possuem nome acessível |
| CORE-A11Y-08 | P1 | Após submit inválido, primeiro erro é revelado ou focado |
| CORE-A11Y-09 | P2 | Campo obrigatório pode ser identificado |
| CORE-A11Y-10 | P2 | Usuário não fica preso em componente interativo |

Prioridade especial para `CORE-A11Y-08`.

Em formulários longos, a UI deve ajudar o usuário a encontrar o erro que impediu o avanço.

---

# 14. Consistência frontend → API

Arquivo sugerido:

```text
tests/core/reliability/frontend-api-contract.spec.ts
```

Validar, em fluxos representativos, se o valor exibido/preenchido corresponde ao payload enviado.

Exemplos:

- texto;
- telefone;
- renda;
- data;
- checkbox;
- select;
- combobox;
- enum;
- valor monetário.

Exemplo conceitual:

```ts
const requestPromise = page.waitForRequest(request =>
  request.url().includes('/participante') &&
  request.method() === 'PUT'
);

await page.getByRole('button', { name: 'Salvar' }).click();

const request = await requestPromise;
const payload = request.postDataJSON();

expect(payload).toMatchObject({
  nome: 'Iago Leal',
  telefone: '21999999999',
  renda: 5000,
});
```

Casos sugeridos:

| ID | Prioridade | Caso |
|---|---|---|
| CORE-API-01 | P0 | Texto exibido corresponde ao payload |
| CORE-API-02 | P0 | Valor monetário não sofre multiplicação/divisão incorreta |
| CORE-API-03 | P0 | Select envia o código correspondente à opção exibida |
| CORE-API-04 | P0 | Checkbox marcado envia estado verdadeiro correto |
| CORE-API-05 | P0 | Checkbox desmarcado envia estado falso correto |
| CORE-API-06 | P1 | Data exibida é convertida corretamente |
| CORE-API-07 | P1 | Telefone mascarado envia valor esperado |
| CORE-API-08 | P1 | Campo limpo não envia valor antigo |
| CORE-API-09 | P0 | Alteração de campo envia valor atualizado |
| CORE-API-10 | P0 | Payload não reutiliza dados de outra proposta |

Não validar todos os endpoints.

Selecionar endpoints representativos por tipo de componente e risco.

---

# 15. Isolamento entre propostas e usuários

Arquivo sugerido:

```text
tests/core/isolation/proposal-isolation.spec.ts
```

| ID | Prioridade | Tipo | Caso |
|---|---|---|---|
| ISOLATION-01 | P0 | isolation | Dados da proposta A não aparecem na proposta B |
| ISOLATION-02 | P0 | isolation | Documento da proposta A não aparece na proposta B |
| ISOLATION-03 | P0 | isolation | Participante da proposta A não aparece na proposta B |
| ISOLATION-04 | P1 | isolation | Estado de aba não vaza entre propostas |
| ISOLATION-05 | P1 | isolation | Alertas não vazam entre propostas |
| ISOLATION-06 | P0 | isolation | Cache não exibe dados da proposta anterior |
| ISOLATION-07 | P0 | isolation | Logout e login com outro usuário limpam estado anterior |
| ISOLATION-08 | P0 | isolation | Arquivo selecionado em A não é associado a B |
| ISOLATION-09 | P0 | isolation | Request iniciada em A não atualiza B após troca de rota |

Priorizar principalmente aplicações React/Next com estado client-side compartilhado.

---

# 16. Jornadas Portal Core

Arquivo sugerido:

```text
tests/core/journeys/core-journeys.spec.ts
```

Não transformar estas jornadas em novos testes gigantes duplicando todos os testes funcionais.

O objetivo é criar poucos cenários representativos de saúde do produto.

## CORE-JOURNEY-01 — Cadastro mínimo válido

```text
Login
→ Abrir proposta
→ Preencher cadastro obrigatório
→ Salvar
→ Reabrir
→ Validar persistência
```

Prioridade: `P0`

## CORE-JOURNEY-02 — Cadastro interrompido

```text
Login
→ Preencher parte relevante do cadastro
→ Sair
→ Novo login
→ Continuar
→ Validar dados preservados
```

Prioridade: `P0`

## CORE-JOURNEY-03 — Documento

```text
Abrir proposta
→ Enviar documento válido
→ Atualizar página
→ Visualizar documento
→ Validar persistência
```

Prioridade: `P0`

## CORE-JOURNEY-04 — Recuperação de falha

```text
Preencher cadastro
→ Forçar falha da API
→ Portal informa erro
→ Dados permanecem
→ Retry
→ Sucesso
```

Prioridade: `P0`

## CORE-JOURNEY-05 — Isolamento

```text
Proposta A
→ Salvar dados
→ Abrir proposta B
→ Garantir ausência dos dados de A
```

Prioridade: `P0`

---

# Tags sugeridas

Manter as tags operacionais existentes:

```text
@readonly
@mutation
@integration
```

Adicionar gradualmente uma dimensão funcional:

```text
@core
@tenant
@c6
@esteira-digital
@scci
@stateful-mass
@mocked-network
@security
@mobile
```

Evitar excesso de tags.

As principais são:

- `@core`
- `@tenant`
- `@integration`
- `@stateful-mass`

---

# Mock de rede

Interceptação de requests deve ser usada apenas quando o objetivo do teste for validar o comportamento do frontend diante de uma condição controlada.

Exemplos válidos:

- HTTP 500;
- timeout;
- request abortada;
- 401;
- 403;
- 409;
- 413;
- 415;
- resposta lenta;
- respostas fora de ordem.

Não substituir todos os testes de integração por mocks.

Separar claramente:

```text
Teste Core com rede controlada
≠
Teste real de integração com backend
```

O teste com mock responde:

> **O frontend trata corretamente este cenário?**

O teste real responde:

> **A integração real funciona?**

Ambos são importantes.

---

# Geração de arquivos de teste

Para arquivos de upload, criar fixtures locais pequenas e determinísticas.

Estrutura sugerida:

```text
test-data/files/
├── valid/
│   ├── valid.pdf
│   ├── valid.jpg
│   └── valid.png
│
├── invalid/
│   ├── empty.pdf
│   ├── corrupted.pdf
│   ├── fake.pdf
│   ├── renamed.jpg.pdf
│   └── no-extension
│
└── generated/
```

Para casos de tamanho de arquivo, gerar os arquivos durante o setup ou por helper.

Não versionar arquivos enormes desnecessariamente no Git.

Criar helper determinístico para gerar:

- limite - 1 byte;
- limite exato;
- limite + 1 byte.

---

# Critérios de implementação

## Reutilização

Antes de criar:

- locator;
- helper;
- fixture;
- Page Object;
- componente;

procurar implementação equivalente existente.

Não criar um segundo helper de:

- salvar;
- esperar persistência;
- navegar para aba;
- selecionar combobox;
- capturar erro;
- abrir proposta.

## Locators

Priorizar:

1. `getByRole`;
2. `getByLabel`;
3. `getByPlaceholder` quando sem alternativa melhor;
4. atributos estáveis;
5. selectors CSS apenas quando necessário.

Não acoplar novos testes Core a textos C6 quando o comportamento puder ser encontrado por papel ou estrutura semântica.

## Esperas

Não adicionar `waitForTimeout` como solução padrão.

Preferir:

- resposta de API;
- mudança de estado;
- loading desaparecer;
- elemento ficar habilitado;
- URL;
- atributo;
- confirmação visível.

Se o sistema possuir comportamento comprovadamente assíncrono sem sinal observável, documentar a exceção.

## Massa

Testes `mutation`, `isolation`, `security` e `stateful-mass` devem declarar claramente a massa necessária.

Não reutilizar uma proposta consumível entre workers paralelos.

Manter `workers: 1` quando o estado do ambiente exigir serialização.

Não aumentar paralelismo apenas para reduzir duração.

---

# Relatório esperado da revisão

Antes da implementação, criar:

```text
PLAYWRIGHT_PORTAL_CORE_COVERAGE_AUDIT.md
```

Estrutura mínima:

## 1. Resumo executivo

- quantidade de casos propostos;
- quantidade `COVERED`;
- quantidade `PARTIAL`;
- quantidade `MISSING`;
- quantidade `NOT_APPLICABLE`;
- quantidade `BLOCKED`.

## 2. Cobertura atual por grupo

Exemplo:

| Grupo | Covered | Partial | Missing | N/A | Blocked |
|---|---:|---:|---:|---:|---:|
| Navegação |  |  |  |  |  |
| Persistência |  |  |  |  |  |
| Documentos |  |  |  |  |  |
| Sessão |  |  |  |  |  |
| Confiabilidade |  |  |  |  |  |
| Isolamento |  |  |  |  |  |
| Mobile |  |  |  |  |  |
| Acessibilidade |  |  |  |  |  |

## 3. Matriz caso a caso

| ID | Status | Evidência atual | Lacuna | Prioridade | Ação |
|---|---|---|---|---|---|

## 4. Duplicidades identificadas

Listar testes atuais que já validam os mesmos riscos.

## 5. Casos parcialmente cobertos

Explicar exatamente o que falta.

## 6. Casos bloqueados

Para cada bloqueio informar:

- dependência;
- massa;
- endpoint;
- permissão;
- configuração;
- decisão funcional necessária.

## 7. Plano de implementação

Separar em fases pequenas.

Sugestão:

### Fase CORE-1 — P0 de persistência e falhas

- SAVE;
- NAV;
- estados de erro.

### Fase CORE-2 — Documentos

- upload;
- limite;
- erros;
- persistência documental.

### Fase CORE-3 — Sessão, autorização e isolamento

- sessão;
- IDOR;
- cache;
- troca de proposta.

### Fase CORE-4 — Concorrência e frontend/API

- ação duplicada;
- responses fora de ordem;
- payload.

### Fase CORE-5 — Mobile e acessibilidade básica

- jornada mobile;
- modais;
- scroll;
- foco em erros.

---

# Resultado esperado

Ao final desta evolução, a suíte deve permitir distinguir claramente:

## Defeito do Portal

Exemplos:

- perda de dados após refresh;
- sucesso exibido após HTTP 500;
- documento duplicado após duplo clique;
- documento de outra proposta aparecendo;
- resposta atrasada sobrescrevendo estado novo;
- loading infinito;
- acesso a proposta de outro usuário;
- valor diferente enviado para a API.

## Diferença de produto

Exemplos:

- cliente não possui garantidor PJ;
- produto não possui composição de renda;
- esteira não possui determinado módulo.

## Diferença de contrato do cliente

Exemplos:

- lista de profissões;
- prazo;
- fases;
- mensagens;
- URL externa;
- catálogo documental;
- obrigatoriedade de campo.

## Falha de integração

Exemplos:

- Portal salvou corretamente, mas SCCI não refletiu;
- documento enviado, mas não apareceu na árvore documental;
- workflow não avançou;
- AEJS não refletiu o estado esperado.

---

# Regra final

Não implementar automaticamente todos os casos deste documento.

Primeiro:

> **Auditar a suíte atual, provar a cobertura existente, identificar lacunas reais e somente então implementar os testes Core faltantes.**

A meta não é aumentar o número de testes.

A meta é aumentar a capacidade da suíte de detectar:

- perda de dados;
- inconsistência;
- falhas de recuperação;
- acesso indevido;
- vazamento de estado;
- comportamento duplicado;
- corrupção de documentos;
- divergência frontend/API.

O resultado deve transformar a suíte atual de uma automação majoritariamente orientada ao aceite de cliente em uma suíte com uma camada real de **qualidade do produto Portal**, preservando separadamente os contratos específicos de cada cliente e as integrações com SCCI/AEJS.
