module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'mygym-segredo-dev',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Fuso horário usado para definir "hoje" nas regras de data
  timeZone: process.env.APP_TZ || 'America/Sao_Paulo',

  // Regras de negócio
  login: {
    maxTentativas: 3, // RN03
    minutosBloqueio: 15, // RN03
  },
  idadeMinima: 14, // RN07
  maioridade: 18, // RN07
  mensalidade: {
    diasTolerancia: 5, // RN11 / RN12
    multa: 0.02, // RN11: 2%
    jurosAoDia: 0.001, // RN11: 0,1% ao dia
    diasParaBloqueio: 30, // RN14
  },
  frequencia: {
    faltasSeguidasAlerta: 5, // RN18
  },
};
