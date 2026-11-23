const { Router } = require('express');
const presencaService = require('../services/presencaService');

const router = Router();

router.get('/', async (req, res) => {
  const { alunoId, data, dataInicio, dataFim } = req.query;
  res.json(await presencaService.listar({ alunoId, data, dataInicio, dataFim }));
});

router.post('/', async (req, res) => {
  res.status(201).json(await presencaService.registrar(req.body, req.usuario));
});

module.exports = router;
