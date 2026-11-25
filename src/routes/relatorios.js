const { Router } = require('express');
const relatorioService = require('../services/relatorioService');

const router = Router();

router.get('/recebimentos', async (req, res) => {
  res.json(await relatorioService.recebimentos(req.query.mes));
});

module.exports = router;
