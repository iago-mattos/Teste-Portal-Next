# Resultados da automação - Portal C6

Última atualização: 17/06/2026  
Ambiente: `portal-desenv.prognum.com.br`  
Massa: proposta `000000075`, cliente `Next Cypress V3`, CPF terminado em `58`

## Resumo

O mapa possui 104 casos entre os blocos 2 e 13.

| Situação | Quantidade |
|---|---:|
| Casos com implementação Cypress | 84 |
| Aprovados em execução real | 19 |
| Divergências funcionais confirmadas | 12 |
| Divergências encontradas no código, aguardando execução final | 4 |
| Correções e novos testes aguardando novo token/cooldown | 49 |
| Ainda pendentes de implementação/massa | 20 |

O token `761526` autenticou corretamente em execução real. Após rodar a timeline
completa, a tentativa seguinte de abrir Participantes recebeu HTTP `429` e a
tela exibiu `Muitas tentativas. Tente novamente em alguns minutos.`. Portanto,
os próximos specs precisam aguardar o cooldown do portal ou receber um novo
`accessUrl`.

Os quatro casos de Login estão implementados, mas ficam fora da contagem acima,
que segue o recorte solicitado dos blocos 2 a 13. Considerando também Login, a
suíte possui 88 implementações.

## Aprovados

| Caso | Resultado observado |
|---|---|
| `PROP-04` | Card apresenta `Fase Atual: Cadastro`. |
| `PROP-13` | Data limite e saldo atual em dias corridos são exibidos. |
| `PROP-15` | Data fim permanece igual durante as execuções. |
| `PROP-19` | Vencimento fica no card, sem modal adicional. |
| `TIMELINE-01` | Cabeçalho apresenta proponente e CPF mascarado. |
| `TIMELINE-02` | Cabeçalho usa CPF e não apresenta CNPJ. |
| `TIMELINE-03` | Linha do tempo contém as oito fases previstas. |
| `TIMELINE-07` | Mensagem da data limite é exibida com `15/Jul/2026`. |
| `TIMELINE-08` | Aviso de obrigatoriedade está visível. |
| `TIMELINE-12` | Botão `Ver documentos` não aparece no cadastro. |
| `PART-01` | Abas estão na ordem esperada. |
| `PART-02` | Campos obrigatórios apresentam `*`. |
| `PART-06` | Lista de Estado Civil corresponde à regra e não contém `Outros`. |
| `PART-11` | Não existe botão `Voltar` no formulário. |
| `RENDA-01` | Informativo sobre composição com terceiros está visível. |
| `MOTIVO-02` | Lista de finalidades contém as opções esperadas. |
| `IMOVEL-02` | Mensagem sobre alteração na negociação está visível. |
| `IMOVEL-03` | Tipo do imóvel contém Residencial e Comercial. |
| `IMOVEL-11` | Lista de condição do imóvel corresponde à regra. |

## Divergências funcionais

Estes testes devem continuar falhando até o portal ou a regra ser corrigido.

### `PROP-01` - endereço ausente no card

O card apresenta número, data, valores e prazo, mas não apresenta o endereço do
imóvel recebido do lead.

### `PROP-14` - prazo calculado em dias corridos

Em 17/06/2026, para a data limite 15/07/2026, o portal mostra `28 dias
restantes`. Pela regra de dias úteis, sem considerar feriados, seriam 20 dias.

### `PROP-16` - destino da nova simulação

O botão existe com o texto esperado, mas direciona para `/menu-simulacao` no
próprio portal. A regra pede `https://c6imobiliario.com.br`.

### `PART-07` - nacionalidade sem valor padrão

O combo `PESSOA.CO_NACIONALIDADE` inicia vazio. A regra pede `Brasileira` como
valor padrão, permitindo alteração.

### `IMOVEL-01` - endereço do imóvel vazio

O valor estimado vem preenchido com `R$ 2.150.000,00`, mas CEP, endereço,
bairro, UF e município do imóvel estão vazios.

### `IMOVEL-04` - opções extras em Uso do Imóvel

A lista exibida contém 15 itens, incluindo `Não Informado`, `Terreno` e
`Galpão`, além de diferenças de grafia. A regra contém 12 opções.

### `DETALHE-01` - botão disponível com cadastro incompleto

O alerta informa que ainda faltam campos obrigatórios, mas o botão
`Ver Detalhes da Operação` continua visível.

### `CONJ-03` - opcionais sem identificação

Data da Comunhão, DDD, Celular e E-mail são renderizados sem o texto
`(opcional)`, embora o schema os marque como opcionais e a regra exija essa
identificação.

### `GAR-PJ-02` - Estado Civil não existe para o garantidor PJ

A regra da cliente relaciona `Estado Civil` entre os campos obrigatórios da
empresa. A tela e o schema do garantidor PJ não possuem esse campo. Município
não foi considerado defeito: ele é condicional e aparece após a seleção ou o
preenchimento automático da UF.

