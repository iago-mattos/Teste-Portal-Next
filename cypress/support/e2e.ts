import "./commands";

// O build de desenvolvimento atualmente emite React #418 durante a hidratacao.
// Ignoramos somente esse erro conhecido para que as validacoes funcionais
// prossigam; qualquer outra excecao da aplicacao continua falhando o teste.
Cypress.on("uncaught:exception", (error) => {
  if (error.message.includes("Minified React error #418")) {
    return false;
  }
});
