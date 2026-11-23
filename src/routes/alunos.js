const { Router } = require('express');
const alunoService = require('../services/alunoService');
const pagamentoService = require('../services/pagamentoService');
const presencaService = require('../services/presencaService');

const router = Router();

router.get('/', async (req, res) => {
  res.json(await alunoService.listar({ busca: req.query.busca, status: req.query.status }));
});

router.post('/', async (req, res) => {
  res.status(201).json(await alunoService.cadastrar(req.body));
});

router.get('/:id', async (req, res) => {
  res.json(await alunoService.detalhar(req.params.id));
});

router.get('/:id/situacao', async (req, res) => {
  const aluno = await alunoService.detalhar(req.params.id);
  res.json({ aluno: { _id: aluno._id, nome: aluno.nome, plano: aluno.plano }, ...aluno.situacao });
});

router.get('/:id/pagamentos', async (req, res) => {
  await alunoService.buscarDocumento(req.params.id);
  res.json(await pagamentoService.listar({ alunoId: req.params.id }));
});

router.get('/:id/presencas', async (req, res) => {
  res.json(await presencaService.resumoDoAluno(req.params.id));
});

module.exports = router;
