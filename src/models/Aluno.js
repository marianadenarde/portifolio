const mongoose = require('mongoose');

const responsavelSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    cpf: { type: String, required: true },
    telefone: { type: String, required: true },
  },
  { _id: false }
);

const alunoSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    cpf: { type: String, required: true, unique: true },
    dataNascimento: { type: String, required: true }, // YYYY-MM-DD
    telefone: { type: String, required: true },
    plano: { type: mongoose.Schema.Types.ObjectId, ref: 'Plano', required: true },
    dataMatricula: { type: String, required: true }, // YYYY-MM-DD — define o dia de vencimento (RN10)
    responsavel: { type: responsavelSchema, default: null },
    // RN17: dias de treino na semana (1 = segunda ... 5 = sexta)
    diasTreino: { type: [Number], default: [1, 2, 3, 4, 5] },
    // RN08: aluno não é excluído, é inativado
    ativo: { type: Boolean, default: true },
    dataInativacao: { type: String, default: null },
    motivoInativacao: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Aluno', alunoSchema);
