const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema(
  {
    aluno: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true, index: true },
    plano: { type: mongoose.Schema.Types.ObjectId, ref: 'Plano', required: true },
    valor: { type: Number, required: true },
    formaPagamento: { type: String, enum: ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'], required: true },
    dataPagamento: { type: String, required: true }, // YYYY-MM-DD
    // Período coberto pelo pagamento: [periodoInicio, periodoFim)
    periodoInicio: { type: String, required: true },
    periodoFim: { type: String, required: true },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Pagamento', pagamentoSchema);