### `GAR-PJ-06` - orientação para empresa com um único dono ausente

A tela identifica a seção como `Lista de Sócios (quando aplicável)`, mas não
informa que, quando não houver sócios, devem ser usados os dados da única pessoa
dona da empresa.

### `TIMELINE-09` - aviso obrigatório volta após reload

O teste fecha o aviso `As informações deste Cadastro são obrigatórias para dar
continuidade ao processo.`, confirma que ele sai da tela e recarrega a página.
Após o reload, o aviso é exibido novamente. A regra pede que ele não apareça
outra vez depois de fechado.

### `TIMELINE-11` - botão de detalhes ausente no cadastro

A tela atual não exibe o botão `Ver Detalhes da Operação` no cadastro. A regra
da planilha pede que ele permaneça habilitado e mostre a evolução do
preenchimento. Observação: este ponto conflita com `DETALHE-01`, que pede o
botão oculto enquanto o cadastro estiver incompleto.

## Divergências encontradas no código

Estes pontos foram comprovados pela implementação do frontend. O teste Cypress
foi fortalecido para demonstrar o comportamento na próxima execução.

### `MOTIVO-03` - mínimo de palavras não bloqueia

`minPalavras: 10` é usado somente para exibir o contador. O componente não
marca o campo como inválido e o fluxo de gravação não verifica a quantidade de
palavras. O teste agora tenta avançar com duas palavras, restaura uma descrição
válida e só depois verifica se o avanço curto foi bloqueado.

### `IMOVEL-12` - instituição financeira permanentemente oculta

O saldo devedor é exibido para condições alienadas, mas o campo
`IMOVEL_OPERACAO.NO_INSTITUICAO_FINANCEIRA` possui `listaExp: ["F"]` no schema,
o que o mantém oculto. A regra exige que saldo e instituição apareçam como
obrigatórios.

### `CONJ-09` - espaços finais não são normalizados no campo

Os inputs de nome e e-mail armazenam diretamente `event.target.value`; não há
`trim` no componente antes da gravação. O teste captura o comportamento, limpa
os valores temporários e então exige que espaços finais sejam rejeitados.

### `RENDA-TERC-06` - terceiro também aceita espaços finais

Nome e e-mail do terceiro usam o mesmo fluxo de inputs sem normalização por
`trim`. O teste grava valores terminados em espaço, recarrega a proposta, lê o
resultado persistido e limpa os dados antes da asserção final.

## Correções feitas nos testes

- Valores monetários agora normalizam espaço não separável antes da comparação.
- Dados do cabeçalho e data limite passaram a vir de `connect.ts`.
- A timeline ignora a cópia responsiva oculta antes de validar visibilidade.
- Combos pesquisáveis são lidos por `role="listbox"` e `role="option"`.
- O radio customizado de composição de renda é validado por `aria-checked`.
- `Construção e/ou reformas` foi alinhado ao texto real da opção configurada.
- CPF da massa foi normalizado para os 11 dígitos reais, removendo os três
  zeros usados apenas no payload tokenizado.
- Quando o token expira, `portalSession()` agora informa a causa e não dispara
  envio de link por e-mail.
- `MOTIVO-03` passou a verificar o bloqueio real para menos de 10 palavras e
  restaura uma descrição válida antes da asserção final.
- Foi criado `selectSearchOption()` para interagir de forma estável com os
  combos pesquisáveis.
- O login pelo magic link agora aguarda a navegação assíncrona
  `raiz -> /login -> /propostas`; antes, o Cypress lia a rota cedo demais.
- A chave de `cy.session()` inclui o `accessUrl`, evitando restaurar uma sessão
  antiga quando um novo link tokenizado é colocado em `connect.ts`.
- A sessão é validada por `/api/auth/me`, sem usar uma navegação de página como
  teste de autenticação.
- `openDefaultProposal()` não monta mais a URL do detalhe. Ele abre a listagem
  autenticada, localiza o card pelo número visível e clica em `Completar
  cadastro` ou `Acompanhar proposta`, deixando o portal definir a rota.
- O fluxo corrigido foi validado em execução real com `TIMELINE-02`: o Cypress
  autenticou pelo novo link, abriu o card da proposta 75 e chegou a
  `/propostas/000000075`.
- `TIMELINE-01` passou a comparar o nome do proponente sem sensibilidade a
  caixa, pois o portal renderiza `NEXT CYPRESS V3`.
- `TIMELINE-03` passou a validar o texto da timeline visível em bloco, evitando
  falha técnica por cópias responsivas ou filtros `:visible` frágeis.
- `portalSession()` agora detecta a mensagem de rate limit `Muitas tentativas`
  e falha com erro explícito de HTTP `429`, em vez de aguardar 30 segundos por
  `Minhas propostas`.
