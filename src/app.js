const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const autenticar = require('./middlewares/auth');
const { naoEncontrado, tratarErros } = require('./middlewares/erros');
const { hoje } = require('./utils/datas');

const CAMINHO_YAML = path.join(__dirname, '..', 'docs', 'openapi.yaml');

const app = express();
app.use(cors());
app.use(express.json());

// Documentação Swagger
app.get('/api-docs/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(fs.readFileSync(CAMINHO_YAML, 'utf8'));
});
const especificacao = yaml.load(fs.readFileSync(CAMINHO_YAML, 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(especificacao, { customSiteTitle: 'API MyGym' }));

// API
app.get('/api/health', (_req, res) => res.json({ status: 'ok', hoje: hoje() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/planos', autenticar, require('./routes/planos'));
app.use('/api/alunos', autenticar, require('./routes/alunos'));
app.use('/api/pagamentos', autenticar, require('./routes/pagamentos'));
app.use('/api/presencas', autenticar, require('./routes/presencas'));
app.use('/api/usuarios', autenticar, require('./routes/usuarios'));
app.use('/api/painel', autenticar, require('./routes/painel'));
app.use('/api/relatorios', autenticar, require('./routes/relatorios'));
app.use('/api', naoEncontrado);

// Site Web
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
