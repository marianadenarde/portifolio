const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema(
  {
    aluno: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true, index: true },
    plano: { type: mongoose.Schema.Types.ObjectId, ref: 'Plano', required: true },
    formaPagamento: { type: String, enum: ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'], required: true },
    dataPagamento: { type: String, required: true }, // YYYY-MM-DD
    // Período coberto: [periodoInicio, periodoFim). O vencimento é o início do período.
    periodoInicio: { type: String, required: true },
    periodoFim: { type: String, required: true },
    vencimento: { type: String, required: true },
    diasAtraso: { type: Number, default: 0 },
    // RN11: valor do plano + multa + juros
    valorPlano: { type: Number, required: true },
    multa: { type: Number, default: 0 },
    juros: { type: Number, default: 0 },
    valor: { type: Number, required: true, min: 0.01 }, // RN13: valor total pago
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Pagamento', pagamentoSchema);
