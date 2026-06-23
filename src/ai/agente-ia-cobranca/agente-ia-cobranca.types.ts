export enum IntencaoCobranca {
  PromessaPagamento = 'promessa_pagamento',
  ColetaPresencial = 'coleta_presencial',
  PedidoSegundaVia = 'pedido_segunda_via',
  Renegociacao = 'renegociacao',
  Contestacao = 'contestacao',
  PagamentoRealizado = 'pagamento_realizado',
  ClienteIrritado = 'cliente_irritado',
  DuvidaSobreDivida = 'duvida_sobre_divida',
  SemIntencaoClara = 'sem_intencao_clara',
}

export enum PrioridadeCobranca {
  Baixa = 'baixa',
  Media = 'media',
  Alta = 'alta',
  Critica = 'critica',
}

export enum AcaoRecomendadaCobranca {
  CriarTarefa = 'criar_tarefa',
  PedirConfirmacao = 'pedir_confirmacao',
  EncaminharAtendimento = 'encaminhar_atendimento',
  RegistrarPromessaPagamento = 'registrar_promessa_pagamento',
  RegistrarPagamentoInformado = 'registrar_pagamento_informado',
  EnviarSegundaVia = 'enviar_segunda_via',
  IniciarRenegociacao = 'iniciar_renegociacao',
  RegistrarContestacao = 'registrar_contestacao',
  Nenhuma = 'nenhuma',
}

export enum StatusDividaAberta {
  EmAberto = 'em_aberto',
  Vencida = 'vencida',
  EmRenegociacao = 'em_renegociacao',
  Contestada = 'contestada',
}

export interface EntradaMensagemCobranca {
  id: string;
  telefone: string;
  texto: string;
  recebidaEm: string;
  canal: 'whatsapp';
}

export interface DadosClienteCobranca {
  id: string;
  nome: string;
  telefone: string;
  documentoMascarado?: string;
  identificado: boolean;
  enderecoCadastrado: boolean;
  promessasQuebradas: number;
}

export interface DividaAbertaCobranca {
  id: string;
  descricao?: string;
  valorAtualizado: number;
  vencimento: string;
  diasAtraso: number;
  status: StatusDividaAberta;
}

export interface HistoricoClienteCobranca {
  ultimaInteracao?: string;
  clienteIrritadoRecentemente: boolean;
  observacoes?: string[];
}

export interface EntradaAgenteCobranca {
  mensagem: EntradaMensagemCobranca;
  cliente: DadosClienteCobranca | null;
  dividasAbertas: DividaAbertaCobranca[];
  historico?: HistoricoClienteCobranca;
}

export interface DadosExtraidosCobranca {
  data: string | null;
  horario: string | null;
  valor: number | null;
  enderecoMencionado: boolean;
  comprovanteMencionado: boolean;
}

export interface SaidaAcaoRecomendadaCobranca {
  tipo: AcaoRecomendadaCobranca;
  responsavel: 'cobrador' | 'atendimento' | 'sistema' | null;
  mensagemParaResponsavel: string | null;
}

export interface SaidaAnaliseCobranca {
  clienteIdentificado: boolean;
  intencao: IntencaoCobranca;
  confianca: number;
  prioridade: PrioridadeCobranca;
  resumo: string;
  dadosExtraidos: DadosExtraidosCobranca;
  acaoRecomendada: SaidaAcaoRecomendadaCobranca;
  riscos: string[];
}

export interface ResultadoBuscaClientePorTelefone {
  cliente: DadosClienteCobranca | null;
}

export interface ResultadoConsultaDividasCliente {
  dividasAbertas: DividaAbertaCobranca[];
}

export interface ResultadoConsultaHistoricoCliente {
  historico: HistoricoClienteCobranca;
}

export interface FerramentasAgenteCobranca {
  buscarClientePorTelefone(
    telefone: string,
  ): Promise<ResultadoBuscaClientePorTelefone>;
  consultarDividasCliente(
    clienteId: string,
  ): Promise<ResultadoConsultaDividasCliente>;
  consultarHistoricoCliente(
    clienteId: string,
  ): Promise<ResultadoConsultaHistoricoCliente>;
}
