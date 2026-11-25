const Pagamento = require('../models/Pagamento');
const AppError = require('../utils/AppError');
const { hoje, dataValida } = require('../utils/datas');
const { buscarDocumento } = require('./alunoService');
const { calcularCobranca, proximoPeriodo, ultimoPagamento, calcularSituacao } = require('./mensalidadeService');

const FORMAS = ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'];

/** Valor a pagar pelo próximo período em aberto, na data informada (RN09, RN10, RN11). */
async function simular(alunoId, dataPagamento = hoje()) {
  if (!dataValida(dataPagamento)) throw new AppError(400, 'Data inválida. Use o formato AAAA-MM-DD.');
  const aluno = await buscarDocumento(alunoId);
  const plano = aluno.plano;
  const periodo = proximoPeriodo(aluno, plano, await ultimoPagamento(aluno._id));
  return {
    aluno: { _id: aluno._id, nome: aluno.nome },
    plano,
    dataPagamento,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    ...calcularCobranca(plano.valor, periodo.inicio, dataPagamento),
  };
}

/**
 * Registra o pagamento do período mais antigo em aberto.
 * O valor é calculado pelo sistema: valor fixo do plano + multa e juros, se houver.
 */
async function registrar(dados = {}, usuario) {
  const erros = [];
  if (!dados.alunoId) erros.push('O campo "alunoId" é obrigatório.');
  const formaPagamento = String(dados.formaPagamento || '').toUpperCase();
  if (!FORMAS.includes(formaPagamento)) erros.push(`O campo "formaPagamento" deve ser um de: ${FORMAS.join(', ')}.`);
  const hojeStr = hoje();
  const dataPagamento = dados.dataPagamento || hojeStr;
  if (!dataValida(dataPagamento)) erros.push('Data de pagamento inválida. Use o formato AAAA-MM-DD.');
  else if (dataPagamento > hojeStr) erros.push('Data de pagamento não pode ser futura.');
  // RN13: o valor pago não pode ser zero nem negativo
  if (dados.valor !== undefined && !(Number(dados.valor) > 0)) erros.push('O valor pago deve ser maior que zero.');
  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);

  const aluno = await buscarDocumento(dados.alunoId);
  if (!aluno.ativo) throw new AppError(422, 'Aluno inativo. Reative o cadastro para registrar pagamentos.');
  const plano = aluno.plano;
  const periodo = proximoPeriodo(aluno, plano, await ultimoPagamento(aluno._id));
  const cobranca = calcularCobranca(plano.valor, periodo.inicio, dataPagamento);

  if (dados.valor !== undefined && Number(dados.valor) !== cobranca.valorTotal) {
    throw new AppError(
      422,
      `O valor a pagar é R$ ${cobranca.valorTotal.toFixed(2)} (plano R$ ${plano.valor.toFixed(2)} + multa R$ ${cobranca.multa.toFixed(2)} + juros R$ ${cobranca.juros.toFixed(2)}).`,
      { cobranca }
    );
  }

  const pagamento = await Pagamento.create({
    aluno: aluno._id,
    plano: plano._id,
    formaPagamento,
    dataPagamento,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    vencimento: cobranca.vencimento,
    diasAtraso: cobranca.diasAtraso,
    valorPlano: cobranca.valorPlano,
    multa: cobranca.multa,
    juros: cobranca.juros,
    valor: cobranca.valorTotal,
    registradoPor: usuario?._id,
  });

  return {
    pagamento: await pagamento.populate([{ path: 'plano' }, { path: 'aluno', select: 'nome cpf' }]),
    situacao: await calcularSituacao(aluno, plano),
  };
}

async function listar({ alunoId, mes } = {}) {
  const filtro = {};
  if (alunoId) filtro.aluno = alunoId;
  if (mes) filtro.dataPagamento = { $regex: `^${mes}` };
  return Pagamento.find(filtro)
    .populate('plano')
    .populate('aluno', 'nome cpf')
    .sort({ dataPagamento: -1, createdAt: -1 });
}

module.exports = { registrar, simular, listar, FORMAS };
