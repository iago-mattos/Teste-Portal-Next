import { SobreVoceAEJS } from './factory';
import { Renda } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Composição de Renda Cônjuge AEJS', () => {

    it('Executar fluxo de verificação da Renda e Ocupação do Cônjuge no Ambiente ExtJS', () => {
        // A renda mockada é '14000,00', então no ExtJS será formatada nativamente como '14.000,00'
        const rendaEsperada = '14.000,00';

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

        // 3. Abrir o Pretendente (primeira linha da grid) para acessar a janela modal
        cy.contains('Nome do Componente').should('be.visible');
        cy.get('.x-grid-row').filter(':visible').first().should('be.visible').dblclick({ force: true });
        cy.waitExtJs(4000);

        // 4. Navegar para a aba de primeiro nível "Cônjuge"
        cy.contains('.x-tab:visible', 'Cônjuge').click({ force: true });
        cy.waitExtJs(2000);

        // ====================================================================
        // --- VALIDAÇÕES DA SUB-ABA OCUPAÇÃO ---
        // ====================================================================
        cy.contains('.x-tab:visible', 'Ocupação').click({ force: true });
        cy.waitExtJs(2000);

        // Validação: Renda Bruta
        cy.get('input[name="CONJUGE$VA_RENDA_BRUTA"]')
            .should('be.visible')
            .should('have.value', rendaEsperada);

        // Validação: Profissão
        cy.get('input[name="CONJUGE$CO_PROFISSAO"]')
            .should('be.visible')
            .should('have.value', Renda.profissao);

        // Validação: Tipo de Profissão / Cargo
        cy.get('input[name="CONJUGE$CO_ATIVIDADE_PROFISSIONAL"]')
            .should('be.visible')
            .should('have.value', Renda.cargo);

        // ====================================================================
        // --- VALIDAÇÕES DA SUB-ABA DADOS PESSOAIS ---
        // ====================================================================
        cy.contains('.x-tab:visible', 'Dados Pessoais').click({ force: true });
        cy.waitExtJs(2000);

        // Validação: Checkbox de Composição de Renda marcado
        cy.get('input[name="CONJUGE$IN_EADQUIRENTE"]')
            .should('be.checked');

        // Validação: Checkbox de Autorização de Consulta (SCR e outros) marcado
        cy.get('input[name="CONJUGE$IN_AUTORZC"]')
            .should('be.checked');
    });
});
