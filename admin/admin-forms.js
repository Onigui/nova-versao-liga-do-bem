/*
 * Formulários de empresa e de usuário do painel (cadastro e edição no mesmo painel lateral).
 * Depende de: API_BASE_URL, loadCompanies, loadMembers, companiesData, membersData (index.html).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utilidades
  const $ = (id) => document.getElementById(id);
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const Mask = {
    phone(v) {
      const d = digits(v).slice(0, 11);
      if (d.length <= 2) return d ? `(${d}` : '';
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    cpf(v) {
      const d = digits(v).slice(0, 11);
      return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },
    cep(v) {
      const d = digits(v).slice(0, 8);
      return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    },
  };

  function isValidCpf(v) {
    const c = digits(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const calc = (n) => {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
  }
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

  function authHeaders() {
    const token = localStorage.getItem('admin_token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Admin-Token': token };
  }

  // ---------------------------------------------------------------- avisos
  function toast(message, tone = 'ok', ms = 5000) {
    let box = document.querySelector('.fx-toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fx-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `fx-toast ${tone}`;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  window.adminToast = toast;


  // ---------------------------------------------------------------- código de primeiro acesso
  /**
   * Mostra o código de 6 dígitos para o admin repassar (WhatsApp/pessoalmente).
   * data: { email, accessCode, accessCodeExpiresAt, shareMessage, emailSent }
   */
  function showAccessCode(data, opts = {}) {
    if (!data?.accessCode) return;
    document.getElementById('fx-code-dialog')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'fx-code-dialog';
    wrap.className = 'fx-dialog-overlay';
    const expires = data.accessCodeExpiresAt ? new Date(data.accessCodeExpiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const emailLine = data.emailSent === true
      ? 'Também enviamos as instruções por e-mail.'
      : data.emailSent === false
        ? 'O e-mail automático não pôde ser enviado. Mande o código abaixo pelo WhatsApp.'
        : '';
    wrap.innerHTML = `
      <div class="fx-dialog" role="dialog" aria-modal="true" aria-labelledby="fx-code-title">
        <h3 id="fx-code-title">${esc(opts.title || 'Código de primeiro acesso')}</h3>
        <p class="fx-dialog-text">Com este código, <strong>${esc(data.email)}</strong> cria a própria senha no app, em
          "${opts.app === 'member' ? 'Esqueci minha senha' : 'Primeiro acesso / Esqueci a senha'}" → "Já tenho um código".</p>
        ${emailLine ? `<p class="fx-dialog-note ${data.emailSent ? 'ok' : 'warn'}">${esc(emailLine)}</p>` : ''}
        <div class="fx-code" aria-label="Código ${esc(data.accessCode.split('').join(' '))}">${esc(data.accessCode.slice(0, 3))}<span></span>${esc(data.accessCode.slice(3))}</div>
        <p class="fx-dialog-text fx-center">Vale até ${esc(expires)} e só pode ser usado uma vez.</p>
        <div class="fx-dialog-actions">
          <a class="fx-btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(data.shareMessage || '')}">Enviar pelo WhatsApp</a>
          <button type="button" class="fx-btn" data-copy>Copiar mensagem</button>
          <button type="button" class="fx-btn" data-close>Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').addEventListener('click', close);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    wrap.querySelector('[data-copy]').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(data.shareMessage || data.accessCode);
        e.target.textContent = 'Copiado';
      } catch {
        window.prompt('Copie a mensagem:', data.shareMessage || data.accessCode);
      }
    });
    setTimeout(() => wrap.querySelector('a.fx-btn').focus(), 30);
  }
  window.showAccessCode = showAccessCode;

  async function requestAccessCode(url, opts) {
    try {
      const r = await fetch(url, { method: 'POST', headers: authHeaders(), body: '{}' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast(data.error || 'Não foi possível gerar o código.', 'bad'); return; }
      showAccessCode(data, opts);
    } catch {
      toast('Sem conexão com o servidor. Tente de novo.', 'bad');
    }
  }
  window.generatePartnerAccessCode = (accountId) =>
    requestAccessCode(`${API_BASE_URL}/api/admin/partner-accounts/${encodeURIComponent(accountId)}/access-code`, { title: 'Novo código de acesso', app: 'partner' });
  window.generateMemberAccessCode = (userId) =>
    requestAccessCode(`${API_BASE_URL}/api/admin/members/${encodeURIComponent(userId)}/access-code`, { title: 'Novo código de acesso', app: 'member' });

  // ---------------------------------------------------------------- validação de campos
  function setError(input, message) {
    const field = input.closest('.fx-field');
    if (!field) return;
    field.classList.toggle('fx-invalid', !!message);
    const err = field.querySelector('.fx-error');
    if (err) err.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  function clearErrors(form) {
    form.querySelectorAll('.fx-field.fx-invalid').forEach((f) => f.classList.remove('fx-invalid'));
    form.querySelectorAll('[aria-invalid="true"]').forEach((i) => i.setAttribute('aria-invalid', 'false'));
  }
  function showErrors(errors, noteEl) {
    const entries = Object.entries(errors);
    entries.forEach(([id, msg]) => setError($(id), msg));
    if (entries.length) {
      const first = $(entries[0][0]);
      const details = first.closest('details');
      if (details) details.open = true;
      first.focus({ preventScroll: false });
      noteEl.textContent = entries.length === 1 ? 'Corrija o campo destacado.' : `Corrija os ${entries.length} campos destacados.`;
      noteEl.classList.add('bad');
    }
    return entries.length === 0;
  }

  // ---------------------------------------------------------------- painel (abrir/fechar)
  function makeDrawer(id, onRequestClose) {
    const overlay = $(id);
    // Foco/scrollIntoView também rolam containers com overflow:hidden; o painel nunca deve sair do lugar
    const panel = overlay.querySelector('.modal');
    panel.addEventListener('scroll', () => { if (panel.scrollTop) panel.scrollTop = 0; });
    overlay.addEventListener('scroll', () => { if (overlay.scrollTop) overlay.scrollTop = 0; });
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) onRequestClose();
    });
    return {
      show() {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      },
      hide() {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      },
      isOpen: () => overlay.style.display === 'flex',
    };
  }

  // ---------------------------------------------------------------- horário de funcionamento
  const DAYS = [
    { key: 1, short: 'Seg', label: 'Segunda' }, { key: 2, short: 'Ter', label: 'Terça' },
    { key: 3, short: 'Qua', label: 'Quarta' }, { key: 4, short: 'Qui', label: 'Quinta' },
    { key: 5, short: 'Sex', label: 'Sexta' }, { key: 6, short: 'Sáb', label: 'Sábado' },
    { key: 0, short: 'Dom', label: 'Domingo' },
  ];
  const DAY_ALIASES = { dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, 'terça': 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, 'sáb': 6, sabado: 6, 'sábado': 6 };
  const ORDER = DAYS.map((d) => d.key); // seg..dom

  const Hours = {
    week: null,
    render(container, week) {
      this.week = week;
      container.innerHTML = DAYS.map((d) => {
        const w = week[d.key];
        return `<div class="fx-hours-row ${w.open ? '' : 'fx-closed'}" data-day="${d.key}">
          <span class="fx-day">${d.label}</span>
          <label class="fx-switch" style="align-items:center"><input type="checkbox" ${w.open ? 'checked' : ''} aria-label="${d.label} aberto"><span class="fx-track"></span><span class="fx-hint" style="margin:0">${w.open ? 'Aberto' : 'Fechado'}</span></label>
          <span class="fx-times"><input type="time" class="fx-input" value="${w.from}" aria-label="${d.label} abre às"> até <input type="time" class="fx-input" value="${w.to}" aria-label="${d.label} fecha às"></span>
        </div>`;
      }).join('');
      container.querySelectorAll('.fx-hours-row').forEach((row) => {
        const key = Number(row.dataset.day);
        const [toggle, from, to] = row.querySelectorAll('input');
        toggle.addEventListener('change', () => {
          this.week[key].open = toggle.checked;
          row.classList.toggle('fx-closed', !toggle.checked);
          row.querySelector('.fx-switch .fx-hint').textContent = toggle.checked ? 'Aberto' : 'Fechado';
          container.dispatchEvent(new Event('hours-change'));
        });
        from.addEventListener('input', () => { this.week[key].from = from.value; container.dispatchEvent(new Event('hours-change')); });
        to.addEventListener('input', () => { this.week[key].to = to.value; container.dispatchEvent(new Event('hours-change')); });
      });
    },
    preset(name) {
      const w = {};
      DAYS.forEach((d) => {
        if (name === 'commercial') w[d.key] = { open: d.key >= 1 && d.key <= 6, from: '08:00', to: d.key === 6 ? '12:00' : '18:00' };
        else if (name === 'everyday') w[d.key] = { open: true, from: '08:00', to: '20:00' };
        else w[d.key] = { open: true, from: '00:00', to: '23:59' };
      });
      return w;
    },
    empty() {
      const w = {};
      DAYS.forEach((d) => (w[d.key] = { open: false, from: '08:00', to: '18:00' }));
      return w;
    },
    /** "Seg-Sex: 08:00-18:00 | Sáb: 08:00-12:00" (formato que o app dos membros entende) */
    serialize(week) {
      const groups = [];
      ORDER.forEach((key) => {
        const w = week[key];
        if (!w.open) { groups.push(null); return; }
        const last = groups[groups.length - 1];
        if (last && last.from === w.from && last.to === w.to) last.keys.push(key);
        else groups.push({ keys: [key], from: w.from, to: w.to });
      });
      const short = (k) => DAYS.find((d) => d.key === k).short;
      return groups
        .filter(Boolean)
        .map((g) => {
          const days = g.keys.length === 1 ? short(g.keys[0]) : `${short(g.keys[0])}-${short(g.keys[g.keys.length - 1])}`;
          return `${days}: ${g.from}-${g.to}`;
        })
        .join(' | ');
    },
    /** Lê o texto salvo de volta para a grade. null se não for um formato reconhecido. */
    parse(text) {
      const t = String(text || '').trim();
      if (!t) return null;
      const week = this.empty();
      const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('.', '').trim();
      const time = (s) => {
        const m = String(s).trim().toLowerCase().replace('h', ':').match(/^(\d{1,2})(?::?(\d{2}))?$/);
        return m ? `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}` : null;
      };
      let ok = false;
      for (const part of t.split(/\||\n|;/)) {
        const m = part.match(/^\s*([^:]+?)\s*:\s*(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*(?:-|–|às|a)\s*(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*$/i);
        if (!m) { if (/fechado/i.test(part)) continue; if (part.trim()) return null; continue; }
        const range = m[1].split(/\s*(?:-|–|a)\s*/).map(norm);
        const from = time(m[2]); const to = time(m[3]);
        const a = DAY_ALIASES[range[0]]; const b = DAY_ALIASES[range[range.length - 1]];
        if (a === undefined || b === undefined || !from || !to) return null;
        let i = ORDER.indexOf(a);
        for (let n = 0; n < 7; n++) {
          const key = ORDER[i % 7];
          week[key] = { open: true, from, to };
          if (key === b) break;
          i++;
        }
        ok = true;
      }
      return ok ? week : null;
    },
    today(week) {
      const w = week[new Date().getDay()];
      return w && w.open ? `Hoje: ${w.from} às ${w.to}` : 'Fechado hoje';
    },
  };

  // ---------------------------------------------------------------- empresa
  const CompanyForm = {
    mode: 'create',
    id: null,
    dirty: false,
    geoManual: false,
    geoTimer: null,
    originalAddress: '',

    init() {
      this.form = $('companyForm');
      this.note = $('companyFormNote');
      this.submitBtn = $('companyFormSubmit');
      this.drawer = makeDrawer('companyModal', () => this.close());
      this.form.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
      this.form.addEventListener('input', () => { this.dirty = true; this.note.textContent = ''; this.note.classList.remove('bad'); this.preview(); });

      $('cf-phone').addEventListener('input', (e) => { e.target.value = Mask.phone(e.target.value); });
      $('cf-state').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^a-z]/gi, '').toUpperCase(); });
      $('cf-zip').addEventListener('input', (e) => {
        e.target.value = Mask.cep(e.target.value);
        if (digits(e.target.value).length === 8) this.lookupCep(digits(e.target.value));
      });
      ['cf-street', 'cf-number', 'cf-district', 'cf-city', 'cf-state'].forEach((id) =>
        $(id).addEventListener('input', () => this.scheduleGeocode()));
      ['cf-lat', 'cf-lng'].forEach((id) => $(id).addEventListener('input', () => {
        this.geoManual = true;
        this.setGeoStatus($('cf-lat').value && $('cf-lng').value ? 'ok' : 'muted', $('cf-lat').value && $('cf-lng').value ? 'Posição no mapa ajustada manualmente' : 'Posição no mapa: incompleta');
      }));
      $('cf-access-toggle').addEventListener('change', (e) => { $('cf-access-fields').hidden = !e.target.checked; if (e.target.checked) $('cf-owner-email').focus(); });
      this.form.querySelectorAll('[data-hours-preset]').forEach((b) => b.addEventListener('click', () => {
        Hours.render($('cf-hours'), Hours.preset(b.dataset.hoursPreset));
        this.dirty = true;
        this.preview();
      }));
      $('cf-hours').addEventListener('hours-change', () => { this.dirty = true; this.preview(); });
    },

    open(company) {
      this.form.reset();
      clearErrors(this.form);
      this.note.textContent = '';
      this.note.classList.remove('bad');
      this.mode = company ? 'edit' : 'create';
      this.id = company?.id || null;
      this.geoManual = false;
      this.originalAddress = company?.address || '';
      $('companyFormTitle').textContent = company ? `Editar ${company.name}` : 'Nova empresa parceira';
      $('companyFormSubtitle').textContent = company
        ? 'As alterações entram no ar na hora para os membros.'
        : 'Os dados abaixo aparecem para os membros no app Liga do Bem, na lista e no mapa de parceiros.';
      this.submitBtn.textContent = company ? 'Salvar alterações' : 'Cadastrar empresa';
      $('cf-access-section').hidden = !!company;
      $('cf-access-fields').hidden = true;
      $('cf-zip-status').innerHTML = '&nbsp;';

      if (company) {
        $('cf-name').value = company.name || '';
        const cat = $('cf-category');
        if (company.category && ![...cat.options].some((o) => o.value === company.category)) {
          cat.add(new Option(company.category, company.category));
        }
        cat.value = company.category || '';
        $('cf-description').value = company.description || '';
        $('cf-logo').value = company.logo || '';
        $('cf-phone').value = company.phone ? Mask.phone(company.phone) : '';
        $('cf-email').value = company.email || '';
        $('cf-website').value = company.website || '';
        $('cf-zip').value = company.zipCode ? Mask.cep(company.zipCode) : '';
        $('cf-street').value = company.address || '';
        $('cf-city').value = company.city || '';
        $('cf-state').value = company.state || '';
        $('cf-lat').value = company.latitude ?? '';
        $('cf-lng').value = company.longitude ?? '';
        $('cf-active').checked = company.isActive !== false && company.status !== 'inactive';
        const week = Hours.parse(company.hours);
        Hours.render($('cf-hours'), week || Hours.empty());
        if (!week && company.hours) toast(`O horário salvo ("${company.hours}") estava em texto livre. Confira a grade antes de salvar.`, 'warn', 8000);
        this.setGeoStatus(company.latitude != null ? 'ok' : 'warn', company.latitude != null ? 'Posição no mapa definida' : 'Sem posição no mapa: confira o endereço');
      } else {
        Hours.render($('cf-hours'), Hours.preset('commercial'));
        $('cf-active').checked = true;
        this.setGeoStatus('muted', 'Posição no mapa: preencha o endereço');
      }
      this.dirty = false;
      this.drawer.show();
      this.preview();
      setTimeout(() => $('cf-name').focus(), 50);
    },

    close(force) {
      if (!force && this.dirty && !confirm('Descartar o que foi preenchido?')) return;
      this.drawer.hide();
    },

    setGeoStatus(tone, text) {
      const el = $('cf-geo-status');
      el.className = `fx-status ${tone}`;
      el.textContent = text;
    },

    async lookupCep(cep) {
      const status = $('cf-zip-status');
      status.textContent = 'Buscando endereço…';
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const j = await r.json();
        if (j.erro) { status.textContent = 'CEP não encontrado. Preencha o endereço à mão.'; return; }
        if (j.logradouro) $('cf-street').value = j.logradouro;
        if (j.bairro) $('cf-district').value = j.bairro;
        if (j.localidade) $('cf-city').value = j.localidade;
        if (j.uf) $('cf-state').value = j.uf;
        status.textContent = 'Endereço encontrado. Falta o número.';
        ['cf-street', 'cf-district', 'cf-city', 'cf-state'].forEach((id) => setError($(id), ''));
        this.preview();
        $('cf-number').focus();
        this.scheduleGeocode();
      } catch {
        status.textContent = 'Não foi possível buscar o CEP. Preencha o endereço à mão.';
      }
    },

    composeAddress() {
      const street = $('cf-street').value.trim();
      const number = $('cf-number').value.trim();
      const compl = $('cf-complement').value.trim();
      const district = $('cf-district').value.trim();
      // Na edição, a rua pode já conter o endereço completo salvo antes
      if (this.mode === 'edit' && street === this.originalAddress && !number && !compl && !district) return street;
      let out = street;
      if (number) out += `, ${number}`;
      if (compl) out += ` - ${compl}`;
      if (district) out += ` - ${district}`;
      return out;
    },

    scheduleGeocode() {
      if (this.geoManual) return;
      clearTimeout(this.geoTimer);
      this.geoTimer = setTimeout(() => this.geocode(), 900);
    },

    async geocode() {
      const city = $('cf-city').value.trim();
      const state = $('cf-state').value.trim();
      const street = $('cf-street').value.trim();
      if (!street || !city || !state) return;
      const query = `${this.composeAddress()}, ${city} - ${state}, Brasil`;
      this.setGeoStatus('muted', 'Procurando no mapa…');
      const done = (lat, lng) => {
        $('cf-lat').value = Number(lat).toFixed(6);
        $('cf-lng').value = Number(lng).toFixed(6);
        this.setGeoStatus('ok', 'Posição no mapa encontrada');
      };
      try {
        if (window.google?.maps?.Geocoder) {
          const res = await new google.maps.Geocoder().geocode({ address: query, region: 'br' });
          const loc = res?.results?.[0]?.geometry?.location;
          if (loc) return done(loc.lat(), loc.lng());
        }
      } catch { /* tenta o OpenStreetMap */ }
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'pt-BR' } });
        const j = await r.json();
        if (j?.[0]) return done(j[0].lat, j[0].lon);
      } catch { /* sem mapa */ }
      this.setGeoStatus('warn', 'Não achamos no mapa. Confira o endereço ou ajuste à mão.');
    },

    preview() {
      const name = $('cf-name').value.trim();
      $('pv-name').textContent = name || 'Nome da empresa';
      $('pv-cat').textContent = $('cf-category').value || 'Categoria';
      const logo = $('cf-logo').value.trim();
      $('pv-logo').innerHTML = /^https:\/\//i.test(logo)
        ? `<img src="${esc(logo)}" alt="" onerror="this.parentNode.textContent='${esc((name[0] || '?').toUpperCase())}'">`
        : esc((name[0] || '?').toUpperCase());
      const desc = $('cf-description').value.trim();
      $('pv-desc').textContent = desc.length > 140 ? `${desc.slice(0, 140)}…` : desc;
      const city = $('cf-city').value.trim();
      const addr = [this.composeAddress(), city && `${city}/${$('cf-state').value.trim()}`].filter(Boolean).join(' · ');
      $('pv-address').textContent = addr || 'Endereço';
      $('pv-address').className = addr ? '' : 'fx-pempty';
      const phone = $('cf-phone').value.trim();
      $('pv-phone').textContent = phone || 'Sem telefone';
      $('pv-phone').className = phone ? '' : 'fx-pempty';
      const week = Hours.week || Hours.empty();
      const anyOpen = Object.values(week).some((w) => w.open);
      $('pv-hours').textContent = anyOpen ? Hours.serialize(week).replace(/ \| /g, ' · ') : 'Horário não informado';
      const today = week[new Date().getDay()];
      const badge = $('pv-badge');
      badge.textContent = !$('cf-active').checked ? 'Oculta no app' : today?.open ? Hours.today(week) : 'Fechado hoje';
      badge.className = `fx-pbadge ${!$('cf-active').checked || !today?.open ? 'off' : ''}`;
    },

    validate() {
      clearErrors(this.form);
      const e = {};
      if ($('cf-name').value.trim().length < 2) e['cf-name'] = 'Informe o nome da empresa.';
      if (!$('cf-category').value) e['cf-category'] = 'Escolha a categoria.';
      const logo = $('cf-logo').value.trim();
      if (logo && !/^https:\/\//i.test(logo)) e['cf-logo'] = 'Use um link que comece com https://';
      const phone = digits($('cf-phone').value);
      if (phone && (phone.length < 10 || phone.length > 11)) e['cf-phone'] = 'Telefone com DDD: 10 ou 11 números.';
      const email = $('cf-email').value.trim();
      if (email && !isEmail(email)) e['cf-email'] = 'E-mail inválido.';
      if (digits($('cf-zip').value).length !== 8) e['cf-zip'] = 'Informe o CEP com 8 números.';
      if (!$('cf-street').value.trim()) e['cf-street'] = 'Informe a rua.';
      const creatingOrNew = this.mode === 'create' || $('cf-street').value.trim() !== this.originalAddress;
      if (creatingOrNew && !$('cf-number').value.trim()) e['cf-number'] = 'Informe o número (ou "s/n").';
      if (creatingOrNew && !$('cf-district').value.trim()) e['cf-district'] = 'Informe o bairro.';
      if (!$('cf-city').value.trim()) e['cf-city'] = 'Informe a cidade.';
      if (!/^[A-Z]{2}$/.test($('cf-state').value.trim())) e['cf-state'] = 'UF com 2 letras.';
      const lat = $('cf-lat').value.trim(); const lng = $('cf-lng').value.trim();
      if (lat && (!Number.isFinite(Number(lat.replace(',', '.'))) || Math.abs(Number(lat.replace(',', '.'))) > 90)) e['cf-lat'] = 'Latitude inválida.';
      if (lng && (!Number.isFinite(Number(lng.replace(',', '.'))) || Math.abs(Number(lng.replace(',', '.'))) > 180)) e['cf-lng'] = 'Longitude inválida.';
      if (this.mode === 'create' && $('cf-access-toggle').checked && !isEmail($('cf-owner-email').value)) e['cf-owner-email'] = 'Informe o e-mail do responsável.';
      return showErrors(e, this.note);
    },

    payload() {
      const week = Hours.week || Hours.empty();
      const hours = Hours.serialize(week);
      const p = {
        name: $('cf-name').value.trim(),
        category: $('cf-category').value,
        description: $('cf-description').value.trim() || null,
        logo: $('cf-logo').value.trim() || null,
        phone: $('cf-phone').value.trim() || null,
        email: $('cf-email').value.trim() || null,
        website: $('cf-website').value.trim() || null,
        zipCode: $('cf-zip').value.trim(),
        address: this.composeAddress(),
        city: $('cf-city').value.trim(),
        state: $('cf-state').value.trim(),
        latitude: $('cf-lat').value.trim() || null,
        longitude: $('cf-lng').value.trim() || null,
        hours: hours || null,
        isActive: $('cf-active').checked,
      };
      if (this.mode === 'create' && $('cf-access-toggle').checked) {
        p.ownerEmail = $('cf-owner-email').value.trim();
        p.ownerName = $('cf-owner-name').value.trim();
      }
      return p;
    },

    async save() {
      if (!this.validate()) return;
      const btn = this.submitBtn;
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = this.mode === 'edit' ? 'Salvando…' : 'Cadastrando…';
      try {
        const url = this.mode === 'edit' ? `${API_BASE_URL}/api/admin/companies/${encodeURIComponent(this.id)}` : `${API_BASE_URL}/api/admin/companies`;
        const r = await fetch(url, { method: this.mode === 'edit' ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(this.payload()) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const map = { name: 'cf-name', category: 'cf-category', zipCode: 'cf-zip', address: 'cf-street', city: 'cf-city', state: 'cf-state', email: 'cf-email', logo: 'cf-logo', latitude: 'cf-lat', longitude: 'cf-lng' };
          if (data.field && map[data.field]) showErrors({ [map[data.field]]: data.error }, this.note);
          else { this.note.textContent = data.error || `Não foi possível salvar (erro ${r.status}).`; this.note.classList.add('bad'); }
          return;
        }
        this.dirty = false;
        this.close(true);
        const name = data.company?.name || 'Empresa';
        toast(this.mode === 'edit' ? `${name}: alterações salvas.` : `${name} cadastrada.`);
        if (data.access?.accessCode) {
          showAccessCode(data.access, { app: 'partner' });
        } else if (data.access) {
          toast(`${data.access.email} já tinha conta: entra no App Parceiros com a senha de sempre.`, 'ok', 8000);
        } else if (data.accessError) {
          toast(`A empresa foi cadastrada, mas o acesso não: ${data.accessError} Crie pelo botão "Acessos".`, 'warn', 10000);
        }
        if (typeof loadCompanies === 'function') loadCompanies();
      } catch (err) {
        this.note.textContent = 'Sem conexão com o servidor. Tente de novo.';
        this.note.classList.add('bad');
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    },
  };

  // ---------------------------------------------------------------- usuário
  const MemberForm = {
    mode: 'create',
    id: null,
    dirty: false,

    init() {
      this.form = $('memberForm');
      this.note = $('memberFormNote');
      this.submitBtn = $('memberFormSubmit');
      this.drawer = makeDrawer('memberModal', () => this.close());
      this.form.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
      this.form.addEventListener('input', () => { this.dirty = true; this.note.textContent = ''; this.note.classList.remove('bad'); });
      $('mf-cpf').addEventListener('input', (e) => { e.target.value = Mask.cpf(e.target.value); });
      $('mf-phone').addEventListener('input', (e) => { e.target.value = Mask.phone(e.target.value); });
      this.form.querySelectorAll('input[name="mf-role"]').forEach((r) =>
        r.addEventListener('change', () => { $('mf-admin-warning').hidden = this.role() !== 'ADMIN'; }));
    },

    role() {
      return this.form.querySelector('input[name="mf-role"]:checked')?.value || 'MEMBER';
    },

    open(member) {
      this.form.reset();
      clearErrors(this.form);
      this.note.textContent = '';
      this.note.classList.remove('bad');
      this.mode = member ? 'edit' : 'create';
      this.id = member?.id || null;
      $('memberFormTitle').textContent = member ? `Editar ${member.name}` : 'Novo usuário';
      $('memberFormSubtitle').textContent = member
        ? 'As alterações valem no próximo acesso da pessoa ao app.'
        : 'A pessoa recebe um e-mail para criar a própria senha. Você não precisa definir nem enviar senha.';
      this.submitBtn.textContent = member ? 'Salvar alterações' : 'Cadastrar usuário';
      $('mf-invite-row').hidden = !!member;
      if (member) {
        $('mf-name').value = member.name || '';
        $('mf-email').value = member.email || '';
        $('mf-phone').value = member.phone ? Mask.phone(member.phone) : '';
        $('mf-cpf').value = member.cpf ? Mask.cpf(member.cpf) : '';
        $('mf-active').checked = member.isActive !== false;
        const radio = this.form.querySelector(`input[name="mf-role"][value="${member.role || 'MEMBER'}"]`);
        if (radio) radio.checked = true;
      }
      $('mf-admin-warning').hidden = this.role() !== 'ADMIN';
      this.dirty = false;
      this.drawer.show();
      setTimeout(() => $('mf-name').focus(), 50);
    },

    close(force) {
      if (!force && this.dirty && !confirm('Descartar o que foi preenchido?')) return;
      this.drawer.hide();
    },

    validate() {
      clearErrors(this.form);
      const e = {};
      if ($('mf-name').value.trim().split(/\s+/).filter(Boolean).length < 2) e['mf-name'] = 'Informe nome e sobrenome.';
      const cpf = $('mf-cpf').value.trim();
      if (cpf && !isValidCpf(cpf)) e['mf-cpf'] = 'CPF inválido. Confira os números.';
      const phone = digits($('mf-phone').value);
      if (phone && (phone.length < 10 || phone.length > 11)) e['mf-phone'] = 'Celular com DDD: 10 ou 11 números.';
      if (!isEmail($('mf-email').value)) e['mf-email'] = 'Informe um e-mail válido.';
      return showErrors(e, this.note);
    },

    async save() {
      if (!this.validate()) return;
      if (this.role() === 'ADMIN' && !confirm('Confirmar acesso de ADMINISTRADOR para esta pessoa?')) return;
      const btn = this.submitBtn;
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = this.mode === 'edit' ? 'Salvando…' : 'Cadastrando…';
      const body = {
        name: $('mf-name').value.trim(),
        email: $('mf-email').value.trim(),
        phone: $('mf-phone').value.trim() || null,
        cpf: digits($('mf-cpf').value) || null,
        role: this.role(),
        isActive: $('mf-active').checked,
      };
      if (this.mode === 'create') body.sendInvite = $('mf-invite').checked;
      try {
        const url = this.mode === 'edit' ? `${API_BASE_URL}/api/admin/members/${encodeURIComponent(this.id)}` : `${API_BASE_URL}/api/admin/members`;
        const r = await fetch(url, { method: this.mode === 'edit' ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const map = { name: 'mf-name', email: 'mf-email', cpf: 'mf-cpf', phone: 'mf-phone' };
          if (data.field && map[data.field]) showErrors({ [map[data.field]]: data.error }, this.note);
          else { this.note.textContent = data.error || `Não foi possível salvar (erro ${r.status}).`; this.note.classList.add('bad'); }
          return;
        }
        this.dirty = false;
        this.close(true);
        if (this.mode === 'edit') toast(`${body.name}: alterações salvas.`);
        else {
          toast(`${body.name} cadastrado.`);
          showAccessCode(data, { app: body.role === 'PARTNER' ? 'partner' : 'member' });
        }
        if (typeof loadMembers === 'function') loadMembers();
      } catch {
        this.note.textContent = 'Sem conexão com o servidor. Tente de novo.';
        this.note.classList.add('bad');
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    },
  };

  // ---------------------------------------------------------------- ligações com o index.html
  CompanyForm.init();
  MemberForm.init();
  window.CompanyForm = CompanyForm;
  window.MemberForm = MemberForm;
  window.AdminFormsInternals = { Mask, isValidCpf, Hours };

  const originalOpenModal = window.openModal;
  window.openModal = function (id) {
    if (id === 'companyModal') return CompanyForm.open();
    if (id === 'memberModal') return MemberForm.open();
    return originalOpenModal(id);
  };
  window.editCompany = function (id) {
    const c = (window.companiesData || (typeof companiesData !== 'undefined' ? companiesData : [])).find((x) => x.id === id);
    if (!c) { toast('Empresa não encontrada. Recarregue a página.', 'bad'); return; }
    CompanyForm.open(c);
  };
  window.editMember = function (id) {
    const m = (typeof membersData !== 'undefined' ? membersData : []).find((x) => x.id === id);
    if (!m) { toast('Usuário não encontrado. Recarregue a página.', 'bad'); return; }
    MemberForm.open(m);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (CompanyForm.drawer.isOpen()) CompanyForm.close();
    else if (MemberForm.drawer.isOpen()) MemberForm.close();
  });
})();
