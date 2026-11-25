const { Router } = require('express');
const autenticar = require('../middlewares/auth');
const usuarioService = require('../services/usuarioService');

const router = Router();

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  res.json(await usuarioService.autenticar(email, senha));
});

router.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});

router.put('/senha', autenticar, async (req, res) => {
  await usuarioService.alterarSenha(req.usuario, req.body);
  res.json({ mensagem: 'Senha alterada com sucesso.' });
});

module.exports = router;
