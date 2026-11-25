const Aluno = require('../models/Aluno');
const Plano = require('../models/Plano');
const Pagamento = require('../models/Pagamento');
const Presenca = require('../models/Presenca');
const AppError = require('../utils/AppError');
const config = require('../config');
const { hoje, dataValida, calcularIdade } = require('../utils/datas');
const { somenteDigitos, cpfValido, telefoneValido } = require('../utils/documentos');
const { montarSituacao } = require('./mensalidadeService');
const { calcularFrequencia } = require('./frequenciaService');

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const DIAS_PADRAO = [1, 2, 3, 4, 5];

async function resolverPlano(valor) {
  const informado = texto(valor);
  const filtro = /^[0-9a-fA-F]{24}$/.test(informado) ? { _id: informado } : { codigo: informado.toUpperCase() };
  const plano = await Plano.findOne(filtro);
  if (!plano) throw new AppError(400, 'Plano inexistente. Consulte GET /api/planos.');
  return plano;
}

/** Valida e normaliza os dados do aluno (RN05, RN06, RN07, RN17). Usado no cadastro e na edição. */
async function validarDados(dados, idAtual = null) {
  const erros = [];
  const nome = texto(dados.nome);
  const cpf = somenteDigitos(dados.cpf);
  const telefone = somenteDigitos(dados.telefone);
  const { dataNascimento } = dados;

  // RN05: campos obrigatórios
  if (!nome) erros.push('O campo "nome" é obrigatório.');
  if (!dados.cpf) erros.push('O campo "cpf" é obrigatório.');
  else if (!cpfValido(cpf)) erros.push('CPF inválido.'); // RN06
  if (!dataNascimento) erros.push('O campo "dataNascimento" é obrigatório.');
  else if (!dataValida(dataNascimento)) erros.push('Data de nascimento inválida. Use o formato AAAA-MM-DD.');
  else if (dataNascimento > hoje()) erros.push('Data de nascimento não pode ser futura.');
  if (!dados.telefone) erros.push('O campo "telefone" é obrigatório.');
  else if (!telefoneValido(telefone)) erros.push('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
  if (!texto(dados.plano)) erros.push('O campo "plano" é obrigatório.');

  // RN17: dias de treino (1 = segunda ... 5 = sexta)
  let diasTreino = dados.diasTreino ?? DIAS_PADRAO;
  if (!Array.isArray(diasTreino) || !diasTreino.length || diasTreino.some((d) => !Number.isInteger(Number(d)) || d < 1 || d > 5)) {
    erros.push('O campo "diasTreino" deve ser uma lista com pelo menos um dia útil (1 = segunda ... 5 = sexta).');
  } else {
    diasTreino = [...new Set(diasTreino.map(Number))].sort();
  }

  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);

  // RN07: idade mínima e responsável para menores
  const idade = calcularIdade(dataNascimento);
  if (idade < config.idadeMinima) {
    throw new AppError(422, `Idade mínima para matrícula é de ${config.idadeMinima} anos. O aluno tem ${idade} ano(s).`);
  }
  let responsavel = null;
  if (idade < config.maioridade) {
    const r = dados.responsavel || {};
    const errosResp = [];
    const rCpf = somenteDigitos(r.cpf);
    if (!texto(r.nome)) errosResp.push('O campo "responsavel.nome" é obrigatório.');
    if (!r.cpf) errosResp.push('O campo "responsavel.cpf" é obrigatório.');
    else if (!cpfValido(rCpf)) errosResp.push('CPF do responsável inválido.');
    else if (rCpf === cpf) errosResp.push('O CPF do responsável deve ser diferente do CPF do aluno.');
    if (!r.telefone) errosResp.push('O campo "responsavel.telefone" é obrigatório.');
    else if (!telefoneValido(r.telefone)) errosResp.push('Telefone do responsável inválido.');
    if (errosResp.length) {
      throw new AppError(422, `Alunos menores de ${config.maioridade} anos precisam de um responsável cadastrado.`, errosResp);
    }
    responsavel = { nome: texto(r.nome), cpf: rCpf, telefone: somenteDigitos(r.telefone) };
  }

  const plano = await resolverPlano(dados.plano);

  // RN06: CPF único
  const duplicado = await Aluno.findOne({ cpf, ...(idAtual && { _id: { $ne: idAtual } }) });
  if (duplicado) throw new AppError(409, 'Já existe um aluno cadastrado com este CPF.');

  return { nome, cpf, dataNascimento, telefone, plano: plano._id, responsavel, diasTreino };
}

async function cadastrar(dados = {}) {
  const valores = await validarDados(dados);
  const aluno = await Aluno.create({ ...valores, dataMatricula: hoje() });
  return detalhar(aluno._id);
}

