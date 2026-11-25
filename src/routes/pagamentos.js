const { Router } = require('express');
const pagamentoService = require('../services/pagamentoService');

const router = Router();

router.get('/', async (req, res) => {
  res.json(await pagamentoService.listar({ alunoId: req.query.alunoId, mes: req.query.mes }));
});

router.post('/', async (req, res) => {
  res.status(201).json(await pagamentoService.registrar(req.body, req.usuario));
});

module.exports = router;