- Garantidores PF e PJ passaram a ter preparação e restauração próprias: cada
  teste habilita o tipo necessário e volta a condição do imóvel para vazio ao
  terminar, inclusive quando a asserção funcional falha.
- Município dos garantidores é validado somente depois da definição da UF,
  respeitando a expressão condicional do formulário.
- Os cenários de CEP aguardam a chamada real antes de verificar Endereço,
  Bairro, UF e Município e limpam os dados usados no teste.

## Aguardando reexecução com novo token

- `PART-03`: rejeição de letras no campo de renda.
- `PART-08`: abre e lê o combo pesquisável de profissões.
- `PART-09`: filtro digitável do combo de profissão.
- `PART-10`: abre e lê o combo pesquisável de tipo de profissão.
- `PART-12`: valida autosave por troca de aba, reload e restauração da renda.
- `PART-13`: valida crítica de obrigatórios e persistência do valor informado,
  restaurando a renda ao final.
- `RENDA-02`: valida o radio customizado `Não` por `aria-checked`.
- `RENDA-03`: habilita Sim, valida Cônjuge/Outra Pessoa e restaura Não.
- `RENDA-CONJ-01` a `RENDA-CONJ-06`: obrigatoriedade, máscaras, listas,
  pesquisa e autorização da composição com cônjuge.
- `RENDA-TERC-01` a `RENDA-TERC-11`: campos, obrigatoriedade, CPF, máscaras,
  listas, pesquisa, autorização e persistência de nome/e-mail da composição
  com terceiro. `RENDA-TERC-06` limpa os valores e restaura a composição para
  `Não` antes de avaliar o resultado.
- `CONJ-01` a `CONJ-10`: exibição condicional da aba, obrigatórios, opcionais,
  DDD/celular, CPF, datas, espaços finais e lista de regimes. O spec restaura o
  Estado Civil e limpa valores temporários em cada caso.
- `MOTIVO-03`: valida o bloqueio de descrição curta e restaura texto válido.
- `IMOVEL-05`: Casa em condomínio define Residencial bloqueado.
- `IMOVEL-06`: usos comerciais definem Comercial bloqueado.
- `IMOVEL-07`: usos residenciais mantêm escolha obrigatória habilitada.
- `IMOVEL-08`: pergunta de residência validada na aba Sobre Você.
- `IMOVEL-09`: endereço residencial habilitado ao selecionar Não.
- `IMOVEL-12`: campos obrigatórios para imóvel alienado.
- `GAR-PF-01` a `GAR-PF-06`: habilitação por condição do imóvel,
  obrigatoriedade, celular, complemento opcional, preenchimento por CEP e
  identificação do endereço do proprietário.
- `GAR-PJ-01` a `GAR-PJ-08`: habilitação por condição do imóvel, campos da
  empresa, opcionais, preenchimento por CEP, identificação do endereço,
  orientação de sócios, obrigatoriedade e celular dos sócios. `GAR-PJ-02` e
  `GAR-PJ-06` já possuem divergências confirmadas pelo mapeamento da tela e do
  schema, mas aguardam a evidência final gerada pelo Cypress.

## Pendentes por massa ou dependência externa

Os 20 casos abaixo não foram transformados em falso positivo. Eles permanecem
marcados como pendentes até existir uma massa ou mecanismo controlado que
permita produzir o estado exigido:

- `PROP-02` e `PROP-03`: exigem alterar dados na Prognum e comparar o reflexo
  no portal em fases diferentes.
- `PROP-05` e `PROP-06`: exigem tarefas e prazos parametrizados distintos.
- `PROP-07`: exige proposta expirada.
- `PROP-08` e `PROP-09`: exigem proposta negada ou em fase a partir da Análise
  de Crédito.
- `PROP-10`, `PROP-11` e `PROP-12`: exigem propostas canceladas em idades e
  estados diferentes.
- `PROP-17`: exige cadastro efetivamente concluído e enviado para crédito.
- `PROP-18`: exige ao menos duas propostas com jornadas diferentes.
- `TIMELINE-04`: exige entrada por todas as jornadas disponíveis.
- `TIMELINE-05`: exige mudança controlada da fase na Prognum.
- `TIMELINE-06`: exige proposta expirada para validar o bloqueio de edição.
- `TIMELINE-10`: exige mais de uma proposta em andamento.
- `PART-04` e `PART-05`: exigem massas identificadas por origem WEB, APP e API.
- `MOTIVO-01`: a aba atual não exibe os três campos descritos pela regra e é
  necessário definir onde Valor, Prazo e Tipo de Juros devem ser validados.
- `IMOVEL-10`: trata da concatenação para integração com a tela Prognum, que
  ficou fora do escopo solicitado.

## Evidências

Falhas possuem screenshot e vídeo em:

- `cypress/screenshots/`
- `cypress/videos/`

Esses diretórios são gerados pelo Cypress e podem ser recriados em uma nova
execução.