/** Edição parcial: os campos não enviados mantêm o valor atual, e o resultado é validado por inteiro. */
async function atualizar(id, dados = {}) {
  const aluno = await buscarDocumento(id);
  const atual = aluno.toObject();
  const mesclado = {
    nome: dados.nome ?? atual.nome,
    cpf: dados.cpf ?? atual.cpf,
    dataNascimento: dados.dataNascimento ?? atual.dataNascimento,
    telefone: dados.telefone ?? atual.telefone,
    plano: dados.plano ?? atual.plano._id.toString(),
    diasTreino: dados.diasTreino ?? atual.diasTreino,
    responsavel: dados.responsavel !== undefined ? dados.responsavel : atual.responsavel,
  };
  const valores = await validarDados(mesclado, aluno._id);
  aluno.set(valores);
  await aluno.save();
  return detalhar(aluno._id);
}

/** RN08: o aluno não é excluído, é inativado. Histórico de pagamentos e frequência é mantido. */
async function inativar(id, motivo) {
  const aluno = await buscarDocumento(id);
  if (!aluno.ativo) throw new AppError(409, 'O aluno já está inativo.');
  aluno.set({ ativo: false, dataInativacao: hoje(), motivoInativacao: texto(motivo) || null });
  await aluno.save();
  return detalhar(aluno._id);
}

async function reativar(id) {
  const aluno = await buscarDocumento(id);
  if (aluno.ativo) throw new AppError(409, 'O aluno já está ativo.');
  aluno.set({ ativo: true, dataInativacao: null, motivoInativacao: null });
  await aluno.save();
  return detalhar(aluno._id);
}

/** Monta a visão completa do aluno com situação financeira e frequência. */
function montar(aluno, ultimoPagamento, registros, referencia = hoje()) {
  const obj = aluno.toObject ? aluno.toObject() : aluno;
  return {
    ...obj,
    idade: calcularIdade(obj.dataNascimento, referencia),
    situacao: montarSituacao(obj, obj.plano, ultimoPagamento, referencia),
    frequencia: calcularFrequencia(obj, registros, referencia),
  };
}

/** Carrega alunos com último pagamento e registros de presença em poucas consultas. */
async function carregar(filtro = {}) {
  const alunos = await Aluno.find(filtro).populate('plano').sort({ nome: 1 });
  const ids = alunos.map((a) => a._id);
  const [ultimos, registros] = await Promise.all([
    Pagamento.aggregate([
      { $match: { aluno: { $in: ids } } },
      { $sort: { periodoFim: -1 } },
      { $group: { _id: '$aluno', doc: { $first: '$$ROOT' } } },
    ]),
    Presenca.find({ aluno: { $in: ids } }).lean(),
  ]);
  const ultimoPorAluno = new Map(ultimos.map((u) => [u._id.toString(), u.doc]));
  const registrosPorAluno = new Map();
  for (const r of registros) {
    const k = r.aluno.toString();
    if (!registrosPorAluno.has(k)) registrosPorAluno.set(k, []);
    registrosPorAluno.get(k).push(r);
  }
  return alunos.map((a) => montar(a, ultimoPorAluno.get(a._id.toString()), registrosPorAluno.get(a._id.toString()) || []));
}

/**
 * Consulta de alunos.
 * - ativo: "true" (padrão), "false" ou "todos"
 * - status: EM_DIA, PENDENTE, INADIMPLENTE ou BLOQUEADO
 * - alerta: "true" para alunos com 5 faltas seguidas ou mais (RN18)
 */
async function listar({ busca, status, ativo = 'true', alerta } = {}) {
  const filtro = {};
  if (ativo === 'true' || ativo === true) filtro.ativo = true;
  else if (ativo === 'false' || ativo === false) filtro.ativo = false;
  if (busca) {
    const termo = String(busca).trim();
    const digitos = somenteDigitos(termo);
    const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filtro.$or = [{ nome: { $regex: escapado, $options: 'i' } }];
    if (digitos) filtro.$or.push({ cpf: { $regex: digitos } });
  }
  let resultado = await carregar(filtro);
  if (status) {
    const s = String(status).toUpperCase();
    resultado = resultado.filter((a) => (s === 'BLOQUEADO' ? a.situacao.bloqueado : a.situacao.status === s));
  }
  if (alerta === 'true' || alerta === true) resultado = resultado.filter((a) => a.frequencia.alerta);
  return resultado;
}

async function buscarDocumento(id) {
  const aluno = await Aluno.findById(id).populate('plano');
  if (!aluno) throw new AppError(404, 'Aluno não encontrado.');
  return aluno;
}

async function detalhar(id) {
  const aluno = await buscarDocumento(id);
  const [completo] = await carregar({ _id: aluno._id });
  return completo;
}

module.exports = { cadastrar, atualizar, inativar, reativar, listar, detalhar, buscarDocumento, carregar };
