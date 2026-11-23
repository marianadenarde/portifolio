# Academia — API REST e Site Web de Gestão

## O que é esta aplicação

Sistema simples para a gestão de uma academia, composto por uma **API REST** (Node.js + Express) e um **site Web** que a consome. Tem quatro funcionalidades:

1. **Login** de usuários do sistema (autenticação via JWT).
2. **Cadastro de alunos**, com validação de CPF, idade mínima e responsável para menores.
3. **Registro de pagamentos** e **situação financeira** de cada aluno (em dia, inadimplente ou bloqueado).
4. **Registro de presença e falta** de cada aluno, com resumo de frequência.

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
    ├── config.js            # Porta, segredo JWT, fuso horário e parâmetros das regras
    ├── seed.js              # Dados de teste
    ├── models/              # Usuario, Plano, Aluno, Pagamento, Presenca
    ├── services/            # Regras de negócio
    ├── routes/              # Endpoints REST
    ├── middlewares/         # Autenticação e tratamento de erros
    └── utils/               # Datas, validação de CPF/telefone, AppError
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

> Na primeira execução, o `mongodb-memory-server` baixa automaticamente o binário do MongoDB (cerca de 100 MB) de `fastdl.mongodb.org` e o guarda em cache. É necessário acesso à internet nesse momento.

## Como executar

```bash
npm start
```

Para desenvolvimento, com reinício automático ao salvar arquivos:

```bash
npm run dev
```

A aplicação sobe em `http://localhost:3000`. Variáveis de ambiente opcionais:

| Variável         | Padrão                  | Descrição                                          |
|------------------|-------------------------|----------------------------------------------------|
| `PORT`           | `3000`                  | Porta HTTP                                         |
| `JWT_SECRET`     | `academia-segredo-dev`  | Segredo usado para assinar os tokens               |
| `JWT_EXPIRES_IN` | `8h`                    | Validade do token                                  |
| `APP_TZ`         | `America/Sao_Paulo`     | Fuso usado para definir "hoje" nas regras de data  |

Para usar a API pelo Swagger: faça `POST /api/auth/login`, copie o `token` e cole no botão **Authorize**.

## Dados de teste incluídos

Carregados automaticamente a cada inicialização (`src/seed.js`).

### 3 usuários

| Nome          | E-mail                   | Senha          | Perfil    |
|---------------|--------------------------|----------------|-----------|
| Administrador | `admin@academia.com`     | `admin123`     | ADMIN     |
| Recepção      | `recepcao@academia.com`  | `recepcao123`  | RECEPCAO  |
| Instrutor     | `instrutor@academia.com` | `instrutor123` | INSTRUTOR |

Todos os perfis têm acesso a todas as funcionalidades.

### 3 produtos (planos)

| Código       | Plano      | Duração | Valor     |
|--------------|------------|---------|-----------|
| `MENSAL`     | Mensal     | 1 mês   | R$ 100,00 |
| `TRIMESTRAL` | Trimestral | 3 meses | R$ 270,00 |
| `SEMESTRAL`  | Semestral  | 6 meses | R$ 500,00 |

### Alunos de exemplo

As datas são calculadas a partir do dia em que a aplicação inicia, então cada aluno está sempre na mesma situação:

| Aluno        | CPF            | Plano      | Situação                                    | Observação                                |
|--------------|----------------|------------|---------------------------------------------|-------------------------------------------|
| Ana Souza    | 529.982.247-25 | Mensal     | **Em dia** (pago até hoje + 10 dias)        | 2 presenças e 1 falta nos últimos 3 dias  |
| Bruno Lima   | 111.444.777-35 | Trimestral | **Em dia** (pago até hoje + 60 dias)        | 16 anos, responsável Márcia Lima          |
| Carla Mendes | 987.654.321-00 | Mensal     | **Inadimplente** (10 dias de atraso)        | Ainda pode registrar presença             |
| Diego Rocha  | 456.123.789-55 | Mensal     | **Bloqueado** (45 dias de atraso)           | Não pode registrar presença               |

