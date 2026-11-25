const Presenca = require('../models/Presenca');
const AppError = require('../utils/AppError');
const { hoje, dataValida } = require('../utils/datas');
const { buscarDocumento, detalhar } = require('./alunoService');
const { calcularSituacao } = require('./mensalidadeService');

const STATUS = ['PRESENTE', 'FALTA'];

async function registrar(dados = {}, usuario) {
  const erros = [];
  if (!dados.alunoId) erros.push('O campo "alunoId" é obrigatório.');
  const status = String(dados.status || 'PRESENTE').toUpperCase();
  if (!STATUS.includes(status)) erros.push('O campo "status" deve ser PRESENTE ou FALTA.');
  const hojeStr = hoje();
  const data = dados.data || hojeStr;
  if (!dataValida(data)) erros.push('Data inválida. Use o formato AAAA-MM-DD.');
  else if (data > hojeStr) erros.push('Não é possível registrar presença/falta em data futura.');
  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);

  const aluno = await buscarDocumento(dados.alunoId);
  // RN16: aluno inativo não registra presença (nem falta, pois não tem mais dias de treino)
  if (!aluno.ativo) throw new AppError(422, 'Aluno inativo. Reative o cadastro para registrar presença ou falta.');
  if (data < aluno.dataMatricula) {
    throw new AppError(422, 'Não é possível registrar presença/falta antes da data de matrícula.');
  }

  // RN14 / RN16: aluno bloqueado por inadimplência não registra presença
  if (status === 'PRESENTE') {
    const situacao = await calcularSituacao(aluno, aluno.plano, data);
    if (situacao.bloqueado) throw new AppError(403, `Aluno bloqueado: ${situacao.descricao}`, { situacao });
  }

  // RN15: um registro por aluno por dia
  const existente = await Presenca.findOne({ aluno: aluno._id, data }).lean();
  if (existente) {
    throw new AppError(409, `Já existe um registro (${existente.status}) para este aluno em ${data}. Só é permitida uma presença por dia.`);
  }

  try {
    const presenca = await Presenca.create({ aluno: aluno._id, data, status, registradoPor: usuario?._id });
    return presenca.populate('aluno', 'nome cpf');
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, `Já existe um registro para este aluno em ${data}.`);
    throw err;
  }
}

async function listar({ alunoId, data, dataInicio, dataFim } = {}) {
  const filtro = {};
  if (alunoId) filtro.aluno = alunoId;
  if (data) filtro.data = data;
  else if (dataInicio || dataFim) {
    filtro.data = {};
    if (dataInicio) filtro.data.$gte = dataInicio;
    if (dataFim) filtro.data.$lte = dataFim;
  }
  return Presenca.find(filtro).populate('aluno', 'nome cpf').sort({ data: -1, createdAt: -1 });
}

/** Histórico de frequência do aluno: resumo (RN17/RN18) + registros. */
async function historicoDoAluno(alunoId) {
  const aluno = await detalhar(alunoId);
  const registros = await Presenca.find({ aluno: aluno._id }).sort({ data: -1 }).lean();
  return { aluno: { _id: aluno._id, nome: aluno.nome }, ...aluno.frequencia, registros };
}

module.exports = { registrar, listar, historicoDoAluno };
