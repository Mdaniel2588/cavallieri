/* ─── Produtividade — Clinica Cavallieri v3 ──────────────────────────── */

const API_BASE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade";
const API_PROD = API_BASE + "/resumo";
const API_WHATSAPP = "https://maicon.mdppconnect.com.br:8443/api/octa/produtividade";

const OCTA_MAP = {
    "Claudio Maximiano":"CMGJ","Julia Chaves":"JSC","Maria D Sousa":"MDS",
    "Rosangela Alcantara Lima":"RAL","Rosangela Tavares":"RDT","Vanessa Waeger":"VS",
    "Jane Sousa":"JSL","Gessica Oliveira":"GOS","Rose Martins":"RGM",
    "Claudia Barbosa":"DUDU","Diana Anchieta":"DC","Nelia de Abreu Silva":"RAS",
    "Cristialine Silva":"CJS","Renata Aquino":"RAC","Dayane":"DSR"
};

// Siglas que NÃO são atendentes (médicos, admin) — excluir do ranking
const EXCLUIR_RANKING = ["FPK","PRQ","MDM","MD"];

const ST_OC = "cavalieri_ocultos";
let prodData = null;
let prodPeriodo = "hoje";
let prodTimer = null;
let chartMarc = null;
let chartRecep = null;
let chartWpp = null;
let octaClassificado = null;
let _sortCol = 'atendimentos';
let _sortDir = -1;
const el = {};

const OCTA_MAP_REV = {};
for (const [nome, sigla] of Object.entries(OCTA_MAP)) OCTA_MAP_REV[sigla] = nome;

// Sort
function sortBy(col) {
    if (_sortCol === col) _sortDir *= -1;
    else { _sortCol = col; _sortDir = -1; }
    renderProd();
}
function sortArrow(col) {
    if (_sortCol !== col) return ' <span style="opacity:0.4;font-size:11px;">&#9650;&#9660;</span>';
    return _sortDir < 0 ? ' <span style="color:#4cc9f0;">&#9660;</span>' : ' <span style="color:#4cc9f0;">&#9650;</span>';
}

