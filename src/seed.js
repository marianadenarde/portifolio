const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario');
const Plano = require('./models/Plano');
const Aluno = require('./models/Aluno');
const Pagamento = require('./models/Pagamento');
const Presenca = require('./models/Presenca');
const { hoje, adicionarDias, adicionarMeses } = require('./utils/datas');

const USUARIOS = [
  { nome: 'Administrador', email: 'admin@academia.com', senha: 'admin123', perfil: 'ADMIN' },
  { nome: 'Recepção', email: 'recepcao@academia.com', senha: 'recepcao123', perfil: 'RECEPCAO' },
  { nome: 'Instrutor', email: 'instrutor@academia.com', senha: 'instrutor123', perfil: 'INSTRUTOR' },
];

// Os 3 "produtos" da academia
const PLANOS = [
  { codigo: 'MENSAL', nome: 'Mensal', duracaoMeses: 1, valor: 100 },
  { codigo: 'TRIMESTRAL', nome: 'Trimestral', duracaoMeses: 3, valor: 270 },
  { codigo: 'SEMESTRAL', nome: 'Semestral', duracaoMeses: 6, valor: 500 },
];

/**
 * Cria o aluno com pagamentos consecutivos cujo último período termina em `pagoAte`.
 * As datas são relativas a hoje, para que a situação de cada aluno seja sempre a mesma.
 */
async function criarAlunoComPagamentos(dados, plano, quantidadePagamentos, pagoAte, admin) {
  const dataMatricula = adicionarMeses(pagoAte, -plano.duracaoMeses * quantidadePagamentos);
  const aluno = await Aluno.create({ ...dados, plano: plano._id, dataMatricula });
  let inicio = dataMatricula;
  for (let i = 0; i < quantidadePagamentos; i++) {
    const fim = adicionarMeses(inicio, plano.duracaoMeses);
    await Pagamento.create({
      aluno: aluno._id,
      plano: plano._id,
      valor: plano.valor,
      formaPagamento: i % 2 === 0 ? 'PIX' : 'CARTAO_DEBITO',
      dataPagamento: inicio,
      periodoInicio: inicio,
      periodoFim: fim,
      registradoPor: admin._id,
    });
    inicio = fim;
  }
  return aluno;
}

async function popularBanco() {
  const usuarios = await Usuario.insertMany(
    await Promise.all(
      USUARIOS.map(async ({ senha, ...u }) => ({ ...u, senhaHash: await bcrypt.hash(senha, 10) }))
    )
  );
  const admin = usuarios[0];
  const [mensal, trimestral] = await Plano.insertMany(PLANOS);

  const d = hoje();
  const nascimentoMenor = adicionarMeses(d, -16 * 12);

  const ana = await criarAlunoComPagamentos(
    { nome: 'Ana Souza', cpf: '52998224725', dataNascimento: '1995-04-12', telefone: '11987654321' },
    mensal, 2, adicionarDias(d, 10), admin
  );
  const bruno = await criarAlunoComPagamentos(
    {
      nome: 'Bruno Lima',
      cpf: '11144477735',
      dataNascimento: nascimentoMenor,
      telefone: '11912345678',
      responsavel: { nome: 'Márcia Lima', cpf: '12345678909', telefone: '11955554444' },
    },
    trimestral, 1, adicionarDias(d, 60), admin
  );
  await criarAlunoComPagamentos(
    { nome: 'Carla Mendes', cpf: '98765432100', dataNascimento: '1988-09-30', telefone: '21998887777' },
    mensal, 1, adicionarDias(d, -10), admin
  );
  await criarAlunoComPagamentos(
    { nome: 'Diego Rocha', cpf: '45612378955', dataNascimento: '1990-01-15', telefone: '3133334444' },
    mensal, 2, adicionarDias(d, -45), admin
  );

  await Presenca.insertMany([
    { aluno: ana._id, data: adicionarDias(d, -3), status: 'PRESENTE', registradoPor: admin._id },
    { aluno: ana._id, data: adicionarDias(d, -2), status: 'FALTA', registradoPor: admin._id },
    { aluno: ana._id, data: adicionarDias(d, -1), status: 'PRESENTE', registradoPor: admin._id },
    { aluno: bruno._id, data: adicionarDias(d, -1), status: 'PRESENTE', registradoPor: admin._id },
  ]);
  await Presenca.syncIndexes();

  console.log('Dados de teste carregados: 3 usuários, 3 planos, 4 alunos, pagamentos e presenças.');
}

module.exports = popularBanco;
