const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const AppError = require('../utils/AppError');
const autenticar = require('../middlewares/auth');
const { jwtSecret, jwtExpiresIn } = require('../config');

const router = Router();

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) throw new AppError(400, 'Informe "email" e "senha".');
  const usuario = await Usuario.findOne({ email: String(email).toLowerCase().trim() });
  if (!usuario || !(await bcrypt.compare(String(senha), usuario.senhaHash))) {
    throw new AppError(401, 'E-mail ou senha inválidos.');
  }
  const token = jwt.sign({ sub: usuario._id.toString(), perfil: usuario.perfil }, jwtSecret, { expiresIn: jwtExpiresIn });
  res.json({ token, tipo: 'Bearer', expiraEm: jwtExpiresIn, usuario });
});

router.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});

module.exports = router;
