# Banco do SCCI: o que o Simulador grava (esteira-ht / cef-mip2)

Levantamento feito em 12/11/2026, **somente leitura**, no Oracle `11g` (usuário
`CAIXA2`) da cef-mip2, que atende `esteiradigital-ht.prognum.com.br`.

Fontes, da mais forte para a mais fraca:

1. **Banco**: `ALL_TAB_COLUMNS`, `ALL_CONSTRAINTS` e consultas agregadas sobre linhas
   reais (nenhum dado pessoal foi lido ou impresso).
2. **Código**: SQL embutido nos binários `woriginacao` e `wtela` (`/u/scci/binfpc`).
3. **Relatório oficial**: `simulacao_internet.jrxml` (rótulos dos campos).

`ALL_COL_COMMENTS` está vazio para essas tabelas: o banco não documenta o
significado das colunas.

## 0. Esquema, usuário e privilégios (atenção)

Conferido em 12/11/2026 (consulta à própria sessão, só metadados):

- Sessão `CAIXA2` no banco `oracle11`; esquema corrente `CAIXA2`. Nomes de tabela sem
  dono (`FROM OPERACAO_CREDITO`) resolvem para o esquema `CAIXA2`.
- **O usuário `CAIXA2` tem a role `DBA`**, com `SELECT/INSERT/UPDATE/DELETE/DROP ANY TABLE`,
  `GRANT ANY PRIVILEGE` e `BECOME USER` (202 privilégios de sessão).
- O mesmo Oracle hospeda de 30 a 41 esquemas com estas tabelas (de outros clientes e
  ambientes), e `ALL_TAB_COLUMNS` os lista. **Sempre filtre `OWNER = 'CAIXA2'`** ao ler
  metadados (o anexo abaixo já está filtrado: 35, 54, 347, 417 e 145 colunas).
- Consequência: a única barreira contra escrita é a transação `SET TRANSACTION READ ONLY`
  mais a trava do helper (`tests/services/scci-db/sqlplus-script.ts`). A trava (revisada
  em 12/11/2026, rodada 1 do Revisor) é por **listas permitidas**:
  - **objetos** depois de `FROM`, de `JOIN` e de **cada vírgula da lista FROM** (inclusive
    depois de `JOIN ... ON ...`, `JOIN ... USING (...)` e `CROSS JOIN`): só `DUAL`, `ALL_TAB_COLUMNS`,
    `SESSION_PRIVS`, `SESSION_ROLES` e as tabelas deste documento (`SIMULACAO_ORIGINACAO`,
    `OPERACAO_CREDITO`, `PESSOA_PRETENDENTE`, `PRETENDENTE`, `IMOVEL_OPERACAO`,
    `SEGURADORA_TIPO_OPERACAO`, `SEGURA`, `TABAPOLICE`, `CARENCIA_TIPO_OPERACAO`);
    `DONO.TABELA`, `DBA_*` e qualquer outro objeto são recusados (inclusive em join por
    vírgula e subconsulta). Um nome de **CTE** (`WITH X AS (...)`) só vale para referências
    **depois** do fim da sua definição: uma CTE definida adiante não mascara o objeto real;
  - **funções** `NOME(` / `PACOTE.NOME(`: só `COUNT`, `MAX`, `MIN`, `SUM`, `AVG`, `TO_CHAR`,
    `TO_NUMBER`, `TO_DATE`, `REPLACE`, `CHR`, `NVL`, `COALESCE`, `DECODE`, `UPPER`, `LOWER`,
    `TRIM`, `SUBSTR`, `INSTR`, `LENGTH`, `ROUND`, `TRUNC`, `ABS`, `SYS_CONTEXT` e as leituras
    puras `DBMS_LOB.SUBSTR/GETLENGTH/INSTR/COMPARE`. Função do esquema, `HTTPURITYPE`,
    `DBURITYPE`, `UTL_*` e `DBMS_*` (exceto as acima) são recusadas;
  - também recusa `;`, `/` isolado, `@`, comentários, identificador entre aspas, literal
    `q'..'`, literal com quebra de linha, `NEXTVAL` e as palavras de DML/DDL/PL-SQL.
  Para ler outro objeto, inclua-o na lista de propósito (e aqui).
  **Limites que restam:** uma função do esquema **sem parâmetros**, chamada sem parênteses
  (`SELECT F_GRAVA FROM DUAL`), é indistinguível de uma coluna para o filtro; a lista
  permitida é de texto, não de privilégio. A proteção de verdade é um usuário do banco só
  com `SELECT` no próprio esquema: pendência para a infra.

## 1. Tabelas e chaves

| Etapa | Tabela | Chave primária | Colunas |
|---|---|---|---|
| Gravar simulação | `SIMULACAO_ORIGINACAO` | `NU_SIMULACAO` + `NU_SESSAO` | 35 |
| Enviar proposta | `PRETENDENTE` | `NU_PRETENDENTE` | 54 |
| Enviar proposta | `PESSOA_PRETENDENTE` | `NU_PESSOA` + `NU_PRETENDENTE` | 347 |
| Enviar proposta | `OPERACAO_CREDITO` | `NU_OPERACAO` (liga à simulação por `NU_SIMULACAO`) | 417 |
| Enviar proposta | `IMOVEL_OPERACAO` | `NU_OPERACAO` | 145 |

`REGISTRO_PROVISAO_PERDAS` e `IMV_OPERACAO_EMPRESARIO` aparecem perto do código
de envio, mas **não foi confirmado** que fazem parte do fluxo do Simulador.
Ficam fora do validador.

