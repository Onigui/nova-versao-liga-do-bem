/* Vaquinhas (campanhas de arrecadação) — tela do admin da ONG.
 * Usa as funções globais do index.html: API_BASE_URL, adminHeaders, escHtml, openModal, closeModal. */
(function () {
  const esc = (v) => (typeof escHtml === 'function' ? escHtml(v) : String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
  const toInputMoney = (n) => (n ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  let cache = [];

  const STATUS = {
    DRAFT: { label: 'Rascunho', bg: '#F1F5F9', fg: '#475569' },
    ACTIVE: { label: 'No ar', bg: '#DCFCE7', fg: '#15803D' },
    ENDED: { label: 'Encerrada', bg: '#FEF3C7', fg: '#B45309' },
  };
  const REASON = { GOAL: 'bateu a meta', DEADLINE: 'prazo acabou', MANUAL: 'encerrada pela ONG' };

  async function api(method, path, body) {
    const r = await fetch(`${API_BASE_URL}/api/admin/campaigns${path}`, {
      method,
      headers: adminHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
    return data;
  }

  function injectStyles() {
    if (document.getElementById('campaignStyles')) return;
    const st = document.createElement('style');
    st.id = 'campaignStyles';
    st.textContent = `
      .campaigns-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
      .camp-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
      .camp-cover{height:150px;background:#F1F5F9 center/cover no-repeat;position:relative}
      .camp-pill{position:absolute;top:10px;left:10px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}
      .camp-body{padding:14px;display:flex;flex-direction:column;gap:6px;flex:1}
      .camp-title{font-weight:800;font-size:16px;color:#0F172A}
      .camp-bar{height:8px;border-radius:999px;background:#E2E8F0;overflow:hidden}
      .camp-bar>span{display:block;height:100%;background:#7C3AED}
      .camp-meta{font-size:13px;color:#64748B}
      .camp-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .camp-actions .btn{padding:6px 10px;font-size:13px}
      .camp-table{width:100%;border-collapse:collapse;font-size:13px}
      .camp-table td,.camp-table th{padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:left}
    `;
    document.head.appendChild(st);
  }

  window.loadCampaignsAdmin = async function () {
    injectStyles();
    const box = document.getElementById('campaignsList');
    if (!box) return;
    try {
      const data = await api('GET', '');
      cache = data.campaigns || [];
      if (!cache.length) {
        box.innerHTML = `<div class="dashboard-card" style="grid-column:1/-1"><h3 class="card-title">Nenhuma vaquinha ainda</h3>
          <p class="header-subtitle" style="margin-top:6px">Crie uma campanha para um animal específico (cirurgia, tratamento, ração especial). Ela aparece no app com a barra de progresso e o botão de doar.</p>
          <button class="btn btn-primary" style="margin-top:12px" onclick="openCampaignModal()">Criar a primeira</button></div>`;
        return;
      }
      box.innerHTML = cache.map(card).join('');
    } catch (e) {
      box.innerHTML = `<p style="color:#B91C1C">${esc(e.message)}</p>`;
    }
  };

  function card(c) {
    const st = STATUS[c.status] || STATUS.DRAFT;
    const cover = c.coverUrl ? `background-image:url('${esc(c.coverUrl)}')` : '';
    const reason = c.status === 'ENDED' && c.closedReason ? ` · ${REASON[c.closedReason] || ''}` : '';
    return `<div class="camp-card">
      <div class="camp-cover" style="${cover}"><span class="camp-pill" style="background:${st.bg};color:${st.fg}">${st.label}${esc(reason)}</span></div>
      <div class="camp-body">
        <div class="camp-title">${esc(c.title)}</div>
        ${c.animal ? `<div class="camp-meta">🐾 ${esc(c.animal.name || 'Animal')}</div>` : ''}
        <div class="camp-bar"><span style="width:${c.percent}%"></span></div>
        <div class="camp-meta"><b style="color:#0F172A">${brl(c.raised)}</b> de ${brl(c.goal)} · ${c.percent}% · ${c.donorsCount} ${c.donorsCount === 1 ? 'doação' : 'doações'}</div>
        <div class="camp-meta">${c.endsAt ? `Prazo: ${dateBR(c.endsAt)}${c.status === 'ACTIVE' && c.daysLeft != null ? ` (${c.daysLeft} ${c.daysLeft === 1 ? 'dia' : 'dias'})` : ''}` : 'Sem prazo'}</div>
        <div class="camp-actions">
          <button class="btn btn-secondary" onclick="openCampaignDetail('${c.id}')">Doações e atualizações</button>
          <button class="btn btn-secondary" onclick="openCampaignModal('${c.id}')">Editar</button>
          ${c.status === 'DRAFT' ? `<button class="btn btn-primary" onclick="campaignAction('${c.id}','publish')">Publicar</button>` : ''}
          ${c.status === 'ACTIVE' ? `<button class="btn btn-secondary" onclick="announceCampaign('${c.id}')">Avisar no app</button>
            <button class="btn btn-secondary" onclick="campaignAction('${c.id}','close')">Encerrar</button>` : ''}
          ${c.status === 'ENDED' ? `<button class="btn btn-secondary" onclick="reopenCampaign('${c.id}')">Reabrir</button>` : ''}
          ${c.donorsCount === 0 ? `<button class="btn btn-secondary" style="color:#B91C1C" onclick="deleteCampaign('${c.id}')">Apagar</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  async function fillAnimals(selected) {
    const sel = document.getElementById('campaignAnimal');
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/animals`, { headers: adminHeaders() });
      const data = await r.json().catch(() => ({}));
      const list = (data.animals || []).filter((a) => a.isActive !== false || a.id === selected);
      sel.innerHTML = '<option value="">— Nenhum (campanha geral) —</option>' +
        list.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}${a.isAdopted ? ' (adotado)' : ''}</option>`).join('');
    } catch {
      /* mantém só "Nenhum" */
    }
    sel.value = selected || '';
  }

  window.openCampaignModal = async function (id) {
    injectStyles();
    const c = id ? cache.find((x) => x.id === id) : null;
    document.getElementById('campaignModalTitle').textContent = c ? 'Editar vaquinha' : 'Nova vaquinha';
    document.getElementById('campaignId').value = c?.id || '';
    document.getElementById('campaignTitle').value = c?.title || '';
    document.getElementById('campaignSummary').value = c?.summary || '';
    document.getElementById('campaignStory').value = c?.story || '';
    document.getElementById('campaignGoal').value = toInputMoney(c?.goal);
    document.getElementById('campaignOffline').value = toInputMoney(c?.offlineAmount);
    document.getElementById('campaignEndsAt').value = c?.endsAt ? new Date(c.endsAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '';
    document.getElementById('campaignAllowOver').checked = c ? !!c.allowOverGoal : true;
    document.getElementById('campaignShowDonors').checked = c ? !!c.showDonors : true;
    document.getElementById('campaignCover').value = '';
    document.getElementById('campaignCoverPreview').innerHTML = c?.hasCover
      ? `<img src="${esc(c.coverUrl)}" style="max-height:120px;border-radius:8px"> <button class="btn btn-secondary" onclick="removeCampaignCover('${c.id}')">Tirar capa</button>`
      : '';
    document.getElementById('campaignMsg').textContent = '';
    document.getElementById('campaignPublishBtn').textContent = c && c.status !== 'DRAFT' ? 'Salvar' : 'Salvar e publicar';
    document.getElementById('campaignSaveDraftBtn').style.display = c && c.status !== 'DRAFT' ? 'none' : '';
    if (c && !c.story) {
      // a lista não traz a história: busca o detalhe
      api('GET', `/${c.id}`).then((d) => (document.getElementById('campaignStory').value = d.campaign?.story || '')).catch(() => {});
    }
    openModal('campaignModal');
    fillAnimals(c?.animal?.id || '');
  };

  /** Reduz a foto no navegador (até 1280 px, JPEG) antes de enviar. */
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Não deu para ler a imagem'));
      img.src = URL.createObjectURL(file);
    });
  }

  window.saveCampaign = async function (publish) {
    const msg = document.getElementById('campaignMsg');
    msg.textContent = '';
    const id = document.getElementById('campaignId').value;
    const body = {
      title: document.getElementById('campaignTitle').value.trim(),
      summary: document.getElementById('campaignSummary').value.trim(),
      story: document.getElementById('campaignStory').value.trim(),
      animalId: document.getElementById('campaignAnimal').value || null,
      goalAmount: document.getElementById('campaignGoal').value.trim(),
      offlineAmount: document.getElementById('campaignOffline').value.trim() || 0,
      endsAt: document.getElementById('campaignEndsAt').value || null,
      allowOverGoal: document.getElementById('campaignAllowOver').checked,
      showDonors: document.getElementById('campaignShowDonors').checked,
    };
    if (!body.title) return (msg.textContent = 'Dê um título para a vaquinha.');
    if (!body.goalAmount) return (msg.textContent = 'Informe a meta em reais.');
    try {
      let saved;
      if (id) saved = await api('PUT', `/${id}`, body);
      else saved = await api('POST', '', { ...body, publish: false });
      const cid = saved.campaign.id;
      const file = document.getElementById('campaignCover').files[0];
      if (file) await api('PUT', `/${cid}/cover`, { imageBase64: await resizeImage(file) });
      if (publish && saved.campaign.savedStatus === 'DRAFT') await api('POST', `/${cid}/publish`, {});
      closeModal('campaignModal');
      await loadCampaignsAdmin();
      if (publish && saved.campaign.savedStatus === 'DRAFT' && confirm('Vaquinha publicada! Quer avisar todos os usuários do app agora?')) {
        announceCampaign(cid);
      }
    } catch (e) {
      msg.textContent = e.message;
    }
  };

  window.removeCampaignCover = async function (id) {
    try {
      await api('DELETE', `/${id}/cover`);
      document.getElementById('campaignCoverPreview').innerHTML = '';
      loadCampaignsAdmin();
    } catch (e) {
      alert(e.message);
    }
  };

  window.campaignAction = async function (id, action) {
    if (action === 'close' && !confirm('Encerrar esta vaquinha? Ela para de receber doações (dá para reabrir depois).')) return;
    try {
      await api('POST', `/${id}/${action}`, {});
      loadCampaignsAdmin();
    } catch (e) {
      alert(e.message);
    }
  };

  window.reopenCampaign = async function (id) {
    const c = cache.find((x) => x.id === id);
    let endsAt = null;
    if (c?.closedReason === 'DEADLINE') {
      endsAt = prompt('O prazo já passou. Novo prazo (dd/mm/aaaa):');
      if (!endsAt) return;
      const m = endsAt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return alert('Use o formato dd/mm/aaaa');
      endsAt = `${m[3]}-${m[2]}-${m[1]}`;
    }
    try {
      await api('POST', `/${id}/reopen`, { endsAt });
      loadCampaignsAdmin();
    } catch (e) {
      alert(e.message);
    }
  };

  window.deleteCampaign = async function (id) {
    if (!confirm('Apagar esta vaquinha? Não dá para desfazer.')) return;
    try {
      await api('DELETE', `/${id}`);
      loadCampaignsAdmin();
    } catch (e) {
      alert(e.message);
    }
  };

  /** Notificação para todos os usuários; tocar abre a vaquinha no app. */
  window.announceCampaign = async function (id) {
    const c = cache.find((x) => x.id === id);
    if (!c) return;
    const title = prompt('Título do aviso:', `Ajude: ${c.title}`.slice(0, 60));
    if (!title) return;
    const message = prompt('Mensagem:', c.summary || `Faltam ${brl(c.remaining)} para a meta. Toque para ajudar.`);
    if (!message) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/notifications/admin/send-to-all`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ title, body: message, data: { screen: 'CampaignDetail', campaignId: id } }),
      });
      const data = await r.json().catch(() => ({}));
      alert(r.ok ? `Aviso enviado (${data.successCount ?? 'todos os'} usuários).` : data.error || data.message || 'Erro ao enviar');
    } catch (e) {
      alert(e.message);
    }
  };

  window.openCampaignDetail = async function (id) {
    injectStyles();
    const body = document.getElementById('campaignDetailBody');
    body.innerHTML = 'Carregando…';
    openModal('campaignDetailModal');
    try {
      const d = await api('GET', `/${id}`);
      const c = d.campaign;
      document.getElementById('campaignDetailTitle').textContent = c.title;
      const st = { APPROVED: 'Pago', PENDING: 'Aguardando', REJECTED: 'Recusado', CANCELLED: 'Cancelado', EXPIRED: 'Expirado' };
      const paid = d.donations.filter((x) => x.status === 'APPROVED');
      body.innerHTML = `
        <div class="camp-bar" style="margin-bottom:6px"><span style="width:${c.percent}%"></span></div>
        <p class="camp-meta"><b style="color:#0F172A">${brl(c.raised)}</b> de ${brl(c.goal)} — pelo app ${brl(c.raisedOnline)}, por fora ${brl(c.offlineAmount)} · ${paid.length} doações pagas</p>
        <h4 style="margin:18px 0 6px">Atualizações para os doadores</h4>
        <p class="camp-meta">Conte como está o animal e onde o dinheiro foi usado. Aparece na página da vaquinha no app.</p>
        <textarea id="campaignUpdateText" class="form-input" rows="3" maxlength="2000" placeholder="Ex.: O Thor operou hoje e passa bem! Obrigado a todos."></textarea>
        <button class="btn btn-primary" style="margin-top:6px" onclick="postCampaignUpdate('${c.id}')">Publicar atualização</button>
        <div style="margin-top:10px">${d.updates.map((u) => `<div style="border-left:3px solid #7C3AED;padding:4px 10px;margin:8px 0">
            <div class="camp-meta">${dateBR(u.createdAt)} <a href="#" style="color:#B91C1C;margin-left:8px" onclick="deleteCampaignUpdate('${c.id}','${u.id}');return false;">apagar</a></div>
            <div style="white-space:pre-wrap">${esc(u.text)}</div></div>`).join('') || '<p class="camp-meta">Nenhuma atualização ainda.</p>'}</div>
        <h4 style="margin:18px 0 6px">Doações</h4>
        ${d.donations.length ? `<table class="camp-table"><thead><tr><th>Data</th><th>Doador</th><th>E-mail</th><th>Forma</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
          ${d.donations.map((x) => `<tr><td>${dateBR(x.createdAt)}</td><td>${esc(x.donorName || '—')}${x.isAnonymous ? ' <small>(anônimo no app)</small>' : ''}</td><td>${esc(x.donorEmail || '')}</td><td>${esc(x.method || '')}</td><td>${brl(x.amount)}</td><td>${st[x.status] || esc(x.status)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="camp-meta">Nenhuma doação ainda.</p>'}`;
    } catch (e) {
      body.innerHTML = `<p style="color:#B91C1C">${esc(e.message)}</p>`;
    }
  };

  window.postCampaignUpdate = async function (id) {
    const text = document.getElementById('campaignUpdateText').value.trim();
    if (!text) return;
    try {
      await api('POST', `/${id}/updates`, { text });
      openCampaignDetail(id);
    } catch (e) {
      alert(e.message);
    }
  };

  window.deleteCampaignUpdate = async function (id, uid) {
    if (!confirm('Apagar esta atualização?')) return;
    try {
      await api('DELETE', `/${id}/updates/${uid}`);
      openCampaignDetail(id);
    } catch (e) {
      alert(e.message);
    }
  };
})();