const fmt = s => { if(!s) return '-'; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m${String(r).padStart(2,'0')}s`:`${r}s`; };
const getOc = () => { try{return JSON.parse(localStorage.getItem(ST_OC))||[];}catch(e){return[];} };
const isOc = s => getOc().indexOf(s)>=0;
function toggleOc(s){const a=getOc();const i=a.indexOf(s);if(i>=0)a.splice(i,1);else a.push(s);localStorage.setItem(ST_OC,JSON.stringify(a));renderProd();}
function buildOcta(o){const r={};for(const a of(o||[])){const s=OCTA_MAP[a.agente];if(s)r[s]={total:a.total||0,inbound:a.inbound||0,outbound:a.outbound||0,tempo_medio:a.tempo_medio||0};}return r;}

// Calendario produtividade
let _pcalMes, _pcalAno, _pcalSelA, _pcalSelB, _pcalExpanded = false, _pcalQuick = "hoje";
const _meses = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function initProdutividade() {
    el.section = document.getElementById("secaoProdutividade");
    el.ano = document.getElementById("anoProd");
    el.mes = document.getElementById("mesProd");
    el.btnHoje = document.getElementById("btnHojeProd");
    el.btnSemana = document.getElementById("btnSemanaProd");
    el.btnMes = document.getElementById("btnMesProd");
    el.btnAno = document.getElementById("btnAnoProd");
    el.tabMarc = document.getElementById("tabMarcacao");
    el.tabRecep = document.getElementById("tabRecepcao");
    el.tabTimeline = document.getElementById("tabTimeline");
    el.panelMarc = document.getElementById("panelMarcacao");
    el.panelRecep = document.getElementById("panelRecepcao");
    el.panelTimeline = document.getElementById("panelTimeline");
    el.timelineData = document.getElementById("timelineData");
    el.timelineConteudo = document.getElementById("timelineConteudo");
    el.btnTimelineCarregar = document.getElementById("btnTimelineCarregar");
    el.cardTel = document.getElementById("cardTelefone");
    el.cardWpp = document.getElementById("cardWhatsapp");
    el.cardCon = document.getElementById("cardConsolidado");
    el.chartRank = document.getElementById("chartRankingProd");
    el.chartWpp = document.getElementById("chartWhatsProd");
    el.status = document.getElementById("statusProd");
    if (!el.section) return;

    const h = new Date();
    for(let a=h.getFullYear();a>=h.getFullYear()-3;a--) el.ano.add(new Option(a,a));
    ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].forEach((m,i)=>el.mes.add(new Option(m,i+1)));
    el.ano.value=h.getFullYear(); el.mes.value=h.getMonth()+1;

    el.tabMarc.addEventListener("click", () => { setTab("marc"); });
    el.tabRecep.addEventListener("click", () => { setTab("recep"); });
    el.tabTimeline.addEventListener("click", () => { setTab("timeline"); });

    el.timelineData.value = new Date().toISOString().slice(0,10);
    el.btnTimelineCarregar.addEventListener("click", carregarTimeline);

    _pcalMes = h.getMonth();
    _pcalAno = h.getFullYear();
    _pcalSelA = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    _pcalSelB = null;
    _renderCalProd();

    setPeriodo("hoje");
}

// ── Helpers de data ──
function _fmtDP(d) { return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0"); }
function _fmtDPFull(d) { return _fmtDP(d)+"/"+d.getFullYear(); }
function _sameDayP(a,b) { return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function _toISO(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

// ── Calendario ──
function _renderCalProd() {
    const box = document.getElementById("calendarPickerProd");
    if (!box) return;
    const nomeMes = _meses[_pcalMes + 1];
    const h = new Date();

    let rangeIni = _pcalSelA, rangeFim = _pcalSelA;
    if (_pcalSelA && _pcalSelB) {
        rangeIni = _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
        rangeFim = _pcalSelB > _pcalSelA ? _pcalSelB : _pcalSelA;
    }
    let textoSel = "";
    if (rangeIni && rangeFim && !_sameDayP(rangeIni, rangeFim)) {
        textoSel = _fmtDP(rangeIni) + " — " + _fmtDPFull(rangeFim);
    } else if (rangeIni) {
        textoSel = _fmtDPFull(rangeIni);
    }

    let html = '<div class="cal-header">';
    html += '<button class="cal-arrow" id="pcalPrev" type="button">&#9664;</button>';
    html += '<span class="cal-month-label" id="pcalLabel">' + nomeMes + " " + _pcalAno + '</span>';
    html += '<button class="cal-arrow" id="pcalNext" type="button">&#9654;</button>';
    if (textoSel && !_pcalExpanded) html += '<span style="margin-left:10px;font-size:11px;color:#96b7ff;font-weight:600;">' + textoSel + '</span>';
    html += '</div>';

    if (!_pcalExpanded) {
        html += '<div class="cal-quick" style="margin-top:4px;">';
        for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MES"},{id:"trimestre",label:"TRIMESTRE"}]) {
            html += '<button class="cal-qbtn' + (_pcalQuick===q.id?" active":"") + '" data-quick="' + q.id + '" type="button">' + q.label + '</button>';
        }
        html += '</div>';
        box.innerHTML = html;
        _bindCalProdHeader(box);
        return;
    }

    // Grid expandido
    html += '<div class="cal-grid">';
    for (const d of ["DOM","SEG","TER","QUA","QUI","SEX","SAB"]) html += '<div class="cal-dow">' + d + '</div>';
    const p1 = new Date(_pcalAno, _pcalMes, 1);
    const uD = new Date(_pcalAno, _pcalMes + 1, 0).getDate();
    const iS = p1.getDay();
    const pU = new Date(_pcalAno, _pcalMes, 0).getDate();
    for (let i = 0; i < iS; i++) html += '<div class="cal-day outside">' + (pU-iS+1+i) + '</div>';
    for (let d = 1; d <= uD; d++) {
        const dt = new Date(_pcalAno, _pcalMes, d);
        let cls = "cal-day";
        if (d===h.getDate()&&_pcalMes===h.getMonth()&&_pcalAno===h.getFullYear()) cls += " today";
        if (rangeIni && rangeFim && !_sameDayP(rangeIni,rangeFim)) {
            if (_sameDayP(dt,rangeIni)||_sameDayP(dt,rangeFim)) cls += " selected";
            else if (dt>rangeIni&&dt<rangeFim) cls += " in-range";
        } else if (rangeIni && _sameDayP(dt,rangeIni)) cls += " selected";
        html += '<div class="' + cls + '" data-dia="' + d + '">' + d + '</div>';
    }
    const cU = iS + uD; for (let i = 1; i <= (7-(cU%7))%7; i++) html += '<div class="cal-day outside">' + i + '</div>';
    html += '</div>';
    html += '<div class="cal-quick">';
    for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MES"},{id:"trimestre",label:"TRIMESTRE"}]) {
        html += '<button class="cal-qbtn' + (_pcalQuick===q.id?" active":"") + '" data-quick="' + q.id + '" type="button">' + q.label + '</button>';
    }
    html += '</div>';
    if (textoSel) html += '<div class="cal-selection">Selecionado: ' + textoSel + '</div>';
    box.innerHTML = html;
    _bindCalProdHeader(box);

    box.querySelectorAll(".cal-day:not(.outside)").forEach(cell => {
        cell.addEventListener("click", () => {
            const d = Number(cell.dataset.dia);
            const dt = new Date(_pcalAno, _pcalMes, d);
            _pcalQuick = "";
            if (!_pcalSelA || (_pcalSelA && _pcalSelB)) { _pcalSelA = dt; _pcalSelB = null; _renderCalProd(); }
            else { _pcalSelB = dt; _pcalExpanded = false; _applyCalProd(); _renderCalProd(); carregarProd(); }
        });
    });
    box.querySelectorAll(".cal-qbtn").forEach(btn => btn.addEventListener("click", () => _handleProdQuick(btn.dataset.quick)));
}

function _bindCalProdHeader(box) {
    const prev = document.getElementById("pcalPrev");
    const next = document.getElementById("pcalNext");
    const label = document.getElementById("pcalLabel");
    if (prev) prev.addEventListener("click", () => {
        _pcalMes--; if (_pcalMes<0){_pcalMes=11;_pcalAno--;}
        if (!_pcalExpanded) { _pcalQuick=""; _pcalSelA=new Date(_pcalAno,_pcalMes,1); _pcalSelB=new Date(_pcalAno,_pcalMes+1,0); _applyCalProd(); carregarProd(); }
        _renderCalProd();
    });
    if (next) next.addEventListener("click", () => {
        _pcalMes++; if (_pcalMes>11){_pcalMes=0;_pcalAno++;}
        if (!_pcalExpanded) { _pcalQuick=""; _pcalSelA=new Date(_pcalAno,_pcalMes,1); _pcalSelB=new Date(_pcalAno,_pcalMes+1,0); _applyCalProd(); carregarProd(); }
        _renderCalProd();
    });
    if (label) label.addEventListener("click", () => { _pcalExpanded = !_pcalExpanded; _renderCalProd(); });
    box.querySelectorAll(".cal-qbtn").forEach(btn => btn.addEventListener("click", () => _handleProdQuick(btn.dataset.quick)));
}

function _handleProdQuick(tipo) {
    const h = new Date();
    _pcalQuick = tipo;
    if (tipo === "hoje") {
        _pcalSelA = new Date(h.getFullYear(),h.getMonth(),h.getDate());
        _pcalSelB = null;
        prodPeriodo = "hoje";
    } else if (tipo === "semana") {
        const dow=h.getDay(); const seg=h.getDate()-(dow===0?6:dow-1);
        _pcalSelA=new Date(h.getFullYear(),h.getMonth(),seg);
        _pcalSelB=new Date(h.getFullYear(),h.getMonth(),h.getDate());
        prodPeriodo = "custom";
    } else if (tipo === "mes") {
        _pcalSelA=new Date(h.getFullYear(),h.getMonth(),1);
        _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0);
        prodPeriodo = "mes";
    } else if (tipo === "trimestre") {
        _pcalSelA=new Date(h.getFullYear(),h.getMonth()-2,1);
        _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0);
        prodPeriodo = "custom";
    }
    _pcalMes = h.getMonth(); _pcalAno = h.getFullYear();
    _pcalExpanded = false;
    _applyCalProd();
    _renderCalProd();
    carregarProd();
}

function _applyCalProd() {
    if (!_pcalSelA) return;
    const ini = _pcalSelB && _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
    const fim = _pcalSelB && _pcalSelB > _pcalSelA ? _pcalSelB : (_pcalSelB || _pcalSelA);
    el.ano.value = String(ini.getFullYear());
    el.mes.value = String(ini.getMonth() + 1);
}

// ── Datas do periodo selecionado ──
function _getDateRange() {
    if (!_pcalSelA) {
        const h = new Date();
        return { ini: _toISO(h), fim: _toISO(h) };
    }
    const ini = _pcalSelB && _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
    const fim = _pcalSelB && _pcalSelB > _pcalSelA ? _pcalSelB : (_pcalSelB || _pcalSelA);
    return { ini: _toISO(ini), fim: _toISO(fim) };
}

let currentTab = "marc";
function setTab(tab) {
    currentTab = tab;
    el.tabMarc.classList.toggle("active", tab==="marc");
    el.tabRecep.classList.toggle("active", tab==="recep");
    el.tabTimeline.classList.toggle("active", tab==="timeline");
    el.panelMarc.style.display = tab==="marc" ? "" : "none";
    el.panelRecep.style.display = tab==="recep" ? "" : "none";
    el.panelTimeline.style.display = tab==="timeline" ? "" : "none";
    if (tab === "timeline" && !el.timelineConteudo.innerHTML) carregarTimeline();
    if (prodData) renderChart();
}

function setPeriodo(p) {
    prodPeriodo = p;
    if(prodTimer){clearInterval(prodTimer);prodTimer=null;}
    carregarProd();
    if (p === "hoje") prodTimer = setInterval(carregarProd, 120000);
}

async function carregarProd() {
    const ano=el.ano.value, mes=el.mes.value;
    const range = _getDateRange();
    const custom = getRamaisCustom();
    const mapaParam = Object.keys(custom).length ? '&mapa=' + encodeURIComponent(JSON.stringify(custom)) : '';

    // Passar datas explicitamente para o backend
    let periodoParam = prodPeriodo;
    let dateParams = '';
    if (prodPeriodo === "custom" || (_pcalSelA && _pcalSelB && !_pcalQuick)) {
        periodoParam = "custom";
        dateParams = `&data_inicio=${range.ini}&data_fim=${range.fim}`;
    }

    const url = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${periodoParam}&com_3cx=1${mapaParam}${dateParams}`;

    showSt("Carregando...", "info");
    try {
        const r1 = await fetch(url);
        const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro||"Erro");
        prodData = j1.data;
        // OctaDesk: buscar da .27 (banco local, 60ms) em paralelo com Kliniki
        // NÃO usar com_octa=1 do clinic_bridge (demora 90+ segundos)
        const octaUrl = `${API_WHATSAPP}?periodo=${periodoParam}&ano=${ano}&mes=${mes}${dateParams}`;
        try {
            const r2 = await fetch(octaUrl);
            const j2 = await r2.json();
            if(j2.ok&&j2.data){
                octaClassificado = j2.data;
                // Montar octadesk[] no formato que o renderProd espera
                prodData.octadesk = (j2.data.agentes||[]).map(a => ({
                    agente: a.agent_name,
                    total: a.atend_real||0,
                    inbound: 0, outbound: 0, tempo_medio: 0
                }));
            }
        } catch(e) { console.warn("API .27:", e); }

        renderProd();
        hideSt();
        if(prodPeriodo==="hoje"){showSt("Realtime — atualiza a cada 2 min","info");setTimeout(hideSt,4000);}
    } catch(err) { showSt("Falha: "+err.message,"error"); }
}

