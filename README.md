# MyGym — API REST e Site Web de Gestão de Academia

## O que é esta aplicação

O MyGym é um sistema de gestão de academia, composto por uma **API REST** (Node.js + Express) e um **site Web** que a consome. É usado pelos funcionários da academia (Administrador e Recepção) e tem quatro módulos:

1. **Login**: acesso com e-mail e senha, bloqueio após tentativas erradas e dois perfis de permissão.
2. **Alunos**: cadastro, edição, consulta e inativação, com dias de treino e responsável para menores.
3. **Mensalidades**: registro de pagamentos com multa e juros por atraso, e situação de cada aluno (em dia, pendente ou inadimplente).
4. **Frequência**: registro de presença e falta, faltas automáticas nos dias de treino e alerta de faltas seguidas.

Também tem um **painel inicial** (alunos ativos, inadimplentes, presenças do dia, receita do mês e alertas), um **relatório mensal de recebimentos** e o **histórico** de pagamentos e frequência de cada aluno.

Os dados ficam em um **MongoDB em memória** ([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)). O banco é criado e populado com dados de teste toda vez que a aplicação inicia, e **tudo é apagado ao encerrá-la**.

### Tecnologias

- Node.js 18+ · Express 5
- Mongoose + mongodb-memory-server (banco em memória)
- JSON Web Token (jsonwebtoken) e bcryptjs
- Swagger UI (swagger-ui-express) com especificação OpenAPI 3 em YAML
- Front-end em HTML, CSS e JavaScript puro (sem build)

### Estrutura

```
.
├── docs/openapi.yaml        # Especificação da API (Swagger / OpenAPI 3)
├── public/                  # Site Web (index.html, app.js, styles.css)
└── src/
    ├── server.js            # Inicia o MongoDB em memória, popula e sobe o servidor
    ├── app.js               # Configuração do Express, rotas e Swagger
    ├── config.js            # Porta, JWT, fuso horário e parâmetros das regras de negócio
    ├── seed.js              # Dados de teste
    ├── models/              # Usuario, Plano, Aluno, Pagamento, Presenca
    ├── services/            # Regras de negócio (alunos, mensalidades, frequência, painel...)
    ├── routes/              # Endpoints REST
    ├── middlewares/         # Autenticação, perfis e tratamento de erros
    └── utils/               # Datas, validação de CPF/telefone/senha, AppError
```

## Como instalar

Pré-requisitos: **Node.js 18 ou superior** e **npm**.

```bash
git clone https://github.com/marianadenarde/portifolio.git
```

```bash
cd portifolio
```

```bash
npm install
```

> Na primeira execução, o `mongodb-memory-server` baixa automaticamente o binário do MongoDB (cerca de 120 MB) de `fastdl.mongodb.org` e o guarda em cache. É necessário acesso à internet nesse momento.

## Como executar

```bash
npm start
```

Para desenvolvimento, com reinício automático ao salvar arquivos:

```bash
npm run dev
```

A aplicação sobe em `http://localhost:3000`. Variáveis de ambiente opcionais:

| Variável                 | Padrão                 | Descrição                                           |
|--------------------------|------------------------|-----------------------------------------------------|
| `PORT`                   | `3000`                 | Porta HTTP                                          |
| `JWT_SECRET`             | `mygym-segredo-dev`    | Segredo usado para assinar os tokens                |
| `JWT_EXPIRES_IN`         | `8h`                   | Validade do token                                   |
| `APP_TZ`                 | `America/Sao_Paulo`    | Fuso usado para definir "hoje" nas regras de data   |
| `MONGOMS_LAUNCH_TIMEOUT` | `60000`                | Tempo máximo (ms) para o MongoDB em memória iniciar |
| `MONGOMS_VERSION`        | padrão da biblioteca   | Versão do MongoDB usada pelo mongodb-memory-server  |

Para usar a API pelo Swagger: faça `POST /api/auth/login`, copie o `token` e cole no botão **Authorize**.

### Solução de problemas

**`Instance failed to start within ...ms`**: o MongoDB demorou demais para iniciar. É comum no Windows na primeira execução, porque o antivírus analisa o executável recém-baixado.

1. Execute `npm start` de novo. Da segunda vez costuma ser bem mais rápido.
2. Aumente o tempo limite (o padrão desta aplicação é 60 segundos):
   - PowerShell: `$env:MONGOMS_LAUNCH_TIMEOUT=120000; npm start`
   - Prompt de Comando: `set MONGOMS_LAUNCH_TIMEOUT=120000 && npm start`
   - Linux/macOS: `MONGOMS_LAUNCH_TIMEOUT=120000 npm start`
