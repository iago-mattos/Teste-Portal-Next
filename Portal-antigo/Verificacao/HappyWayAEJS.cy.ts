import { SobreVoceAEJS } from './factory';
import { SobreVoce, Conjuge, Renda, Observacoes, Imovel } from '../Preenchimento/factory';

describe('Portal C6 - Verificação - Fluxo Happy Way Completo AEJS', () => {

    it('Deve verificar todos os dados E2E gravados no backoffice ExtJS de forma contínua', () => {
        // Formatações auxiliares para espelhar a exibição nativa do ExtJS
        const cpfFormatado = Conjuge.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        const nomeMaiusculo = Conjuge.nome.toUpperCase();
        const rendaEsperada = '14.000,00'; // Baseada no '14000,00' do factory
        const valorFormatadoImovel = Number(Imovel.valorImovel).toLocaleString('pt-BR') + ',00';
        const finalidadeMaiuscula = Imovel.finalidade.toUpperCase();

        // 1. Login e Navegação Inicial
        cy.login();
        cy.contains('Originação').should('be.visible').click();
        cy.contains('Cadastro de operações').should('be.visible').click();
        cy.waitExtJs();

        // 2. Busca e Abertura da Operação
        cy.get('input[name="operacao"]').should('be.visible').type(`${SobreVoceAEJS.operacao}{enter}`);
        cy.waitExtJs();
        cy.contains(SobreVoceAEJS.operacao).should('be.visible').dblclick();
        cy.waitExtJs(3000);

        // ====================================================================
        // --- NÍVEL 1: MODAL DO PRETENDENTE (SOBRE VOCÊ, CÔNJUGE E RENDA) ---
        // ====================================================================

        // Garantir que estamos na aba principal para acessar a grid do pretendente
        cy.contains('.x-tab:visible', 'Pretendente').click({ force: true });
        cy.waitExtJs(2000);

        // Abrir a janela modal do Pretendente Titular
        cy.contains('Nome do Componente').should('be.visible');
        cy.get('.x-grid-row').filter(':visible').first().should('be.visible').dblclick({ force: true });
        cy.waitExtJs(4000);

        // --- SOBRE VOCÊ ---
        // O modal já abre nativamente focado em "Dados Pessoais" do Titular
        cy.get('input[name="PESSOA$CO_ESTCIV"]')
            .should('be.visible')
            .should('have.value', SobreVoce.estadoCivil);

        // Navegar para Ocupação do Titular
        cy.contains('.x-tab:visible', 'Ocupação').click({ force: true });
        cy.waitExtJs(2000);
        cy.get('input[name="PESSOA$CO_PROFISSAO"]').should('be.visible').should('have.value', SobreVoce.profissao);
        cy.get('input[name="PESSOA$CO_ATIVIDADE_PROFISSIONAL"]').should('be.visible').should('have.value', SobreVoce.ocupacao);

        // --- CÔNJUGE ---
        // Navega para a guia mestre do Cônjuge
        cy.contains('.x-tab:visible', 'Cônjuge').click({ force: true });
        cy.waitExtJs(2000);

        // A aba Dados Pessoais do cônjuge é a default
        cy.get('input[name="CONJUGE$NO_PESSOA"]').should('be.visible').should('have.value', nomeMaiusculo);
        cy.get('input[name="CONJUGE$NU_CPFCNPJ"]').should('be.visible').should('have.value', cpfFormatado);
        cy.get('input[name="CONJUGE$DT_NASCIMENTO"]').should('be.visible').should('have.value', '01/Jan/2001');
        cy.get('input[name="CONJUGE$CO_NACIONALIDADE"]').should('be.visible').should('have.value', Conjuge.nacionalidade);
        cy.get('input[name="CONJUGE$DT_CASAMENTO"]').should('be.visible').should('have.value', '01/Jan/2025');
        cy.get('input[name="CONJUGE$CO_REGIME_CASAMENTO"]').should('be.visible').should('have.value', Conjuge.regimeBens);

        // Verificação dos Checkboxes na aba Dados Pessoais do Cônjuge (invisíveis por CSS opacity: 0)
        cy.get('input[name="CONJUGE$IN_EADQUIRENTE"]').should('be.checked');
        cy.get('input[name="CONJUGE$IN_AUTORZC"]').should('be.checked');

        // --- DADOS DE CONTATO DO CÔNJUGE ---
        cy.contains('.x-tab:visible', new RegExp('^\\s*Dados de Contato\\s*$', 'i')).click({ force: true });
        cy.waitExtJs(2000);
        cy.get('input[name="CONJUGE$NU_CELULAR"]').should('be.visible').should('have.value', Conjuge.celular);
        cy.get('input[name="CONJUGE$NO_EMAIL"]').should('be.visible').should('have.value', Conjuge.email);

        // --- OCUPAÇÃO DO CÔNJUGE (COMPOSIÇÃO DE RENDA) ---
        cy.contains('.x-tab:visible', 'Ocupação').click({ force: true });
        cy.waitExtJs(2000);
        cy.get('input[name="CONJUGE$VA_RENDA_BRUTA"]').should('be.visible').should('have.value', rendaEsperada);
        cy.get('input[name="CONJUGE$CO_PROFISSAO"]').should('be.visible').should('have.value', Renda.profissao);
        cy.get('input[name="CONJUGE$CO_ATIVIDADE_PROFISSIONAL"]').should('be.visible').should('have.value', Renda.cargo);

        // ====================================================================
        // --- FECHAMENTO DO MODAL ---
        // ====================================================================
        // Fecha o modal do pretendente para desobstruir as abas principais da operação
        cy.contains('span', 'Fechar tela').click({ force: true });
        cy.waitExtJs(2000);

        // ====================================================================
        // --- NÍVEL 2: ABAS DA OPERAÇÃO ---
        // ====================================================================

        // --- FINALIDADE DO CRÉDITO (MOTIVO) ---
        cy.contains('.x-tab:visible', 'Finalidade do Crédito').click({ force: true });
        cy.waitExtJs(2000);
        cy.contains('.x-grid-cell-inner:visible', Observacoes.vinculo).should('be.visible');
        cy.get('textarea[name="OPERACAO_CREDITO$TE_OBS_MOTIVO_EMPRESTIMO"]')
            .should('be.visible')
            .should('have.value', Observacoes.texto);

        // --- IMÓVEL OPERAÇÃO (IMÓVEL QUITADO) ---
        cy.contains('.x-tab:visible', 'Imóvel Operação').click({ force: true });
        cy.waitExtJs(2000);
        cy.get('input[name="IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA"]').should('be.visible').should('have.value', valorFormatadoImovel);
        cy.get('input[name="IMOVEL_OPERACAO$IN_TIPO_IMOVEL"]').should('be.visible').should('have.value', finalidadeMaiuscula);
        cy.get('input[name="IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL"]').should('be.visible').should('have.value', Imovel.situacao);
        cy.get('input[name="IMOVEL_OPERACAO$IN_USO_DO_IMOVEL"]').should('be.visible').should('have.value', Imovel.tipo);

    });
});
