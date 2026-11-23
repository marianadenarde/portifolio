const mongoose = require('mongoose');

const presencaSchema = new mongoose.Schema(
  {
    aluno: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true },
    data: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ['PRESENTE', 'FALTA'], required: true },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true, versionKey: false }
);

// Regra 5: apenas um registro (presença ou falta) por aluno por dia.
presencaSchema.index({ aluno: 1, data: 1 }, { unique: true });

module.exports = mongoose.model('Presenca', presencaSchema);
