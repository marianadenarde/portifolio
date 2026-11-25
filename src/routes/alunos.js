const { Router } = require('express');
const exigirPerfil = require('../middlewares/perfil');
const alunoService = require('../services/alunoService');
const pagamentoService = require('../services/pagamentoService');
const presencaService = require('../services/presencaService');

const router = Router();

router.get('/', async (req, res) => {
  const { busca, status, ativo, alerta } = req.query;
  res.json(await alunoService.listar({ busca, status, ativo, alerta }));
});

router.post('/', async (req, res) => {
  res.status(201).json(await alunoService.cadastrar(req.body));
});

router.get('/:id', async (req, res) => {
  res.json(await alunoService.detalhar(req.params.id));
});

router.put('/:id', async (req, res) => {
  res.json(await alunoService.atualizar(req.params.id, req.body));
});

// RN04 / RN08: só o Administrador inativa (o "excluir" do sistema) e reativa alunos
router.patch('/:id/inativar', exigirPerfil('ADMIN'), async (req, res) => {
  res.json(await alunoService.inativar(req.params.id, req.body?.motivo));
});

router.patch('/:id/reativar', exigirPerfil('ADMIN'), async (req, res) => {
  res.json(await alunoService.reativar(req.params.id));
});

router.get('/:id/situacao', async (req, res) => {
  const aluno = await alunoService.detalhar(req.params.id);
  res.json({ aluno: { _id: aluno._id, nome: aluno.nome, plano: aluno.plano }, ...aluno.situacao });
});

router.get('/:id/cobranca', async (req, res) => {
  res.json(await pagamentoService.simular(req.params.id, req.query.data));
});

router.get('/:id/pagamentos', async (req, res) => {
  await alunoService.buscarDocumento(req.params.id);
  res.json(await pagamentoService.listar({ alunoId: req.params.id }));
});

router.get('/:id/presencas', async (req, res) => {
  res.json(await presencaService.historicoDoAluno(req.params.id));
});

module.exports = router;
