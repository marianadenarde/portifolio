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
    dataMatricula: { type: String, required: true }, // YYYY-MM-DD
    responsavel: { type: responsavelSchema, default: null },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Aluno', alunoSchema);
