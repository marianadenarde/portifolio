const Pagamento = require('../models/Pagamento');
const AppError = require('../utils/AppError');
const { hoje, dataValida, adicionarMeses } = require('../utils/datas');
const { buscarDocumento } = require('./alunoService');
const { calcularSituacao } = require('./situacaoService');

const FORMAS = ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'];

/**
 * Registra o pagamento de um período do plano do aluno.
 * O valor é sempre o valor fixo do plano (regra 3). O período pago começa no
 * fim do período anterior (ou na matrícula, se for o primeiro pagamento),
 * de modo que meses em atraso são quitados antes de avançar a validade.
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
  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);

  const aluno = await buscarDocumento(dados.alunoId);
  const plano = aluno.plano;

  if (dados.valor !== undefined && Number(dados.valor) !== plano.valor) {
    throw new AppError(422, `O valor do plano ${plano.nome} é fixo: R$ ${plano.valor.toFixed(2)}.`);
  }

  const anterior = await Pagamento.findOne({ aluno: aluno._id }).sort({ periodoFim: -1 }).lean();
  const periodoInicio = anterior ? anterior.periodoFim : aluno.dataMatricula;
  const periodoFim = adicionarMeses(periodoInicio, plano.duracaoMeses);

  const pagamento = await Pagamento.create({
    aluno: aluno._id,
    plano: plano._id,
    valor: plano.valor,
    formaPagamento,
    dataPagamento,
    periodoInicio,
    periodoFim,
    registradoPor: usuario?._id,
  });

  return {
    pagamento: await pagamento.populate([{ path: 'plano' }, { path: 'aluno', select: 'nome cpf' }]),
    situacao: await calcularSituacao(aluno),
  };
}

async function listar({ alunoId } = {}) {
  const filtro = alunoId ? { aluno: alunoId } : {};
  return Pagamento.find(filtro)
    .populate('plano')
    .populate('aluno', 'nome cpf')
    .sort({ dataPagamento: -1, createdAt: -1 });
}

module.exports = { registrar, listar, FORMAS };
