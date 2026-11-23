const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

function naoEncontrado(req, _res, next) {
  next(new AppError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, ...(err.detalhes && { detalhes: err.detalhes }) });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ erro: `Identificador inválido: ${err.value}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ erro: 'Dados inválidos.', detalhes: Object.values(err.errors).map((e) => e.message) });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ erro: 'Registro duplicado.', detalhes: err.keyValue });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { naoEncontrado, tratarErros };
