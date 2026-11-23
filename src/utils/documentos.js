const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

/** Valida CPF pelos dígitos verificadores. Recebe com ou sem máscara. */
function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digitos = cpf.split('').map(Number);
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += digitos[i] * (n + 1 - i);
    const resto = ((soma * 10) % 11) % 10;
    if (resto !== digitos[n]) return false;
  }
  return true;
}

/** Telefone brasileiro com DDD: 10 (fixo) ou 11 (celular) dígitos. */
function telefoneValido(valor) {
  const tel = somenteDigitos(valor);
  return tel.length === 10 || tel.length === 11;
}

module.exports = { somenteDigitos, cpfValido, telefoneValido };
