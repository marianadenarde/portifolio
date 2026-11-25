const { Router } = require('express');
const painelService = require('../services/painelService');

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await painelService.resumo());
});

module.exports = router;
