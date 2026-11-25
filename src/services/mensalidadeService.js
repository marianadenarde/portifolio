const Pagamento = require('../models/Pagamento');
const { mensalidade: regras } = require('../config');
const { hoje, adicionarMeses, diferencaEmDias } = require('../utils/datas');

const arredondar = (v) => Math.round(v * 100) / 100;

/**
 * RN11: até o vencimento ou com até 5 dias de atraso, paga-se o valor do plano.
 * A partir do 6º dia, multa de 2% + juros de 0,1% por dia de atraso (contados desde o vencimento).
 */
function calcularCobranca(valorPlano, vencimento, dataPagamento = hoje()) {
  const diasAtraso = Math.max(0, diferencaEmDias(vencimento, dataPagamento));
  let multa = 0;
  let juros = 0;
  if (diasAtraso > regras.diasTolerancia) {
    multa = arredondar(valorPlano * regras.multa);
    juros = arredondar(valorPlano * regras.jurosAoDia * diasAtraso);
  }
  return { vencimento, diasAtraso, valorPlano, multa, juros, valorTotal: arredondar(valorPlano + multa + juros) };
}

/** Dia do mês da matrícula, usado como dia de vencimento (RN10). */
const diaVencimento = (aluno) => Number(aluno.dataMatricula.slice(8, 10));

async function ultimoPagamento(alunoId) {
  return Pagamento.findOne({ aluno: alunoId }).sort({ periodoFim: -1 }).lean();
}

/**
 * Próximo período em aberto. Cada pagamento quita o período mais antigo ainda não pago;
 * o vencimento é o início do período e cai sempre no dia da matrícula (RN10).
 */
function proximoPeriodo(aluno, plano, ultimo) {
  const inicio = ultimo ? ultimo.periodoFim : aluno.dataMatricula;
  return { inicio, fim: adicionarMeses(inicio, plano.duracaoMeses, diaVencimento(aluno)) };
}

/**
 * RN12: EM_DIA (sem atraso), PENDENTE (1 a 5 dias de atraso), INADIMPLENTE (mais de 5 dias).
 * RN14: inadimplente há mais de 30 dias fica bloqueado para registrar presença.
 * RN16: aluno inativo também não registra presença.
 */
function montarSituacao(aluno, plano, ultimo, referencia = hoje()) {
  const vencimento = ultimo ? ultimo.periodoFim : aluno.dataMatricula;
  const diasEmAtraso = Math.max(0, diferencaEmDias(vencimento, referencia));

  let status = 'EM_DIA';
  if (diasEmAtraso > regras.diasTolerancia) status = 'INADIMPLENTE';
  else if (diasEmAtraso > 0) status = 'PENDENTE';
  const bloqueado = diasEmAtraso > regras.diasParaBloqueio;

  let descricao;
  if (status === 'EM_DIA') descricao = vencimento === referencia ? 'Mensalidade vence hoje.' : 'Mensalidade em dia.';
  else if (status === 'PENDENTE') descricao = `${diasEmAtraso} dia(s) de atraso, dentro da tolerância de ${regras.diasTolerancia} dias (sem multa).`;
  else if (bloqueado) descricao = `Inadimplente há ${diasEmAtraso} dias. Registro de presença bloqueado.`;
  else descricao = `Inadimplente há ${diasEmAtraso} dias. Multa e juros aplicados. Bloqueio após ${regras.diasParaBloqueio} dias.`;
  if (!aluno.ativo) descricao = `Aluno inativo. ${descricao}`;

  return {
    status,
    descricao,
    bloqueado,
    ativo: aluno.ativo,
    diaVencimento: diaVencimento(aluno),
    pagoAte: ultimo ? ultimo.periodoFim : null,
    vencimento,
    diasEmAtraso,
    ultimoPagamento: ultimo ? ultimo.dataPagamento : null,
    proximaCobranca: plano ? calcularCobranca(plano.valor, vencimento, referencia) : null,
    podeRegistrarPresenca: aluno.ativo && !bloqueado,
  };
}

async function calcularSituacao(aluno, plano, referencia = hoje()) {
  return montarSituacao(aluno, plano, await ultimoPagamento(aluno._id), referencia);
}

module.exports = { calcularCobranca, proximoPeriodo, ultimoPagamento, montarSituacao, calcularSituacao };
