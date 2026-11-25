const { timeZone } = require('../config');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje (no fuso da aplicação) no formato YYYY-MM-DD. */
function hoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/** Valida uma string YYYY-MM-DD que represente uma data real. */
function dataValida(valor) {
  if (typeof valor !== 'string' || !REGEX_DATA.test(valor)) return false;
  const d = paraDate(valor);
  return !Number.isNaN(d.getTime()) && formatar(d) === valor;
}

/** Valida YYYY-MM. */
function mesValido(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function paraDate(valor) {
  return new Date(`${valor}T00:00:00.000Z`);
}

function formatar(data) {
  return data.toISOString().slice(0, 10);
}

function adicionarDias(valor, dias) {
  const d = paraDate(valor);
  d.setUTCDate(d.getUTCDate() + dias);
  return formatar(d);
}

/**
 * Soma meses e coloca a data no dia `diaAncora` (padrão: o próprio dia de `valor`),
 * limitado ao último dia do mês. Mantém o vencimento sempre no dia da matrícula (RN10):
 * matrícula em 31/01 vence em 28/02, 31/03, 30/04...
 */
function adicionarMeses(valor, meses, diaAncora) {
  const [ano, mes, dia] = valor.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(diaAncora || dia, ultimoDia));
  return formatar(alvo);
}

/** Diferença em dias (b - a). */
function diferencaEmDias(a, b) {
  return Math.round((paraDate(b) - paraDate(a)) / 86400000);
}

/** Dia da semana: 0 = domingo ... 6 = sábado. */
function diaDaSemana(valor) {
  return paraDate(valor).getUTCDay();
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
  mesValido,
  paraDate,
  formatar,
  adicionarDias,
  adicionarMeses,
  diferencaEmDias,
  diaDaSemana,
  calcularIdade,
};
