const Pagamento = require('../models/Pagamento');
const Presenca = require('../models/Presenca');
const Aluno = require('../models/Aluno');
const { hoje } = require('../utils/datas');
const { carregar } = require('./alunoService');

const arredondar = (v) => Math.round(v * 100) / 100;

/** Painel inicial: alunos ativos, situação financeira, presenças do dia, alertas e receita do mês. */
async function resumo() {
  const dia = hoje();
  const mes = dia.slice(0, 7);
  const [ativos, inativos, presencasHoje, pagamentosMes] = await Promise.all([
    carregar({ ativo: true }),
    Aluno.countDocuments({ ativo: false }),
    Presenca.find({ data: dia, status: 'PRESENTE' }).populate('aluno', 'nome').sort({ createdAt: -1 }).lean(),
    Pagamento.find({ dataPagamento: { $regex: `^${mes}` } }).lean(),
  ]);

  const contar = (fn) => ativos.filter(fn).length;
  return {
    data: dia,
    alunos: {
      ativos: ativos.length,
      inativos,
      emDia: contar((a) => a.situacao.status === 'EM_DIA'),
      pendentes: contar((a) => a.situacao.status === 'PENDENTE'),
      inadimplentes: contar((a) => a.situacao.status === 'INADIMPLENTE'),
      bloqueados: contar((a) => a.situacao.bloqueado),
    },
    presencasHoje: {
      total: presencasHoje.length,
      alunos: presencasHoje.map((p) => ({ _id: p.aluno?._id, nome: p.aluno?.nome })),
    },
    receitaMes: {
      mes,
      total: arredondar(pagamentosMes.reduce((s, p) => s + p.valor, 0)),
      quantidade: pagamentosMes.length,
    },
    // RN18: alunos com 5 faltas seguidas ou mais
    alertasFaltas: ativos
      .filter((a) => a.frequencia.alerta)
      .sort((a, b) => b.frequencia.faltasSeguidas - a.frequencia.faltasSeguidas)
      .map((a) => ({ _id: a._id, nome: a.nome, telefone: a.telefone, faltasSeguidas: a.frequencia.faltasSeguidas, responsavel: a.responsavel })),
    inadimplentes: ativos
      .filter((a) => a.situacao.status !== 'EM_DIA')
      .sort((a, b) => b.situacao.diasEmAtraso - a.situacao.diasEmAtraso)
      .map((a) => ({ _id: a._id, nome: a.nome, telefone: a.telefone, status: a.situacao.status, bloqueado: a.situacao.bloqueado, diasEmAtraso: a.situacao.diasEmAtraso, valorDevido: a.situacao.proximaCobranca.valorTotal })),
  };
}

module.exports = { resumo };
