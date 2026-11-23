const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('./app');
const { port } = require('./config');
const popularBanco = require('./seed');

async function iniciar() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'academia' });
  console.log('Banco MongoDB em memória iniciado.');

  await popularBanco();

  const server = app.listen(port, () => {
    console.log(`\nAcademia rodando em http://localhost:${port}`);
    console.log(`  Site Web .......... http://localhost:${port}/`);
    console.log(`  Swagger UI ........ http://localhost:${port}/api-docs`);
    console.log(`  Especificação YAML  http://localhost:${port}/api-docs/openapi.yaml`);
    console.log(`  API ............... http://localhost:${port}/api\n`);
  });

  const encerrar = async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar().catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