3. No Windows, instale o [Microsoft Visual C++ Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe). Sem ele, o MongoDB não inicia.
4. Use uma versão anterior do MongoDB, que é baixada automaticamente: `$env:MONGOMS_VERSION="7.0.14"; npm start` (PowerShell).
5. Para ver o motivo exato da falha, ative o log detalhado: `$env:MONGOMS_DEBUG=1; npm start` (PowerShell).

O binário do MongoDB fica em cache em `node_modules/.cache/mongodb-memory-server`. Se o download foi interrompido, apague essa pasta e execute de novo.

## Dados de teste incluídos

Carregados automaticamente a cada inicialização (`src/seed.js`). As datas são calculadas a partir do dia em que a aplicação inicia, então cada aluno está sempre na mesma situação.

### 3 usuários

| Nome           | E-mail                   | Senha         | Perfil        |
|----------------|--------------------------|---------------|---------------|
| Administrador  | `admin@academia.com`     | `admin123`    | Administrador |
| Recepção       | `recepcao@academia.com`  | `recepcao123` | Recepção      |
| Recepção Noite | `recepcao2@academia.com` | `recepcao456` | Recepção      |

### 3 produtos (planos)

| Código       | Plano      | Duração | Valor     |
|--------------|------------|---------|-----------|
| `MENSAL`     | Mensal     | 1 mês   | R$ 100,00 |
| `TRIMESTRAL` | Trimestral | 3 meses | R$ 270,00 |
| `SEMESTRAL`  | Semestral  | 6 meses | R$ 500,00 |

### 6 alunos de exemplo

| Aluno         | CPF            | Plano      | Treinos       | Situação                                                   |
|---------------|----------------|------------|---------------|------------------------------------------------------------|
| Ana Souza     | 529.982.247-25 | Mensal     | Seg, Qua, Sex | **Em dia**. Um pagamento antigo foi feito com multa e juros |
| Bruno Lima    | 111.444.777-35 | Trimestral | Ter, Qui      | **Em dia**. 16 anos, responsável Márcia Lima               |
| Carla Mendes  | 987.654.321-00 | Mensal     | Seg a Sex     | **Pendente** (3 dias de atraso). Uma falta registrada ontem |
| Eduardo Pires | 741.852.963-55 | Mensal     | Seg, Qua, Sex | **Inadimplente** (12 dias, com multa). Alerta de faltas    |
| Diego Rocha   | 456.123.789-55 | Mensal     | Ter, Qui      | **Inadimplente e bloqueado** (45 dias). Alerta de faltas   |
| Fábio Nunes   | 321.654.987-91 | Semestral  | Seg a Sex     | **Inativo** há 20 dias (histórico mantido)                 |

CPFs válidos e livres para testar novos cadastros: `135.792.468-28`, `246.813.579-28`, `864.297.531-82`.

## Regras de negócio

### Login

- **RN01** Só usuários cadastrados acessam o sistema (e-mail + senha). Todas as rotas da API, exceto login, health e documentação, exigem `Authorization: Bearer <token>`.
- **RN02** A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número. Vale ao criar usuários e ao alterar a senha.
- **RN03** Depois de 3 tentativas erradas seguidas, o usuário fica bloqueado por 15 minutos. O Administrador pode desbloquear antes disso em Configurações.
- **RN04** Há dois perfis. O **Administrador** pode tudo. A **Recepção** não pode inativar alunos nem alterar o valor dos planos. Criar e desbloquear usuários e reativar alunos também é exclusivo do Administrador.

### Cadastro de aluno

- **RN05** Campos obrigatórios: nome, CPF, data de nascimento, telefone e plano. Os dias de treino são opcionais (padrão: segunda a sexta).
- **RN06** O CPF deve ser válido (dígitos verificadores) e único.
- **RN07** A idade mínima é 14 anos. Menores de 18 precisam de um responsável com nome, CPF válido (diferente do CPF do aluno) e telefone.
- **RN08** Aluno não é excluído, é inativado, para manter o histórico de pagamentos e frequência. Aluno inativo não registra pagamentos, presenças nem faltas, e pode ser reativado.

### Mensalidade

- **RN09** Planos com valores fixos: Mensal R$ 100, Trimestral R$ 270 e Semestral R$ 500. O valor só muda se o Administrador alterá-lo, e a alteração vale para os próximos pagamentos.
- **RN10** O vencimento é sempre no mesmo dia da matrícula. Em meses mais curtos, vence no último dia do mês (matrícula em 31/01 vence em 28/02, 31/03, 30/04...).
- **RN11** Pagamento até o vencimento ou com até 5 dias de atraso: valor normal. A partir do 6º dia: multa de 2% mais juros de 0,1% por dia de atraso, contados desde o vencimento. O sistema calcula o valor.
- **RN12** Status do aluno: **Em dia**, **Pendente** (1 a 5 dias de atraso) e **Inadimplente** (mais de 5 dias).
- **RN13** O valor pago não pode ser zero nem negativo. Se for enviado, também precisa ser igual ao valor calculado.
- **RN14** Aluno inadimplente há mais de 30 dias fica bloqueado para registrar presença.

