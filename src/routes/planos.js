const { Router } = require('express');
const Plano = require('../models/Plano');
const AppError = require('../utils/AppError');
const exigirPerfil = require('../middlewares/perfil');

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await Plano.find().sort({ duracaoMeses: 1 }));
});

// RN04: só o Administrador altera o valor dos planos. Vale para os próximos pagamentos.
router.put('/:id', exigirPerfil('ADMIN'), async (req, res) => {
  const valor = Number(req.body?.valor);
  if (!(valor > 0)) throw new AppError(400, 'O campo "valor" deve ser um número maior que zero.');
  const plano = await Plano.findByIdAndUpdate(req.params.id, { valor: Math.round(valor * 100) / 100 }, { new: true });
  if (!plano) throw new AppError(404, 'Plano não encontrado.');
  res.json(plano);
});

module.exports = router;
