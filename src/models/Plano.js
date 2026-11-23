const mongoose = require('mongoose');

// Os planos são os "produtos" da academia. Valores são fixos e não podem
// ser alterados via API.
const planoSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true },
    nome: { type: String, required: true },
    duracaoMeses: { type: Number, required: true, min: 1 },
    valor: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Plano', planoSchema);
