const { timeZone } = require('../config');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Retorna a data de hoje (no fuso da aplicação) no formato YYYY-MM-DD. */
function hoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/** Valida uma string YYYY-MM-DD que represente uma data real. */
function dataValida(valor) {
  if (typeof valor !== 'string' || !REGEX_DATA.test(valor)) return false;
  const d = paraDate(valor);
  return !Number.isNaN(d.getTime()) && formatar(d) === valor;
}

/** Converte YYYY-MM-DD em Date à meia-noite UTC. */
function paraDate(valor) {
  return new Date(`${valor}T00:00:00.000Z`);
}

/** Converte Date (UTC) em YYYY-MM-DD. */
function formatar(data) {
  return data.toISOString().slice(0, 10);
}

function adicionarDias(valor, dias) {
  const d = paraDate(valor);
  d.setUTCDate(d.getUTCDate() + dias);
  return formatar(d);
}

/** Soma meses mantendo o dia, limitado ao último dia do mês de destino. */
function adicionarMeses(valor, meses) {
  const [ano, mes, dia] = valor.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return formatar(alvo);
}

/** Diferença em dias (b - a). */
function diferencaEmDias(a, b) {
  return Math.round((paraDate(b) - paraDate(a)) / 86400000);
}

/** Idade completa em anos na data de referência. */
function calcularIdade(nascimento, referencia = hoje()) {
  const [an, mn, dn] = nascimento.split('-').map(Number);
  const [ar, mr, dr] = referencia.split('-').map(Number);
  let idade = ar - an;
  if (mr < mn || (mr === mn && dr < dn)) idade -= 1;
  return idade;
}

module.exports = {
  hoje,
  dataValida,
  paraDate,
  formatar,
  adicionarDias,
  adicionarMeses,
  diferencaEmDias,
  calcularIdade,
};
