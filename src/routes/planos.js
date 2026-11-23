const { Router } = require('express');
const Plano = require('../models/Plano');

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await Plano.find().sort({ duracaoMeses: 1 }));
});

module.exports = router;
