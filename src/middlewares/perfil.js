const AppError = require('../utils/AppError');

/** RN04: restringe a rota aos perfis informados. Use depois de `autenticar`. */
function exigirPerfil(...perfis) {
  return (req, _res, next) => {
    if (!perfis.includes(req.usuario?.perfil)) {
      throw new AppError(403, `Ação permitida apenas para o perfil ${perfis.join(' ou ')}.`);
    }
    next();
  };
}

module.exports = exigirPerfil;
