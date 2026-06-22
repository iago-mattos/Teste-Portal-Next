export interface SobreVoceData {
    proposta: string;
    estadoCivil: string;
    profissao: string;
    ocupacao: string;
    Resideimóveloperação: string;
    nacionalidade: string;
    uf: string;
    municipio: string;
    ppe: string;
}

export interface ConjugeData {
    nome: string;
    cpf: string;
    dataNascimento: string;
    nacionalidade: string;
    dataCasamento: string;
    regimeBens: string;
    ddd: string;
    celular: string;
    email: string;
}

export interface RendaData {
    valor: string;
    profissao: string;
    cargo: string;
    outrasRendas: boolean;
}

export interface ObservacoesData {
    vinculo: string;
    texto: string;
}

export interface ImovelData {
    tipo: string;
    finalidade: string;
    situacao: string;
    saldoDevedor?: string;
    banco?: string;
    valorImovel?: string;
}

export interface SobreVoceAEJSData {
    operacao: string;
    pretendente: string;
}

export interface OutraPessoaData {
    nome: string;
    cpf: string;
    dataNascimento: string;
    renda: string;
    profissao: string;
    cargo: string;
    ddd: string;
    celular: string;
    email: string;
}
