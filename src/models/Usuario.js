const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true },
    // RN04: dois perfis
    perfil: { type: String, enum: ['ADMIN', 'RECEPCAO'], required: true },
    // RN03: controle de tentativas de login
    tentativasFalhas: { type: Number, default: 0 },
    bloqueadoAte: { type: Date, default: null },
  },
  { timestamps: true }
);

usuarioSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.senhaHash;
    delete ret.tentativasFalhas;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Usuario', usuarioSchema);
