const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true },
    perfil: { type: String, enum: ['ADMIN', 'RECEPCAO', 'INSTRUTOR'], required: true },
  },
  { timestamps: true }
);

usuarioSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.senhaHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Usuario', usuarioSchema);
