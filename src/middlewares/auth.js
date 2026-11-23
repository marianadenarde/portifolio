const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const Usuario = require('../models/Usuario');
const AppError = require('../utils/AppError');

async function autenticar(req, _res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de autenticação não informado.');
  }
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new AppError(401, 'Token inválido ou expirado.');
  }
  const usuario = await Usuario.findById(payload.sub);
  if (!usuario) throw new AppError(401, 'Usuário do token não encontrado.');
  req.usuario = usuario;
  next();
}

module.exports = autenticar;
