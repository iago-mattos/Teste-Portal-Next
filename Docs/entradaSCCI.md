# Como entrar no SCCI e chegar à tela de Pretendente

Use este roteiro para acessar o SCCI/AEJS e abrir a tela de **Pretendente** de
uma proposta. Ele serve como referência para qualquer automação ou projeto;
substitua apenas a URL, as credenciais autorizadas e o número da proposta.

## O que é necessário antes de começar

- URL do ambiente SCCI/AEJS (por exemplo, HT ou DEV);
- usuário e senha autorizados para esse ambiente;
- número da proposta/operação que será consultada.

Não salve credenciais, cookies ou dados reais de clientes no código ou na
documentação versionada.

## Caminho na tela

1. Abra a URL do SCCI/AEJS no navegador.
2. Na página inicial, clique em **Acesso via Plataforma**.
3. Informe o **usuário** e a **senha**.
4. Se a tela exibir o campo **Path**, preencha-o somente quando o ambiente
   fornecer esse valor.
5. Clique em **Login**.
6. Aguarde o sistema carregar. A presença do menu **Originação** confirma que
   o login foi concluído.
7. Clique em **Originação**.
8. No menu aberto, clique em **Cadastro de operações**.
9. Localize o campo de pesquisa da operação (identificado tecnicamente como
   `operacao`).
10. Digite o número da proposta. A tela normalmente aceita o número sem os
    zeros à esquerda.
11. Clique em **Pesquisar**.
12. Na grade de resultados, localize a linha da proposta desejada e dê
    **duplo clique** nela para abrir a ficha da operação.
13. Aguarde o carregamento completo da ficha; essa abertura pode levar alguns
    segundos.
14. Na ficha aberta, clique na aba **Pretendente**.

Nesse ponto você chegou à lista de pretendentes da proposta.

## Para abrir o cadastro de um pretendente

1. Selecione a linha do pretendente desejado na grade.
2. Clique em **Abrir**.
3. Aguarde a ficha do pretendente carregar antes de consultar campos ou abas.

## Referências úteis para automação

- Botão de acesso: texto exato `Acesso via Plataforma`.
- Campos de login: `name="name"` e `name="password"`.
- Menu: **Originação > Cadastro de operações**.
- Campo de busca: `input[name="operacao"]`.
- Abertura da operação: duplo clique na linha retornada pela pesquisa.
- Aba da ficha: **Pretendente**.
- Após abrir o cadastro: campo do nome do pretendente
  `input[name="PESSOA$NO_PESSOA"]`.

Prefira esses nomes e textos estáveis a IDs gerados dinamicamente, como os
prefixados por `aejs-`.
