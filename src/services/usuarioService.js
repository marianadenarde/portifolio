const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const AppError = require('../utils/AppError');
const { jwtSecret, jwtExpiresIn, login: regras } = require('../config');
const { senhaValida, REGRA_SENHA } = require('../utils/senha');

const PERFIS = ['ADMIN', 'RECEPCAO'];

/**
 * RN01: só usuários cadastrados acessam o sistema.
 * RN03: 3 tentativas erradas seguidas bloqueiam o usuário por 15 minutos.
 */
async function autenticar(email, senha) {
  if (!email || !senha) throw new AppError(400, 'Informe "email" e "senha".');
  const usuario = await Usuario.findOne({ email: String(email).toLowerCase().trim() });
  if (!usuario) throw new AppError(401, 'E-mail ou senha inválidos.');

  const agora = new Date();
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) {
    const minutos = Math.ceil((usuario.bloqueadoAte - agora) / 60000);
    throw new AppError(423, `Usuário bloqueado por excesso de tentativas. Tente novamente em ${minutos} minuto(s).`, {
      bloqueadoAte: usuario.bloqueadoAte,
    });
  }

  if (!(await bcrypt.compare(String(senha), usuario.senhaHash))) {
    usuario.tentativasFalhas += 1;
    if (usuario.tentativasFalhas >= regras.maxTentativas) {
      usuario.tentativasFalhas = 0;
      usuario.bloqueadoAte = new Date(agora.getTime() + regras.minutosBloqueio * 60000);
      await usuario.save();
      throw new AppError(423, `Usuário bloqueado por ${regras.minutosBloqueio} minutos após ${regras.maxTentativas} tentativas erradas.`, {
        bloqueadoAte: usuario.bloqueadoAte,
      });
    }
    await usuario.save();
    const restantes = regras.maxTentativas - usuario.tentativasFalhas;
    throw new AppError(401, `E-mail ou senha inválidos. ${restantes} tentativa(s) restante(s) antes do bloqueio.`);
  }

  usuario.tentativasFalhas = 0;
  usuario.bloqueadoAte = null;
  await usuario.save();
  const token = jwt.sign({ sub: usuario._id.toString(), perfil: usuario.perfil }, jwtSecret, { expiresIn: jwtExpiresIn });
  return { token, tipo: 'Bearer', expiraEm: jwtExpiresIn, usuario };
}

async function listar() {
  return Usuario.find().sort({ nome: 1 });
}

async function criar(dados = {}) {
  const erros = [];
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  const email = typeof dados.email === 'string' ? dados.email.trim().toLowerCase() : '';
  const perfil = String(dados.perfil || '').toUpperCase();
  if (!nome) erros.push('O campo "nome" é obrigatório.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('Informe um e-mail válido.');
  if (!senhaValida(dados.senha)) erros.push(REGRA_SENHA); // RN02
  if (!PERFIS.includes(perfil)) erros.push('O campo "perfil" deve ser ADMIN ou RECEPCAO.');
  if (erros.length) throw new AppError(400, 'Dados inválidos.', erros);
  if (await Usuario.exists({ email })) throw new AppError(409, 'Já existe um usuário com este e-mail.');
  return Usuario.create({ nome, email, perfil, senhaHash: await bcrypt.hash(dados.senha, 10) });
}

async function alterarSenha(usuario, { senhaAtual, novaSenha } = {}) {
  if (!senhaAtual || !novaSenha) throw new AppError(400, 'Informe "senhaAtual" e "novaSenha".');
  if (!(await bcrypt.compare(String(senhaAtual), usuario.senhaHash))) throw new AppError(422, 'A senha atual está incorreta.');
  if (!senhaValida(novaSenha)) throw new AppError(400, 'Dados inválidos.', [REGRA_SENHA]); // RN02
  usuario.senhaHash = await bcrypt.hash(novaSenha, 10);
  await usuario.save();
}

async function desbloquear(id) {
  const usuario = await Usuario.findById(id);
  if (!usuario) throw new AppError(404, 'Usuário não encontrado.');
  usuario.tentativasFalhas = 0;
  usuario.bloqueadoAte = null;
  await usuario.save();
  return usuario;
}

module.exports = { autenticar, listar, criar, alterarSenha, desbloquear };
