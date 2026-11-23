const Pagamento = require('../models/Pagamento');
const { hoje, diferencaEmDias } = require('../utils/datas');
const { diasParaBloqueio } = require('../config');

/**
 * Calcula a situação financeira de um aluno.
 *
 * - O "vencimento" é o fim do período coberto pelo último pagamento.
 *   Se o aluno nunca pagou, o vencimento é a própria data de matrícula.
 * - EM_DIA: hoje é anterior ou igual ao vencimento.
 * - INADIMPLENTE: de 1 a 30 dias após o vencimento.
 * - BLOQUEADO: mais de 30 dias após o vencimento (regra 4) — não pode registrar presença.
 */
async function calcularSituacao(aluno, referencia = hoje()) {
  const ultimo = await Pagamento.findOne({ aluno: aluno._id }).sort({ periodoFim: -1 }).lean();
  const vencimento = ultimo ? ultimo.periodoFim : aluno.dataMatricula;
  const diasEmAtraso = Math.max(0, diferencaEmDias(vencimento, referencia));

  let status = 'EM_DIA';
  if (diasEmAtraso > diasParaBloqueio) status = 'BLOQUEADO';
  else if (diasEmAtraso > 0) status = 'INADIMPLENTE';

  const descricoes = {
    EM_DIA: 'Pagamento em dia.',
    INADIMPLENTE: `Inadimplente há ${diasEmAtraso} dia(s). Bloqueio após ${diasParaBloqueio} dias.`,
    BLOQUEADO: `Inadimplente há ${diasEmAtraso} dias. Registro de presença bloqueado.`,
  };

  return {
    status,
    descricao: descricoes[status],
    pagoAte: ultimo ? ultimo.periodoFim : null,
    vencimento,
    diasEmAtraso,
    ultimoPagamento: ultimo ? ultimo.dataPagamento : null,
    podeRegistrarPresenca: status !== 'BLOQUEADO',
  };
}

module.exports = { calcularSituacao };