Cada pagamento quita o período mais antigo em aberto. Quem está atrasado paga primeiro os meses devidos, cada um com a multa e os juros do seu vencimento.

### Presença e falta

- **RN15** Só é permitido um registro por aluno por dia (presença ou falta).
- **RN16** Aluno inativo ou bloqueado não pode registrar presença. Para um aluno bloqueado, a recepção ainda pode registrar falta.
- **RN17** As faltas são contadas automaticamente: cada dia de treino do aluno (dias úteis escolhidos no cadastro), da matrícula até ontem, sem presença registrada é uma falta. Faltas registradas manualmente também contam, sem duplicar.
- **RN18** Com 5 faltas seguidas, o aluno aparece no alerta do painel e na lista de alunos, para a recepção entrar em contato.

## URLs importantes

| Recurso                       | URL                                           |
|-------------------------------|-----------------------------------------------|
| Site Web                      | http://localhost:3000/                        |
| Swagger UI (documentação)     | http://localhost:3000/api-docs                |
| Especificação YAML (OpenAPI)  | http://localhost:3000/api-docs/openapi.yaml   |
| Health check                  | http://localhost:3000/api/health              |
| Base da API                   | http://localhost:3000/api                     |

### Endpoints da API

| Método | Rota                              | Descrição                                       | Perfil |
|--------|-----------------------------------|-------------------------------------------------|--------|
| POST   | `/api/auth/login`                 | Login (retorna token JWT)                       | —      |
| GET    | `/api/auth/me`                    | Usuário autenticado                             | Todos  |
| PUT    | `/api/auth/senha`                 | Altera a própria senha                          | Todos  |
| GET    | `/api/usuarios`                   | Lista usuários                                  | Admin  |
| POST   | `/api/usuarios`                   | Cria usuário                                    | Admin  |
| PATCH  | `/api/usuarios/{id}/desbloquear`  | Remove o bloqueio de login                      | Admin  |
| GET    | `/api/planos`                     | Lista os planos                                 | Todos  |
| PUT    | `/api/planos/{id}`                | Altera o valor de um plano                      | Admin  |
| GET    | `/api/alunos`                     | Consulta alunos (`?busca=&ativo=&status=&alerta=`) | Todos |
| POST   | `/api/alunos`                     | Cadastra aluno                                  | Todos  |
| GET    | `/api/alunos/{id}`                | Detalha aluno                                   | Todos  |
| PUT    | `/api/alunos/{id}`                | Edita aluno                                     | Todos  |
| PATCH  | `/api/alunos/{id}/inativar`       | Inativa aluno                                   | Admin  |
| PATCH  | `/api/alunos/{id}/reativar`       | Reativa aluno                                   | Admin  |
| GET    | `/api/alunos/{id}/situacao`       | Situação financeira                             | Todos  |
| GET    | `/api/alunos/{id}/cobranca`       | Valor a pagar hoje ou em uma data (`?data=`)    | Todos  |
| GET    | `/api/alunos/{id}/pagamentos`     | Histórico de pagamentos                         | Todos  |
| GET    | `/api/alunos/{id}/presencas`      | Histórico de frequência e faltas                | Todos  |
| GET    | `/api/pagamentos`                 | Lista pagamentos (`?alunoId=&mes=`)             | Todos  |
| POST   | `/api/pagamentos`                 | Registra pagamento                              | Todos  |
| GET    | `/api/presencas`                  | Lista registros (`?alunoId=&data=&dataInicio=&dataFim=`) | Todos |
| POST   | `/api/presencas`                  | Registra presença ou falta                      | Todos  |
| GET    | `/api/painel`                     | Painel inicial                                  | Todos  |
| GET    | `/api/relatorios/recebimentos`    | Relatório mensal (`?mes=AAAA-MM`)               | Todos  |

### Exemplos com curl

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@academia.com","senha":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

```bash
curl -s -X POST http://localhost:3000/api/alunos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"nome":"Gabriela Torres","cpf":"135.792.468-28","dataNascimento":"1992-06-20","telefone":"11988887777","plano":"MENSAL","diasTreino":[1,3,5]}'
```

```bash
curl -s "http://localhost:3000/api/alunos?alerta=true" -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s "http://localhost:3000/api/relatorios/recebimentos?mes=2026-11" -H "Authorization: Bearer $TOKEN"
```
