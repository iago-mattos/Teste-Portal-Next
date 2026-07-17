# @prognum/playwright-report

Relatório Playwright reutilizável com interface adaptativa para desktop, tablet
e mobile.

## Instalação local

```bash
npm install -D ./prognum-playwright-report-0.1.0.tgz
npx prognum-playwright-report init
```

## Uso

```bash
npm run pw:test:report
npm run pw:report:open
```

Para iniciar o servidor sem abrir automaticamente o navegador:

```bash
npx prognum-playwright-report open --no-open
```

O comando de teste preserva o resultado original do Playwright, mas sempre tenta
construir o relatório, inclusive quando algum teste falha.

## Personalização

Edite `prognum-report.config.mjs` para alterar título, produto, cor, domínios,
evidências e diretório de saída.
