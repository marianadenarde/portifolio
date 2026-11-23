(() => {
  const CHAVE_TOKEN = 'academia.token';
  const CHAVE_USUARIO = 'academia.usuario';
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let planos = [];
  let alunosCache = [];

  // ---------- Utilidades ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (v) => (v ? v.split('-').reverse().join('/') : '—');
  const cpf = (v) => String(v || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  const telefone = (v) => String(v || '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  const rotuloStatus = { EM_DIA: 'Em dia', INADIMPLENTE: 'Inadimplente', BLOQUEADO: 'Bloqueado', PRESENTE: 'Presente', FALTA: 'Falta' };
  const selo = (s) => `<span class="selo ${esc(s)}">${esc(rotuloStatus[s] || s)}</span>`;
  const rotuloForma = { PIX: 'PIX', DINHEIRO: 'Dinheiro', CARTAO_DEBITO: 'Cartão de débito', CARTAO_CREDITO: 'Cartão de crédito' };
  const hojeLocal = () => new Date().toLocaleDateString('en-CA');

  function idade(nascimento) {
    if (!nascimento) return null;
    const [a, m, d] = nascimento.split('-').map(Number);
    const h = new Date();
    let i = h.getFullYear() - a;
    if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) i -= 1;
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

  // ---------- API ----------
  async function api(caminho, opcoes = {}) {
    const token = localStorage.getItem(CHAVE_TOKEN);
    const resposta = await fetch(`/api${caminho}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
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
    const usuario = JSON.parse(localStorage.getItem(CHAVE_USUARIO) || 'null');
    $('#nome-usuario').textContent = usuario ? `${usuario.nome} (${usuario.perfil})` : '';
    $('#tela-login').hidden = true;
    $('#tela-app').hidden = false;
    iniciarApp();
  }

  function sair() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
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
      localStorage.setItem(CHAVE_TOKEN, r.token);
      localStorage.setItem(CHAVE_USUARIO, JSON.stringify(r.usuario));
      mensagem(msg, '');
      mostrarApp();
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  $('#btn-sair').addEventListener('click', sair);

  // ---------- Abas ----------
  function abrirAba(nome) {
    $$('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
    $$('.painel').forEach((p) => (p.hidden = p.id !== `aba-${nome}`));
    if (nome === 'alunos') carregarAlunos();
    if (nome === 'pagamentos') { carregarSelectAlunos(); carregarPagamentos(); }
    if (nome === 'presencas') { carregarSelectAlunos(); carregarPresencas(); }
  }
  $$('.aba').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));

  async function iniciarApp() {
    try {
      planos = await api('/planos');
      $('#select-plano').innerHTML = planos
        .map((p) => `<option value="${esc(p.codigo)}">${esc(p.nome)} — ${moeda(p.valor)}</option>`)
        .join('');
    } catch { /* tratado no login */ }
    $('#form-presenca [name=data]').value = hojeLocal();
    $('#form-pagamento [name=dataPagamento]').value = hojeLocal();
    $('#filtro-data-presenca').value = hojeLocal();
    abrirAba('alunos');
  }

  // ---------- Alunos ----------
  let temporizadorBusca;
  $('#busca-aluno').addEventListener('input', () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(carregarAlunos, 250);
  });
  $('#filtro-status').addEventListener('change', carregarAlunos);

  async function carregarAlunos() {
    const params = new URLSearchParams();
    const busca = $('#busca-aluno').value.trim();
    const status = $('#filtro-status').value;
    if (busca) params.set('busca', busca);
    if (status) params.set('status', status);
    const corpo = $('#lista-alunos');
    try {
      const alunos = await api(`/alunos?${params}`);
      corpo.innerHTML = alunos.length
        ? alunos.map((a) => `
          <tr>
            <td>${esc(a.nome)}</td>
            <td>${esc(cpf(a.cpf))}</td>
            <td>${esc(a.idade)}</td>
            <td>${esc(a.plano?.nome)}</td>
            <td>${data(a.situacao.pagoAte)}</td>
            <td>${selo(a.situacao.status)}</td>
            <td><button class="secundario pequeno" data-detalhe="${esc(a._id)}">Detalhes</button></td>
          </tr>`).join('')
        : '<tr><td colspan="7" class="vazio">Nenhum aluno encontrado.</td></tr>';
    } catch (err) {
      corpo.innerHTML = `<tr><td colspan="7" class="vazio">${esc(err.message)}</td></tr>`;
    }
  }

  $('#lista-alunos').addEventListener('click', (e) => {
    const id = e.target.dataset.detalhe;
    if (id) mostrarDetalhe(id);
  });

  async function mostrarDetalhe(id) {
    const painel = $('#detalhe-aluno');
    try {
      const [aluno, pagamentos, presencas] = await Promise.all([
        api(`/alunos/${id}`),
        api(`/alunos/${id}/pagamentos`),
        api(`/alunos/${id}/presencas`),
      ]);
      const s = aluno.situacao;
      painel.innerHTML = `
        <div class="cabecalho">
          <div><h3 style="margin:0">${esc(aluno.nome)}</h3>${selo(s.status)} <span class="info">${esc(s.descricao)}</span></div>
          <button class="secundario pequeno" id="fechar-detalhe">Fechar</button>
        </div>
        <dl>
          <div><dt>CPF</dt><dd>${esc(cpf(aluno.cpf))}</dd></div>
          <div><dt>Nascimento</dt><dd>${data(aluno.dataNascimento)} (${esc(aluno.idade)} anos)</dd></div>
          <div><dt>Telefone</dt><dd>${esc(telefone(aluno.telefone))}</dd></div>
          <div><dt>Plano</dt><dd>${esc(aluno.plano.nome)} — ${moeda(aluno.plano.valor)}</dd></div>
          <div><dt>Matrícula</dt><dd>${data(aluno.dataMatricula)}</dd></div>
          <div><dt>Vencimento</dt><dd>${data(s.vencimento)}</dd></div>
          <div><dt>Dias em atraso</dt><dd>${esc(s.diasEmAtraso)}</dd></div>
          <div><dt>Frequência</dt><dd>${presencas.frequencia === null ? '—' : `${presencas.frequencia}%`} (${presencas.totalPresencas} P / ${presencas.totalFaltas} F)</dd></div>
          ${aluno.responsavel ? `<div><dt>Responsável</dt><dd>${esc(aluno.responsavel.nome)} · ${esc(cpf(aluno.responsavel.cpf))} · ${esc(telefone(aluno.responsavel.telefone))}</dd></div>` : ''}
        </dl>
        <div class="colunas">
          <div><h4>Pagamentos</h4><ul>${pagamentos.map((p) => `<li><span>${data(p.dataPagamento)} · ${moeda(p.valor)}</span><span class="info">${data(p.periodoInicio)} a ${data(p.periodoFim)}</span></li>`).join('') || '<li class="info">Nenhum pagamento.</li>'}</ul></div>
          <div><h4>Presenças e faltas</h4><ul>${presencas.registros.map((r) => `<li><span>${data(r.data)}</span>${selo(r.status)}</li>`).join('') || '<li class="info">Nenhum registro.</li>'}</ul></div>
        </div>`;
      painel.hidden = false;
      $('#fechar-detalhe').addEventListener('click', () => (painel.hidden = true));
      painel.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Cadastro ----------
  const formAluno = $('#form-aluno');
  formAluno.dataNascimento.addEventListener('change', () => {
    const i = idade(formAluno.dataNascimento.value);
    const info = $('#info-idade');
    const menor = i !== null && i < 18;
    $('#grupo-responsavel').hidden = !menor;
    ['respNome', 'respCpf', 'respTelefone'].forEach((n) => (formAluno[n].required = menor));
    if (i === null) info.textContent = '';
    else if (i < 14) info.textContent = `Idade: ${i} anos — a idade mínima para matrícula é 14 anos.`;
    else info.textContent = `Idade: ${i} anos${menor ? ' — necessário informar um responsável.' : '.'}`;
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
    };
    if (!$('#grupo-responsavel').hidden) {
      corpo.responsavel = { nome: f.get('respNome'), cpf: f.get('respCpf'), telefone: f.get('respTelefone') };
    }
    const msg = $('#msg-aluno');
    try {
      const aluno = await api('/alunos', { method: 'POST', body: corpo });
      mensagem(msg, `Aluno ${aluno.nome} cadastrado com sucesso! Registre o primeiro pagamento na aba Pagamentos.`, 'sucesso');
      formAluno.reset();
      $('#grupo-responsavel').hidden = true;
      $('#info-idade').textContent = '';
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  // ---------- Selects de aluno ----------
  async function carregarSelectAlunos() {
    alunosCache = await api('/alunos');
    $$('.select-aluno').forEach((sel) => {
      const atual = sel.value;
      sel.innerHTML = '<option value="">Selecione...</option>' +
        alunosCache.map((a) => `<option value="${esc(a._id)}">${esc(a.nome)} — ${esc(cpf(a.cpf))}</option>`).join('');
      if (alunosCache.some((a) => a._id === atual)) sel.value = atual;
      sel.dispatchEvent(new Event('change'));
    });
  }

  const alunoPorId = (id) => alunosCache.find((a) => a._id === id);

  // ---------- Pagamentos ----------
  const formPagamento = $('#form-pagamento');
  formPagamento.alunoId.addEventListener('change', () => {
    const a = alunoPorId(formPagamento.alunoId.value);
    $('#info-pagamento').innerHTML = a
      ? `Plano <strong>${esc(a.plano.nome)}</strong> — valor fixo <strong>${moeda(a.plano.valor)}</strong> · ${selo(a.situacao.status)} pago até ${data(a.situacao.pagoAte)}`
      : '';
  });

  formPagamento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(formPagamento);
    const msg = $('#msg-pagamento');
    try {
      const r = await api('/pagamentos', {
        method: 'POST',
        body: { alunoId: f.get('alunoId'), formaPagamento: f.get('formaPagamento'), dataPagamento: f.get('dataPagamento') || undefined },
      });
      mensagem(msg, `Pagamento de ${moeda(r.pagamento.valor)} registrado. Período coberto: ${data(r.pagamento.periodoInicio)} a ${data(r.pagamento.periodoFim)}. Situação: ${rotuloStatus[r.situacao.status]}.`, 'sucesso');
      await Promise.all([carregarSelectAlunos(), carregarPagamentos()]);
    } catch (err) {
      mensagem(msg, textoErro(err), 'falha');
    }
  });

  async function carregarPagamentos() {
    const corpo = $('#lista-pagamentos');
    const lista = await api('/pagamentos');
    corpo.innerHTML = lista.length
      ? lista.map((p) => `
        <tr>
          <td>${data(p.dataPagamento)}</td>
          <td>${esc(p.aluno?.nome)}</td>
          <td>${esc(p.plano?.nome)}</td>
          <td>${moeda(p.valor)}</td>
          <td>${esc(rotuloForma[p.formaPagamento] || p.formaPagamento)}</td>
          <td>${data(p.periodoInicio)} a ${data(p.periodoFim)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="vazio">Nenhum pagamento registrado.</td></tr>';
  }

  // ---------- Presenças ----------
  const formPresenca = $('#form-presenca');
  formPresenca.alunoId.addEventListener('change', () => {
    const a = alunoPorId(formPresenca.alunoId.value);
    $('#info-presenca').innerHTML = a ? `${selo(a.situacao.status)} ${esc(a.situacao.descricao)}` : '';
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
      mensagem(msg, `${rotuloStatus[r.status]} registrada para ${r.aluno.nome} em ${data(r.data)}.`, 'sucesso');
      carregarPresencas();
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

  // ---------- Início ----------
  if (localStorage.getItem(CHAVE_TOKEN)) mostrarApp();
  else $('#tela-login').hidden = false;
})();