CPFs válidos e livres para testar novos cadastros: `321.654.987-91`, `741.852.963-55`.

## Regras de negócio

1. **Campos obrigatórios no cadastro do aluno:** nome, CPF, data de nascimento, telefone e plano. O CPF precisa ser válido (dígitos verificadores) e único. O telefone precisa ter DDD + número (10 ou 11 dígitos).
2. **Idade mínima de 14 anos.** Alunos **menores de 18 anos** precisam de um **responsável** com nome, CPF válido (diferente do CPF do aluno) e telefone.
3. **Planos com valores fixos:** Mensal R$ 100, Trimestral R$ 270 e Semestral R$ 500. O valor do pagamento é sempre o do plano do aluno; se outro valor for enviado, a API recusa.
4. **Aluno inadimplente há mais de 30 dias fica bloqueado** para registrar presença. Faltas ainda podem ser registradas.
5. **Só é permitido um registro por aluno por dia** (presença ou falta), garantido também por índice único no banco.

### Como a situação financeira é calculada

- A data de matrícula é o dia do cadastro.
- Cada pagamento cobre um período igual à duração do plano. Esse período começa onde terminou o anterior, ou na matrícula se for o primeiro pagamento. Assim, quem está atrasado quita primeiro os meses em aberto.
- **Vencimento** é o fim do último período pago (ou a data de matrícula, se o aluno nunca pagou).
- **EM_DIA**: hoje ≤ vencimento · **INADIMPLENTE**: 1 a 30 dias após o vencimento · **BLOQUEADO**: mais de 30 dias após o vencimento.

### Outras validações

- Pagamentos e presenças não aceitam datas futuras.
- Presenças e faltas não podem ser registradas antes da data de matrícula.
- Todas as rotas da API, exceto login, health e documentação, exigem `Authorization: Bearer <token>`.

## URLs importantes

| Recurso                       | URL                                           |
|-------------------------------|-----------------------------------------------|
| Site Web                      | http://localhost:3000/                        |
| Swagger UI (documentação)     | http://localhost:3000/api-docs                |
| Especificação YAML (OpenAPI)  | http://localhost:3000/api-docs/openapi.yaml   |
| Health check                  | http://localhost:3000/api/health              |
| Base da API                   | http://localhost:3000/api                     |

### Endpoints da API

| Método | Rota                           | Descrição                                   |
|--------|--------------------------------|---------------------------------------------|
| POST   | `/api/auth/login`              | Login (retorna token JWT)                   |
| GET    | `/api/auth/me`                 | Usuário autenticado                         |
| GET    | `/api/planos`                  | Lista os planos                             |
| GET    | `/api/alunos`                  | Lista alunos com situação (`?busca=&status=`)|
| POST   | `/api/alunos`                  | Cadastra aluno                              |
| GET    | `/api/alunos/{id}`             | Detalha aluno                               |
| GET    | `/api/alunos/{id}/situacao`    | Situação financeira do aluno                |
| GET    | `/api/alunos/{id}/pagamentos`  | Histórico de pagamentos do aluno            |
| GET    | `/api/alunos/{id}/presencas`   | Presenças, faltas e frequência do aluno     |
| GET    | `/api/pagamentos`              | Lista pagamentos (`?alunoId=`)              |
| POST   | `/api/pagamentos`              | Registra pagamento                          |
| GET    | `/api/presencas`               | Lista registros (`?alunoId=&data=&dataInicio=&dataFim=`) |
| POST   | `/api/presencas`               | Registra presença ou falta                  |

### Exemplos com curl

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@academia.com","senha":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

```bash
curl -s -X POST http://localhost:3000/api/alunos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"nome":"Fernanda Alves","cpf":"321.654.987-91","dataNascimento":"1992-06-20","telefone":"11988887777","plano":"MENSAL"}'
```

```bash
curl -s http://localhost:3000/api/alunos?status=BLOQUEADO -H "Authorization: Bearer $TOKEN"
```
