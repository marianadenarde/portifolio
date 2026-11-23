const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('./app');
const { port } = require('./config');
const popularBanco = require('./seed');

// Tempo máximo para o MongoDB em memória iniciar. O padrão da biblioteca (10s)
// costuma ser pouco no Windows, onde o antivírus analisa o executável na primeira execução.
const TEMPO_INICIO_MONGO = Number(process.env.MONGOMS_LAUNCH_TIMEOUT) || 60000;

async function iniciarMongo() {
  try {
    return await MongoMemoryServer.create({ instance: { launchTimeout: TEMPO_INICIO_MONGO } });
  } catch (err) {
    console.error('\nNão foi possível iniciar o MongoDB em memória.');
    console.error('Possíveis soluções (veja a seção "Solução de problemas" do README):');
    console.error('  1. Execute "npm start" novamente (a primeira execução pode ser mais lenta).');
    console.error('  2. Aumente o tempo limite: MONGOMS_LAUNCH_TIMEOUT=120000');
    console.error('  3. No Windows, instale o Microsoft Visual C++ Redistributable (x64).');
    console.error('  4. Use outra versão do MongoDB: MONGOMS_VERSION=7.0.14');
    console.error('  5. Veja o log detalhado com MONGOMS_DEBUG=1\n');
    throw err;
  }
}

async function iniciar() {
  const mongo = await iniciarMongo();
  await mongoose.connect(mongo.getUri(), { dbName: 'academia' });
  console.log('Banco MongoDB em memória iniciado.');

  await popularBanco();

  const server = app.listen(port, () => {
    console.log(`\nMyGym rodando em http://localhost:${port}`);
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
