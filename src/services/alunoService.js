const Aluno = require('../models/Aluno');
const Plano = require('../models/Plano');
const AppError = require('../utils/AppError');
const config = require('../config');
const { hoje, dataValida, calcularIdade } = require('../utils/datas');
const { somenteDigitos, cpfValido, telefoneValido } = require('../utils/documentos');
const { calcularSituacao } = require('./situacaoService');

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

async function cadastrar(dados = {}) {
  const erros = [];
  const nome = texto(dados.nome);
  const cpf = somenteDigitos(dados.cpf);
  const telefone = somenteDigitos(dados.telefone);
  const { dataNascimento } = dados;
  const planoInformado = texto(dados.plano);

  // Regra 1: campos obrigatórios
  if (!nome) erros.push('O campo "nome" é obrigatório.');
  if (!dados.cpf) erros.push('O campo "cpf" é obrigatório.');
  else if (!cpfValido(cpf)) erros.push('CPF inválido.');
  if (!dataNascimento) erros.push('O campo "dataNascimento" é obrigatório.');
  else if (!dataValida(dataNascimento)) erros.push('Data de nascimento inválida. Use o formato AAAA-MM-DD.');
  if (!dados.telefone) erros.push('O campo "telefone" é obrigatório.');
  else if (!telefoneValido(telefone)) erros.push('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
  if (!planoInformado) erros.push('O campo "plano" é obrigatório.');

  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);

  // Regra 2: idade mínima de 14 anos; menores de 18 precisam de responsável
  const hojeStr = hoje();
  if (dataNascimento > hojeStr) throw new AppError(400, 'Dados inválidos.', ['Data de nascimento não pode ser futura.']);
  const idade = calcularIdade(dataNascimento, hojeStr);
  if (idade < config.idadeMinima) {
    throw new AppError(422, `Idade mínima para matrícula é de ${config.idadeMinima} anos. O aluno tem ${idade} ano(s).`);
  }

  let responsavel = null;
  if (idade < config.maioridade) {
    const r = dados.responsavel || {};
    const errosResp = [];
    const rNome = texto(r.nome);
    const rCpf = somenteDigitos(r.cpf);
    const rTel = somenteDigitos(r.telefone);
    if (!rNome) errosResp.push('O campo "responsavel.nome" é obrigatório.');
    if (!r.cpf) errosResp.push('O campo "responsavel.cpf" é obrigatório.');
    else if (!cpfValido(rCpf)) errosResp.push('CPF do responsável inválido.');
    else if (rCpf === cpf) errosResp.push('O CPF do responsável deve ser diferente do CPF do aluno.');
    if (!r.telefone) errosResp.push('O campo "responsavel.telefone" é obrigatório.');
    else if (!telefoneValido(rTel)) errosResp.push('Telefone do responsável inválido.');
    if (errosResp.length) {
      throw new AppError(422, `Alunos menores de ${config.maioridade} anos precisam de um responsável cadastrado.`, errosResp);
    }
    responsavel = { nome: rNome, cpf: rCpf, telefone: rTel };
  }

  // Regra 3: plano deve ser um dos planos fixos (aceita id ou código)
  const filtroPlano = /^[0-9a-fA-F]{24}$/.test(planoInformado)
    ? { _id: planoInformado }
    : { codigo: planoInformado.toUpperCase() };
  const plano = await Plano.findOne(filtroPlano);
  if (!plano) throw new AppError(400, 'Plano inexistente. Consulte GET /api/planos.');

  if (await Aluno.exists({ cpf })) throw new AppError(409, 'Já existe um aluno cadastrado com este CPF.');

  const aluno = await Aluno.create({
    nome,
    cpf,
    dataNascimento,
    telefone,
    plano: plano._id,
    dataMatricula: hojeStr,
    responsavel,
  });
  return detalhar(aluno._id);
}

async function montar(aluno) {
  const obj = aluno.toObject ? aluno.toObject() : aluno;
  return {
    ...obj,
    idade: calcularIdade(obj.dataNascimento),
    situacao: await calcularSituacao(obj),
  };
}

async function listar({ busca, status } = {}) {
  const filtro = {};
  if (busca) {
    const termo = String(busca).trim();
    const digitos = somenteDigitos(termo);
    const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filtro.$or = [{ nome: { $regex: escapado, $options: 'i' } }];
    if (digitos) filtro.$or.push({ cpf: { $regex: digitos } });
  }
  const alunos = await Aluno.find(filtro).populate('plano').sort({ nome: 1 });
  const resultado = await Promise.all(alunos.map(montar));
  return status ? resultado.filter((a) => a.situacao.status === String(status).toUpperCase()) : resultado;
}

async function buscarDocumento(id) {
  const aluno = await Aluno.findById(id).populate('plano');
  if (!aluno) throw new AppError(404, 'Aluno não encontrado.');
  return aluno;
}

async function detalhar(id) {
  return montar(await buscarDocumento(id));
}

module.exports = { cadastrar, listar, detalhar, buscarDocumento };
