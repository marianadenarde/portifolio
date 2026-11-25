(() => {
  const CHAVE_TOKEN = 'mygym.token';
  const CHAVE_USUARIO = 'mygym.usuario';
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let planos = [];
  let alunosAtivos = [];
  let usuarioAtual = null;
  let alunoEmEdicao = null;

  // ---------- Armazenamento seguro ----------
  const armazenamento = {
    ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
    gravar(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
    remover(k) { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } },
  };

  // ---------- Formatação ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (v) => (v ? v.split('-').reverse().join('/') : '—');
  const cpf = (v) => String(v || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  const telefone = (v) => String(v || '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  const ROTULOS = {
    EM_DIA: 'Em dia', PENDENTE: 'Pendente', INADIMPLENTE: 'Inadimplente', BLOQUEADO: 'Bloqueado',
    PRESENTE: 'Presente', FALTA: 'Falta', INATIVO: 'Inativo', ADMIN: 'Administrador', RECEPCAO: 'Recepção',
    PIX: 'PIX', DINHEIRO: 'Dinheiro', CARTAO_DEBITO: 'Cartão de débito', CARTAO_CREDITO: 'Cartão de crédito',
  };
  const rotulo = (v) => ROTULOS[v] || v;
  const selo = (s, texto) => `<span class="selo ${esc(s)}">${esc(texto || rotulo(s))}</span>`;
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  // "Hoje" vem do servidor (fuso da academia), para não divergir do relógio do navegador
  let hojeServidor = null;
  const hojeLocal = () => hojeServidor || new Date().toLocaleDateString('en-CA');

  function seloSituacao(a) {
    if (!a.ativo) return selo('INATIVO');
    if (a.situacao.bloqueado) return selo('BLOQUEADO');
    return selo(a.situacao.status);
  }

  function idade(nascimento) {
    if (!nascimento) return null;
    const [a, m, d] = nascimento.split('-').map(Number);
    const [ha, hm, hd] = hojeLocal().split('-').map(Number);
    let i = ha - a;
    if (hm < m || (hm === m && hd < d)) i -= 1;
    return i;
  }

  function mensagem(el, texto, tipo) {
    el.textContent = texto || '';
    el.className = `mensagem ${tipo || ''}`;
  }

  function textoErro(err) {
    const detalhes = Array.isArray(err.detalhes) ? `\n• ${err.detalhes.join('\n• ')}` : '';
    return `${err.message}${detalhes}`;
  }

  const ehAdmin = () => usuarioAtual?.perfil === 'ADMIN';

  // ---------- API ----------
  async function api(caminho, opcoes = {}) {
    const token = armazenamento.ler(CHAVE_TOKEN);
    const resposta = await fetch(`/api${caminho}`, {
      ...opcoes,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (resposta.status === 401 && caminho !== '/auth/login') {
      sair();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!resposta.ok) {
      const erro = new Error(corpo.erro || `Erro ${resposta.status}`);
      erro.detalhes = corpo.detalhes;
      throw erro;
    }
    return corpo;
  }

  // ---------- Sessão ----------
  function mostrarApp() {
    usuarioAtual = JSON.parse(armazenamento.ler(CHAVE_USUARIO) || 'null');
    $('#nome-usuario').textContent = !usuarioAtual ? ''
      : usuarioAtual.nome === rotulo(usuarioAtual.perfil) ? usuarioAtual.nome : `${usuarioAtual.nome} · ${rotulo(usuarioAtual.perfil)}`;
    document.body.classList.toggle('perfil-admin', ehAdmin());
    $('#tela-login').hidden = true;
    $('#tela-app').hidden = false;
    iniciarApp();
  }

  function sair() {
    armazenamento.remover(CHAVE_TOKEN);
    armazenamento.remover(CHAVE_USUARIO);
    usuarioAtual = null;
    $('#tela-app').hidden = true;
    $('#tela-login').hidden = false;
  }

  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = $('#msg-login');
    mensagem(msg, 'Entrando...');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email: f.get('email'), senha: f.get('senha') } });
      armazenamento.gravar(CHAVE_TOKEN, r.token);
      armazenamento.gravar(CHAVE_USUARIO, JSON.stringify(r.usuario));
      mensagem(msg, '');
      mostrarApp();
    } catch (err) {
      mensagem(msg, err.message, 'falha');
    }
  });

  $('#btn-sair').addEventListener('click', sair);

  // ---------- Abas ----------
  const carregadores = {
    painel: () => carregarPainel(),
    alunos: () => carregarAlunos(),
    pagamentos: () => Promise.all([carregarSelectAlunos(), carregarPagamentos()]),
    presencas: () => Promise.all([carregarSelectAlunos(), carregarPresencas()]),
    relatorio: () => carregarRelatorio(),
    config: () => carregarConfiguracoes(),
  };

  function abrirAba(nome) {
    $$('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
    $$('.painel').forEach((p) => (p.hidden = p.id !== `aba-${nome}`));
    if (nome === 'cadastro' && !alunoEmEdicao) prepararFormulario(null);
    carregadores[nome]?.().catch((err) => console.error(err));
  }
  $$('.aba').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.aba !== 'cadastro') alunoEmEdicao = null;
    abrirAba(b.dataset.aba);
  }));

  async function carregarPlanos() {
    planos = await api('/planos');
    $('#select-plano').innerHTML = planos
      .map((p) => `<option value="${esc(p.codigo)}">${esc(p.nome)} — ${moeda(p.valor)}</option>`)
      .join('');
  }

  async function iniciarApp() {
    try {
      const [saude] = await Promise.all([api('/health'), carregarPlanos()]);
      hojeServidor = saude.hoje;
    } catch { /* tratado pela sessão */ }
    const hoje = hojeLocal();
    $('#presenca-data').value = hoje;
    $('#pagamento-data').value = hoje;
    $('#filtro-data-presenca').value = hoje;
    $('#filtro-mes-pagamentos').value = hoje.slice(0, 7);
    $('#relatorio-mes').value = hoje.slice(0, 7);
    abrirAba('painel');
  }

  // ---------- Painel ----------
  const kpi = (valor, nome, classe = '') => `<div class="kpi ${classe}"><span class="kpi-valor">${valor}</span><span class="kpi-nome">${esc(nome)}</span></div>`;

  async function carregarPainel() {
    const p = await api('/painel');
    $('#painel-data').textContent = `Hoje, ${data(p.data)}`;
    $('#painel-kpis').innerHTML = [
      kpi(p.alunos.ativos, 'Alunos ativos', 'destaque'),
      kpi(p.alunos.emDia, 'Em dia', 'ok'),
      kpi(p.alunos.pendentes, 'Pendentes', 'alerta'),
      kpi(p.alunos.inadimplentes, `Inadimplentes${p.alunos.bloqueados ? ` · ${p.alunos.bloqueados} bloqueado(s)` : ''}`, 'erro'),
      kpi(p.presencasHoje.total, 'Presenças hoje'),
      kpi(moeda(p.receitaMes.total), `Recebido no mês (${p.receitaMes.quantidade})`),
    ].join('');
    $('#painel-alertas').innerHTML = p.alertasFaltas.length
      ? p.alertasFaltas.map((a) => `
        <li>
          <div><button class="link" data-detalhe="${esc(a._id)}">${esc(a.nome)}</button>
          <span class="info">${esc(telefone(a.telefone))}${a.responsavel ? ` · resp. ${esc(a.responsavel.nome)} ${esc(telefone(a.responsavel.telefone))}` : ''}</span></div>
          ${selo('FALTA', `${a.faltasSeguidas} faltas seguidas`)}
        </li>`).join('')
      : '<li class="info">Nenhum aluno com 5 faltas seguidas.</li>';
    $('#painel-atrasos').innerHTML = p.inadimplentes.length
      ? p.inadimplentes.map((a) => `
        <li>
          <div><button class="link" data-detalhe="${esc(a._id)}">${esc(a.nome)}</button>
          <span class="info">${a.diasEmAtraso} dia(s) de atraso · a pagar ${moeda(a.valorDevido)}</span></div>
          ${a.bloqueado ? selo('BLOQUEADO') : selo(a.status)}
        </li>`).join('')
      : '<li class="info">Nenhuma mensalidade em atraso.</li>';
    $('#painel-presencas').textContent = p.presencasHoje.total
      ? p.presencasHoje.alunos.map((a) => a.nome).join(', ')
      : 'Nenhuma presença registrada hoje.';
  }

  $('#aba-painel').addEventListener('click', (e) => {
    const id = e.target.dataset.detalhe;
    if (id) { abrirAba('alunos'); mostrarDetalhe(id); }
  });

  // ---------- Alunos ----------
  let temporizadorBusca;
  $('#busca-aluno').addEventListener('input', () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(carregarAlunos, 250);
  });
  ['#filtro-status', '#filtro-ativo', '#filtro-alerta'].forEach((s) => $(s).addEventListener('change', carregarAlunos));

  async function carregarAlunos() {
    const params = new URLSearchParams({ ativo: $('#filtro-ativo').value });
    const busca = $('#busca-aluno').value.trim();
    if (busca) params.set('busca', busca);
    if ($('#filtro-status').value) params.set('status', $('#filtro-status').value);
    if ($('#filtro-alerta').checked) params.set('alerta', 'true');
    const corpo = $('#lista-alunos');
    try {
      const alunos = await api(`/alunos?${params}`);
      corpo.innerHTML = alunos.length
        ? alunos.map((a) => `
          <tr class="${a.ativo ? '' : 'inativo'}">
            <td>${esc(a.nome)}</td>
            <td>${esc(cpf(a.cpf))}</td>
            <td>${esc(a.plano?.nome)}</td>
            <td>${esc(a.frequencia.diasTreinoDescricao)}</td>
            <td>${data(a.situacao.vencimento)}</td>
            <td>${seloSituacao(a)}</td>
            <td>${a.frequencia.alerta ? selo('FALTA', `${a.frequencia.faltasSeguidas} · alerta`) : esc(a.frequencia.faltasSeguidas)}</td>
            <td><button class="secundario pequeno" data-detalhe="${esc(a._id)}">Detalhes</button></td>
          </tr>`).join('')
        : '<tr><td colspan="8" class="vazio">Nenhum aluno encontrado.</td></tr>';
    } catch (err) {
      corpo.innerHTML = `<tr><td colspan="8" class="vazio">${esc(err.message)}</td></tr>`;
    }
  }

  $('#lista-alunos').addEventListener('click', (e) => {
    const id = e.target.dataset.detalhe;
    if (id) mostrarDetalhe(id);
  });

  async function mostrarDetalhe(id) {
    const painel = $('#detalhe-aluno');
    try {
      const [aluno, pagamentos, historico] = await Promise.all([
        api(`/alunos/${id}`),
        api(`/alunos/${id}/pagamentos`),
        api(`/alunos/${id}/presencas`),
      ]);
      const s = aluno.situacao;
      const f = historico;
      const acoesAdmin = ehAdmin()
        ? aluno.ativo
          ? '<button class="secundario pequeno perigo" data-acao="inativar">Inativar</button>'
          : '<button class="secundario pequeno" data-acao="reativar">Reativar</button>'
        : '';
      painel.innerHTML = `
        <div class="cabecalho">
          <div>
            <h3 class="sem-margem">${esc(aluno.nome)}</h3>
            <div class="linha-selos">${seloSituacao(aluno)} ${f.alerta ? selo('FALTA', `${f.faltasSeguidas} faltas seguidas`) : ''}</div>
            <p class="info">${esc(s.descricao)}${aluno.motivoInativacao ? ` Motivo: ${esc(aluno.motivoInativacao)}.` : ''}</p>
          </div>
          <div class="botoes">
            <button class="secundario pequeno" data-acao="editar">Editar</button>
            ${acoesAdmin}
            <button class="secundario pequeno" data-acao="fechar">Fechar</button>
          </div>
        </div>
        <div class="confirmacao" id="confirmar-inativacao" hidden>
          <label>Motivo da inativação (opcional) <input id="motivo-inativacao" placeholder="Ex.: mudou de cidade"></label>
          <p class="info">O histórico de pagamentos e de frequência é mantido.</p>
          <div class="botoes">
            <button class="pequeno perigo-cheio" data-acao="confirmar-inativar">Confirmar inativação</button>
            <button class="secundario pequeno" data-acao="cancelar-inativar">Cancelar</button>
          </div>
        </div>
        <p class="mensagem" id="msg-detalhe" role="alert"></p>
        <dl>
          <div><dt>CPF</dt><dd>${esc(cpf(aluno.cpf))}</dd></div>
          <div><dt>Nascimento</dt><dd>${data(aluno.dataNascimento)} (${esc(aluno.idade)} anos)</dd></div>
          <div><dt>Telefone</dt><dd>${esc(telefone(aluno.telefone))}</dd></div>
          <div><dt>Plano</dt><dd>${esc(aluno.plano.nome)} — ${moeda(aluno.plano.valor)}</dd></div>
          <div><dt>Matrícula</dt><dd>${data(aluno.dataMatricula)}</dd></div>
          <div><dt>Vencimento</dt><dd>Todo dia ${esc(s.diaVencimento)} · próximo ${data(s.vencimento)}</dd></div>
          <div><dt>A pagar hoje</dt><dd>${moeda(s.proximaCobranca.valorTotal)}${s.proximaCobranca.multa ? ' (com multa e juros)' : ''}</dd></div>
          <div><dt>Dias de treino</dt><dd>${esc(f.diasTreinoDescricao)}</dd></div>
          <div><dt>Frequência</dt><dd>${f.frequencia === null ? '—' : `${f.frequencia}%`} (${f.totalPresencas} P / ${f.totalFaltas} F)</dd></div>
          ${aluno.responsavel ? `<div><dt>Responsável</dt><dd>${esc(aluno.responsavel.nome)} · ${esc(cpf(aluno.responsavel.cpf))} · ${esc(telefone(aluno.responsavel.telefone))}</dd></div>` : ''}
          ${aluno.dataInativacao ? `<div><dt>Inativado em</dt><dd>${data(aluno.dataInativacao)}</dd></div>` : ''}
        </dl>
        <div class="colunas">
          <div>
            <h4>Histórico de pagamentos</h4>
            <ul>${pagamentos.map((p) => `
              <li><span>${data(p.dataPagamento)} · <strong>${moeda(p.valor)}</strong>${p.multa + p.juros ? ` <span class="info">(${moeda(p.multa + p.juros)} de multa e juros)</span>` : ''}</span>
              <span class="info">${data(p.periodoInicio)} a ${data(p.periodoFim)}</span></li>`).join('') || '<li class="info">Nenhum pagamento.</li>'}</ul>
          </div>
          <div>
            <h4>Últimas faltas</h4>
            <ul>${f.ultimasFaltas.slice(0, 6).map((x) => `<li><span>${data(x.data)} · ${DIAS[new Date(`${x.data}T12:00:00`).getDay()]}</span><span class="info">${x.origem === 'REGISTRADA' ? 'Registrada' : 'Automática'}</span></li>`).join('') || '<li class="info">Nenhuma falta.</li>'}</ul>
            <h4>Últimas presenças</h4>
            <ul>${f.registros.filter((r) => r.status === 'PRESENTE').slice(0, 5).map((r) => `<li><span>${data(r.data)}</span>${selo('PRESENTE')}</li>`).join('') || '<li class="info">Nenhuma presença.</li>'}</ul>
          </div>
        </div>`;
      painel.dataset.alunoId = aluno._id;
      painel.hidden = false;
      painel.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      painel.hidden = false;
      painel.innerHTML = `<p class="mensagem falha">${esc(err.message)}</p>`;
    }
  }

  $('#detalhe-aluno').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;
    const painel = $('#detalhe-aluno');
    const id = painel.dataset.alunoId;
    const msg = $('#msg-detalhe');
    try {
      if (acao === 'fechar') painel.hidden = true;
      if (acao === 'editar') editarAluno(id);
      if (acao === 'inativar') $('#confirmar-inativacao').hidden = false;
      if (acao === 'cancelar-inativar') $('#confirmar-inativacao').hidden = true;
      if (acao === 'confirmar-inativar') {
        await api(`/alunos/${id}/inativar`, { method: 'PATCH', body: { motivo: $('#motivo-inativacao').value } });
        await Promise.all([mostrarDetalhe(id), carregarAlunos()]);
      }
      if (acao === 'reativar') {
        await api(`/alunos/${id}/reativar`, { method: 'PATCH' });
        await Promise.all([mostrarDetalhe(id), carregarAlunos()]);
      }
    } catch (err) {
      if (msg) mensagem(msg, textoErro(err), 'falha');
    }
  });

  // ---------- Cadastro e edição ----------
  const formAluno = $('#form-aluno');

  function atualizarResponsavel() {
    const i = idade(formAluno.dataNascimento.value);
    const info = $('#info-idade');
    const menor = i !== null && i < 18;
    $('#grupo-responsavel').hidden = !menor;
    ['respNome', 'respCpf', 'respTelefone'].forEach((n) => (formAluno[n].required = menor));
    if (i === null) info.textContent = '';
    else if (i < 14) info.textContent = `Idade: ${i} anos. A idade mínima para matrícula é 14 anos.`;
    else info.textContent = `Idade: ${i} anos${menor ? '. É necessário informar um responsável.' : '.'}`;
  }
  formAluno.dataNascimento.addEventListener('change', atualizarResponsavel);

  function prepararFormulario(aluno) {
    alunoEmEdicao = aluno ? aluno._id : null;
    formAluno.reset();
    mensagem($('#msg-aluno'), '');
    $('#titulo-form-aluno').textContent = aluno ? `Editar aluno: ${aluno.nome}` : 'Cadastrar aluno';
    $('#btn-salvar-aluno').textContent = aluno ? 'Salvar alterações' : 'Cadastrar';
    $('#btn-cancelar-edicao').hidden = !aluno;
    const dias = aluno ? aluno.diasTreino : [1, 2, 3, 4, 5];
    $$('input[name=diasTreino]').forEach((c) => (c.checked = dias.includes(Number(c.value))));
    if (aluno) {
      formAluno.nome.value = aluno.nome;
      formAluno.cpf.value = cpf(aluno.cpf);
      formAluno.dataNascimento.value = aluno.dataNascimento;
      formAluno.telefone.value = telefone(aluno.telefone);
      formAluno.plano.value = aluno.plano.codigo;
      if (aluno.responsavel) {
        formAluno.respNome.value = aluno.responsavel.nome;
        formAluno.respCpf.value = cpf(aluno.responsavel.cpf);
        formAluno.respTelefone.value = telefone(aluno.responsavel.telefone);
      }
    }
    atualizarResponsavel();
  }

  async function editarAluno(id) {
    const aluno = await api(`/alunos/${id}`);
    prepararFormulario(aluno);
    abrirAba('cadastro');
  }

  $('#btn-cancelar-edicao').addEventListener('click', () => {
    alunoEmEdicao = null;
    abrirAba('alunos');
  });

  formAluno.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(formAluno);
    const corpo = {
      nome: f.get('nome'),
      cpf: f.get('cpf'),
      dataNascimento: f.get('dataNascimento'),
      telefone: f.get('telefone'),
      plano: f.get('plano'),
      diasTreino: f.getAll('diasTreino').map(Number),
      responsavel: $('#grupo-responsavel').hidden ? null
        : { nome: f.get('respNome'), cpf: f.get('respCpf'), telefone: f.get('respTelefone') },
    };
    const msg = $('#msg-aluno');
    if (!corpo.diasTreino.length) return mensagem(msg, 'Selecione pelo menos um dia de treino.', 'falha');
    try {
      if (alunoEmEdicao) {
        const aluno = await api(`/alunos/${alunoEmEdicao}`, { method: 'PUT', body: corpo });
        alunoEmEdicao = null;
        abrirAba('alunos');
        mostrarDetalhe(aluno._id);
      } else {
        const aluno = await api('/alunos', { method: 'POST', body: corpo });
        prepararFormulario(null);
        mensagem(msg, `Aluno ${aluno.nome} cadastrado. Vencimento todo dia ${aluno.situacao.diaVencimento}. Registre o primeiro pagamento em Mensalidades.`, 'sucesso');
      }
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  // ---------- Selects de aluno ----------
  async function carregarSelectAlunos() {
    alunosAtivos = await api('/alunos?ativo=true');
    $$('.select-aluno').forEach((sel) => {
      const atual = sel.value;
      sel.innerHTML = '<option value="">Selecione...</option>' +
        alunosAtivos.map((a) => `<option value="${esc(a._id)}">${esc(a.nome)} — ${esc(cpf(a.cpf))}</option>`).join('');
      if (alunosAtivos.some((a) => a._id === atual)) sel.value = atual;
      sel.dispatchEvent(new Event('change'));
    });
  }

  const alunoPorId = (id) => alunosAtivos.find((a) => a._id === id);

  // ---------- Mensalidades ----------
  const formPagamento = $('#form-pagamento');

  async function atualizarCobranca() {
    const caixa = $('#info-cobranca');
    const id = formPagamento.alunoId.value;
    if (!id) { caixa.hidden = true; return; }
    try {
      const dia = formPagamento.dataPagamento.value || hojeLocal();
      const c = await api(`/alunos/${id}/cobranca?data=${encodeURIComponent(dia)}`);
      const a = alunoPorId(id);
      const situacao = c.diasAtraso === 0 ? 'Sem atraso' : c.diasAtraso <= 5 ? `${c.diasAtraso} dia(s) de atraso, dentro da tolerância` : `${c.diasAtraso} dias de atraso`;
      caixa.innerHTML = `
        <div class="cobranca-cabecalho">${a ? seloSituacao(a) : ''} <span>Período ${data(c.periodoInicio)} a ${data(c.periodoFim)} · vencimento ${data(c.vencimento)} · ${esc(situacao)}</span></div>
        <dl class="cobranca-valores">
          <div><dt>Plano ${esc(c.plano.nome)}</dt><dd>${moeda(c.valorPlano)}</dd></div>
          <div><dt>Multa (2%)</dt><dd>${moeda(c.multa)}</dd></div>
          <div><dt>Juros (0,1% ao dia)</dt><dd>${moeda(c.juros)}</dd></div>
          <div class="total"><dt>Total a pagar</dt><dd>${moeda(c.valorTotal)}</dd></div>
        </dl>`;
      caixa.hidden = false;
    } catch (err) {
      caixa.innerHTML = `<p class="mensagem falha">${esc(err.message)}</p>`;
      caixa.hidden = false;
    }
  }
  formPagamento.alunoId.addEventListener('change', atualizarCobranca);
  formPagamento.dataPagamento.addEventListener('change', atualizarCobranca);

  formPagamento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(formPagamento);
    const msg = $('#msg-pagamento');
    try {
      const r = await api('/pagamentos', {
        method: 'POST',
        body: { alunoId: f.get('alunoId'), formaPagamento: f.get('formaPagamento'), dataPagamento: f.get('dataPagamento') || undefined },
      });
      mensagem(msg, `Pagamento de ${moeda(r.pagamento.valor)} registrado para ${r.pagamento.aluno.nome}. Período ${data(r.pagamento.periodoInicio)} a ${data(r.pagamento.periodoFim)}. Situação: ${rotulo(r.situacao.status)}.`, 'sucesso');
      await Promise.all([carregarSelectAlunos(), carregarPagamentos()]);
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  $('#filtro-mes-pagamentos').addEventListener('change', carregarPagamentos);

  async function carregarPagamentos() {
    const corpo = $('#lista-pagamentos');
    const mes = $('#filtro-mes-pagamentos').value;
    const lista = await api(`/pagamentos${mes ? `?mes=${encodeURIComponent(mes)}` : ''}`);
    corpo.innerHTML = lista.length
      ? lista.map((p) => `
        <tr>
          <td>${data(p.dataPagamento)}</td>
          <td>${esc(p.aluno?.nome)}</td>
          <td>${esc(p.plano?.nome)}</td>
          <td>${data(p.vencimento)}</td>
          <td>${p.diasAtraso ? `${p.diasAtraso} dia(s)` : '—'}</td>
          <td>${p.multa + p.juros ? moeda(p.multa + p.juros) : '—'}</td>
          <td><strong>${moeda(p.valor)}</strong></td>
          <td>${esc(rotulo(p.formaPagamento))}</td>
          <td>${data(p.periodoInicio)} a ${data(p.periodoFim)}</td>
        </tr>`).join('')
      : '<tr><td colspan="9" class="vazio">Nenhum pagamento no período.</td></tr>';
  }

  // ---------- Frequência ----------
  const formPresenca = $('#form-presenca');
  formPresenca.alunoId.addEventListener('change', () => {
    const a = alunoPorId(formPresenca.alunoId.value);
    $('#info-presenca').innerHTML = a
      ? `${seloSituacao(a)} ${esc(a.situacao.descricao)} Treina: ${esc(a.frequencia.diasTreinoDescricao)}.${a.frequencia.alerta ? ` <strong>${a.frequencia.faltasSeguidas} faltas seguidas.</strong>` : ''}`
      : '';
  });

  formPresenca.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = e.submitter?.value || 'PRESENTE';
    const f = new FormData(formPresenca);
    const msg = $('#msg-presenca');
    try {
      const r = await api('/presencas', {
        method: 'POST',
        body: { alunoId: f.get('alunoId'), data: f.get('data') || undefined, status },
      });
      mensagem(msg, `${rotulo(r.status)} registrada para ${r.aluno.nome} em ${data(r.data)}.`, 'sucesso');
      await Promise.all([carregarSelectAlunos(), carregarPresencas()]);
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  $('#filtro-data-presenca').addEventListener('change', carregarPresencas);

  async function carregarPresencas() {
    const corpo = $('#lista-presencas');
    const dia = $('#filtro-data-presenca').value;
    const lista = await api(`/presencas${dia ? `?data=${encodeURIComponent(dia)}` : ''}`);
    corpo.innerHTML = lista.length
      ? lista.map((r) => `<tr><td>${data(r.data)}</td><td>${esc(r.aluno?.nome)}</td><td>${selo(r.status)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="vazio">Nenhum registro para a data selecionada.</td></tr>';
  }

  // ---------- Relatório ----------
  $('#relatorio-mes').addEventListener('change', carregarRelatorio);

  async function carregarRelatorio() {
    const mes = $('#relatorio-mes').value || hojeLocal().slice(0, 7);
    const r = await api(`/relatorios/recebimentos?mes=${encodeURIComponent(mes)}`);
    $('#relatorio-kpis').innerHTML = [
      kpi(moeda(r.total), 'Total recebido', 'destaque'),
      kpi(r.quantidade, 'Pagamentos'),
      kpi(moeda(r.totalPlanos), 'Mensalidades'),
      kpi(moeda(r.totalMultas + r.totalJuros), 'Multas e juros', 'alerta'),
    ].join('');
    const valores = (lista) => lista.map((g) => `<li><span>${esc(rotulo(g.nome))} <span class="info">(${g.quantidade})</span></span><strong>${moeda(g.total)}</strong></li>`).join('')
      || '<li class="info">Nenhum pagamento.</li>';
    $('#relatorio-formas').innerHTML = valores(r.porFormaPagamento);
    $('#relatorio-planos').innerHTML = valores(r.porPlano);
    $('#relatorio-lista').innerHTML = r.pagamentos.length
      ? r.pagamentos.map((p) => `
        <tr>
          <td>${data(p.dataPagamento)}</td><td>${esc(p.aluno?.nome)}</td><td>${esc(p.plano?.nome)}</td>
          <td>${moeda(p.valorPlano)}</td><td>${p.multa ? moeda(p.multa) : '—'}</td><td>${p.juros ? moeda(p.juros) : '—'}</td>
          <td><strong>${moeda(p.valor)}</strong></td><td>${esc(rotulo(p.formaPagamento))}</td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="vazio">Nenhum pagamento neste mês.</td></tr>';
  }

  // ---------- Configurações ----------
  async function carregarConfiguracoes() {
    await carregarPlanos();
    $('#info-planos').textContent = ehAdmin()
      ? 'Valores fixos de cada plano. Uma alteração vale para os próximos pagamentos.'
      : 'Valores fixos de cada plano. Apenas o Administrador pode alterá-los.';
    $('#lista-planos').innerHTML = planos.map((p) => `
      <tr>
        <td>${esc(p.nome)}</td>
        <td>${p.duracaoMeses} ${p.duracaoMeses === 1 ? 'mês' : 'meses'}</td>
        <td>${ehAdmin()
          ? `<input class="valor-plano" type="number" min="0.01" step="0.01" value="${p.valor}" data-plano="${esc(p._id)}" aria-label="Valor do plano ${esc(p.nome)}">`
          : moeda(p.valor)}</td>
        <td class="so-admin"><button class="secundario pequeno" data-salvar-plano="${esc(p._id)}">Salvar</button></td>
      </tr>`).join('');
    if (ehAdmin()) await carregarUsuarios();
  }

  $('#lista-planos').addEventListener('click', async (e) => {
    const id = e.target.dataset.salvarPlano;
    if (!id) return;
    const msg = $('#msg-planos');
    const valor = Number($(`input[data-plano="${id}"]`).value);
    try {
      const p = await api(`/planos/${id}`, { method: 'PUT', body: { valor } });
      mensagem(msg, `Valor do plano ${p.nome} alterado para ${moeda(p.valor)}.`, 'sucesso');
      await carregarPlanos();
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  async function carregarUsuarios() {
    const usuarios = await api('/usuarios');
    const agora = Date.now();
    $('#lista-usuarios').innerHTML = usuarios.map((u) => {
      const bloqueado = u.bloqueadoAte && new Date(u.bloqueadoAte).getTime() > agora;
      return `
        <tr>
          <td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(rotulo(u.perfil))}</td>
          <td>${bloqueado ? selo('BLOQUEADO', `Bloqueado até ${new Date(u.bloqueadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`) : selo('EM_DIA', 'Liberado')}</td>
          <td>${bloqueado ? `<button class="secundario pequeno" data-desbloquear="${esc(u._id)}">Desbloquear</button>` : ''}</td>
        </tr>`;
    }).join('');
  }

  $('#lista-usuarios').addEventListener('click', async (e) => {
    const id = e.target.dataset.desbloquear;
    if (!id) return;
    await api(`/usuarios/${id}/desbloquear`, { method: 'PATCH' });
    carregarUsuarios();
  });

  $('#form-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = $('#msg-senha');
    try {
      const r = await api('/auth/senha', { method: 'PUT', body: { senhaAtual: f.get('senhaAtual'), novaSenha: f.get('novaSenha') } });
      e.target.reset();
      mensagem(msg, r.mensagem, 'sucesso');
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  $('#form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = $('#msg-usuario');
    try {
      const u = await api('/usuarios', { method: 'POST', body: Object.fromEntries(f) });
      e.target.reset();
      mensagem(msg, `Usuário ${u.nome} criado com perfil ${rotulo(u.perfil)}.`, 'sucesso');
      carregarUsuarios();
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  // ---------- Início ----------
  if (armazenamento.ler(CHAVE_TOKEN)) mostrarApp();
  else $('#tela-login').hidden = false;
})();
