module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'academia-segredo-dev',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Fuso horário usado para definir "hoje" nas regras de presença e inadimplência
  timeZone: process.env.APP_TZ || 'America/Sao_Paulo',
  // Regras de negócio
  idadeMinima: 14,
  maioridade: 18,
  diasParaBloqueio: 30,
};
