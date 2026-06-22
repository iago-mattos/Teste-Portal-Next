import { SobreVoceAEJS } from './factory';
import { Observacoes } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Motivo da Contratação AEJS', () => {

    it('Executar fluxo de verificação do Motivo da Contratação no Ambiente ExtJS', () => {
        // 1. Login e Navegação
        cy.login();
        cy.contains('Originação').should('be.visible').click();
        cy.contains('Cadastro de operações').should('be.visible').click();
        cy.waitExtJs();

        // 2. Busca e Abertura da Operação
        cy.get('input[name="operacao"]').should('be.visible').type(`${SobreVoceAEJS.operacao}{enter}`);
        cy.waitExtJs();
        cy.contains(SobreVoceAEJS.operacao).should('be.visible').dblclick();
        cy.waitExtJs(3000);

        // 3. Navegar diretamente para a aba superior "Finalidade do Crédito" da Operação
        cy.contains('.x-tab:visible', 'Finalidade do Crédito').click({ force: true });
        cy.waitExtJs(2000);

        // --- INÍCIO DAS VALIDAÇÕES ---

        // Validação: Certifica que o motivo da contratação consta como registro ativo na grid
        cy.contains('.x-grid-cell-inner:visible', Observacoes.vinculo)
            .should('be.visible');

        // Validação: Verifica a integridade da justificativa descritiva gravada no textarea
        cy.get('textarea[name="OPERACAO_CREDITO$TE_OBS_MOTIVO_EMPRESTIMO"]')
            .should('be.visible')
            .should('have.value', Observacoes.texto);
    });
});
