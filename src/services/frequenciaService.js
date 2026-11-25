const Presenca = require('../models/Presenca');
const { frequencia: regras } = require('../config');
const { hoje, adicionarDias, diaDaSemana } = require('../utils/datas');

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * RN17: falta é contada em dia útil de treino do aluno sem presença, da matrícula até ontem
 * (ou até a inativação). Faltas registradas manualmente também contam, sem duplicar.
 * RN18: com 5 faltas seguidas, o aluno entra na lista de alerta.
 */
function calcularFrequencia(aluno, registros, referencia = hoje()) {
  const presencas = new Set(registros.filter((r) => r.status === 'PRESENTE').map((r) => r.data));
  const faltasRegistradas = new Set(registros.filter((r) => r.status === 'FALTA').map((r) => r.data));

  let ultimoDia = adicionarDias(referencia, -1);
  if (!aluno.ativo && aluno.dataInativacao) {
    const antesDaInativacao = adicionarDias(aluno.dataInativacao, -1);
    if (antesDaInativacao < ultimoDia) ultimoDia = antesDaInativacao;
  }

  const diasTreino = new Set(aluno.diasTreino);
  const faltasAutomaticas = [];
  const esperados = [];
  for (let d = aluno.dataMatricula; d <= ultimoDia; d = adicionarDias(d, 1)) {
    if (!diasTreino.has(diaDaSemana(d))) continue;
    esperados.push(d);
    if (!presencas.has(d) && !faltasRegistradas.has(d)) faltasAutomaticas.push(d);
  }

  // Faltas seguidas: percorre do dia mais recente para trás até encontrar uma presença
  const linhaDoTempo = [...new Set([...esperados, ...presencas, ...faltasRegistradas])].sort().reverse();
  let faltasSeguidas = 0;
  for (const d of linhaDoTempo) {
    if (presencas.has(d)) break;
    faltasSeguidas += 1;
  }

  const totalPresencas = presencas.size;
  const totalFaltas = faltasAutomaticas.length + faltasRegistradas.size;
  const faltas = [
    ...faltasAutomaticas.map((data) => ({ data, origem: 'AUTOMATICA' })),
    ...[...faltasRegistradas].map((data) => ({ data, origem: 'REGISTRADA' })),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  return {
    diasTreino: [...aluno.diasTreino].sort(),
    diasTreinoDescricao: [...aluno.diasTreino].sort().map((d) => NOMES_DIAS[d]).join(', '),
    totalPresencas,
    totalFaltas,
    faltasAutomaticas: faltasAutomaticas.length,
    faltasRegistradas: faltasRegistradas.size,
    faltasSeguidas,
    alerta: aluno.ativo && faltasSeguidas >= regras.faltasSeguidasAlerta,
    frequencia: totalPresencas + totalFaltas ? Number(((totalPresencas / (totalPresencas + totalFaltas)) * 100).toFixed(1)) : null,
    ultimasFaltas: faltas.slice(0, 10),
  };
}

async function frequenciaDoAluno(aluno, referencia = hoje()) {
  const registros = await Presenca.find({ aluno: aluno._id }).lean();
  return calcularFrequencia(aluno, registros, referencia);
}

module.exports = { calcularFrequencia, frequenciaDoAluno, NOMES_DIAS };
