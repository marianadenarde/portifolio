const AppError = require('../utils/AppError');
const { hoje, mesValido } = require('../utils/datas');
const { listar } = require('./pagamentoService');

const arredondar = (v) => Math.round(v * 100) / 100;

/** Relatório mensal de recebimentos. */
async function recebimentos(mes = hoje().slice(0, 7)) {
  if (!mesValido(mes)) throw new AppError(400, 'Mês inválido. Use o formato AAAA-MM.');
  const pagamentos = await listar({ mes });
  const somar = (lista, campo) => arredondar(lista.reduce((s, p) => s + p[campo], 0));
  const agrupar = (chave) => {
    const grupos = new Map();
    for (const p of pagamentos) {
      const k = chave(p);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(p);
    }
    return [...grupos.entries()].map(([nome, lista]) => ({ nome, quantidade: lista.length, total: somar(lista, 'valor') }))
      .sort((a, b) => b.total - a.total);
  };
  return {
    mes,
    quantidade: pagamentos.length,
    total: somar(pagamentos, 'valor'),
    totalPlanos: somar(pagamentos, 'valorPlano'),
    totalMultas: somar(pagamentos, 'multa'),
    totalJuros: somar(pagamentos, 'juros'),
    porFormaPagamento: agrupar((p) => p.formaPagamento),
    porPlano: agrupar((p) => p.plano?.nome || '—'),
    pagamentos,
  };
}

module.exports = { recebimentos };
