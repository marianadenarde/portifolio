/** RN02: mínimo de 8 caracteres, com pelo menos uma letra e um número. */
function senhaValida(senha) {
  return typeof senha === 'string' && senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}

const REGRA_SENHA = 'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.';

module.exports = { senhaValida, REGRA_SENHA };
