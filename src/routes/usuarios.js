const { Router } = require('express');
const exigirPerfil = require('../middlewares/perfil');
const usuarioService = require('../services/usuarioService');

const router = Router();
router.use(exigirPerfil('ADMIN'));

router.get('/', async (_req, res) => {
  res.json(await usuarioService.listar());
});

router.post('/', async (req, res) => {
  res.status(201).json(await usuarioService.criar(req.body));
});

router.patch('/:id/desbloquear', async (req, res) => {
  res.json(await usuarioService.desbloquear(req.params.id));
});

module.exports = router;