function showSt(m,t){if(!el.status)return;el.status.hidden=false;el.status.className=`status-banner ${t}`;el.status.textContent=m;}
function hideSt(){if(el.status)el.status.hidden=true;}

function renderProd() {
    if (!prodData) return;
    const marc = prodData.marcacao || [];
    const recep = prodData.recepcao || [];
    const octa = prodData.octadesk || [];
    const octaMap = buildOcta(octa);

    renderTitulo();
    renderCards(marc, recep, octa);
    renderMarcacao(marc, octaMap);
    renderRecepcao(recep);
    renderChart();
    renderChartWpp(octa);
}

function renderTitulo() {
    const titulo = document.getElementById("tituloProd");
    if (!titulo || !prodData) return;
    const range = _getDateRange();
    let txt = "PRODUTIVIDADE";

    if (prodPeriodo === "hoje") {
        const h = new Date();
        txt = `PRODUTIVIDADE | HOJE ${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${h.getFullYear()}`;
    } else if (_pcalQuick === "semana") {
        txt = `PRODUTIVIDADE | SEMANA CORRENTE`;
    } else if (_pcalQuick === "trimestre") {
        txt = `PRODUTIVIDADE | TRIMESTRE`;
    } else if (prodPeriodo === "mes") {
        const m = prodData.mes || (new Date().getMonth()+1);
        txt = `PRODUTIVIDADE | ${_meses[m] || ''} ${prodData.ano || new Date().getFullYear()}`;
    } else {
        // Custom range
        const ini = range.ini.split('-').reverse().join('/');
        const fim = range.fim.split('-').reverse().join('/');
        txt = ini === fim ? `PRODUTIVIDADE | ${ini}` : `PRODUTIVIDADE | ${ini} a ${fim}`;
    }
    titulo.textContent = txt;
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    const range = _getDateRange();
    const labelMap = {"hoje":"Hoje","semana":"Semana","mes":_meses[(prodData.mes||1)],"trimestre":"Trimestre","custom":"Periodo"};
    const label = labelMap[_pcalQuick] || labelMap[prodPeriodo] || "Periodo";

    // Telefone
    const tLigAt = prodData.ligacoes_atendidas || tLig;
    el.cardTel.innerHTML = `<div class="prod-card-title">TELEFONE</div>
        <div class="prod-card-big">${tLig || '-'}</div>
        <div class="prod-card-label">${label}</div>
        ${tLig ? `<div class="prod-card-sub">${tLigAt} atendidas</div>` : ''}`;

    // WhatsApp
    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    const tMarcOcta = octaClassificado?.totais?.marcacao || 0;
    const tConfOcta = octaClassificado?.totais?.confirmacao || 0;
    el.cardWpp.innerHTML = `<div class="prod-card-title">WHATSAPP</div>
        <div class="prod-card-big">${tWpp || '-'}</div>
        <div class="prod-card-label">${label}</div>
        ${tWpp ? `<div class="prod-card-sub">${tMarcOcta} marcações | ${tConfOcta} confirmações</div>` : ''}`;

    // Consolidado
    const tMa = marc.filter(u=>!EXCLUIR_RANKING.includes(u.usuario)).reduce((s,u)=>s+(u.marcacoes||0),0);
    const tAd = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    const tAtend = tLig + tWpp;
    const convRate = octaClassificado?.totais?.marcacao && tMa > 0
        ? ((octaClassificado.totais.marcacao / tMa) * 100).toFixed(0)
        : null;
    el.cardCon.innerHTML = `<div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${tAtend || '-'}</div>
        <div class="prod-card-label">${label}</div>
        <div class="prod-card-sub">
            ${tMa} agendamentos | ${tAd} admissões
        </div>`;
}

