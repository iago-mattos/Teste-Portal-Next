import { SobreVoceAEJS } from './factory';
import { SobreVoce as dadosPreenchimento } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Sobre Você AEJS', () => {

    it('Executar fluxo de verificação completo', () => {
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

        // 3. Abrir o Pretendente (primeira linha da grid)
        cy.contains('Nome do Componente').should('be.visible');
        cy.get('.x-grid-row').filter(':visible').first().should('be.visible').dblclick();
        cy.waitExtJs(2000);

        // --- INÍCIO DAS VALIDAÇÕES (Fluxo Contínuo) ---

        // Validação: Estado Civil
        cy.get('input[name="PESSOA$CO_ESTCIV"]')
            .should('be.visible')
            .should('have.value', dadosPreenchimento.estadoCivil);

        // Validação: Profissão (Navega para a aba Ocupação)
        cy.contains('a span', 'Ocupação').should('be.visible').click();
        cy.waitExtJs();

        cy.get('input[name="PESSOA$CO_PROFISSAO"]')
            .should('be.visible')
            .should('have.value', dadosPreenchimento.profissao);

        // Validação: Ocupação
        cy.get('input[name="PESSOA$CO_ATIVIDADE_PROFISSIONAL"]')
            .should('be.visible')
            .should('have.value', dadosPreenchimento.ocupacao);
    });
});
