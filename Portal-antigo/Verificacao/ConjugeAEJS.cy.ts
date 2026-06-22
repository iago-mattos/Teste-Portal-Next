import { SobreVoceAEJS } from './factory';
import { Conjuge } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Cônjuge AEJS', () => {

    it('Executar fluxo de verificação dos dados do Cônjuge no Ambiente ExtJS', () => {
        // Formatações auxiliares para espelhar a exibição nativa do ExtJS
        const cpfFormatado = Conjuge.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        const nomeMaiusculo = Conjuge.nome.toUpperCase();

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

        // 3. Abrir o Pretendente (primeira linha da grid) para acessar suas abas internas
        cy.contains('Nome do Componente').should('be.visible');
        cy.get('.x-grid-row').filter(':visible').first().should('be.visible').dblclick({ force: true });
        cy.waitExtJs(4000);

        // 4. Navegar para a aba Cônjuge
        cy.contains('.x-tab:visible', 'Cônjuge').click({ force: true });
        cy.waitExtJs(2000);

        // --- INÍCIO DAS VALIDAÇÕES DA ABA CÔNJUGE ---

        // Validação: Nome do Cônjuge (Renderizado em maiúsculas)
        cy.get('input[name="CONJUGE$NO_PESSOA"]')
            .should('be.visible')
            .should('have.value', nomeMaiusculo);

        // Validação: CPF do Cônjuge (Renderizado com pontuação)
        cy.get('input[name="CONJUGE$NU_CPFCNPJ"]')
            .should('be.visible')
            .should('have.value', cpfFormatado);

        // Validação: Data de Nascimento (Formato 01/Jan/2001)
        cy.get('input[name="CONJUGE$DT_NASCIMENTO"]')
            .should('be.visible')
            .should('have.value', '01/Jan/2001');

        // Validação: Nacionalidade
        cy.get('input[name="CONJUGE$CO_NACIONALIDADE"]')
            .should('be.visible')
            .should('have.value', Conjuge.nacionalidade);

        // Validação: Data de Casamento (Formato 01/Jan/2025)
        cy.get('input[name="CONJUGE$DT_CASAMENTO"]')
            .should('be.visible')
            .should('have.value', '01/Jan/2025');

        // Validação: Regime de Comunhão
        cy.get('input[name="CONJUGE$CO_REGIME_CASAMENTO"]')
            .should('be.visible')
            .should('have.value', Conjuge.regimeBens);

        // --- VALIDAÇÕES DOS DADOS DE CONTATO ---
        // Navega para a sub-aba "Dados de contato"
        cy.contains('.x-tab:visible', new RegExp('^\\s*Dados de Contato\\s*$', 'i')).click({ force: true });
        cy.waitExtJs(2000);

        // Validação: Celular
        cy.get('input[name="CONJUGE$NU_CELULAR"]')
            .should('be.visible')
            .should('have.value', Conjuge.celular);

        // Validação: E-mail
        cy.get('input[name="CONJUGE$NO_EMAIL"]')
            .should('be.visible')
            .should('have.value', Conjuge.email);
    });
});