function renderMarcacao(marc, octaMap) {
    if (!el.panelMarc) return;
    const lista = marc
        .filter(u => !isOc(u.usuario) && !EXCLUIR_RANKING.includes(u.usuario) && ((u.marcacoes||0)+(u.ligacoes||0)>0))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total||0;
            const atendimentos = (u.ligacoes||0)+wpp;
            const total = atendimentos + (u.marcacoes||0);
            return {...u, wpp, atendimentos, total};
        });

    // Enriquecer com dados de eficiencia da .27
    const efMap = {};
    if (octaClassificado && octaClassificado.agentes) {
        for (const a of octaClassificado.agentes) {
            const sigla = OCTA_MAP[a.agent_name];
            if (sigla) efMap[sigla] = a;
        }
    }
    for (const u of lista) {
        const ef = efMap[u.usuario] || {};
        u._mediaInter = ef.media_interacoes || 0;
        u._pctLongos = ef.pct_longos || 0;
        u._taxaEf = ef.taxa_efetiva || 0;
    }

    // Sort
    lista.sort((a,b) => {
        const va = a[_sortCol] ?? a['_'+_sortCol] ?? 0;
        const vb = b[_sortCol] ?? b['_'+_sortCol] ?? 0;
        if (typeof va === 'string') return va.localeCompare(vb) * _sortDir;
        return (va > vb ? 1 : va < vb ? -1 : 0) * _sortDir;
    });

    const th = (label, col, tip) => `<th style="cursor:pointer;user-select:none;white-space:nowrap;" onclick="sortBy('${col}')" title="${tip||''}">${label}${sortArrow(col)}</th>`;

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th>${th('Nome','nome','')}
        ${th('Lig.','ligacoes','Ligações telefone')}
        <th>T.Med</th>
        ${th('WPP','wpp','WhatsApp total')}
        <th>T.Med</th>
        ${th('ATEND','atendimentos','Total atendimentos (Lig+WPP)')}
        ${th('Agend.','marcacoes','Agendamentos criados no Kliniki')}
        ${th('Efic.','_mediaInter','Media interações/chat (menor = mais objetiva)')}
        ${th('Enrol.','_pctLongos','% chats com mais de 10 interações')}
        ${th('Conv.','_taxaEf','Taxa conversão marcações/atendimentos')}
        <th></th>
    </tr></thead><tbody>`;

    let p=1;
    for(const u of lista){
        const octaInfo = octaMap[u.usuario];
        const tMedWpp = octaInfo && octaInfo.tempo_medio ? fmt(octaInfo.tempo_medio) : '-';
        const mediaInter = u._mediaInter || '-';
        const pctLongos = u._pctLongos || 0;
        const taxaEf = u._taxaEf || 0;
        const efColor = mediaInter === '-' ? '#555' : mediaInter <= 5 ? '#2ecc71' : mediaInter <= 8 ? '#f39c12' : '#e94560';
        const enrolColor = pctLongos === 0 ? '#555' : pctLongos <= 20 ? '#2ecc71' : pctLongos <= 30 ? '#f39c12' : '#e94560';
        const convColor = taxaEf === 0 ? '#555' : taxaEf >= 20 ? '#2ecc71' : taxaEf >= 12 ? '#3498db' : taxaEf >= 8 ? '#f39c12' : '#e94560';

        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell">${u.ligacoes||'-'}</td>
            <td class="num-cell" style="color:#888;">${fmt(u.tempo_medio_lig)}</td>
            <td class="num-cell">${u.wpp||'-'}</td>
            <td class="num-cell" style="color:#888;">${tMedWpp}</td>
            <td class="num-cell total-cell">${u.atendimentos||'-'}</td>
            <td class="num-cell" style="color:#f2c94c;font-weight:600;">${u.marcacoes||0}</td>
            <td class="num-cell" style="color:${efColor};font-weight:700;" title="Media interações">${mediaInter !== '-' ? mediaInter.toFixed?.(1) ?? mediaInter : '-'}</td>
            <td class="num-cell" style="color:${enrolColor};font-weight:700;" title="% chats longos">${pctLongos?pctLongos.toFixed?.(0)+'%':'-'}</td>
            <td class="num-cell" style="color:${convColor};font-weight:700;" title="Taxa conversão">${taxaEf?taxaEf.toFixed?.(1)+'%':'-'}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')" title="Ocultar">×</button></td></tr>`;
    }

    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0);
    const tW=lista.reduce((s,u)=>s+u.wpp,0);
    const tAtend=tL+tW;
    const tM=lista.reduce((s,u)=>s+(u.marcacoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;color:#4cc9f0;">TOTAL</td>
        <td class="num-cell">${tL||'-'}</td><td></td>
        <td class="num-cell">${tW||'-'}</td><td></td>
        <td class="num-cell total-cell" style="font-size:14px;">${tAtend}</td>
        <td class="num-cell" style="color:#f2c94c;">${tM}</td>
        <td colspan="4"></td></tr></tbody></table>`;

    // Classificação WhatsApp (da .27) — separado visualmente
    if (octaClassificado && octaClassificado.totais) {
        const t = octaClassificado.totais;
        const total = t.atend_real || 1;
        const cats = [
            {label:'Pediram Marcação',val:t.marcacao,color:'#3a86ff',bg:'rgba(58,134,255,0.12)'},
            {label:'Confirmaram',val:t.confirmacao,color:'#2ecc71',bg:'rgba(46,204,113,0.12)'},
            {label:'Cancelaram',val:t.cancelamento,color:'#e74c3c',bg:'rgba(231,76,60,0.12)'},
            {label:'Pediram Info',val:t.informacao,color:'#f39c12',bg:'rgba(243,156,18,0.12)'},
            {label:'Resultado/Laudo',val:t.resultado,color:'#9b59b6',bg:'rgba(155,89,182,0.12)'},
            {label:'Disparo Massa',val:t.disparo,color:'#666',bg:'rgba(100,100,100,0.12)'},
        ];
        h += `<div style="margin-top:18px;"><div style="font-size:12px;font-weight:700;color:#96b7ff;letter-spacing:.08em;margin-bottom:8px;">WHATSAPP — CLASSIFICAÇÃO (${total} conversas)</div>`;
        h += `<div style="display:flex;gap:10px;flex-wrap:wrap;">`;
        for (const c of cats) {
            if (!c.val) continue;
            const pct = ((c.val||0)/total*100).toFixed(0);
            h += `<div style="background:${c.bg};border-radius:10px;padding:12px 16px;border-left:3px solid ${c.color};min-width:110px;flex:1;">
                <div style="font-size:11px;color:${c.color};font-weight:700;letter-spacing:.05em;">${c.label.toUpperCase()}</div>
                <div style="font-size:26px;font-weight:800;color:#fff;margin:2px 0;">${c.val}</div>
                <div style="font-size:11px;color:#666;">${pct}% das conversas</div>
            </div>`;
        }
        h += `</div></div>`;
    }

    // Legenda
    h += `<div style="margin-top:12px;font-size:10px;color:#555;display:flex;gap:16px;flex-wrap:wrap;padding:4px 0;">
        <span><b style="color:#96b7ff;">Efic.</b> msgs/chat (<span style="color:#2ecc71">&#9679;</span>≤5 <span style="color:#f39c12">&#9679;</span>≤8 <span style="color:#e94560">&#9679;</span>>8)</span>
        <span><b style="color:#96b7ff;">Enrol.</b> % longos (<span style="color:#2ecc71">&#9679;</span>≤20% <span style="color:#f39c12">&#9679;</span>≤30% <span style="color:#e94560">&#9679;</span>>30%)</span>
        <span><b style="color:#96b7ff;">Conv.</b> taxa marc. (<span style="color:#2ecc71">&#9679;</span>≥20% <span style="color:#3498db">&#9679;</span>≥12% <span style="color:#f39c12">&#9679;</span>≥8%)</span>
    </div>`;

    const oc=getOc();
    if(oc.length) h+=`<div style="margin-top:8px;font-size:11px;color:#96b7ff;">Ocultos: ${oc.map(s=>`<button class="btn-restaurar" onclick="toggleOc('${s}')">${s}</button>`).join(' ')}</div>`;
    el.panelMarc.innerHTML = h;
}

function renderRecepcao(recep) {
    if (!el.panelRecep) return;
    const lista = recep.filter(u => !isOc(u.usuario) && (u.admissoes||0)>0)
        .sort((a,b)=>(b.admissoes||0)-(a.admissoes||0));

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th><th>Admissões</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell total-cell">${u.admissoes||0}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')" title="Ocultar">×</button></td></tr>`;
    }
    const tA=lista.reduce((s,u)=>s+(u.admissoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;color:#4cc9f0;">TOTAL</td>
        <td class="num-cell total-cell" style="font-size:14px;">${tA}</td><td></td></tr></tbody></table>`;
    el.panelRecep.innerHTML = h;
}

// ── Charts ──

function renderChart() {
    const titulo = document.getElementById("tituloChartRank");
    try {
        if (currentTab === "marc") {
            if (titulo) titulo.textContent = "Ranking Marcação";
            renderChartMarc();
        } else {
            if (titulo) titulo.textContent = "Ranking Recepção";
            renderChartRecep();
        }
    } catch(e) { console.warn("Chart error:", e); }
}

function renderChartMarc() {
    const octaMap = buildOcta(prodData.octadesk || []);
    const marc = (prodData.marcacao||[])
        .filter(u=>!isOc(u.usuario) && !EXCLUIR_RANKING.includes(u.usuario))
        .map(u=>{const w=(octaMap[u.usuario]||{}).total||0;return{...u,wpp:w,total:(u.marcacoes||0)+(u.ligacoes||0)+w};})
        .filter(u=>u.total>0).sort((a,b)=>b.total-a.total).slice(0,12);

    if(chartMarc)chartMarc.destroy();
    if(chartRecep){chartRecep.destroy();chartRecep=null;}
    if(!marc.length) return;

    chartMarc = new Chart(el.chartRank, {
        type:"bar",
        data:{labels:marc.map(u=>u.usuario),datasets:[
            {label:"Marcações",data:marc.map(u=>u.marcacoes||0),backgroundColor:"#3a86ff"},
            {label:"Ligações",data:marc.map(u=>u.ligacoes||0),backgroundColor:"#f2c94c"},
            {label:"WhatsApp",data:marc.map(u=>u.wpp),backgroundColor:"#25d366"}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10,font:{size:11}}},datalabels:{display:false}},
            scales:{x:{stacked:true,ticks:{color:"#fff",font:{size:11}},grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}}}
        }
    });
}

function renderChartRecep() {
    const recep = (prodData.recepcao||[]).filter(u=>!isOc(u.usuario)&&(u.admissoes||0)>0)
        .sort((a,b)=>(b.admissoes||0)-(a.admissoes||0)).slice(0,12);

    if(chartRecep)chartRecep.destroy();
    if(chartMarc){chartMarc.destroy();chartMarc=null;}
    if(!recep.length) return;

    chartRecep = new Chart(el.chartRank, {
        type:"bar",
        data:{labels:recep.map(u=>u.usuario),datasets:[
            {label:"Admissões",data:recep.map(u=>u.admissoes||0),backgroundColor:"#4cc9f0"}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",anchor:"end",align:"top",font:{size:10,weight:"bold"}}},
            scales:{x:{ticks:{color:"#fff"},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}}}
        }
    });
}

function renderChartWpp(octa) {
    const sorted = (octa||[]).filter(a=>a.agente!=="SEM AGENTE"&&a.agente!=="CLINICA CAVALLIERI"&&a.agente!=="Enfermagem Cavallieri")
        .sort((a,b)=>b.total-a.total);
    if(chartWpp)chartWpp.destroy();
    if(!sorted.length)return;
    chartWpp = new Chart(el.chartWpp, {
        type:"bar",
        data:{labels:sorted.map(a=>{const s=OCTA_MAP[a.agente];return s||a.agente;}),
            datasets:[{label:"Recebidos",data:sorted.map(a=>a.inbound||0),backgroundColor:"#25d366"},
                {label:"Enviados",data:sorted.map(a=>a.outbound||0),backgroundColor:"#128c7e"}]},
        options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",font:{size:9,weight:"bold"}}},
            scales:{x:{stacked:true,ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}},
                y:{stacked:true,ticks:{color:"#fff",font:{size:10}},grid:{display:false}}}}
    });
}

// ── Timeline ──

const API_TIMELINE = API_BASE + "/timeline";
const ST_RAMAIS = "cavalieri_ramais_custom";

const MAPA_PADRAO = {
    "192.168.0.1":  {host:"205MARC01",  ramal:null,   setor:"marcacao"},
    "192.168.0.2":  {host:"205MARC02",  ramal:"2056", setor:"marcacao"},
    "192.168.0.3":  {host:"205MARC03",  ramal:"2057", setor:"marcacao"},
    "192.168.0.4":  {host:"205MARC04",  ramal:"2054", setor:"marcacao"},
    "192.168.0.5":  {host:"205MARC05",  ramal:"2055", setor:"marcacao"},
    "192.168.0.6":  {host:"205MARC06",  ramal:"2058", setor:"marcacao"},
    "192.168.0.7":  {host:"DAYANE",     ramal:"2053", setor:"adm"},
    "192.168.0.8":  {host:"RENATA",     ramal:"2050", setor:"adm"},
    "192.168.0.26": {host:"IMAG",       ramal:"2051", setor:"ti"},
    "192.168.0.30": {host:"306RECEP01", ramal:"3061", setor:"recepcao"},
    "192.168.0.31": {host:"306RECEP02", ramal:"3061", setor:"recepcao"},
    "192.168.0.32": {host:"307RECEP01", ramal:"3071", setor:"recepcao"},
    "192.168.0.33": {host:"307RECEP02", ramal:"3072", setor:"recepcao"},
    "192.168.0.34": {host:"313RECEP01", ramal:"3131", setor:"recepcao"},
    "192.168.0.35": {host:"602RECEP02", ramal:"6021", setor:"recepcao"},
    "192.168.0.36": {host:"602RECEP01", ramal:"6021", setor:"recepcao"},
    "192.168.0.37": {host:"602RECEP03", ramal:"6022", setor:"recepcao"},
    "192.168.0.38": {host:"606RECEP01", ramal:"6061", setor:"recepcao"},
    "192.168.0.39": {host:"606RECEP02", ramal:"6062", setor:"recepcao"},
    "192.168.0.40": {host:"606RECEP03", ramal:"6062", setor:"recepcao"},
    "192.168.0.41": {host:"BIOPSIA",    ramal:null,   setor:"outro"},
};

function getRamaisCustom() {
    try { const r = localStorage.getItem(ST_RAMAIS); if (r) return JSON.parse(r); } catch(e) {}
    return {};
}

function getMapaRamais() {
    const custom = getRamaisCustom();
    const mapa = {};
    for (const ip in MAPA_PADRAO) {
        mapa[ip] = { ...MAPA_PADRAO[ip] };
        if (custom[ip]) mapa[ip].ramal = custom[ip];
    }
    return mapa;
}

async function carregarTimeline() {
    const data = el.timelineData.value;
    if (!data) return;
    el.timelineConteudo.innerHTML = '<div style="color:#96b7ff;padding:20px;text-align:center;"><div style="font-size:24px;margin-bottom:8px;">&#9203;</div>Carregando timeline...</div>';

    try {
        const res = await fetch(`${API_TIMELINE}?data=${data}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.erro || "Erro");
        renderTimeline(json.timeline, json.nomes, json.mapa_estacoes, data);
    } catch (err) {
        el.timelineConteudo.innerHTML = `<div style="color:#ffb3c1;padding:20px;text-align:center;">Falha: ${err.message}<br><button onclick="carregarTimeline()" style="margin-top:8px;">Tentar novamente</button></div>`;
    }
}

function renderTimeline(timeline, nomes, mapaBackend, data) {
    const custom = getRamaisCustom();
    const mapa = {};
    for (const ip in mapaBackend) {
        mapa[ip] = { ...mapaBackend[ip] };
        if (custom[ip]) mapa[ip].ramal = custom[ip];
    }
    for (const usr in timeline) {
        for (const s of timeline[usr]) {
            if (custom[s.ip]) s.ramal = custom[s.ip];
        }
    }

    const btnReset = document.getElementById("btnResetRamais");
    if (btnReset) {
        btnReset.onclick = () => {
            if (!confirm("Resetar todos os ramais para o padrão?")) return;
            localStorage.removeItem(ST_RAMAIS);
            carregarTimeline();
            carregarProd();
            showSt("Ramais resetados.", "info"); setTimeout(hideSt, 2000);
        };
    }

    const usuarios = Object.keys(timeline).sort((a, b) => {
        const ha = timeline[a][0] ? timeline[a][0].hora : 'z';
        const hb = timeline[b][0] ? timeline[b][0].hora : 'z';
        return ha.localeCompare(hb);
    });

    const atendentes = usuarios.filter(usr => {
        return timeline[usr].some(s => s.setor === 'marcacao' || s.setor === 'recepcao');
    });

    const dataBr = data.split('-').reverse().join('/');

    let h = `<div style="color:#96b7ff;font-size:12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">&#128197;</span> ${dataBr} — ${atendentes.length} atendentes com atividade
    </div>`;

    for (const usr of atendentes) {
        const sessoes = timeline[usr];
        const nome = nomes[usr] || '';
        const primeiraHora = sessoes[0] ? sessoes[0].hora.substring(11, 16) : '';
        const ultimaHora = sessoes[sessoes.length - 1] ? sessoes[sessoes.length - 1].hora.substring(11, 16) : '';

        h += `<div class="timeline-user">`;
        h += `<div class="timeline-header">
            <span class="timeline-sigla">${usr}</span>
            <span class="timeline-nome">${nome}</span>
            <span style="color:#96b7ff;font-size:11px;">${primeiraHora} — ${ultimaHora} (${sessoes.length} sessões)</span>
        </div>`;
        h += `<div class="timeline-sessoes">`;

        for (let i = 0; i < sessoes.length; i++) {
            const s = sessoes[i];
            const hora = s.hora.substring(11, 16);
            const horaFim = sessoes[i + 1] ? sessoes[i + 1].hora.substring(11, 16) : '...';
            const setor = s.setor || 'outro';
            const tagClass = 'tag-' + setor;

            h += `<div class="timeline-sessao">
                <span class="timeline-hora">${hora}</span>
                <span style="color:#555;font-size:11px;">ate ${horaFim}</span>
                <span class="timeline-host">${s.hostname}</span>
                <input type="text" class="ramal-inline" data-ip="${s.ip}" value="${s.ramal || ''}"
                    placeholder="ramal" style="width:55px;padding:2px 4px;background:#0f1738;color:#4cc9f0;border:1px solid #2f4f9c;border-radius:4px;text-align:center;font-size:12px;" />
                <span class="timeline-setor-tag ${tagClass}">${setor.toUpperCase()}</span>
            </div>`;
        }

        h += `</div></div>`;
    }

    const outros = usuarios.filter(usr => !atendentes.includes(usr));
    if (outros.length) {
        h += `<details style="margin-top:12px;"><summary style="color:#96b7ff;font-size:12px;cursor:pointer;">Outros usuarios (${outros.length})</summary>`;
        for (const usr of outros) {
            const sessoes = timeline[usr];
            const nome = nomes[usr] || '';
            h += `<div style="padding:4px 0;font-size:12px;color:#dce7ff;">
                <b>${usr}</b> ${nome.substring(0, 25)} — `;
            h += sessoes.map(s => `${s.hora.substring(11, 16)} ${s.hostname}`).join(' → ');
            h += `</div>`;
        }
        h += `</details>`;
    }

    el.timelineConteudo.innerHTML = h;

    document.querySelectorAll(".ramal-inline").forEach(input => {
        input.addEventListener("change", () => {
            const ip = input.dataset.ip;
            const val = input.value.trim();
            const custom = getRamaisCustom();
            const padrao = (MAPA_PADRAO[ip] || {}).ramal || '';
            if (val && val !== padrao) {
                custom[ip] = val;
                input.style.borderColor = '#f2c94c';
            } else {
                delete custom[ip];
                input.style.borderColor = '#2f4f9c';
            }
            localStorage.setItem(ST_RAMAIS, JSON.stringify(custom));
            enviarMapaERecarregar();
        });
    });
}

let _recarregarTimer = null;
function enviarMapaERecarregar() {
    if (_recarregarTimer) clearTimeout(_recarregarTimer);
    _recarregarTimer = setTimeout(() => {
        showSt("Ramal atualizado, recalculando...", "info");
        carregarProd();
        setTimeout(hideSt, 2000);
    }, 1000);
}