A lista completa de colunas, com tipo e tamanho, está no
[Anexo](#anexo-colunas-reais-all_tab_columns).

## 2. Carência

- `SIMULACAO_ORIGINACAO` **não tem** coluna de carência.
- `OPERACAO_CREDITO` tem `IN_CARENCIA_AMORTIZACAO`, `IN_TIPO_JUROS_CARENCIA`,
  `NU_PRAZO_CARENCIA_AMAISJ`, `NU_MESES_CARENCIA_AMORTIZACAO` e `DT_CARENCIA_JUROS`.
- O `INSERT INTO OPERACAO_CREDITO` do envio da proposta (`woriginacao`) grava
  **`IN_CARENCIA_AMORTIZACAO`, `IN_TIPO_JUROS_CARENCIA` e `NU_PRAZO_CARENCIA_AMAISJ`**
  e os valores pós-carência (`VA_AMAISJ_1A_PREST_POSCAR`, `VA_JUROS_POSCAR`,
  `VA_SEG_MIP_POSCAR`, `VA_SEG_DFI_POSCAR`, `VA_TOT_SEG_POSCAR` e as variantes
  `..._SEMBONUS_POSCAR`). `NU_MESES_CARENCIA_AMORTIZACAO` e `DT_CARENCIA_JUROS`
  **não** estão nesse INSERT.
- Os parâmetros por modalidade ficam em `CARENCIA_TIPO_OPERACAO`
  (`NU_MESES_CARENCIA_MAX`, `NU_MESES_CARENCIA_1PRST`, `IN_CARENCIA_AMORTIZACAO`,
  `IN_TIPO_JUROS_CARENCIA`, `IN_SEGURO_CARENCIA_NA1PRST`).

Reproduzido em 12/11/2026: `CARENCIA_TIPO_OPERACAO` está **vazia** (0 linhas) no esteira-ht.
Não existe controle positivo de carência neste ambiente sem cadastrar uma. Que essa seja
a tabela que controla a exibição do campo na tela Dados é **hipótese** (a tabela e as
colunas são o que o código do `woriginacao` usa; ninguém confirmou o vínculo com a tela).

Consequência: carência **só é verificável depois do envio da proposta**.

## 3. Telefone (incluindo PJ)

Colunas de telefone em `PESSOA_PRETENDENTE` (tamanho em caracteres):

| Uso provável | DDD | Número |
|---|---|---|
| Celular | `NU_DDD_CEL` (5) | `NU_CELULAR` (11) |
| Celular comercial | `NU_DDD_CEL_COM` (5) | `NU_CELULAR_COM` (11) |
| Residencial | `NU_DDD_RES` (5) | `NU_TELEFONE_RES` (11) |
| Comercial | `NU_DDD_COM` (5) | `NU_TELEFONE_COM` (15) |
| Recado | `NU_DDD_REC` (5) | `NU_TELEFONE_REC` (11) |
| Fax | `NU_DDD_FAX` (5) | `NU_TELEFONE_FAX` (11) |
| **Contato da PJ** | `NU_DDD_TEL_CONTATO_PJ` (5) | `NU_TEL_CONTATO_PJ` (11), com `NO_PESSOA_CONTATO_PJ` (40) |

Existe, portanto, coluna própria para o contato da PJ. **Qual delas o Simulador
preenche** só uma proposta real responde: exige `ALLOW_TEST_MUTATION=true` e massa
autorizada. A simulação sozinha não grava telefone.

## 4. Seguradoras e card duplicado

Cadastro lido pelo Simulador (`wtela`, rotina de evolução por seguradora):

```sql
SELECT STO.*, S.IM_SEGURADORA
FROM SEGURADORA_TIPO_OPERACAO STO
LEFT JOIN SEGURA S ON STO.CO_SEGURADORA = S.CODIGO
WHERE STO.CO_TIPO_OPERACAO = :CoTipoOperacao
  AND (STO.CO_ENQUADRAMENTO = :CO_ENQUADRAMENTO OR STO.CO_ENQUADRAMENTO = 0 OR STO.CO_ENQUADRAMENTO IS NULL)
ORDER BY STO.CO_TIPO_OPERACAO, STO.NU_SEQ
```

| Tabela | Papel | Chave |
|---|---|---|
| `SEGURADORA_TIPO_OPERACAO` | Quais seguradoras/apólices valem para cada tipo de operação | `CO_TIPO_OPERACAO` + `NU_SEQ` |
| `SEGURA` | Cadastro da seguradora (`NOME`, logo `IM_SEGURADORA`) | `CODIGO` |
| `TABAPOLICE` | Cadastro da apólice (`DESCAPOLICE`, alíquotas) | `CODAPOLICE` |

**Fato (reproduzido em 12/11/2026, SQL na seção 8):** `SEGURADORA_TIPO_OPERACAO` tem
2.695 linhas para 422 tipos de operação e **324 grupos** de linhas repetidas, que só
diferem no `NU_SEQ`. "Repetidas" = iguais nas 7 colunas que não são `NU_SEQ`
(`CO_TIPO_OPERACAO`, `CO_SEGURADORA`, `CO_SEGURADORA_DFI`, `CO_APOLICE`,
`CO_APOLICE_DFI`, `CO_ENQUADRAMENTO` e `TE_CO_ENQUADRAMENTO`; do `BLOB` comparam-se o
tamanho e os primeiros 2.000 bytes). As 8 colunas da tabela estão no anexo. Exemplo: tipo
`811`, seguradora `7`, apólice `7200`: 12 linhas iguais (o tipo `811` tem 43 linhas e 5
seguradoras). O maior grupo tem 12 linhas.

**Medido na tela e na resposta do BFF (12/11/2026, 24 jornadas, ver auditoria seção 24):**
nas 6 jornadas cujo tipo tem uma oferta repetida no cadastro (mesmo `CO_ENQUADRAMENTO` nulo),
a resposta de `/api/simulacao/evolucao` traz **os dois cards**, a tela mostra os dois, e o
2º (e seguintes) de uma seguradora **não tem nome acessível** (`aria-labelledby=""`; os
cards com nome usam `seg-<código da seguradora>-label`). Nas 18 jornadas sem repetição, tela
= resposta = cadastro e todos os cards têm nome. A consulta do `wtela` citada acima não foi
provada como a que alimenta a rota (a repetição, porém, chega ao BFF). **Não verificado:** o
código do front (a causa do `aria-labelledby` vazio) e se a deduplicação deve ficar no Pascal,
no BFF ou no cadastro: decisão de Produto.

Seguradora sem nome: 4 linhas de `SEGURADORA_TIPO_OPERACAO` não têm `SEGURA` (ou `NOME`)
correspondente no `LEFT JOIN`. Não é o mesmo número dos "6 cards sem nome" da tela (cards
são por tipo de operação), mas é a mesma classe de causa a verificar.

Para o teste: comparar os cards exibidos com
`SELECT DISTINCT CO_SEGURADORA, CO_SEGURADORA_DFI, CO_APOLICE, CO_APOLICE_DFI`
do tipo de operação usado.

## 5. Tamanho dos campos (limite de 40 no nome)

`NVARCHAR2`: o limite real é `CHAR_LENGTH` (`DATA_LENGTH` é em bytes, o dobro).

| Coluna | Limite (caracteres) |
|---|---|
| `PESSOA_PRETENDENTE.NO_PESSOA` | **40** |
| `PESSOA_PRETENDENTE.NO_PESSOA_COMPLETO` | 120 |
| `PESSOA_PRETENDENTE.NO_FANTASIA` | 42 |
| `PESSOA_PRETENDENTE.NO_PESSOA_CONTATO_PJ` | 40 |
| `PESSOA_PRETENDENTE.NO_EMAIL` / `NO_EMAIL2` | 80 |
| `PESSOA_PRETENDENTE.NU_CPFCNPJ` | 14 |
| `SIMULACAO_ORIGINACAO.CO_APOLICE` / `CO_APOLICE_DFI` | 15 |

O limite de 40 do nome está **confirmado pelo banco** (`NO_PESSOA`). Existe também
`NO_PESSOA_COMPLETO` (120): o teste deve verificar em qual das duas o nome longo foi parar.

## 6. Significado das colunas de valor

| Coluna | Significado | Evidência |
|---|---|---|
| `VA_FINANCIAMENTO` | Valor financiamento **solicitado** | Rótulo no relatório oficial |
| `VA_OPERACAO` | Valor **total** do financiamento | Rótulo no relatório oficial |
| `VA_OPERACAO − VA_FINANCIAMENTO` | Despesas incorporadas (`VA_DESPESAS`) | Em 365 de 432 propostas recentes do Simulador; nas outras 67 a diferença tem outra origem (não identificada) |
| `VA_PRECO_IMOVEL` | Valor do imóvel | Nome e INSERT |
| `VA_AMAISJ_1A_PRESTACAO` | **Hipótese**: amortização + juros da 1ª parcela, sem seguros e sem tarifa | Bate com SAC e taxa nominal ÷ 12 (`VA_OPERACAO/prazo + VA_OPERACAO × taxa/1200`) em 52 de 79 simulações recentes; nas outras 27 não bate com nenhuma fórmula testada (há até valor 0 com dados preenchidos). **Não confirmado** |
| `VA_MIP`, `VA_DFI` | Seguros MIP e DFI da 1ª parcela | Nome; não recalculado |
| `VA_TARIFA_ADMINISTRACAO` | Tarifa de administração | Nome; não recalculado |

A prestação total da 1ª parcela **não é** `VA_AMAISJ_1A_PRESTACAO`: incluir MIP,
DFI e tarifa não bateu em nenhum caso. A definição precisa vir de Produto ou do
código-fonte Pascal. Sem isso, a expectativa vira tautologia.

## 7. Como o teste deve usar o banco

- **A chave inclui a sessão.** 22 simulações têm mais de uma `NU_SESSAO` (até 4; 633 linhas
  para 577 `NU_SIMULACAO`). Buscar só por `NU_SIMULACAO` devolve qualquer uma delas:
  use sempre `NU_SIMULACAO` + `NU_SESSAO` (`getSimulation({ nuSimulacao, nuSessao })`).
- **Achar a linha certa**: o BFF devolve `resumo.nuSimulacao` e `resumo.nuSessao`
  na resposta de `/api/simulacao/evolucao`, lidos de `NU_SIMULACAO`/`NU_SESSAO` do
  Pascal (`SimulacaoTranslator.resumo`). Capturar com `page.waitForResponse` e
  buscar por essa chave. **Confirmar numa execução** que vêm preenchidos; se não
  vierem, usar um valor único por teste. Não usar "última simulação" (ambiente
  compartilhado e workers em paralelo).
- **O que prova**: tela igual ao banco prova **persistência**, não que o cálculo
  esteja certo. Cálculo continua exigindo referência independente.
- **Gravação assíncrona**: esperar o registro aparecer, com limite de tempo, em vez
  de ler uma única vez (`waitForSimulation`, intervalo mínimo de 1 s: cada consulta abre
  um `ssh` e um `sqlplus`, 1 a 2 s).
- **"Zero linhas" só vale com o marcador de fim.** O script imprime `@@END@@` depois do
  SELECT; sem ele a saída é tratada como incompleta, nunca como lista vazia.
- **Falha transitória do `ssh`** (salto pela desenv, exit 255) é repetida até 3 vezes; erro
  do Oracle e recusa de autenticação não.
- **Dados pessoais**: filtrar só pelo CPF sintético do teste; nunca anexar linha
  completa de `PESSOA_PRETENDENTE` a relatório, trace ou PDF.

## 8. SQL de reprodução (executados em 12/11/2026, pelo helper, somente leitura)

```sql
-- seção 4: linhas e tipos
SELECT COUNT(*) AS N, COUNT(DISTINCT CO_TIPO_OPERACAO) AS T FROM SEGURADORA_TIPO_OPERACAO;
-- seção 4: grupos repetidos (resultado: 324 grupos, 1.116 linhas, máximo 12)
SELECT COUNT(*) AS GRUPOS, SUM(C) AS LINHAS, MAX(C) AS MAXIMO
FROM (SELECT COUNT(*) AS C FROM SEGURADORA_TIPO_OPERACAO
      GROUP BY CO_TIPO_OPERACAO, CO_SEGURADORA, CO_SEGURADORA_DFI, CO_APOLICE, CO_APOLICE_DFI,
               CO_ENQUADRAMENTO, DBMS_LOB.SUBSTR(TE_CO_ENQUADRAMENTO, 2000, 1),
               DBMS_LOB.GETLENGTH(TE_CO_ENQUADRAMENTO)
      HAVING COUNT(*) > 1);
-- seção 4: exemplo (resultado: 12)
SELECT COUNT(*) FROM SEGURADORA_TIPO_OPERACAO
WHERE CO_TIPO_OPERACAO = '811' AND CO_SEGURADORA = 7 AND CO_APOLICE = '7200';
-- seção 4: seguradora sem cadastro ou sem nome (resultado: 4)
SELECT COUNT(*) FROM SEGURADORA_TIPO_OPERACAO STO LEFT JOIN SEGURA S ON STO.CO_SEGURADORA = S.CODIGO
WHERE S.CODIGO IS NULL OR S.NOME IS NULL;
-- seção 7: simulações com mais de uma sessão (resultado: 22, máximo 4)
SELECT COUNT(*) AS SIMULACOES, MAX(C) AS MAX_SESSOES
FROM (SELECT COUNT(*) AS C FROM SIMULACAO_ORIGINACAO GROUP BY NU_SIMULACAO HAVING COUNT(*) > 1);
-- seção 2: carência (resultado: 0)
SELECT COUNT(*) FROM CARENCIA_TIPO_OPERACAO;
```

**Não reproduzidos** (o SQL original não foi registrado; não os use como expectativa antes
disso): "365 de 432 propostas" (`VA_OPERACAO - VA_FINANCIAMENTO = VA_DESPESAS`) e
"52 de 79 simulações" (`VA_AMAISJ_1A_PRESTACAO` = SAC). Faltam o critério de "recentes" e a
fórmula exata.

Verificado no Oracle 11g: `WITH` dentro de `FROM (...)` roda.

## Anexo: colunas reais (`ALL_TAB_COLUMNS`)

Tamanho = `CHAR_LENGTH` para texto; para número, a precisão quando declarada.

### IMOVEL_OPERACAO

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `NU_OPERACAO` | NUMBER | prec. 10 | N |
| 2 | `NO_ENDERECO` | NVARCHAR2 | 35 | Y |
| 3 | `NO_COMPLEMENTO` | NVARCHAR2 | 15 | Y |
| 4 | `NO_BAIRRO` | NVARCHAR2 | 21 | Y |
| 5 | `NO_COMARCA` | NVARCHAR2 | 40 | Y |
| 6 | `NO_CIRCUNSCRICAO_IMOBILIARIA` | NVARCHAR2 | 120 | Y |
| 7 | `NU_INSCRICAO_MUNICIPAL` | NVARCHAR2 | 40 | Y |
| 8 | `DT_TITULO_AQUISITIVO` | DATE |  | Y |
| 9 | `NU_MATRICULA_IMOVEL` | NVARCHAR2 | 20 | Y |
| 10 | `NU_REGISTRO_IMOVEL` | NVARCHAR2 | 20 | Y |
| 11 | `NU_RGI` | NVARCHAR2 | 70 | Y |
| 12 | `TE_DESCRICAO_RGI` | BLOB |  | Y |
| 13 | `VA_AVALIACAO_PROVISORIA` | FLOAT | prec. 126 | Y |
| 14 | `DT_PRIMEIRA_AVALIACAO` | DATE |  | Y |
| 15 | `VA_PRIMEIRA_AVALIACAO` | FLOAT | prec. 126 | Y |
| 16 | `DT_SEGUNDA_AVALIACAO` | DATE |  | Y |
| 17 | `VA_SEGUNDA_AVALIACAO` | FLOAT | prec. 126 | Y |
| 18 | `CO_UF` | NCHAR | 2 | Y |
| 19 | `NU_MUNICIPIO` | NCHAR | 5 | Y |
| 20 | `NO_PRIMEIRA_AVALIACAO` | NVARCHAR2 | 60 | Y |
| 21 | `IN_TITULO_AQUISITIVO` | NCHAR | 1 | Y |
| 22 | `NO_SEGUNDA_AVALIACAO` | NVARCHAR2 | 60 | Y |
| 23 | `TE_AVALIACAO_IMOVEL` | BLOB |  | Y |
| 24 | `TE_REFERENCIA_LOCALIZACAO` | BLOB |  | Y |
| 25 | `NO_CONTATO_AVALIACAO` | NVARCHAR2 | 60 | Y |
| 26 | `NU_DDD_AVALIACAO` | NVARCHAR2 | 3 | Y |
| 27 | `NU_TELEFONE_AVALIACAO` | NVARCHAR2 | 11 | Y |
| 28 | `NU_DDD_CELULAR_AVALIACAO` | NVARCHAR2 | 3 | Y |
| 29 | `NU_CELULAR_AVALIACAO` | NVARCHAR2 | 11 | Y |
| 30 | `IN_CONTATO_AVALIACAO` | NCHAR | 1 | Y |
| 31 | `NO_TIPO_CONTATO_AVALIACAO` | NVARCHAR2 | 40 | Y |
| 32 | `NO_PESSOA_CONTATO` | NCHAR | 20 | Y |
| 33 | `NU_DDD_PESSOA_CONTATO` | NVARCHAR2 | 3 | Y |
| 34 | `NU_TELEFONE_PESSOA_CONTATO` | NVARCHAR2 | 11 | Y |
| 35 | `NO_HORARIO_AVALIACAO` | NVARCHAR2 | 20 | Y |
| 36 | `TE_OBSERVACAO_AVALIACAO` | BLOB |  | Y |
| 37 | `NO_TABELIONATO` | NVARCHAR2 | 60 | Y |
| 38 | `NU_LIVRO_REGISTRO` | NVARCHAR2 | 30 | Y |
| 39 | `NU_FOLHAS_REGISTRO` | NVARCHAR2 | 30 | Y |
| 40 | `NO_COMPLEMENTO_ENDERECO` | NVARCHAR2 | 15 | Y |
| 41 | `VA_PUBLICACAO_LEILAO` | FLOAT | prec. 126 | Y |
| 42 | `NU_CEP` | NVARCHAR2 | 9 | Y |
| 43 | `TE_INSTRUMENTO_COMP_ANTERIOR` | BLOB |  | Y |
| 44 | `DT_INSTRUMENTO_COMP_ANTERIOR` | DATE |  | Y |
| 45 | `CO_FORMA_COMP_ANTERIOR` | NCHAR | 1 | Y |
| 46 | `TE_TABELIONATO_COMP_ANTERIOR` | BLOB |  | Y |
| 47 | `NO_LIVRO_COMP_ANTERIOR` | NVARCHAR2 | 30 | Y |
| 48 | `NO_FOLHAS_COMP_ANTERIOR` | NVARCHAR2 | 30 | Y |
| 49 | `TE_RGI_COMP_ANTERIOR` | BLOB |  | Y |
| 50 | `NO_MATRICULA_COMP_ANTERIOR` | NVARCHAR2 | 30 | Y |
| 51 | `NO_REG_AVERB_COMP_ANTERIOR` | NVARCHAR2 | 30 | Y |
| 52 | `DT_POSSE_COMP_ANTERIOR` | DATE |  | Y |
| 53 | `CO_EMPREENDIMENTO` | NUMBER | prec. 10 | Y |
| 54 | `CO_IMOVEL` | NVARCHAR2 | 10 | Y |
| 55 | `NO_IMOVEL_NOVO` | NCHAR | 1 | Y |
| 56 | `VA_TERRENO` | FLOAT | prec. 126 | Y |
| 57 | `NU_LAUDO_AVALIACAO` | NVARCHAR2 | 64 | Y |
| 58 | `CO_UF_CARTORIO_REGISTRO` | NCHAR | 2 | Y |
| 59 | `CO_MUNICIPIO_CARTORIO_REGISTRO` | NUMBER | prec. 10 | Y |
| 60 | `CO_NIVEL_LIQUIDEZ_GARANTIA` | NUMBER | prec. 10 | Y |
| 61 | `NU_IDADE_IMOVEL` | NUMBER | prec. 10 | Y |
| 62 | `IN_FOTO` | NCHAR | 1 | Y |
| 63 | `VA_AREA_AVERBADA` | FLOAT | prec. 126 | Y |
| 64 | `VA_AREA_NAO_AVERBADA` | FLOAT | prec. 126 | Y |
| 65 | `VA_AREA_IMOVEL` | FLOAT | prec. 126 | Y |
| 66 | `IN_VICIO_CONSTRUTIVO` | NCHAR | 1 | Y |
| 67 | `IN_VICIO_AFETA_IM` | NCHAR | 1 | Y |
| 68 | `IN_LOCAL_RISCO` | NCHAR | 1 | Y |
| 69 | `IN_ENQUADRADO` | NCHAR | 1 | Y |
| 70 | `IN_RESTRICAO_ENQUADRAMENTO` | NCHAR | 1 | Y |
| 71 | `CO_USUARIO_AVALIACAO` | NVARCHAR2 | 20 | Y |
| 72 | `DT_REGISTRO_AVALIACAO` | DATE |  | Y |
| 73 | `VA_AREA_CONSTRUIDA` | FLOAT | prec. 126 | Y |
| 74 | `CO_ENQUADRAMENTO_AVALIACAO` | NUMBER | prec. 10 | Y |
| 75 | `IN_TIPO_IMOVEL` | NVARCHAR2 | 1 | Y |
| 76 | `IN_USO_DO_IMOVEL` | NUMBER | prec. 10 | Y |
| 77 | `CO_TIPO_IMOVEL` | NUMBER | prec. 10 | Y |
| 78 | `CO_CARTORIO_REGISTRO` | NVARCHAR2 | 3 | Y |
| 79 | `NU_TESTADA` | FLOAT | prec. 126 | Y |
| 80 | `CO_IMPLANTACAO` | NUMBER | prec. 10 | Y |
| 81 | `CO_EST_CONSERV` | NUMBER | prec. 10 | Y |
| 82 | `CO_PADRAO_ACAB` | NUMBER | prec. 10 | Y |
| 83 | `CO_ESTR_SERV_CONDOM` | NUMBER | prec. 10 | Y |
| 84 | `CO_GRAU_HIPOTECA` | NCHAR | 1 | Y |
| 85 | `QT_QUARTOS` | NUMBER | prec. 10 | Y |
| 86 | `QT_VAGA_GARAGEM` | NUMBER | prec. 10 | Y |
| 87 | `DT_REGISTRO_AVERBACAO` | DATE |  | Y |
| 88 | `IN_MATRICULA_BOX_GARAGEM` | NCHAR | 1 | Y |
| 89 | `VA_AREA_PRIVATIVA` | FLOAT | prec. 126 | Y |
| 90 | `VA_AREA_TERRENO` | FLOAT | prec. 126 | Y |
| 91 | `DT_COMPRA_VENDA` | DATE |  | Y |
| 92 | `NU_BOX` | NUMBER | prec. 10 | Y |
| 93 | `NU_VAGA_GARAGEM` | NVARCHAR2 | 7 | Y |
| 94 | `IN_REGISTRADO` | NCHAR | 1 | Y |
| 95 | `CO_IMV_CLIENTE` | NUMBER | prec. 10 | Y |
| 96 | `NO_NOME_CORRETOR` | NVARCHAR2 | 40 | Y |
| 97 | `NU_NUM_CRECI` | NVARCHAR2 | 10 | Y |
| 98 | `NU_REGISTRO_COMP_ANTERIOR` | NVARCHAR2 | 20 | Y |
| 99 | `CO_CARTORIO_COMP_ANTERIOR` | NVARCHAR2 | 3 | Y |
| 100 | `TP_GARANTIA_COMP_ANTERIOR` | NUMBER | prec. 10 | Y |
| 101 | `NU_AVERBACAO_COMP_ANTERIOR` | NVARCHAR2 | 20 | Y |
| 102 | `IN_LIQUIDACAO_COMP_ANTERIOR` | NCHAR | 1 | Y |
| 103 | `IN_ALIENADO_PROPRIO` | NCHAR | 1 | Y |
| 104 | `VA_AREA_COMUM` | FLOAT | prec. 126 | Y |
| 105 | `VA_AREA_UTIL` | FLOAT | prec. 126 | Y |
| 106 | `VA_AREA_PRIVDESCOBERTA` | FLOAT | prec. 126 | Y |
| 107 | `VA_AREA_PRIVTERREO` | FLOAT | prec. 126 | Y |
| 108 | `VA_AREA_PAVSUPERIOR` | FLOAT | prec. 126 | Y |
| 109 | `VA_AREA_NEDIFICAVEL` | FLOAT | prec. 126 | Y |
| 110 | `VA_AREA_CONDOMINIO` | FLOAT | prec. 126 | Y |
| 111 | `VA_FRACAO_IDEAL` | FLOAT | prec. 126 | Y |
| 112 | `VA_FRACAO_IDEAL_GARAGEM` | FLOAT | prec. 126 | Y |
| 113 | `NU_ANDAR` | NVARCHAR2 | 5 | Y |
| 114 | `CO_TIPOGARAGEM` | NUMBER | prec. 10 | Y |
| 115 | `NU_AVERB_PATRIM_AFETACAO` | NVARCHAR2 | 15 | Y |
| 116 | `IN_CONDOMINIO` | NCHAR | 1 | Y |
| 117 | `NO_TITULO_AQUISITIVO` | NVARCHAR2 | 30 | Y |
| 118 | `CO_STATUS_AVALIACAO` | NUMBER | prec. 10 | Y |
| 119 | `CO_UF_CARTORIO_NOTAS` | NCHAR | 2 | Y |
| 120 | `CO_MUNICIPIO_CARTORIO_NOTAS` | NUMBER | prec. 10 | Y |
| 121 | `CO_CARTORIO_NOTAS` | NVARCHAR2 | 3 | Y |
| 122 | `NO_SITUACAO_AVERBACAO` | NVARCHAR2 | 30 | Y |
| 123 | `NU_APTO` | NVARCHAR2 | 7 | Y |
| 124 | `NO_BLOCO` | NVARCHAR2 | 7 | Y |
| 125 | `VA_AVALIACAO_AREA_AVERBADA` | FLOAT | prec. 126 | Y |
| 126 | `IN_TIPO_AVALIACAO` | NUMBER | prec. 10 | Y |
| 127 | `CO_ID_AVALIACAO` | NVARCHAR2 | 64 | Y |
| 128 | `CO_ID_VISTORIA` | NVARCHAR2 | 64 | Y |
| 129 | `IN_TIPO_REGIAO_IMOVEL` | NVARCHAR2 | 1 | Y |
| 130 | `CO_CADASTRO_CAR` | NVARCHAR2 | 50 | Y |
| 131 | `CO_CERTIFICADO_CCIR` | NVARCHAR2 | 13 | Y |
| 132 | `CO_CADASTRO_CIB` | NVARCHAR2 | 9 | Y |
| 133 | `CO_SITUACAO_GARANTIA` | NUMBER | prec. 10 | Y |
| 134 | `CO_CONDICAO_IMOVEL` | NUMBER | prec. 10 | Y |
| 135 | `NU_VIDA_UTIL_REMANESC` | NUMBER | prec. 10 | Y |
| 136 | `PE_IMOVEL_MADEIRA` | FLOAT | prec. 126 | Y |
| 137 | `NO_PREDIO` | NVARCHAR2 | 5 | Y |
| 138 | `NO_QUADRA` | NVARCHAR2 | 5 | Y |
| 139 | `NO_LOTE` | NVARCHAR2 | 5 | Y |
| 140 | `NO_PAVIMENTO` | NVARCHAR2 | 5 | Y |
| 141 | `NO_LAMINA` | NVARCHAR2 | 5 | Y |
| 142 | `NO_ESCADA` | NVARCHAR2 | 5 | Y |
| 143 | `CO_REGIONAL` | NVARCHAR2 | 3 | Y |
| 144 | `CO_REGIONAL_DAH` | NVARCHAR2 | 3 | Y |
| 145 | `NO_ENDERECO_COMPLETO` | NVARCHAR2 | 200 | Y |

### OPERACAO_CREDITO

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `NU_OPERACAO` | NUMBER | prec. 10 | N |
| 2 | `CO_TIPO_OPERACAO` | NCHAR | 3 | Y |
| 3 | `NU_FASE_ATUAL` | NUMBER | prec. 10 | Y |
| 4 | `CO_CORRETOR` | NVARCHAR2 | 20 | Y |
| 5 | `COD_ENT_CORRETAGEM` | NUMBER | prec. 10 | Y |
| 6 | `CO_UNIDADE_CORRETAGEM` | NVARCHAR2 | 5 | Y |
| 7 | `NU_PRETENDENTE` | NVARCHAR2 | 9 | N |
| 8 | `COD_ENT_SUPERVISOR` | NUMBER | prec. 10 | Y |
| 9 | `DT_CADASTRAMENTO_OPERACAO` | DATE |  | Y |
| 10 | `CO_USUARIO_CADASTRAMENTO` | NVARCHAR2 | 20 | Y |
| 11 | `DT_FASE_ATUAL` | DATE |  | Y |
| 12 | `VA_OPERACAO` | FLOAT | prec. 126 | Y |
| 13 | `IN_PESSOA_FISICA_JURIDICA` | NCHAR | 1 | Y |
| 14 | `DT_REFERENCIA_CALCULO` | DATE |  | Y |
| 15 | `NU_PRAZO_MESES_OPERACAO` | NUMBER | prec. 10 | Y |
| 16 | `CO_SISTEMA_AMORTIZACAO` | NUMBER | prec. 10 | Y |
| 17 | `IN_DESPESA_CERTIDAO` | NCHAR | 1 | Y |
| 18 | `IN_DESPESA_ITBI` | NCHAR | 1 | Y |
| 19 | `IN_DESPESA_REGISTRO` | NCHAR | 1 | Y |
| 20 | `IN_AVALIACAO_IMOVEL` | NCHAR | 1 | Y |
| 21 | `IN_ESTRUTURACAO_OPERACAO` | NCHAR | 1 | Y |
| 22 | `VA_TAXA_JUROS_ANUAL` | FLOAT | prec. 126 | Y |
| 23 | `VA_DESPESAS` | FLOAT | prec. 126 | Y |
| 24 | `VA_OPERACAO_PRETENDIDA` | FLOAT | prec. 126 | Y |
| 25 | `VA_ENTRADA` | FLOAT | prec. 126 | Y |
| 26 | `VA_FGTS` | FLOAT | prec. 126 | Y |
| 27 | `VA_PRECO_IMOVEL` | FLOAT | prec. 126 | Y |
| 28 | `VA_IOF` | FLOAT | prec. 126 | Y |
| 29 | `VA_LIBERADO` | FLOAT | prec. 126 | Y |
| 30 | `PE_CUSTO_EFETIVO_TOTAL` | FLOAT | prec. 126 | Y |
| 31 | `VA_AMAISJ_1A_PRESTACAO` | FLOAT | prec. 126 | Y |
| 32 | `PE_MIP` | FLOAT | prec. 126 | Y |
| 33 | `PE_DFI` | FLOAT | prec. 126 | Y |
| 34 | `VA_TARIFA_ADMINISTRACAO` | FLOAT | prec. 126 | Y |
| 35 | `NU_DIA_VENCIMENTO_PRESTACAO` | NUMBER | prec. 10 | Y |
| 36 | `DT_VENCIMENTO_PRESTACAO_1` | DATE |  | Y |
| 37 | `PE_JUROS_MORA_MENSAL` | FLOAT | prec. 126 | Y |
| 38 | `PE_MULTA_CONTRATUAL` | FLOAT | prec. 126 | Y |
| 39 | `VA_INDICE_MES_ANTES_ASSINATURA` | FLOAT | prec. 126 | Y |
| 40 | `VA_INDICE_MES_ANTES_PAGAMENTO` | FLOAT | prec. 126 | Y |
| 41 | `CO_INDICE_REAJUSTE_CTR` | NUMBER | prec. 10 | Y |
| 42 | `CO_INDICE_REAJUSTE_SUBSTITUTO` | NUMBER | prec. 10 | Y |
| 43 | `VA_MIP` | FLOAT | prec. 126 | Y |
| 44 | `VA_DFI` | FLOAT | prec. 126 | Y |
| 45 | `VA_TOT_PREMIOS_SEG` | FLOAT | prec. 126 | Y |
| 46 | `NU_PRESTACAO` | NUMBER | prec. 10 | Y |
| 47 | `PE_TX_NOM_JUROS` | FLOAT | prec. 126 | Y |
| 48 | `PE_TX_EFET_JUROS` | FLOAT | prec. 126 | Y |
| 49 | `VA_TOT_PARC_MENSAIS` | FLOAT | prec. 126 | Y |
| 50 | `NU_PRAZO_CCI` | NUMBER | prec. 10 | Y |
| 51 | `VA_VALOR_EMI_CCI` | FLOAT | prec. 126 | Y |
| 52 | `VA_TAR_ESTRUT_OPER` | FLOAT | prec. 126 | Y |
| 53 | `PE_CRED_CCI` | FLOAT | prec. 126 | Y |
| 54 | `NU_CCI` | NVARCHAR2 | 20 | Y |
| 55 | `NU_SERIE_CCI` | NVARCHAR2 | 20 | Y |
| 56 | `VA_FINANCIAMENTO` | FLOAT | prec. 126 | Y |
| 57 | `TE_PENDENCIA_OPERACAO` | BLOB |  | Y |
| 58 | `DT_PENDENCIA_OPERACAO` | DATE |  | Y |
| 59 | `NO_DOC_MODELO` | NVARCHAR2 | 80 | Y |
| 60 | `ID` | NUMBER | prec. 10 | Y |
| 61 | `DT_CANCELAMENTO` | DATE |  | Y |
| 62 | `TE_CANCELAMENTO` | BLOB |  | Y |
| 63 | `CO_USUARIO_CANCELAMENTO` | NVARCHAR2 | 20 | Y |
| 64 | `CO_AVALIADOR` | NUMBER | prec. 10 | Y |
| 65 | `DT_PEDIDO_AVALIACAO` | DATE |  | Y |
| 66 | `TE_PEDIDO_AVALIACAO` | BLOB |  | Y |
| 67 | `VA_TAXA_FLAT_CESSAO` | FLOAT | prec. 126 | Y |
| 68 | `VA_TAXA_JUROS_CESSAO` | FLOAT | prec. 126 | Y |
| 69 | `CO_CESSIONARIO_CREDITO` | NUMBER | prec. 10 | Y |
| 70 | `DT_CESSAO_CREDITO` | DATE |  | Y |
| 71 | `DT_LIQ_PAGAMENTO_CESSAO` | DATE |  | Y |
| 72 | `VA_CESSAO_CREDITO` | FLOAT | prec. 126 | Y |
| 73 | `CO_USUARIO_PARECER_TECNICO` | NVARCHAR2 | 20 | Y |
| 74 | `CO_USUARIO_PARECER_JURIDICO` | NVARCHAR2 | 20 | Y |
| 75 | `DT_PARECER_TECNICO_CREDITO` | DATE |  | Y |
| 76 | `TE_PARECER_TECNICO` | BLOB |  | Y |
| 77 | `DT_PARECER_JURIDICO` | DATE |  | Y |
| 78 | `TE_PARECER_JURIDICO` | BLOB |  | Y |
| 79 | `DT_PARECER_REGISTRO` | DATE |  | Y |
| 80 | `TE_PARECER_REGISTRO` | BLOB |  | Y |
| 81 | `CO_USUARIO_REGISTRO` | NVARCHAR2 | 20 | Y |
| 82 | `TE_PARECER_DADOS_AUX_RENDA` | BLOB |  | Y |
| 83 | `TE_PARECER_RENDA_FAMILIAR` | BLOB |  | Y |
| 84 | `TE_PARECER_ENQUADRAMENTO` | BLOB |  | Y |
| 85 | `TE_PARECER_INFORMACOES` | BLOB |  | Y |
| 86 | `DT_PAGTO_TARIFA_AVALIACAO` | DATE |  | Y |
| 87 | `DT_PAGTO_NF_AVALIADOR` | DATE |  | Y |
| 88 | `DT_LIQUIDACAO_CESSAO` | DATE |  | Y |
| 89 | `DT_LIBERACAO_RECURSO_CLIENTE` | DATE |  | Y |
| 90 | `DT_AVALIACAO_IMOVEL` | DATE |  | Y |
| 91 | `DT_ENVIO_CB_CONTRATO` | DATE |  | Y |
| 92 | `DT_ENVIO_CERTIDAO_RGI` | DATE |  | Y |
| 93 | `DT_ENVIO_CTO_ASSINADO` | DATE |  | Y |
| 94 | `DT_ENVIO_DOSSIE_PRELIMINAR` | DATE |  | Y |
| 95 | `DT_ENVIO_TCC` | DATE |  | Y |
| 96 | `DT_VENCTO_NF_AVALIADOR` | DATE |  | Y |
| 97 | `VA_AREA_IMOVEL_AVALIACAO` | FLOAT | prec. 126 | Y |
| 98 | `NU_CREA_ENGENHEIRO_AVALIADOR` | NVARCHAR2 | 40 | Y |
| 99 | `NU_NF_AVALIADOR` | NVARCHAR2 | 20 | Y |
| 100 | `NO_ENGENHEIRO_AVALIACAO` | NVARCHAR2 | 40 | Y |
| 101 | `TE_MOTIVO_REJEICAO` | BLOB |  | Y |
| 102 | `TE_APROVA_EMISSAO_CTR` | BLOB |  | Y |
| 103 | `VA_CREDITO_PROPONENTE` | FLOAT | prec. 126 | Y |
| 104 | `VA_CREDITO_VENDEDOR` | FLOAT | prec. 126 | Y |
| 105 | `VA_CUSTO_AVALIACAO` | FLOAT | prec. 126 | Y |
| 106 | `VA_IMOVEL_LIQUIDEZ` | FLOAT | prec. 126 | Y |
| 107 | `VA_IMOVEL_MERCADO` | FLOAT | prec. 126 | Y |
| 108 | `VA_DESPESAS_COM_CERTIDOES` | FLOAT | prec. 126 | Y |
| 109 | `VA_ITBI` | FLOAT | prec. 126 | Y |
| 110 | `VA_DESPESAS_COM_REGISTRO` | FLOAT | prec. 126 | Y |
| 111 | `VA_TARIFA_AVALIACAO_IMOVEL` | FLOAT | prec. 126 | Y |
| 112 | `VA_LIQ_LIB_VEND_E_FINANCIADO` | FLOAT | prec. 126 | Y |
| 113 | `PE_JUROS` | FLOAT | prec. 126 | Y |
| 114 | `DT_PRIMEIRO_ANIV_CTR` | DATE |  | Y |
| 115 | `VA_CM_PRORATA_VENDEDOR` | FLOAT | prec. 126 | Y |
| 116 | `CO_SUPERVISOR` | NVARCHAR2 | 20 | Y |
| 117 | `VA_REMUNERACAO_CB` | FLOAT | prec. 126 | Y |
| 118 | `VA_REMUNERACAO_SUPERVISOR` | FLOAT | prec. 126 | Y |
| 119 | `VA_SALDO_DEV_DT_CESSAO` | FLOAT | prec. 126 | Y |
| 120 | `VA_REMUNERACAO_CESSIONARIO` | FLOAT | prec. 126 | Y |
| 121 | `VA_NA_VENDA_AGIO_DESAGIO` | FLOAT | prec. 126 | Y |
| 122 | `VA_GLOBAL_VENDA_CREDITO` | FLOAT | prec. 126 | Y |
| 123 | `VA_CM_PRORATA_CESSAO` | FLOAT | prec. 126 | Y |
| 124 | `VA_CESSAO_RECEBIDA` | FLOAT | prec. 126 | Y |
| 125 | `VA_REMUNERACAO_AUDITOR` | FLOAT | prec. 126 | Y |
| 126 | `DT_ANALISE_REGISTRO_AUDITOR` | DATE |  | Y |
| 127 | `CO_TIPO_CCI` | NUMBER | prec. 10 | Y |
| 128 | `CO_INDICE_REAJUSTE_SUBST2` | NUMBER | prec. 10 | Y |
| 129 | `PE_CM_PRORATA_PROPONENTE` | FLOAT | prec. 126 | Y |
| 130 | `PE_JUROS_PRORATA_PROPONENTE` | FLOAT | prec. 126 | Y |
| 131 | `VA_LIQ_LIB_PROPONENTE` | FLOAT | prec. 126 | Y |
| 132 | `CO_STATUS_CREDITO_AUDITOR` | NCHAR | 3 | Y |
| 133 | `CO_STATUS_REGISTRO_AUDITOR` | NCHAR | 3 | Y |
| 134 | `CO_ENT_AUDITOR_CREDITO` | NUMBER | prec. 10 | Y |
| 135 | `NO_DESPACHANTE` | NVARCHAR2 | 40 | Y |
| 136 | `NO_AGENTE_FIDUCIARIO` | NVARCHAR2 | 40 | Y |
| 137 | `VA_REMUNERACAO_DESPACHANTE` | FLOAT | prec. 126 | Y |
| 138 | `VA_REMUNERACAO_AG_FIDUCIARIO` | FLOAT | prec. 126 | Y |
| 139 | `VA_REMUNERACAO_AVALIADOR` | FLOAT | prec. 126 | Y |
| 140 | `VA_LIQ_LIB_VENDEDOR` | FLOAT | prec. 126 | Y |
| 141 | `DT_ANALISE_CREDITO_AUDITOR` | DATE |  | Y |
| 142 | `TE_PARECER_CREDITO_AUDITOR` | BLOB |  | Y |
| 143 | `TE_PARECER_REGISTRO_AUDITOR` | BLOB |  | Y |
| 144 | `VA_JUROS_PRIMEIRO_MES` | FLOAT | prec. 126 | Y |
| 145 | `VA_CM_PRIMEIRO_MES` | FLOAT | prec. 126 | Y |
| 146 | `DT_ASSINATURA_CTO_ORIGINADOR` | DATE |  | Y |
| 147 | `DT_CARENCIA_JUROS` | DATE |  | Y |
| 148 | `VA_CM_PRORATA_PROPONENTE` | FLOAT | prec. 126 | Y |
| 149 | `VA_JUROS_PRORATA_PROPONENTE` | FLOAT | prec. 126 | Y |
| 150 | `VA_JUROS_PRORATA_VENDEDOR` | FLOAT | prec. 126 | Y |
| 151 | `CO_PADRAO_CTR` | NVARCHAR2 | 11 | Y |
| 152 | `CO_TIPO_SERIE` | NUMBER | prec. 10 | Y |
| 153 | `CO_CONTRATO_SCCI` | NVARCHAR2 | 17 | Y |
| 154 | `CO_SEGURADORA` | NUMBER | prec. 10 | Y |
| 155 | `CO_SEGURADORA_DFI` | NUMBER | prec. 10 | Y |
| 156 | `CO_APOLICE` | NVARCHAR2 | 15 | Y |
| 157 | `CO_APOLICE_DFI` | NVARCHAR2 | 15 | Y |
| 158 | `DT_INICIO_COBRANCA_SEGURO` | DATE |  | Y |
| 159 | `DT_ASSIN_PROPOSTA_SEGURO` | DATE |  | Y |
| 160 | `CO_TESTEMUNHA1` | NUMBER | prec. 10 | Y |
| 161 | `CO_TESTEMUNHA2` | NUMBER | prec. 10 | Y |
| 162 | `VA_JUROS_PRORATA_CESSAO` | FLOAT | prec. 126 | Y |
| 163 | `CO_CONVENIO` | NUMBER | prec. 10 | Y |
| 164 | `CO_CONVENIO_CORRETOR` | NVARCHAR2 | 20 | Y |
| 165 | `VA_JUROS_PRORATA_LIBERADO` | FLOAT | prec. 126 | Y |
| 166 | `DT_FIM_CONSTRUCAO` | DATE |  | Y |
| 167 | `VA_RENDA_FAMILIAR` | FLOAT | prec. 126 | Y |
| 168 | `IN_BONUS_FUNDING_FGTS` | NCHAR | 1 | Y |
| 169 | `IN_IMOVEL_NA_LOCALIDADE` | NCHAR | 1 | Y |
| 170 | `NO_LOCALIDADE` | NVARCHAR2 | 80 | Y |
| 171 | `IN_USOU_SUBSIDIO` | NCHAR | 1 | Y |
| 172 | `CO_CONCLUSAO_PARECER_CREDITO` | NCHAR | 1 | Y |
| 173 | `CO_CONCLUSAO_PARECER_JURIDICO` | NCHAR | 1 | Y |
| 174 | `VA_EFETIVAMENTE_LIBERADO` | FLOAT | prec. 126 | Y |
| 175 | `IN_COMISSIONAMENTO` | NCHAR | 1 | Y |
| 176 | `CO_ENQUADRAMENTO` | NUMBER | prec. 10 | Y |
| 177 | `IN_PORTABILIDADE` | NCHAR | 1 | Y |
| 178 | `VA_INTERVENIENTE` | FLOAT | prec. 126 | Y |
| 179 | `VA_FGTS_INTERVENIENTE` | FLOAT | prec. 126 | Y |
| 180 | `VA_ACOMPANHAMENTO_OPERACAO` | FLOAT | prec. 126 | Y |
| 181 | `VA_TX_CAD_PJ` | FLOAT | prec. 126 | Y |
| 182 | `VA_TX_CAD_PF` | FLOAT | prec. 126 | Y |
| 183 | `IN_ACOMPANHAMENTO_OPERACAO` | NCHAR | 1 | Y |
| 184 | `IN_TX_CAD_PJ` | NCHAR | 1 | Y |
| 185 | `IN_TX_CAD_PF` | NCHAR | 1 | Y |
| 186 | `IN_IOF_AVISTA` | NCHAR | 1 | Y |
| 187 | `NO_OPERADOR` | NVARCHAR2 | 40 | Y |
| 188 | `NU_CPF` | NVARCHAR2 | 14 | Y |
| 189 | `NO_CERTIFICADORA` | NVARCHAR2 | 40 | Y |
| 190 | `NO_TIPO_CERTIFICACAO` | NVARCHAR2 | 30 | Y |
| 191 | `NO_NUMERO_CERTIFICACAO` | NVARCHAR2 | 20 | Y |
| 192 | `DT_CREDITO_FGTS` | DATE |  | Y |
| 193 | `TE_SERIES_OPERACAO` | BLOB |  | Y |
| 194 | `DT_REPASSE_FINANCIAMENTO` | DATE |  | Y |
| 195 | `VA_REPASSE_FNANCIAMENTO` | FLOAT | prec. 126 | Y |
| 196 | `CO_USUARIO_APROVACAO` | NVARCHAR2 | 20 | Y |
| 197 | `DT_APROVACAO` | DATE |  | Y |
| 198 | `PE_DESCONTO_APROVADO` | FLOAT | prec. 126 | Y |
| 199 | `IN_REFIN` | NCHAR | 1 | Y |
| 200 | `CO_RISCO_CONSULTA_EXTERNA` | NUMBER | prec. 10 | Y |
| 201 | `TE_OBSERVACAO_AB_ENDIVIDAMENTO` | BLOB |  | Y |
| 202 | `VA_AVALIACAO_ORIGINAL` | FLOAT | prec. 126 | Y |
| 203 | `VA_ORCAMENTO_CONSTRUCAO` | FLOAT | prec. 126 | Y |
| 204 | `VA_GLOBAL_VENDAS` | FLOAT | prec. 126 | Y |
| 205 | `NU_MESES_PRAZO_CONSTRUCAO` | NUMBER | prec. 10 | Y |
| 206 | `NU_MESES_CARENCIA_AMORTIZACAO` | NUMBER | prec. 10 | Y |
| 207 | `QT_UNIDADES_EMPREENDIMENTO` | NUMBER | prec. 10 | Y |
| 208 | `PE_VENDAS_REALIZADAS` | FLOAT | prec. 126 | Y |
| 209 | `PE_EXECUCAO_CONSTRUCAO` | FLOAT | prec. 126 | Y |
| 210 | `NO_EMPREENDIMENTO` | NVARCHAR2 | 40 | Y |
| 211 | `CO_CONJUNTO_AQUISICAO` | NVARCHAR2 | 7 | Y |
| 212 | `CO_OPERACAO_AQUISICAO` | NUMBER | prec. 10 | Y |
| 213 | `IN_SIMPLESNACIONAL` | NVARCHAR2 | 1 | Y |
| 214 | `VA_SALDO_REFIN` | FLOAT | prec. 126 | Y |
| 215 | `DT_SALDO_REFIN` | DATE |  | Y |
| 216 | `VA_TXJUR_REFIN` | FLOAT | prec. 126 | Y |
| 217 | `NU_PRAZO_REM_REFIN` | NUMBER | prec. 10 | Y |
| 218 | `IN_ATACADO_VAREJO` | NCHAR | 1 | Y |
| 219 | `CO_ATENDENTE` | NVARCHAR2 | 20 | Y |
| 220 | `CO_PLANO` | NUMBER | prec. 10 | Y |
| 221 | `NU_PERREPAC` | NUMBER | prec. 10 | Y |
| 222 | `NU_PRIMREPAC` | NUMBER | prec. 10 | Y |
| 223 | `VA_PERCFIA` | FLOAT | prec. 126 | Y |
| 224 | `IN_TEM_IOF` | NCHAR | 1 | Y |
| 225 | `VA_CALC_DIF_JUROS` | FLOAT | prec. 126 | Y |
| 226 | `VA_DIFERENCIAL_JUROS` | FLOAT | prec. 126 | Y |
| 227 | `VA_TAXA` | FLOAT | prec. 126 | Y |
| 228 | `TE_QUALIFIC_COMPRADORES` | BLOB |  | Y |
| 229 | `TE_QUALIFIC_VENDEDORES` | BLOB |  | Y |
| 230 | `TE_QUALIFIC_INTERVENIENTE` | BLOB |  | Y |
| 231 | `TE_OBSERVACOES` | BLOB |  | Y |
| 232 | `TE_OBSERVACOES_1` | BLOB |  | Y |
| 233 | `TE_OBSERVACOES_2` | BLOB |  | Y |
| 234 | `TE_OBSERVACOES_3` | BLOB |  | Y |
| 235 | `TE_OBSERVACOES_4` | BLOB |  | Y |
| 236 | `TP_GARANTIA` | NUMBER | prec. 10 | Y |
| 237 | `VA_TAR_ENG_AVAL_GAR` | FLOAT | prec. 126 | Y |
| 238 | `NU_CTRVELHO` | NVARCHAR2 | 17 | Y |
| 239 | `COD_ENT_SUPERIOR_1` | NUMBER | prec. 10 | Y |
| 240 | `COD_ENT_SUPERIOR_2` | NUMBER | prec. 10 | Y |
| 241 | `VA_SEGURO_RCC` | FLOAT | prec. 126 | Y |
| 242 | `IN_BLOQUEIA_PAGAMENTO` | NCHAR | 1 | Y |
| 243 | `NU_CTRVELHO_REFIN` | NVARCHAR2 | 17 | Y |
| 244 | `CO_CONTRATO_REFIN` | NVARCHAR2 | 17 | Y |
| 245 | `DT_EXPIRACAO_APROVACAO` | DATE |  | Y |
| 246 | `CO_DESCONTO` | NVARCHAR2 | 20 | Y |
| 247 | `PE_GARANTIA_SOBRE_VENDAS` | FLOAT | prec. 126 | Y |
| 248 | `VA_GARANTIA_FIADOR` | FLOAT | prec. 126 | Y |
| 249 | `VA_TAXA_JUROS_RETORNO` | FLOAT | prec. 126 | Y |
| 250 | `TE_PARECER_CREDITO` | BLOB |  | Y |
| 251 | `CO_CONCLUSAO_CREDITO` | NUMBER | prec. 10 | Y |
| 252 | `CO_RISCO_CREDITO` | NUMBER | prec. 10 | Y |
| 253 | `CO_USUARIO_PARECER_CREDITO` | NVARCHAR2 | 20 | Y |
| 254 | `DT_PARECER_CREDITO` | DATE |  | Y |
| 255 | `TE_QUALIFIC_CONSTRUTOR` | BLOB |  | Y |
| 256 | `TE_QUALIFIC_FIADORES` | BLOB |  | Y |
| 257 | `TE_QUALIFIC_EMPREENDIMENTO` | BLOB |  | Y |
| 258 | `TE_QUALIFIC_REGULAR_FISCAL` | BLOB |  | Y |
| 259 | `CO_NIVEL_VIABILIDADE_PROJETO` | NUMBER | prec. 10 | Y |
| 260 | `NO_REGIME_CONSTRUCAO` | NVARCHAR2 | 30 | Y |
| 261 | `NO_FINALIDADE_CONSTRUCAO` | NVARCHAR2 | 30 | Y |
| 262 | `QT_BLOCOS_EMPREENDIMENTO` | NUMBER | prec. 10 | Y |
| 263 | `QT_VAGA_AUTONOMA_EMPREEND` | NUMBER | prec. 10 | Y |
| 264 | `DT_LANCAMENTO_EMPREENDIMENTO` | DATE |  | Y |
| 265 | `DT_INICIO_CONSTRUCAO` | DATE |  | Y |
| 266 | `IN_SALDO_RESIDUAL` | NCHAR | 1 | Y |
| 267 | `NO_TIPO_CONSTRUCAO` | NVARCHAR2 | 30 | Y |
| 268 | `DT_VENCIMENTO_ATUAL_REFIN` | DATE |  | Y |
| 269 | `VA_TOTPREST_REFIN` | FLOAT | prec. 126 | Y |
| 270 | `CO_MOTIVO_EMPRESTIMO` | NUMBER | prec. 10 | Y |
| 271 | `TE_OBS_MOTIVO_EMPRESTIMO` | BLOB |  | Y |
| 272 | `VA_SEGURO_AVISTA` | FLOAT | prec. 126 | Y |
| 273 | `VA_ALIQUOTA_SEGURO_AVISTA` | FLOAT | prec. 126 | Y |
| 274 | `VA_MARGEM_CONSIGNADA` | FLOAT | prec. 126 | Y |
| 275 | `CO_MARGEM_CONSIGNADA` | NVARCHAR2 | 30 | Y |
| 276 | `IN_CONSIDERA_HOLERITE` | NCHAR | 1 | Y |
| 277 | `IN_CONSIDERA_EXTRATO` | NCHAR | 1 | Y |
| 278 | `IN_CONSIDERA_IR` | NCHAR | 1 | Y |
| 279 | `IN_CONSIDERA_OUTRAS_RENDA` | NCHAR | 1 | Y |
| 280 | `IN_CONSIDERA_FATURAMENTO` | NCHAR | 1 | Y |
| 281 | `DT_SIMULACAO_OPERACAO` | DATE |  | Y |
| 282 | `VA_PARECER_OPERACAO` | FLOAT | prec. 126 | Y |
| 283 | `CO_RUBRICA` | NVARCHAR2 | 10 | Y |
| 284 | `NU_OPERACAO_PRINCIPAL` | NUMBER | prec. 10 | Y |
| 285 | `CO_GRUPO_TIPO_OPERACAO_SUBORD` | NCHAR | 3 | Y |
| 286 | `CO_ANALISTA_RESPONSAVEL` | NVARCHAR2 | 20 | Y |
| 287 | `IN_TEM_REEMBOLSO_DESPESAS` | NCHAR | 1 | Y |
| 288 | `VA_DEVOLUCAO_IOF` | FLOAT | prec. 126 | Y |
| 289 | `VA_DEVOLUCAO_SEG_PRESTAMISTA` | FLOAT | prec. 126 | Y |
| 290 | `CO_CARTEIRA` | NUMBER | prec. 10 | Y |
| 291 | `CO_RESTRITIVO_CREDITO` | NUMBER | prec. 10 | Y |
| 292 | `CO_ENDIVIDAMENTO_PRAZO` | NUMBER | prec. 10 | Y |
| 293 | `CO_ENDIVIDAMENTO_MODALIDADE` | NUMBER | prec. 10 | Y |
| 294 | `CO_HISTORICO_ENDIVIDAMENTO` | NUMBER | prec. 10 | Y |
| 295 | `CO_TIPO_RENDA_OPERACAO` | NUMBER | prec. 10 | Y |
| 296 | `CO_COOBRIGACAO` | NVARCHAR2 | 17 | Y |
| 297 | `VA_PREST_ATRASO_REFIN` | FLOAT | prec. 126 | Y |
| 298 | `NU_MAC_INICIAL_ATRASO_REFIN` | NUMBER | prec. 10 | Y |
| 299 | `NU_MAC_FINAL_ATRASO_REFIN` | NUMBER | prec. 10 | Y |
| 300 | `VA_PENDENCIA_ATRASO_REFIN` | FLOAT | prec. 126 | Y |
| 301 | `NU_CTR_SISTEMA_ANTIGO` | NVARCHAR2 | 17 | Y |
| 302 | `PE_DIF_JUROS_FGTS` | FLOAT | prec. 126 | Y |
| 303 | `VA_VISTORIA_LIBERACAO` | FLOAT | prec. 126 | Y |
| 304 | `VA_LIMITE_PRE_APROVADO` | FLOAT | prec. 126 | Y |
| 305 | `CO_LIMITE_PRE_APROVADO` | NVARCHAR2 | 3 | Y |
| 306 | `NU_PROPOSTA_EXTERNO` | NVARCHAR2 | 50 | Y |
| 307 | `VA_SEGURO_MIP_P0` | FLOAT | prec. 126 | Y |
| 308 | `VA_SEGURO_DFI_P0` | FLOAT | prec. 126 | Y |
| 309 | `CO_GRUPO_APOLICE_MISTA` | NUMBER | prec. 10 | Y |
| 310 | `CO_ENTIDADE_CADASTRAMENTO` | NUMBER | prec. 10 | Y |
| 311 | `IN_VENDA_PAI_PARA_FILHO` | NCHAR | 1 | Y |
| 312 | `IN_COMPRADOR_FILHO_UNICO` | NCHAR | 1 | Y |
| 313 | `IN_PRIMEIRO_IMOVEL_TODOS` | NCHAR | 1 | Y |
| 314 | `PE_CEM` | FLOAT | prec. 126 | Y |
| 315 | `PE_CESH` | FLOAT | prec. 126 | Y |
| 316 | `IN_SEM_GRUPO_APOLICE_MISTA` | NCHAR | 1 | Y |
| 317 | `CO_TIPO_REMUNERACAO` | NUMBER | prec. 10 | Y |
| 318 | `IN_FATOR_SOCIAL` | NCHAR | 1 | Y |
| 319 | `CO_FX_RENDA_SIM` | NUMBER | prec. 10 | Y |
| 320 | `CO_FX_RENDA_ANAL` | NUMBER | prec. 10 | Y |
| 321 | `PE_DESAGIO_SALDO_CESSAO` | FLOAT | prec. 126 | Y |
| 322 | `PE_TAR_ESTRUT_OPERACAO` | FLOAT | prec. 126 | Y |
| 323 | `IN_PRO_COTISTA` | NCHAR | 1 | Y |
| 324 | `IN_TIPO_CREDITO_DESPESAS` | NCHAR | 1 | Y |
| 325 | `NO_EMAIL_OPERADOR` | NVARCHAR2 | 80 | Y |
| 326 | `CO_SISTEMA_EXTERNO` | NVARCHAR2 | 10 | Y |
| 327 | `IN_TEM_DESC_SEGURO_MIP` | NCHAR | 1 | Y |
| 328 | `IN_TEM_DESC_SEGURO_DFI` | NCHAR | 1 | Y |
| 329 | `DT_TERMINO_DESC_MIP` | DATE |  | Y |
| 330 | `DT_TERMINO_DESC_DFI` | DATE |  | Y |
| 331 | `DT_VALIDADELIMITECRED` | DATE |  | Y |
| 332 | `NO_INSTRUMENTO_ORIGEM_IQ` | NVARCHAR2 | 30 | Y |
| 333 | `NO_PONTO_CORTE_OPERACAO` | NVARCHAR2 | 20 | Y |
| 334 | `NO_ENQUADRAMENTO_REGUA` | NVARCHAR2 | 20 | Y |
| 335 | `VA_PARCELA_PORTABILIDADE` | FLOAT | prec. 126 | Y |
| 336 | `VA_SEGURO_ENG` | FLOAT | prec. 126 | Y |
| 337 | `DT_SALDO_DEV_PORTABILIDADE` | DATE |  | Y |
| 338 | `IN_ALIQ_MIP_EXCECAO` | NCHAR | 1 | Y |
| 339 | `IN_ALIQ_DFI_EXCECAO` | NCHAR | 1 | Y |
| 340 | `PE_TX_NOM_JUROSSEMBONUS` | FLOAT | prec. 126 | Y |
| 341 | `PE_TX_EFET_JUROSSEMBONUS` | FLOAT | prec. 126 | Y |
| 342 | `VA_AMAISJ_1A_PRESTACAOSEMBONUS` | FLOAT | prec. 126 | Y |
| 343 | `VA_DFI_SEMBONUS` | FLOAT | prec. 126 | Y |
| 344 | `VA_MIP_SEMBONUS` | FLOAT | prec. 126 | Y |
| 345 | `PE_CUSTO_EFETIVO_TOTALSEMBONUS` | FLOAT | prec. 126 | Y |
| 346 | `PE_CESHSEMBONUS` | FLOAT | prec. 126 | Y |
| 347 | `VA_TOT_PREMIOS_SEGSEMBONUS` | FLOAT | prec. 126 | Y |
| 348 | `VA_SEGURO_MIP_P0SEMBONUS` | FLOAT | prec. 126 | Y |
| 349 | `VA_SEGURO_DFI_P0SEMBONUS` | FLOAT | prec. 126 | Y |
| 350 | `VA_DFI_AVISTA` | FLOAT | prec. 126 | Y |
| 351 | `NO_ESCREVENTE_REGISTRO` | NVARCHAR2 | 100 | Y |
| 352 | `NO_EMAIL_CARTORIO_REGISTRO` | NVARCHAR2 | 90 | Y |
| 353 | `NU_DDD_CARTORIO_REGISTRO` | NVARCHAR2 | 3 | Y |
| 354 | `NU_TELEFONE_CARTORIO_REGISTRO` | NVARCHAR2 | 9 | Y |
| 355 | `IN_CARENCIA_AMORTIZACAO` | NCHAR | 1 | Y |
| 356 | `IN_TIPO_JUROS_CARENCIA` | NUMBER | prec. 10 | Y |
| 357 | `NU_PRAZO_CARENCIA_AMAISJ` | NUMBER | prec. 10 | Y |
| 358 | `VA_AMAISJ_1A_PRSTSBONUS_POSCAR` | FLOAT | prec. 126 | Y |
| 359 | `VA_MIP_SEMBONUS_POSCAR` | FLOAT | prec. 126 | Y |
| 360 | `VA_DFI_SEMBONUS_POSCAR` | FLOAT | prec. 126 | Y |
| 361 | `VA_TOT_PREMIOS_SEMBONUS_POSCAR` | FLOAT | prec. 126 | Y |
| 362 | `VA_AMAISJ_1A_PREST_POSCAR` | FLOAT | prec. 126 | Y |
| 363 | `VA_SEG_MIP_POSCAR` | FLOAT | prec. 126 | Y |
| 364 | `VA_SEG_DFI_POSCAR` | FLOAT | prec. 126 | Y |
| 365 | `VA_TOT_SEG_POSCAR` | FLOAT | prec. 126 | Y |
| 366 | `QT_UNIDADES_VENDIDAS` | NUMBER | prec. 10 | Y |
| 367 | `REPRESENTANTE_LEGAL1` | NUMBER | prec. 10 | Y |
| 368 | `REPRESENTANTE_LEGAL2` | NUMBER | prec. 10 | Y |
| 369 | `IN_FINANCIA_TERRENO` | NCHAR | 1 | Y |
| 370 | `VA_FINANCIAMENTO_TERRENO` | FLOAT | prec. 126 | Y |
| 371 | `IN_DEMANDA_MINIMA` | NCHAR | 1 | Y |
| 372 | `PE_DEMANDA_MINIMA` | FLOAT | prec. 126 | Y |
| 373 | `VA_SUBSIDIO_FGTS` | FLOAT | prec. 126 | Y |
| 374 | `IN_BONUS_OPERACAO` | NCHAR | 1 | Y |
| 375 | `VA_PARECER_JURIDICO` | FLOAT | prec. 126 | Y |
| 376 | `NO_CERT_TRAB_PARECER_JUR` | NVARCHAR2 | 25 | Y |
| 377 | `NO_IRREG_TRAB_PARECER_JUR` | NVARCHAR2 | 25 | Y |
| 378 | `NO_CERT_FISCAIS_PARECER_JUR` | NVARCHAR2 | 25 | Y |
| 379 | `NO_IRREG_FISCAIS_PARECER_JUR` | NVARCHAR2 | 25 | Y |
| 380 | `VA_CERTIDOES_CONSIDERA` | FLOAT | prec. 126 | Y |
| 381 | `COD_ENT_CAPTADOR` | NUMBER | prec. 10 | Y |
| 382 | `TE_QUALIFICACAO_IQ` | BLOB |  | Y |
| 383 | `VA_BONUS` | FLOAT | prec. 126 | Y |
| 384 | `IN_PERMITE_DEBITO_CONTA` | NCHAR | 1 | Y |
| 385 | `IN_PERMITE_LIMITE_CREDITO` | NCHAR | 1 | Y |
| 386 | `IN_DEBITO_VENCIDO` | NCHAR | 1 | Y |
| 387 | `NU_SIMULACAO` | NUMBER | prec. 10 | Y |
| 388 | `NU_TIPO_PRIORIDADE` | NUMBER | prec. 10 | Y |
| 389 | `TE_PRIORIDADE` | BLOB |  | Y |
| 390 | `CO_TIPO_BONUS` | NVARCHAR2 | 3 | Y |
| 391 | `VA_FINANCIAMENTO_CONSTRUCAO` | FLOAT | prec. 126 | Y |
| 392 | `VA_JUROS_POSCAR` | FLOAT | prec. 126 | Y |
| 393 | `VA_JUROS_SEMBONUS_POSCAR` | FLOAT | prec. 126 | Y |
| 394 | `IN_IMOVEL_RETOMADA` | NCHAR | 1 | Y |
| 395 | `IN_VAFINANC_EXCEPCIONAL` | NCHAR | 1 | Y |
| 396 | `PE_TX_NOM_JUROSMINIMA` | FLOAT | prec. 126 | Y |
| 397 | `NU_VERSAO_PROPOSTA` | NUMBER | prec. 10 | Y |
| 398 | `VA_TOTAL_SEGURO_MIP` | FLOAT | prec. 126 | Y |
| 399 | `VA_TOTAL_SEGURO_DFI` | FLOAT | prec. 126 | Y |
| 400 | `VA_TOTAL_JUROS` | FLOAT | prec. 126 | Y |
| 401 | `DT_CADASTRO_EXTERNO` | DATE |  | Y |
| 402 | `IN_SEGURO_FORA_FX_CONTRATACAO` | NCHAR | 1 | Y |
| 403 | `NU_MES_PULA_PARCELA` | NUMBER | prec. 10 | Y |
| 404 | `VA_SUBSIDIO_ENTRADA` | FLOAT | prec. 126 | Y |
| 405 | `IN_ATIVOPROBLEMATICO` | NCHAR | 1 | Y |
| 406 | `IN_INIBE_DISPOSICAO_PARC` | NCHAR | 1 | Y |
| 407 | `VA_SUBSIDIO_EMENDA_FGTS` | FLOAT | prec. 126 | Y |
| 408 | `NU_LIMITE_SUBSIDIO` | NUMBER | prec. 10 | Y |
| 409 | `TE_EXIGENCIA_CARTORIO` | BLOB |  | Y |
| 410 | `CO_CONTRATO_ORIGINAL` | NVARCHAR2 | 17 | Y |
| 411 | `NU_CONTA_CONTABIL` | NUMBER | prec. 10 | Y |
| 412 | `VA_TAXA_JUROS_PRE_APROVADA` | FLOAT | prec. 126 | Y |
| 413 | `VA_SALDO_DEV_TOTAL` | FLOAT | prec. 126 | Y |
| 414 | `TIPO_PARAMETRIZACAO` | NCHAR | 1 | Y |
| 415 | `PE_LIMITE_PREST_RENDA` | FLOAT | prec. 126 | Y |
| 416 | `VA_TOP_UP` | FLOAT | prec. 126 | Y |
| 417 | `VA_AVALIACAO_TERRENO` | FLOAT | prec. 126 | Y |

### PESSOA_PRETENDENTE

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `NU_PRETENDENTE` | NVARCHAR2 | 9 | N |
| 2 | `NU_PESSOA` | NUMBER | prec. 10 | N |
| 3 | `NO_PESSOA` | NVARCHAR2 | 40 | Y |
| 4 | `NU_IDENTIDADE` | NVARCHAR2 | 15 | Y |
| 5 | `CO_UFIDENTIDADE` | NVARCHAR2 | 2 | Y |
| 6 | `NU_CPROF` | NVARCHAR2 | 7 | Y |
| 7 | `NO_SERCPROF` | NVARCHAR2 | 5 | Y |
| 8 | `NU_CPFCNPJ` | NVARCHAR2 | 14 | Y |
| 9 | `DT_NASCIMENTO` | DATE |  | Y |
| 10 | `NO_LOCALNASC` | NVARCHAR2 | 21 | Y |
| 11 | `CO_UFNASC` | NVARCHAR2 | 2 | Y |
| 12 | `NU_SEXO` | NUMBER | prec. 10 | Y |
| 13 | `NU_ESCOLARIDADE` | NUMBER | prec. 10 | Y |
| 14 | `NU_SITESCOLAR` | NUMBER | prec. 10 | Y |
| 15 | `CO_ESTCIV` | NUMBER | prec. 10 | Y |
| 16 | `CO_REGIME_CASAMENTO` | NUMBER | prec. 10 | Y |
| 17 | `CO_UFCPROF` | NVARCHAR2 | 2 | Y |
| 18 | `CO_PROFISSAO` | NUMBER | prec. 10 | Y |
| 19 | `CO_SIT_RENDA` | NUMBER | prec. 10 | Y |
| 20 | `CO_CATEGORIA` | NUMBER | prec. 10 | Y |
| 21 | `CO_SIT_EST_CIV` | NUMBER | prec. 10 | Y |
| 22 | `DT_CASAMENTO` | DATE |  | Y |
| 23 | `CO_NACIONALIDADE` | NUMBER | prec. 10 | Y |
| 24 | `NU_ORGAOV` | NVARCHAR2 | 9 | Y |
| 25 | `IN_EADQUIRENTE` | NCHAR | 1 | Y |
| 26 | `NO_TP_EXP_AGRO_1` | NVARCHAR2 | 21 | Y |
| 27 | `NO_TP_EXP_AGRO_2` | NVARCHAR2 | 21 | Y |
| 28 | `NO_TP_EXP_AGRO_3` | NVARCHAR2 | 21 | Y |
| 29 | `CO_SITUACAO_AGRO` | NUMBER | prec. 10 | Y |
| 30 | `DT_IDENTIDADE` | DATE |  | Y |
| 31 | `NU_PIS` | NVARCHAR2 | 15 | Y |
| 32 | `NO_ORGE` | NVARCHAR2 | 6 | Y |
| 33 | `NU_AGENCDV` | NVARCHAR2 | 1 | Y |
| 34 | `NU_OPER` | NUMBER | prec. 10 | Y |
| 35 | `NU_CTADV` | NVARCHAR2 | 2 | Y |
| 36 | `NO_PAI` | NVARCHAR2 | 41 | Y |
| 37 | `NO_MAE` | NVARCHAR2 | 41 | Y |
| 38 | `NU_CONJUGE` | NUMBER | prec. 10 | Y |
| 39 | `NU_CELULAR` | NVARCHAR2 | 11 | Y |
| 40 | `VA_SALDO_DISP_FGTS` | FLOAT | prec. 126 | Y |
| 41 | `DT_SALDO_FGTS` | DATE |  | Y |
| 42 | `VA_POUPANCA` | FLOAT | prec. 126 | Y |
| 43 | `VA_SALDO_POUPANCA` | FLOAT | prec. 126 | Y |
| 44 | `VA_OUT_APLICACAO` | FLOAT | prec. 126 | Y |
| 45 | `VA_SALDO_OUT_APLICACAO` | FLOAT | prec. 126 | Y |
| 46 | `IN_FISICA_JURIDICA` | NCHAR | 1 | Y |
| 47 | `VA_CREDIT_SCORE` | FLOAT | prec. 126 | Y |
| 48 | `DT_CONSULTA_SERASA` | DATE |  | Y |
| 49 | `NU_BANCO` | NUMBER | prec. 10 | Y |
| 50 | `NU_AGENCIA` | NVARCHAR2 | 20 | Y |
| 51 | `NU_CONTA_CORRENTE` | NVARCHAR2 | 20 | Y |
| 52 | `NO_ENDERECO` | NVARCHAR2 | 41 | Y |
| 53 | `NU_NUMERO` | NUMBER | prec. 10 | Y |
| 54 | `NO_COMPLEMENTO` | NVARCHAR2 | 15 | Y |
| 55 | `NU_DDD_RES` | NVARCHAR2 | 5 | Y |
| 56 | `NU_TELEFONE_RES` | NVARCHAR2 | 11 | Y |
| 57 | `NO_BAIRRO` | NVARCHAR2 | 21 | Y |
| 58 | `CO_UF` | NVARCHAR2 | 2 | Y |
| 59 | `NU_CEP` | NVARCHAR2 | 9 | Y |
| 60 | `PE_RENDA` | NUMBER | prec. 10 | Y |
| 61 | `VA_RENDA` | FLOAT | prec. 126 | Y |
| 62 | `CO_MUNIC_CATEG` | NUMBER | prec. 10 | Y |
| 63 | `NU_MDIS` | NUMBER | prec. 10 | Y |
| 64 | `DT_LEI_DIV` | DATE |  | Y |
| 65 | `CO_DISTRITO` | NUMBER | prec. 10 | Y |
| 66 | `CO_MUNICIPIO` | NUMBER | prec. 10 | Y |
| 67 | `NO_PONTOREF` | NVARCHAR2 | 31 | Y |
| 68 | `NO_ENDERECO_ABREV` | NVARCHAR2 | 3 | Y |
| 69 | `NU_DEPEND_SEM_RENDA` | NUMBER | prec. 10 | Y |
| 70 | `NU_DEPEND_RENDA_N_PARTE` | NUMBER | prec. 10 | Y |
| 71 | `VA_RENDA_LIQ_DEPEND` | FLOAT | prec. 126 | Y |
| 72 | `NU_TEMPO_RES_MUN` | NUMBER | prec. 10 | Y |
| 73 | `NU_TEMPO_RES_MUN_ANT` | NUMBER | prec. 10 | Y |
| 74 | `NO_EMAIL` | NVARCHAR2 | 80 | Y |
| 75 | `NU_TIT_ELE_NUM` | NVARCHAR2 | 14 | Y |
| 76 | `NU_TIT_ELE_ZONA` | NVARCHAR2 | 3 | Y |
| 77 | `NU_TIT_ELE_SECAO` | NVARCHAR2 | 4 | Y |
| 78 | `CO_TIPO_RG` | NUMBER | prec. 10 | Y |
| 79 | `NU_DDD_CEL` | NVARCHAR2 | 5 | Y |
| 80 | `IN_E_FIADOR` | NCHAR | 1 | Y |
| 81 | `IN_FGTS` | NUMBER | prec. 10 | Y |
| 82 | `CO_NAT_JURIDICA` | NUMBER | prec. 10 | Y |
| 83 | `NU_INSCRICAO_ESTADUAL` | NUMBER | prec. 10 | Y |
| 84 | `CO_NATUREZA_EMPRESA` | NUMBER | prec. 10 | Y |
| 85 | `IN_EMPRESA_TRIBUTAVEL` | NCHAR | 1 | Y |
| 86 | `IN_EMPRESA_COM_FINS_LUCRATIVOS` | NCHAR | 1 | Y |
| 87 | `NO_TIPO_LOGRADOURO` | NVARCHAR2 | 15 | Y |
| 88 | `NO_CIDADE` | NVARCHAR2 | 25 | Y |
| 89 | `NU_RAMAL` | NVARCHAR2 | 5 | Y |
| 90 | `NU_DDD_FAX` | NVARCHAR2 | 5 | Y |
| 91 | `NU_TELEFONE_FAX` | NVARCHAR2 | 11 | Y |
| 92 | `IN_DEFICIENTE` | NCHAR | 1 | Y |
| 93 | `NO_DESCR_DEFICIENCIA` | BLOB |  | Y |
| 94 | `CO_TIPO_RACA` | NUMBER | prec. 10 | Y |
| 95 | `CO_TIPO_NEGRO` | NUMBER | prec. 10 | Y |
| 96 | `NO_MOTIVO` | BLOB |  | Y |
| 97 | `IN_RES_OUTRA_OCUPACAO` | NCHAR | 1 | Y |
| 98 | `CO_TIPO_DEFICIENCIA` | NUMBER | prec. 10 | Y |
| 99 | `NO_DEFICIENTE` | NVARCHAR2 | 40 | Y |
| 100 | `NU_DEPENDENTES` | NUMBER | prec. 10 | Y |
| 101 | `NU_SETOR` | NUMBER | prec. 10 | Y |
| 102 | `NO_QUADRA` | NVARCHAR2 | 6 | Y |
| 103 | `NO_LOTE` | NVARCHAR2 | 4 | Y |
| 104 | `NO_EDIFICACAO` | NVARCHAR2 | 6 | Y |
| 105 | `NU_INSCR_ANTERIOR` | NUMBER | prec. 10 | Y |
| 106 | `NO_PROCEDENCIA` | BLOB |  | Y |
| 107 | `VA_TOTAL_BENEFICIO` | FLOAT | prec. 126 | Y |
| 108 | `CO_SIT_TRABALHO` | NUMBER | prec. 10 | Y |
| 109 | `IN_RECEBE_BENEFICIO_GOV` | NCHAR | 1 | Y |
| 110 | `NO_BENEFICIO` | NVARCHAR2 | 30 | Y |
| 111 | `IN_CADUNICO_GOVFED` | NCHAR | 1 | Y |
| 112 | `NU_CADUNICO_GOVFED` | NVARCHAR2 | 20 | Y |
| 113 | `IN_ENDERECO_CORRESPONDENCIA` | NCHAR | 1 | Y |
| 114 | `IN_TIPO_PESSOA` | NCHAR | 1 | Y |
| 115 | `IN_CARTAO_VISA` | NCHAR | 1 | Y |
| 116 | `IN_CARTAO_MASTERCARD` | NCHAR | 1 | Y |
| 117 | `IN_CARTAO_AMEX` | NCHAR | 1 | Y |
| 118 | `IN_OUTRO_CARTAO` | NCHAR | 1 | Y |
| 119 | `NO_OUTRO_CARTAO` | NVARCHAR2 | 40 | Y |
| 120 | `CO_ATIVIDADE_PROFISSIONAL` | NUMBER | prec. 10 | Y |
| 121 | `QT_FILHOS` | NUMBER | prec. 10 | Y |
| 122 | `NO_TITULAR_CONTA_CORRENTE` | NVARCHAR2 | 40 | Y |
| 123 | `CO_TIT_ELE_UF` | NCHAR | 2 | Y |
| 124 | `DT_OPCAO_FGTS` | DATE |  | Y |
| 125 | `IN_MARITAL` | NCHAR | 1 | Y |
| 126 | `DT_MARITAL` | DATE |  | Y |
| 127 | `NU_TELEFONE_COM` | NVARCHAR2 | 15 | Y |
| 128 | `NU_DDD_COM` | NVARCHAR2 | 5 | Y |
| 129 | `NO_FANTASIA` | NVARCHAR2 | 42 | Y |
| 130 | `NO_GRUPO` | NVARCHAR2 | 42 | Y |
| 131 | `DT_CONSTITUICAO` | DATE |  | Y |
| 132 | `VA_CAPITAL_SOCIAL` | FLOAT | prec. 126 | Y |
| 133 | `IN_CAPITAL_ABERTO` | NCHAR | 1 | Y |
| 134 | `CO_CONTROLE_ACIONARIO` | NVARCHAR2 | 1 | Y |
| 135 | `TE_FILIAIS` | BLOB |  | Y |
| 136 | `TE_SUCESSAO` | BLOB |  | Y |
| 137 | `NO_TITULAR_CONTA` | NVARCHAR2 | 42 | Y |
| 138 | `NU_PESSOA_PRINCIPAL` | NUMBER | prec. 10 | Y |
| 139 | `DT_PACTO_ANTENUPCIAL` | DATE |  | Y |
| 140 | `TE_TABELIONATO_PACTO` | BLOB |  | Y |
| 141 | `NO_LIVRO_PACTO` | NVARCHAR2 | 30 | Y |
| 142 | `NO_FOLHAS_PACTO` | NVARCHAR2 | 30 | Y |
| 143 | `TE_RGI_PACTO` | BLOB |  | Y |
| 144 | `NO_REGISTRO_AVERBACAO_PACTO` | NVARCHAR2 | 30 | Y |
| 145 | `NO_MATRICULA_PACTO` | NVARCHAR2 | 30 | Y |
| 146 | `NO_PAIS_EMISSOR_IDENTIDADE` | NVARCHAR2 | 50 | Y |
| 147 | `IN_EXERCEU_FUNCAO_PUBLICA` | NCHAR | 1 | Y |
| 148 | `NO_ORGAO_PUBLICO` | NVARCHAR2 | 50 | Y |
| 149 | `DT_INICIO_ORGAO_PUBLICO` | DATE |  | Y |
| 150 | `DT_FIM_ORGAO_PUBLICO` | DATE |  | Y |
| 151 | `IN_VINCULO_FUNCAO_PUBLICA` | NCHAR | 1 | Y |
| 152 | `IN_ESTRANGEIRO` | NCHAR | 1 | Y |
| 153 | `NO_PAIS_ESTRANGEIRO` | NVARCHAR2 | 50 | Y |
| 154 | `NO_ORGAO_ESTRANGEIRO` | NVARCHAR2 | 50 | Y |
| 155 | `NO_CARGO_ESTRANGEIRO` | NVARCHAR2 | 50 | Y |
| 156 | `DT_INICIO_EXER_ESTRANGEIRO` | DATE |  | Y |
| 157 | `DT_FIM_EXER_ESTRANGEIRO` | DATE |  | Y |
| 158 | `NO_RELACAO_ESTRANGEIRO` | NVARCHAR2 | 20 | Y |
| 159 | `NO_VINCULO_1` | NVARCHAR2 | 50 | Y |
| 160 | `NO_VINCULO_2` | NVARCHAR2 | 50 | Y |
| 161 | `NO_VINCULO_3` | NVARCHAR2 | 50 | Y |
| 162 | `NO_VINCULO_NOME_1` | NVARCHAR2 | 50 | Y |
| 163 | `NO_VINCULO_NOME_2` | NVARCHAR2 | 50 | Y |
| 164 | `NO_VINCULO_NOME_3` | NVARCHAR2 | 50 | Y |
| 165 | `NU_VINCULO_NOME_CPFCNPJ_1` | NVARCHAR2 | 14 | Y |
| 166 | `NU_VINCULO_NOME_CPFCNPJ_2` | NVARCHAR2 | 14 | Y |
| 167 | `NU_VINCULO_NOME_CPFCNPJ_3` | NVARCHAR2 | 14 | Y |
| 168 | `NO_VINCULO_ORGAO_PUBLICO_1` | NVARCHAR2 | 50 | Y |
| 169 | `NO_VINCULO_ORGAO_PUBLICO_2` | NVARCHAR2 | 50 | Y |
| 170 | `NO_VINCULO_ORGAO_PUBLICO_3` | NVARCHAR2 | 50 | Y |
| 171 | `TE_DECLARACAO_ORIGEM_RECURSO` | BLOB |  | Y |
| 172 | `TE_DECLARACAO_NEGOCIO` | BLOB |  | Y |
| 173 | `NU_DDD_REC` | NVARCHAR2 | 5 | Y |
| 174 | `NU_TELEFONE_REC` | NVARCHAR2 | 11 | Y |
| 175 | `NU_INFORMACAO_SOCIAL` | NVARCHAR2 | 20 | Y |
| 176 | `IN_UNIAO_ESTAVEL` | NVARCHAR2 | 1 | Y |
| 177 | `NO_EMPRESA_ANTERIOR` | NVARCHAR2 | 80 | Y |
| 178 | `NU_DDD_EMPRESA_ANT` | NVARCHAR2 | 3 | Y |
| 179 | `NU_TEL_EMPRESA_ANT` | NVARCHAR2 | 10 | Y |
| 180 | `NU_RAMAL_EMPRESA_ANT` | NVARCHAR2 | 5 | Y |
| 181 | `NO_FACEBOOK` | NVARCHAR2 | 50 | Y |
| 182 | `NO_TWITER` | NVARCHAR2 | 50 | Y |
| 183 | `IN_ESTUDANDO` | NCHAR | 1 | Y |
| 184 | `NO_SERIE_ESTUDANDO` | NVARCHAR2 | 20 | Y |
| 185 | `NU_NIS_GOVFED` | NVARCHAR2 | 15 | Y |
| 186 | `CO_STATUS_SIT_RENDA` | NUMBER | prec. 10 | Y |
| 187 | `CO_TP_CONTA` | NVARCHAR2 | 1 | Y |
| 188 | `CO_QUALIFICACAO_CONTA` | NVARCHAR2 | 1 | Y |
| 189 | `IN_E_PROCURADOR` | NCHAR | 1 | Y |
| 190 | `NU_INSCRICAO_MUNICIPAL` | NUMBER | prec. 10 | Y |
| 191 | `CO_FORMA_CONSTITUICAO_PJ` | NVARCHAR2 | 3 | Y |
| 192 | `NO_WEB_SITE_EMPRESA` | NVARCHAR2 | 40 | Y |
| 193 | `NO_CARGO` | NVARCHAR2 | 40 | Y |
| 194 | `NU_REGISTRO_JUNTA_COMERCIAL` | NVARCHAR2 | 30 | Y |
| 195 | `NO_ORGAO` | NVARCHAR2 | 20 | Y |
| 196 | `DT_REGISTRO_JUNTA_COMERCIAL` | DATE |  | Y |
| 197 | `DT_ULT_ALT_CONTRATUAL` | DATE |  | Y |
| 198 | `NO_EMPRESA_SUCESSORA` | NVARCHAR2 | 40 | Y |
| 199 | `DT_SUCESSAO` | DATE |  | Y |
| 200 | `NO_PESSOA_CONTATO_PJ` | NVARCHAR2 | 40 | Y |
| 201 | `NO_CARGO_PESSOA_CONTATO_PJ` | NVARCHAR2 | 15 | Y |
| 202 | `NU_DDD_TEL_CONTATO_PJ` | NVARCHAR2 | 5 | Y |
| 203 | `NU_TEL_CONTATO_PJ` | NVARCHAR2 | 11 | Y |
| 204 | `CO_TIPO_CONTROLE` | NVARCHAR2 | 1 | Y |
| 205 | `DT_ATUALIZACAO_CADASTRO` | DATE |  | Y |
| 206 | `CO_RISCO_CLIENTE` | NVARCHAR2 | 3 | Y |
| 207 | `IN_RESTRICOES_CADASTRAIS` | NCHAR | 1 | Y |
| 208 | `NO_RECIPROCIDADE` | NVARCHAR2 | 100 | Y |
| 209 | `IN_CONTA_SALARIO` | NCHAR | 1 | Y |
| 210 | `IN_CESTA_SERVICO` | NCHAR | 1 | Y |
| 211 | `NO_COMPROVACAO_RENDA` | NVARCHAR2 | 30 | Y |
| 212 | `NU_LIVRO_PROCURACAO` | NVARCHAR2 | 15 | Y |
| 213 | `NU_FOLHA_PROCURACAO` | NVARCHAR2 | 15 | Y |
| 214 | `NO_CARTORIO_PROCURACAO` | NVARCHAR2 | 50 | Y |
| 215 | `DT_PROCURACAO` | DATE |  | Y |
| 216 | `IN_TEM_RESPONSABILIDADE` | NCHAR | 1 | Y |
| 217 | `VA_BENEFICIO_CONTINUADO` | FLOAT | prec. 126 | Y |
| 218 | `VA_FATURAMENTO_ANUAL` | FLOAT | prec. 126 | Y |
| 219 | `DT_FATURAMENTO_MENSAL` | DATE |  | Y |
| 220 | `DT_PATRIMONIO_LIQUIDO` | DATE |  | Y |
| 221 | `VA_PATRIMONIO_LIQUIDO` | FLOAT | prec. 126 | Y |
| 222 | `VA_CAPITAL_REALIZAVEL` | FLOAT | prec. 126 | Y |
| 223 | `QT_EMPREGADOS` | NUMBER | prec. 10 | Y |
| 224 | `VA_FATURAMENTO_PRESUMIDO` | FLOAT | prec. 126 | Y |
| 225 | `IN_NATUREZA_CAPITAL` | NVARCHAR2 | 1 | Y |
| 226 | `IN_REPRESENTANTE_LEGAL` | NCHAR | 1 | Y |
| 227 | `NO_COMARCA_PROCURACAO` | NVARCHAR2 | 30 | Y |
| 228 | `CO_UF_PROCURACAO` | NVARCHAR2 | 2 | Y |
| 229 | `CO_MUNICIPIO_NATURALIDADE` | NUMBER | prec. 10 | Y |
| 230 | `CO_PESSOA_SISTEMA_EXTERNO` | NVARCHAR2 | 17 | Y |
| 231 | `IN_ISENTO_IR` | NCHAR | 1 | Y |
| 232 | `TE_OBSERVACAO_PROF` | BLOB |  | Y |
| 233 | `VA_MEDIA_IR` | FLOAT | prec. 126 | Y |
| 234 | `NO_CC_OU_POUP` | NVARCHAR2 | 1 | Y |
| 235 | `IN_MENOR_EMANCIPADO` | NCHAR | 1 | Y |
| 236 | `IN_RESTRICAO_SECURITARIA` | NCHAR | 1 | Y |
| 237 | `TE_RESTRICAO_SECURITARIA` | BLOB |  | Y |
| 238 | `IN_FAMILIAR_PESSOA_EXPOSTA` | NCHAR | 1 | Y |
| 239 | `IN_RELACIONA_PESSOA_EXPOSTA` | NCHAR | 1 | Y |
| 240 | `VA_ENDIVIDAMENTO_BCO` | FLOAT | prec. 126 | Y |
| 241 | `VA_DIPJ` | FLOAT | prec. 126 | Y |
| 242 | `VA_ENDIVIDAMENTO_TOT` | FLOAT | prec. 126 | Y |
| 243 | `VA_CURTO_PRZ` | FLOAT | prec. 126 | Y |
| 244 | `VA_LONGO_PRZ` | FLOAT | prec. 126 | Y |
| 245 | `VA_VENCIDO` | FLOAT | prec. 126 | Y |
| 246 | `VA_PREJUIZO` | FLOAT | prec. 126 | Y |
| 247 | `VA_FINANC_IMOB` | FLOAT | prec. 126 | Y |
| 248 | `IN_SITUACAO_ATIPICA` | NCHAR | 1 | Y |
| 249 | `VA_RESTRICAO_CADASTRAL` | FLOAT | prec. 126 | Y |
| 250 | `TP_RESTRICAO_CADASTRAL` | NUMBER | prec. 10 | Y |
| 251 | `NO_CERTIFICACAO_1` | NVARCHAR2 | 40 | Y |
| 252 | `NO_CERTIFICACAO_2` | NVARCHAR2 | 40 | Y |
| 253 | `NU_ANOS_EXPERIENCIA_PROF` | NUMBER | prec. 10 | Y |
| 254 | `NO_ATIVIDADE_PRINCIPAL_PJ` | NVARCHAR2 | 40 | Y |
| 255 | `NO_ATIVIDADE_SEGUNDARIA_PJ` | NVARCHAR2 | 40 | Y |
| 256 | `NO_FUNCAO_EMPRESA` | NVARCHAR2 | 40 | Y |
| 257 | `CO_ORGANIZACAO_MILITAR` | NVARCHAR2 | 20 | Y |
| 258 | `CO_SELO_DIGITAL` | NVARCHAR2 | 23 | Y |
| 259 | `IN_MILITAR_TEMPORARIO` | NCHAR | 1 | Y |
| 260 | `DT_ENGAJAMENTO` | DATE |  | Y |
| 261 | `NU_IMOVEL_GARANTIA` | NUMBER | prec. 10 | Y |
| 262 | `NU_BANCO_FASE_RETORNO` | NUMBER | prec. 10 | Y |
| 263 | `NU_AGENCIA_FASE_RETORNO` | NVARCHAR2 | 20 | Y |
| 264 | `NU_CONTACORR_FASE_RETORNO` | NVARCHAR2 | 20 | Y |
| 265 | `IN_TIPO_PGTO_LIBERACAO` | NUMBER | prec. 10 | Y |
| 266 | `NU_PESSOA_CREDITO_VENDEDOR` | NUMBER | prec. 10 | Y |
| 267 | `DT_CONSULTA_CRIVO` | DATE |  | Y |
| 268 | `CO_BANDEIRA_CRIVO` | NVARCHAR2 | 1 | Y |
| 269 | `TE_RESPOSTA_CRIVO` | BLOB |  | Y |
| 270 | `TE_ENVIO_CONSULTA_CRIVO` | BLOB |  | Y |
| 271 | `NO_EMAIL2` | NVARCHAR2 | 80 | Y |
| 272 | `NU_DV_AGENCIA_FASE_RETORNO` | NVARCHAR2 | 1 | Y |
| 273 | `NU_DV_CONTACORR_FASE_RETORNO` | NVARCHAR2 | 2 | Y |
| 274 | `CO_PARENTESCO_TITULAR` | NUMBER | prec. 10 | Y |
| 275 | `VA_RENDA_BRUTA` | FLOAT | prec. 126 | Y |
| 276 | `PE_PARA_CREDITO` | FLOAT | prec. 126 | Y |
| 277 | `TE_CONTRATO_SOCIAL` | BLOB |  | Y |
| 278 | `NO_COMPLEMENTO_RG` | NVARCHAR2 | 40 | Y |
| 279 | `IN_CONJUGE_ANUENTE` | NCHAR | 1 | Y |
| 280 | `CO_DOCUMENTO_FORMA_PGTO` | NVARCHAR2 | 50 | Y |
| 281 | `PE_PROPRIEDADE_IMOVEL` | FLOAT | prec. 126 | Y |
| 282 | `IN_VENDEDOR_PRINCIPAL` | NCHAR | 1 | Y |
| 283 | `NO_INSTRUMENTO_PROCURACAO` | NVARCHAR2 | 30 | Y |
| 284 | `NU_PROCURACAO` | NVARCHAR2 | 30 | Y |
| 285 | `IN_AUTORZC` | NCHAR | 1 | Y |
| 286 | `IN_FINANC_ATIVO_SFH` | NCHAR | 1 | Y |
| 287 | `IN_IMOVEL_MUNIC_RESIDENCIA` | NCHAR | 1 | Y |
| 288 | `IN_IMOVEL_MUNIC_FINANC` | NCHAR | 1 | Y |
| 289 | `NU_MATRICULA_REG_CIVIL` | NVARCHAR2 | 40 | Y |
| 290 | `PE_RENDA_EXCECAO` | NUMBER | prec. 10 | Y |
| 291 | `PE_MIP_EXCECAO` | FLOAT | prec. 126 | Y |
| 292 | `IN_CONFDADOS` | NCHAR | 1 | Y |
| 293 | `IN_CIENCIADADOS` | NCHAR | 1 | Y |
| 294 | `NU_DDD_CEL_COM` | NVARCHAR2 | 5 | Y |
| 295 | `NU_CELULAR_COM` | NVARCHAR2 | 11 | Y |
| 296 | `NO_SITUACAO_CADASTRO` | NVARCHAR2 | 20 | Y |
| 297 | `NO_PESSOA_COMPLETO` | NVARCHAR2 | 120 | Y |
| 298 | `CO_RANKING_CLIENTE` | NVARCHAR2 | 5 | Y |
| 299 | `NO_PONTO_CORTE_CLIENTE` | NVARCHAR2 | 6 | Y |
| 300 | `IN_PODER_REPRESENTACAO` | NCHAR | 1 | Y |
| 301 | `IN_ANUENTE` | NVARCHAR2 | 1 | Y |
| 302 | `TE_INF_ADICIONAL` | BLOB |  | Y |
| 303 | `CO_PIX` | NVARCHAR2 | 100 | Y |
| 304 | `IN_PARTE_RELACIONADA` | NCHAR | 1 | Y |
| 305 | `IN_FAMILIAR_PARTE_RELACIONADA` | NCHAR | 1 | Y |
| 306 | `CO_TIPO_TOMADOR` | NUMBER | prec. 10 | Y |
| 307 | `NO_SITUACAO_CONTA` | NVARCHAR2 | 20 | Y |
| 308 | `DT_AUTORZC` | DATE |  | Y |
| 309 | `CO_USUARIO_AUTORZC` | NVARCHAR2 | 20 | Y |
| 310 | `IN_PESSOA_DEBITO_CONTA` | NCHAR | 1 | Y |
| 311 | `IN_POUPANCA_SALARIO` | NCHAR | 1 | Y |
| 312 | `IN_RESIDE_MENOS1ANO` | NCHAR | 1 | Y |
| 313 | `IN_TEM_IMOVEL` | NCHAR | 1 | Y |
| 314 | `IN_AUTORIZA_TROCA_MSG` | NCHAR | 1 | Y |
| 315 | `NU_RAMAL_COM` | NVARCHAR2 | 5 | Y |
| 316 | `NU_NIRE` | NVARCHAR2 | 30 | Y |
| 317 | `CO_UF_REG_CIVIL` | NVARCHAR2 | 2 | Y |
| 318 | `CO_MUNIC_REG_CIVIL` | NVARCHAR2 | 25 | Y |
| 319 | `NO_NOME_REG_CIVIL` | NVARCHAR2 | 50 | Y |
| 320 | `IN_CERTIFICADO_DIGITAL` | NCHAR | 1 | Y |
| 321 | `DT_VALIDADE_CERTIFICADO` | DATE |  | Y |
| 322 | `NO_LIVRO_REGCIVIL` | NVARCHAR2 | 30 | Y |
| 323 | `NO_FOLHA_REGCIVIL` | NVARCHAR2 | 30 | Y |
| 324 | `DT_REGCIVIL` | DATE |  | Y |
| 325 | `NO_NOMESOCIAL` | NVARCHAR2 | 40 | Y |
| 326 | `CO_CNAE` | NVARCHAR2 | 7 | Y |
| 327 | `NO_CARTORIO_PACTO` | NVARCHAR2 | 150 | Y |
| 328 | `TE_INFORMACAO_PACTO` | NVARCHAR2 | 255 | Y |
| 329 | `IN_RELACIONAMENTO_COMERCIAL` | NCHAR | 1 | Y |
| 330 | `CO_UF_JUNTA_COMERCIAL` | NVARCHAR2 | 2 | Y |
| 331 | `IN_ASSINA_DOCUMENTO` | NCHAR | 1 | Y |
| 332 | `IN_TIPO_CHAVE_PIX` | NVARCHAR2 | 1 | Y |
| 333 | `IN_PIX_AUT` | NCHAR | 1 | Y |
| 334 | `ID_REC_PIX_AUT` | NVARCHAR2 | 77 | Y |
| 335 | `IN_AREA_RISCO` | NCHAR | 1 | Y |
| 336 | `NU_ATESTE_PUBLICO` | NVARCHAR2 | 80 | Y |
| 337 | `IN_DOENCA_CRONICA` | NCHAR | 1 | Y |
| 338 | `NO_DOENCA_CRONICA` | NVARCHAR2 | 150 | Y |
| 339 | `IN_VIOLENCIA_DOMESTICA` | NCHAR | 1 | Y |
| 340 | `NO_SITUACAO_PRETEND` | NVARCHAR2 | 50 | Y |
| 341 | `VA_INTERVENIENTE` | FLOAT | prec. 126 | Y |
| 342 | `IN_RESIDE_NO_IMOVEL` | NCHAR | 1 | Y |
| 343 | `PE_GARANTIA` | FLOAT | prec. 126 | Y |
| 344 | `NU_IMOVEL_IQ` | NUMBER | prec. 10 | Y |
| 345 | `CO_RANKING_CLIENTE_ULT_SIM` | NVARCHAR2 | 5 | Y |
| 346 | `CO_MUNIC_JUNTA_COMERCIAL` | NUMBER | prec. 10 | Y |
| 347 | `NO_LOGRADOURO_COMPLETO` | NVARCHAR2 | 200 | Y |

### PRETENDENTE

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `NU_PRETENDENTE` | NVARCHAR2 | 9 | N |
| 2 | `NU_ESCRREG` | NUMBER | prec. 10 | Y |
| 3 | `NO_ENTREVISTADOR` | NVARCHAR2 | 15 | Y |
| 4 | `DT_CADASTRO` | DATE |  | N |
| 5 | `DT_ULT_ATUALIZACAO` | DATE |  | Y |
| 6 | `CO_EMPREENDIMENTO` | NUMBER | prec. 10 | Y |
| 7 | `CO_SITUACAO` | NUMBER | prec. 10 | Y |
| 8 | `DT_SITUACAO` | DATE |  | Y |
| 9 | `NU_QTDCLASS` | NUMBER | prec. 10 | Y |
| 10 | `CO_OCORRENCIA` | NUMBER | prec. 10 | Y |
| 11 | `IN_CARTAEMITIDA` | NCHAR | 1 | Y |
| 12 | `IN_IMV_PROP` | NUMBER | prec. 10 | Y |
| 13 | `IN_IMV_PELO_FGTS` | NUMBER | prec. 10 | Y |
| 14 | `CO_MUNIC_IMV_PROP` | NUMBER | prec. 10 | Y |
| 15 | `VA_FINANC_PLEITEADO` | FLOAT | prec. 126 | Y |
| 16 | `CO_OPCAO_AMORT` | NUMBER | prec. 10 | Y |
| 17 | `NU_PRAZO` | NUMBER | prec. 10 | Y |
| 18 | `VA_ENCARGO` | FLOAT | prec. 126 | Y |
| 19 | `CO_INTERESSE` | NUMBER | prec. 10 | Y |
| 20 | `IN_PROCUROU_IMV` | NCHAR | 1 | Y |
| 21 | `CO_TIPO_IMV_PRETEND_1` | NUMBER | prec. 10 | Y |
| 22 | `CO_TIPO_IMV_PRETEND_2` | NUMBER | prec. 10 | Y |
| 23 | `CO_MUNIC_PRETEND_1` | NUMBER | prec. 10 | Y |
| 24 | `CO_MUNIC_PRETEND_2` | NUMBER | prec. 10 | Y |
| 25 | `CO_MUNIC_PRETEND_3` | NUMBER | prec. 10 | Y |
| 26 | `NO_BAIRRO_PRETEND_1` | NVARCHAR2 | 21 | Y |
| 27 | `NO_OBS` | BLOB |  | Y |
| 28 | `NO_ANALISE` | BLOB |  | Y |
| 29 | `NO_MEMO` | BLOB |  | Y |
| 30 | `CO_TIPO_SITBEN` | NUMBER | prec. 10 | Y |
| 31 | `NO_USU_ALT` | NVARCHAR2 | 20 | Y |
| 32 | `NO_SENHA` | NVARCHAR2 | 50 | Y |
| 33 | `NO_LEMBRETE_SENHA` | NVARCHAR2 | 50 | Y |
| 34 | `CO_CLIENTE` | NVARCHAR2 | 17 | Y |
| 35 | `IN_RECEBER_INF_POR_EMAIL` | NCHAR | 1 | Y |
| 36 | `IN_TEM_IMOVEL` | NCHAR | 1 | Y |
| 37 | `IN_MUTUARIO_OUTRO_AGENTE` | NCHAR | 1 | Y |
| 38 | `IN_CONJUGE_COMPOE_RENDA` | NCHAR | 1 | Y |
| 39 | `DT_ENTREVISTA` | DATE |  | Y |
| 40 | `CO_RESPONSAVEL_CRIANCA0A6` | NUMBER | prec. 10 | Y |
| 41 | `NO_OUTRO_RESP_CRIANCA0A6` | NVARCHAR2 | 40 | Y |
| 42 | `NO_ENTREVISTADO` | NVARCHAR2 | 40 | Y |
| 43 | `NO_SITUACAO_TRABALHO_OUTRO` | NVARCHAR2 | 30 | Y |
| 44 | `CO_TIPO_MOEDA` | NUMBER | prec. 10 | Y |
| 45 | `CO_BAIRRO_PRETENDIDO` | NUMBER | prec. 10 | Y |
| 46 | `CO_IDPAIDOCUMENTOS` | NUMBER | prec. 10 | Y |
| 47 | `IN_DEFICIENTE_GRUPO_FAMILIAR` | NCHAR | 1 | Y |
| 48 | `NU_SORTEIO` | NUMBER | prec. 10 | Y |
| 49 | `CO_ORIGEM_CONTATO` | NUMBER | prec. 10 | Y |
| 50 | `CO_MOTIVO_OPERACAO` | NUMBER | prec. 10 | Y |
| 51 | `CO_LCOBR` | NUMBER | prec. 10 | Y |
| 52 | `CO_EMPRESA` | NUMBER | prec. 10 | Y |
| 53 | `IN_REALIZANOVODEBITOCC` | NCHAR | 1 | Y |
| 54 | `IN_UTILIZA_CHEQUEESP` | NCHAR | 1 | Y |

### SIMULACAO_ORIGINACAO

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `NU_SIMULACAO` | NUMBER | prec. 10 | N |
| 2 | `NU_SESSAO` | NUMBER | prec. 10 | N |
| 3 | `ID_ORIGEM` | NUMBER | prec. 10 | Y |
| 4 | `DT_REFERENCIA` | DATE |  | Y |
| 5 | `CO_GRUPO_TIPO_OPERACAO` | NVARCHAR2 | 3 | Y |
| 6 | `CO_TIPO_OPERACAO` | NVARCHAR2 | 3 | Y |
| 7 | `CO_ENQUADRAMENTO` | NUMBER | prec. 10 | Y |
| 8 | `CO_SEGURADORA` | NUMBER | prec. 10 | Y |
| 9 | `CO_SEGURADORA_DFI` | NUMBER | prec. 10 | Y |
| 10 | `CO_APOLICE` | NVARCHAR2 | 15 | Y |
| 11 | `CO_APOLICE_DFI` | NVARCHAR2 | 15 | Y |
| 12 | `DT_NASCIMENTO_1` | DATE |  | Y |
| 13 | `VA_OPERACAO` | FLOAT | prec. 126 | Y |
| 14 | `VA_FINANCIAMENTO` | FLOAT | prec. 126 | Y |
| 15 | `VA_PRECO_IMOVEL` | FLOAT | prec. 126 | Y |
| 16 | `VA_RENDA_FAMILIAR` | FLOAT | prec. 126 | Y |
| 17 | `NU_PRAZO_MESES_OPERACAO` | NUMBER | prec. 10 | Y |
| 18 | `CO_SISTEMA_AMORTIZACAO` | NUMBER | prec. 10 | Y |
| 19 | `CO_PLANO` | NUMBER | prec. 10 | Y |
| 20 | `PE_TX_ANUAL_JUROS` | FLOAT | prec. 126 | Y |
| 21 | `NU_CPFCNPJ` | NVARCHAR2 | 14 | Y |
| 22 | `CO_INDICE` | NUMBER | prec. 10 | Y |
| 23 | `VA_INDICE_UTILIZADO` | FLOAT | prec. 126 | Y |
| 24 | `VA_FINANCIAMENTO_CONSTRUCAO` | FLOAT | prec. 126 | Y |
| 25 | `VA_FINANCIAMENTO_TERRENO` | FLOAT | prec. 126 | Y |
| 26 | `NU_MESES_PRAZO_CONSTRUCAO` | NUMBER | prec. 10 | Y |
| 27 | `NO_IMOVEL_NOVO` | NCHAR | 1 | Y |
| 28 | `IN_TIPO_IMOVEL` | NCHAR | 1 | Y |
| 29 | `VA_AREA_UTIL` | FLOAT | prec. 126 | Y |
| 30 | `CO_TIPO_IMOVEL` | NUMBER | prec. 10 | Y |
| 31 | `IM_ENQUADRAMENTO` | BLOB |  | Y |
| 32 | `VA_AMAISJ_1A_PRESTACAO` | FLOAT | prec. 126 | Y |
| 33 | `VA_DFI` | FLOAT | prec. 126 | Y |
| 34 | `VA_MIP` | FLOAT | prec. 126 | Y |
| 35 | `VA_TARIFA_ADMINISTRACAO` | FLOAT | prec. 126 | Y |

### CARENCIA_TIPO_OPERACAO (dono CAIXA2)

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `CO_TIPO_OPERACAO` | NCHAR | 3 | N |
| 2 | `IN_TIPO_JUROS_CARENCIA` | NUMBER | prec. 10 | N |
| 3 | `NU_MESES_CARENCIA_1PRST` | NUMBER | prec. 10 | Y |
| 4 | `IN_CARENCIA_AMORTIZACAO` | NCHAR | 1 | Y |
| 5 | `IN_SEGURO_CARENCIA_NA1PRST` | NCHAR | 1 | Y |
| 6 | `NU_MESES_CARENCIA_MAX` | NUMBER | prec. 10 | Y |

### SEGURA (dono CAIXA2)

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `CODIGO` | NUMBER | prec. 10 | N |
| 2 | `NOME` | NVARCHAR2 | 35 | Y |
| 3 | `MATRIC` | NVARCHAR2 | 9 | Y |
| 4 | `APOLICE` | NVARCHAR2 | 15 | Y |
| 5 | `DESCONSIDERAPRSTNODIASIN` | NCHAR | 1 | Y |
| 6 | `CALCSEGMIPPELOVALAVAL` | NCHAR | 1 | Y |
| 7 | `PERCIMPOSTO` | FLOAT | prec. 126 | Y |
| 8 | `DTINIAPOLICE` | DATE |  | Y |
| 9 | `USAFIFCADMUT` | NCHAR | 1 | Y |
| 10 | `CODREGIAO` | NUMBER | prec. 10 | Y |
| 11 | `CNPJ` | NVARCHAR2 | 15 | Y |
| 12 | `EDOSFH` | NCHAR | 1 | Y |
| 13 | `IDADEMAXINIFINANC` | NUMBER | prec. 10 | Y |
| 14 | `SEGPRESTZERO` | NCHAR | 1 | Y |
| 15 | `INFTRANSFSONOMESDOEVENTO` | NCHAR | 1 | Y |
| 16 | `MESANOINICIALDFISALDODEV` | DATE |  | Y |
| 17 | `MESANOFINALDFISALDODEV` | DATE |  | Y |
| 18 | `INDENIZSEMPRORATAEJUROS` | NCHAR | 1 | Y |
| 19 | `IDADEMAXTERMFINANC` | NUMBER | prec. 10 | Y |
| 20 | `IDADEMESESTERMFINANC` | NUMBER | prec. 10 | Y |
| 21 | `NOMELAYOUT` | NVARCHAR2 | 29 | Y |
| 22 | `DTINIASSINATURA` | DATE |  | Y |
| 23 | `DTFIMASSINATURA` | DATE |  | Y |
| 24 | `CODLIDER` | NUMBER | prec. 10 | Y |
| 25 | `ORIGEMCTR` | NUMBER | prec. 10 | Y |
| 26 | `UTILIZASDANTSINISTRO` | NCHAR | 1 | Y |
| 27 | `CO_EMPRESA` | NUMBER | prec. 10 | Y |
| 28 | `IM_SEGURADORA` | BLOB |  | Y |
| 29 | `IM_SEGURADORA_MINI` | BLOB |  | Y |
| 30 | `SOMACARENCIAPRAZO` | NCHAR | 1 | Y |

### SEGURADORA_TIPO_OPERACAO (dono CAIXA2)

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `CO_TIPO_OPERACAO` | NCHAR | 3 | N |
| 2 | `NU_SEQ` | NUMBER | prec. 10 | N |
| 3 | `CO_SEGURADORA` | NUMBER | prec. 10 | Y |
| 4 | `CO_SEGURADORA_DFI` | NUMBER | prec. 10 | Y |
| 5 | `CO_APOLICE` | NVARCHAR2 | 15 | Y |
| 6 | `CO_APOLICE_DFI` | NVARCHAR2 | 15 | Y |
| 7 | `CO_ENQUADRAMENTO` | NUMBER | prec. 10 | Y |
| 8 | `TE_CO_ENQUADRAMENTO` | BLOB |  | Y |

### TABAPOLICE (dono CAIXA2)

| # | Coluna | Tipo | Tamanho (caracteres) | Nulo |
|---|---|---|---|---|
| 1 | `CODAPOLICE` | NVARCHAR2 | 15 | N |
| 2 | `DESCAPOLICE` | NVARCHAR2 | 31 | Y |
| 3 | `COBRAVALMIN` | NCHAR | 1 | Y |
| 4 | `LIBERAJURNAIND` | NCHAR | 1 | Y |
| 5 | `CODSEGURADORA` | NUMBER | prec. 10 | Y |
| 6 | `CODFAIXA` | NUMBER | prec. 10 | Y |
| 7 | `MAINIEVO` | DATE |  | Y |
| 8 | `NAOREAJUSTADFI` | NCHAR | 1 | Y |
| 9 | `GRUPOAPOLICE` | NUMBER | prec. 10 | Y |
| 10 | `DTVIGENCIAINIG` | DATE |  | Y |
| 11 | `DTVIGENCIAFIMG` | DATE |  | Y |
| 12 | `ALIQUOTAMIP` | FLOAT | prec. 126 | Y |
| 13 | `ALIQUOTADFI` | FLOAT | prec. 126 | Y |
| 14 | `ALIQUOTAMQC` | FLOAT | prec. 126 | Y |
| 15 | `SITESPVENCIDA` | NUMBER | prec. 10 | Y |
| 16 | `CUSTOAPOLICE` | FLOAT | prec. 126 | Y |
| 17 | `CAMPOVBASEMIP` | NUMBER | prec. 10 | Y |
| 18 | `CAMPOVBASEDFI` | NUMBER | prec. 10 | Y |
| 19 | `TPREAJBASE` | NUMBER | prec. 10 | Y |
| 20 | `USATRULTPRSTCORRSIN` | NCHAR | 1 | Y |
| 21 | `VA_MAXIMO_SEGURADO_DFI` | FLOAT | prec. 126 | Y |
| 22 | `MUDAFXMESPOSANI` | NCHAR | 1 | Y |
| 23 | `CONUMAPOLICE` | NVARCHAR2 | 15 | Y |
| 24 | `ALIQUOTAMIPORIGINACAO` | FLOAT | prec. 126 | Y |
| 25 | `ALIQUOTADFIORIGINACAO` | FLOAT | prec. 126 | Y |
| 26 | `NAORECALCMIPFAIXA` | NCHAR | 1 | Y |
| 27 | `SEGUROAVISTA` | NCHAR | 1 | Y |
| 28 | `NU_PARC_ATRASO_INAD_MIP` | NUMBER | prec. 10 | Y |
| 29 | `NU_PARC_ATRASO_INAD_DFI` | NUMBER | prec. 10 | Y |
| 30 | `IN_TRATADIA_FXAPOLICE` | NCHAR | 1 | Y |
| 31 | `NUPROCSUSEP` | NVARCHAR2 | 25 | Y |
| 32 | `NUCONTRATO` | NVARCHAR2 | 25 | Y |
| 33 | `TXCALCCOMISSAO` | FLOAT | prec. 126 | Y |
| 34 | `VA_MAXIMO_SEGURADO_MIP` | FLOAT | prec. 126 | Y |
| 35 | `CAMPOVBASEMIPRETORNO` | NUMBER | prec. 10 | Y |
| 36 | `CAMPOVBASEDFIRETORNO` | NUMBER | prec. 10 | Y |
| 37 | `TPREAJBASERETORNO` | NUMBER | prec. 10 | Y |
| 38 | `NU_PERVALAVAL` | NUMBER | prec. 10 | Y |
| 39 | `CRITERIOALIQUOTAMIP` | NUMBER | prec. 10 | Y |
| 40 | `MUDAFXANOPOSANI` | NCHAR | 1 | Y |
| 41 | `ALIQUODOTACONTRATO` | NCHAR | 1 | Y |
| 42 | `EXCINCORPSDVENCCALCMIP` | NCHAR | 1 | Y |
| 43 | `NUARQDESTINO` | NUMBER | prec. 10 | Y |
| 44 | `CO_EMPRESA` | NUMBER | prec. 10 | Y |
| 45 | `NU_SEQ` | NUMBER | prec. 10 | N |
| 46 | `IN_LIMITA_PRAZO_IDADE_MAX` | NCHAR | 1 | Y |
| 47 | `MUDAFXMESANIVERSARIOAPOLICE` | NCHAR | 1 | Y |
| 48 | `COBRASEGCARPRIPRES` | NCHAR | 1 | Y |
| 49 | `CO_TIPO_ALIQUOTA` | NUMBER | prec. 10 | Y |
| 50 | `PERCIOFMIP` | FLOAT | prec. 126 | Y |
| 51 | `PERCIOFDFI` | FLOAT | prec. 126 | Y |
| 52 | `INICIO_COBRANCA_DFI` | NUMBER | prec. 10 | Y |
| 53 | `IN_ALIQ_IDADE_PRZ_TERMINO` | NCHAR | 1 | Y |
| 54 | `COD_ESTIPULANTE` | NUMBER | prec. 10 | Y |
| 55 | `IN_LIMITA_MAX_SEG_IDADE_MES` | NCHAR | 1 | Y |
| 56 | `NUMESESATRVABASEMIP` | NUMBER | prec. 10 | Y |
