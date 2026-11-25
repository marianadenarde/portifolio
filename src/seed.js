const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario');
const Plano = require('./models/Plano');
const Aluno = require('./models/Aluno');
const Pagamento = require('./models/Pagamento');
const Presenca = require('./models/Presenca');
const { hoje, adicionarDias, adicionarMeses, diaDaSemana } = require('./utils/datas');
const { calcularCobranca } = require('./services/mensalidadeService');

// 3 usuários (senhas seguem a RN02: 8+ caracteres, com letra e número)
const USUARIOS = [
  { nome: 'Administrador', email: 'admin@academia.com', senha: 'admin123', perfil: 'ADMIN' },
  { nome: 'Recepção', email: 'recepcao@academia.com', senha: 'recepcao123', perfil: 'RECEPCAO' },
  { nome: 'Recepção Noite', email: 'recepcao2@academia.com', senha: 'recepcao456', perfil: 'RECEPCAO' },
];

// 3 produtos (planos)
const PLANOS = [
  { codigo: 'MENSAL', nome: 'Mensal', duracaoMeses: 1, valor: 100 },
  { codigo: 'TRIMESTRAL', nome: 'Trimestral', duracaoMeses: 3, valor: 270 },
  { codigo: 'SEMESTRAL', nome: 'Semestral', duracaoMeses: 6, valor: 500 },
];

/**
 * Cria um aluno com `qtd` pagamentos consecutivos, o último terminando perto de `pagoAte`.
 * `atrasos` define com quantos dias de atraso cada pagamento foi feito (gera multa/juros quando > 5).
 * As datas são relativas a hoje, para que cada aluno esteja sempre na mesma situação.
 */
async function criarAluno(dados, plano, qtd, pagoAte, admin, atrasos = []) {
  const dataMatricula = adicionarMeses(pagoAte, -plano.duracaoMeses * qtd);
  const dia = Number(dataMatricula.slice(8, 10));
  const aluno = await Aluno.create({ ...dados, plano: plano._id, dataMatricula });
  let inicio = dataMatricula;
  for (let i = 0; i < qtd; i++) {
    const fim = adicionarMeses(inicio, plano.duracaoMeses, dia);
    const dataPagamento = adicionarDias(inicio, atrasos[i] || 0);
    const c = calcularCobranca(plano.valor, inicio, dataPagamento);
    await Pagamento.create({
      aluno: aluno._id,
      plano: plano._id,
      formaPagamento: ['PIX', 'CARTAO_DEBITO', 'DINHEIRO', 'CARTAO_CREDITO'][i % 4],
      dataPagamento,
      periodoInicio: inicio,
      periodoFim: fim,
      vencimento: inicio,
      diasAtraso: c.diasAtraso,
      valorPlano: c.valorPlano,
      multa: c.multa,
      juros: c.juros,
      valor: c.valorTotal,
      registradoPor: admin._id,
    });
    inicio = fim;
  }
  return aluno;
}

/** Presenças nos dias de treino entre `de` e `ate`, faltando a cada `faltaACada` treinos. */
function presencasNosTreinos(aluno, de, ate, faltaACada, admin) {
  const registros = [];
  let n = 0;
  for (let d = de; d <= ate; d = adicionarDias(d, 1)) {
    if (!aluno.diasTreino.includes(diaDaSemana(d))) continue;
    n += 1;
    if (faltaACada && n % faltaACada === 0) continue;
    registros.push({ aluno: aluno._id, data: d, status: 'PRESENTE', registradoPor: admin._id });
  }
  return registros;
}

async function popularBanco() {
  const usuarios = await Usuario.insertMany(
    await Promise.all(USUARIOS.map(async ({ senha, ...u }) => ({ ...u, senhaHash: await bcrypt.hash(senha, 10) })))
  );
  const admin = usuarios[0];
  const [mensal, trimestral, semestral] = await Plano.insertMany(PLANOS);

  const d = hoje();
  const ontem = adicionarDias(d, -1);

  // Em dia; o 2º pagamento foi feito com 8 dias de atraso (com multa e juros)
  const ana = await criarAluno(
    { nome: 'Ana Souza', cpf: '52998224725', dataNascimento: '1995-04-12', telefone: '11987654321', diasTreino: [1, 3, 5] },
    mensal, 2, adicionarDias(d, 10), admin, [0, 8]
  );
  // Menor de idade com responsável, em dia
  const bruno = await criarAluno(
    {
      nome: 'Bruno Lima', cpf: '11144477735', dataNascimento: adicionarMeses(d, -16 * 12), telefone: '11912345678', diasTreino: [2, 4],
      responsavel: { nome: 'Márcia Lima', cpf: '12345678909', telefone: '11955554444' },
    },
    trimestral, 1, adicionarDias(d, 60), admin
  );
  // Pendente: 3 dias de atraso (tolerância, sem multa)
  const carla = await criarAluno(
    { nome: 'Carla Mendes', cpf: '98765432100', dataNascimento: '1988-09-30', telefone: '21998887777', diasTreino: [1, 2, 3, 4, 5] },
    mensal, 1, adicionarDias(d, -3), admin
  );
  // Inadimplente há 12 dias (com multa) e sem treinar há 3 semanas: alerta de faltas
  const eduardo = await criarAluno(
    { nome: 'Eduardo Pires', cpf: '74185296355', dataNascimento: '1999-02-08', telefone: '11944443333', diasTreino: [1, 3, 5] },
    mensal, 2, adicionarDias(d, -12), admin
  );
  // Inadimplente há 45 dias: bloqueado para presença
  const diego = await criarAluno(
    { nome: 'Diego Rocha', cpf: '45612378955', dataNascimento: '1990-01-15', telefone: '3133334444', diasTreino: [2, 4] },
    mensal, 2, adicionarDias(d, -45), admin
  );
  // Inativo há 20 dias (histórico mantido)
  const fabio = await criarAluno(
    { nome: 'Fábio Nunes', cpf: '32165498791', dataNascimento: '1985-07-22', telefone: '11933332222', diasTreino: [1, 2, 3, 4, 5] },
    semestral, 1, adicionarDias(d, 100), admin
  );
  fabio.set({ ativo: false, dataInativacao: adicionarDias(d, -20), motivoInativacao: 'Mudou de cidade' });
  await fabio.save();

  await Presenca.insertMany([
    ...presencasNosTreinos(ana, ana.dataMatricula, ontem, 6, admin),
    ...presencasNosTreinos(bruno, bruno.dataMatricula, ontem, 0, admin),
    ...presencasNosTreinos(carla, carla.dataMatricula, adicionarDias(d, -2), 5, admin),
    ...presencasNosTreinos(eduardo, eduardo.dataMatricula, adicionarDias(d, -22), 4, admin),
    ...presencasNosTreinos(diego, diego.dataMatricula, adicionarDias(d, -45), 3, admin),
    ...presencasNosTreinos(fabio, fabio.dataMatricula, adicionarDias(d, -21), 4, admin),
    { aluno: carla._id, data: adicionarDias(d, -1), status: 'FALTA', registradoPor: admin._id },
  ]);
  await Presenca.syncIndexes();

  console.log('Dados de teste carregados: 3 usuários, 3 planos, 6 alunos, pagamentos e presenças.');
}

module.exports = popularBanco;
