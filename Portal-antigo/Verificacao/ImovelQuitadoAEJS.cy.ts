import { SobreVoceAEJS } from './factory';
import { Imovel } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Imóvel Quitado AEJS', () => {

    it('Executar fluxo de verificação dos dados do Imóvel Quitado no Ambiente ExtJS', () => {
        // Formatações auxiliares para espelhar a exibição nativa do ExtJS
        // Converte '1500000' para '1.500.000,00'
        const valorFormatado = Number(Imovel.valorImovel).toLocaleString('pt-BR') + ',00';
        // O Tipo do Imóvel (finalidade) aparece em letras maiúsculas
        const finalidadeMaiuscula = Imovel.finalidade.toUpperCase();

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

        // 3. Navegar diretamente para a aba superior "Imóvel Operação"
        cy.contains('.x-tab:visible', 'Imóvel Operação').click({ force: true });
        cy.waitExtJs(2000);

        // --- INÍCIO DAS VALIDAÇÕES DA ABA IMÓVEL ---

        // Validação: Valor Estimado do Imóvel
        cy.get('input[name="IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA"]')
            .should('be.visible')
            .should('have.value', valorFormatado);

        // Validação: Tipo do Imóvel (corresponde à finalidade no factory.ts)
        cy.get('input[name="IMOVEL_OPERACAO$IN_TIPO_IMOVEL"]')
            .should('be.visible')
            .should('have.value', finalidadeMaiuscula);

        // Validação: Condição do Imóvel
        cy.get('input[name="IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL"]')
            .should('be.visible')
            .should('have.value', Imovel.situacao);

        // Validação: Uso do Imóvel (corresponde ao tipo no factory.ts)
        cy.get('input[name="IMOVEL_OPERACAO$IN_USO_DO_IMOVEL"]')
            .should('be.visible')
            .should('have.value', Imovel.tipo);
    });
});
