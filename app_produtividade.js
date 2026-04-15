/* ─── Produtividade — Clinica Cavallieri v4 ──────────────────────────── */

const API_BASE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade";
const API_PROD = API_BASE + "/resumo";
const API_WHATSAPP = API_BASE + "/whatsapp";

const OCTA_MAP = {
    "Claudio Maximiano":"CMGJ","Julia Chaves":"JSC","Maria D Sousa":"MDS",
    "Rosangela Alcantara Lima":"RAL","Rosangela Tavares":"RDT","Vanessa Waeger":"VS",
    "Jane Sousa":"JSL","Gessica Oliveira":"GOS","Rose Martins":"RGM",
    "Claudia Barbosa":"DUDU","Diana Anchieta":"DC","Nelia de Abreu Silva":"RAS",
    "Cristialine Silva":"CJS","Renata Aquino":"RAC","Dayane":"DSR"
};

// Excluir do ranking (sistema/bloqueio)
const EXCLUIR_RANKING = ["PRQ","MDM","MD"];
// Agendado direto (médica/secretária) — mostrar separado
const AGENDADO_DIRETO = ["FPK"];

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

    el.tabMarc.addEventListener("click", () => setTab("marc"));
    el.tabRecep.addEventListener("click", () => setTab("recep"));
    el.tabTimeline.addEventListener("click", () => setTab("timeline"));
    el.timelineData.value = new Date().toISOString().slice(0,10);
    el.btnTimelineCarregar.addEventListener("click", carregarTimeline);

    _pcalMes = h.getMonth(); _pcalAno = h.getFullYear();
    _pcalSelA = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    _pcalSelB = null;
    _renderCalProd();
    setPeriodo("hoje");
}

function _fmtDP(d) { return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0"); }
function _fmtDPFull(d) { return _fmtDP(d)+"/"+d.getFullYear(); }
function _sameDayP(a,b) { return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function _toISO(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

function _renderCalProd() {
    const box = document.getElementById("calendarPickerProd");
    if (!box) return;
    const nomeMes = _meses[_pcalMes + 1]; const h = new Date();
    let rangeIni = _pcalSelA, rangeFim = _pcalSelA;
    if (_pcalSelA && _pcalSelB) {
        rangeIni = _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
        rangeFim = _pcalSelB > _pcalSelA ? _pcalSelB : _pcalSelA;
    }
    let textoSel = "";
    if (rangeIni && rangeFim && !_sameDayP(rangeIni, rangeFim)) textoSel = _fmtDP(rangeIni) + " — " + _fmtDPFull(rangeFim);
    else if (rangeIni) textoSel = _fmtDPFull(rangeIni);

    let html = '<div class="cal-header">';
    html += '<button class="cal-arrow" id="pcalPrev" type="button">&#9664;</button>';
    html += '<span class="cal-month-label" id="pcalLabel">' + nomeMes + " " + _pcalAno + '</span>';
    html += '<button class="cal-arrow" id="pcalNext" type="button">&#9654;</button>';
    if (textoSel && !_pcalExpanded) html += '<span style="margin-left:10px;font-size:11px;color:#96b7ff;font-weight:600;">' + textoSel + '</span>';
    html += '</div>';

    if (!_pcalExpanded) {
        html += '<div class="cal-quick" style="margin-top:4px;">';
        for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MES"},{id:"trimestre",label:"TRIMESTRE"}])
            html += '<button class="cal-qbtn' + (_pcalQuick===q.id?" active":"") + '" data-quick="' + q.id + '" type="button">' + q.label + '</button>';
        html += '</div>';
        box.innerHTML = html; _bindCalProdHeader(box); return;
    }

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
    for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MES"},{id:"trimestre",label:"TRIMESTRE"}])
        html += '<button class="cal-qbtn' + (_pcalQuick===q.id?" active":"") + '" data-quick="' + q.id + '" type="button">' + q.label + '</button>';
    html += '</div>';
    if (textoSel) html += '<div class="cal-selection">Selecionado: ' + textoSel + '</div>';
    box.innerHTML = html; _bindCalProdHeader(box);

    box.querySelectorAll(".cal-day:not(.outside)").forEach(cell => {
        cell.addEventListener("click", () => {
            const d = Number(cell.dataset.dia), dt = new Date(_pcalAno, _pcalMes, d);
            _pcalQuick = "";
            if (!_pcalSelA || (_pcalSelA && _pcalSelB)) { _pcalSelA = dt; _pcalSelB = null; _renderCalProd(); }
            else { _pcalSelB = dt; _pcalExpanded = false; _applyCalProd(); _renderCalProd(); carregarProd(); }
        });
    });
    box.querySelectorAll(".cal-qbtn").forEach(btn => btn.addEventListener("click", () => _handleProdQuick(btn.dataset.quick)));
}

function _bindCalProdHeader(box) {
    const prev = document.getElementById("pcalPrev"), next = document.getElementById("pcalNext"), label = document.getElementById("pcalLabel");
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
    const h = new Date(); _pcalQuick = tipo;
    if (tipo === "hoje") { _pcalSelA = new Date(h.getFullYear(),h.getMonth(),h.getDate()); _pcalSelB = null; prodPeriodo = "hoje"; }
    else if (tipo === "semana") { const dow=h.getDay(); const seg=h.getDate()-(dow===0?6:dow-1); _pcalSelA=new Date(h.getFullYear(),h.getMonth(),seg); _pcalSelB=new Date(h.getFullYear(),h.getMonth(),h.getDate()); prodPeriodo = "semana"; }
    else if (tipo === "mes") { _pcalSelA=new Date(h.getFullYear(),h.getMonth(),1); _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0); prodPeriodo = "mes"; }
    else if (tipo === "trimestre") { _pcalSelA=new Date(h.getFullYear(),h.getMonth()-2,1); _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0); prodPeriodo = "trimestre"; }
    _pcalMes = h.getMonth(); _pcalAno = h.getFullYear(); _pcalExpanded = false;
    _applyCalProd(); _renderCalProd(); carregarProd();
}

function _applyCalProd() {
    if (!_pcalSelA) return;
    const ini = _pcalSelB && _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
    el.ano.value = String(ini.getFullYear()); el.mes.value = String(ini.getMonth() + 1);
}

function _getDateRange() {
    if (!_pcalSelA) { const h = new Date(); return { ini: _toISO(h), fim: _toISO(h) }; }
    const ini = _pcalSelB && _pcalSelB < _pcalSelA ? _pcalSelB : _pcalSelA;
    const fim = _pcalSelB && _pcalSelB > _pcalSelA ? _pcalSelB : (_pcalSelB || _pcalSelA);
    return { ini: _toISO(ini), fim: _toISO(fim) };
}

let currentTab = "marc";
function setTab(tab) {
    currentTab = tab;
    el.tabMarc.classList.toggle("active", tab==="marc"); el.tabRecep.classList.toggle("active", tab==="recep"); el.tabTimeline.classList.toggle("active", tab==="timeline");
    el.panelMarc.style.display = tab==="marc" ? "" : "none"; el.panelRecep.style.display = tab==="recep" ? "" : "none"; el.panelTimeline.style.display = tab==="timeline" ? "" : "none";
    if (tab === "timeline" && !el.timelineConteudo.innerHTML) carregarTimeline();
    if (prodData) renderChart();
}

function setPeriodo(p) { prodPeriodo = p; if(prodTimer){clearInterval(prodTimer);prodTimer=null;} carregarProd(); if (p === "hoje") prodTimer = setInterval(carregarProd, 120000); }

async function carregarProd() {
    const ano=el.ano.value, mes=el.mes.value, range = _getDateRange();
    const custom = getRamaisCustom();
    const mapaParam = Object.keys(custom).length ? '&mapa=' + encodeURIComponent(JSON.stringify(custom)) : '';
    let periodoParam = prodPeriodo, dateParams = '';
    if (prodPeriodo === "trimestre" || prodPeriodo === "custom" || (_pcalSelA && _pcalSelB && !_pcalQuick)) {
        periodoParam = "custom"; dateParams = `&data_inicio=${range.ini}&data_fim=${range.fim}`;
    }

    const url = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${periodoParam}&com_3cx=1${mapaParam}${dateParams}`;
    showSt("Carregando...", "info");
    try {
        const r1 = await fetch(url); const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro||"Erro");
        prodData = j1.data;

        // WhatsApp + canal via proxy clinic_bridge → .27
        const octaUrl = `${API_WHATSAPP}?periodo=${periodoParam}&ano=${ano}&mes=${mes}${dateParams}`;
        try {
            const r2 = await fetch(octaUrl); const j2 = await r2.json();
            if(j2.ok&&j2.data){
                octaClassificado = j2.data;
                prodData.octadesk = (j2.data.agentes||[]).map(a => ({
                    agente: a.agent_name, total: a.atend_real||0, inbound: 0, outbound: 0, tempo_medio: 0
                }));
            }
        } catch(e) { console.warn("API WhatsApp:", e); }

        renderProd(); hideSt();
        if(prodPeriodo==="hoje"){showSt("Realtime — atualiza a cada 2 min","info");setTimeout(hideSt,4000);}
    } catch(err) { showSt("Falha: "+err.message,"error"); }
}

function showSt(m,t){if(!el.status)return;el.status.hidden=false;el.status.className=`status-banner ${t}`;el.status.textContent=m;}
function hideSt(){if(el.status)el.status.hidden=true;}

function renderProd() {
    if (!prodData) return;
    const marc = prodData.marcacao || [], recep = prodData.recepcao || [], octa = prodData.octadesk || [];
    const octaMap = buildOcta(octa);
    renderTitulo(); renderCards(marc, recep, octa); renderMarcacao(marc, octaMap); renderRecepcao(recep); renderChart(); renderChartWpp(octa);
}

function renderTitulo() {
    const titulo = document.getElementById("tituloProd");
    if (!titulo || !prodData) return;
    const range = _getDateRange();
    let txt = "PRODUTIVIDADE";
    if (prodPeriodo === "hoje") { const h = new Date(); txt = `PRODUTIVIDADE | HOJE ${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${h.getFullYear()}`; }
    else if (_pcalQuick === "semana") txt = `PRODUTIVIDADE | SEMANA CORRENTE`;
    else if (_pcalQuick === "trimestre") txt = `PRODUTIVIDADE | TRIMESTRE`;
    else if (prodPeriodo === "mes") { const m = prodData.mes || (new Date().getMonth()+1); txt = `PRODUTIVIDADE | ${_meses[m] || ''} ${prodData.ano || new Date().getFullYear()}`; }
    else { const ini = range.ini.split('-').reverse().join('/'), fim = range.fim.split('-').reverse().join('/'); txt = ini === fim ? `PRODUTIVIDADE | ${ini}` : `PRODUTIVIDADE | ${ini} a ${fim}`; }
    titulo.textContent = txt;
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    const labelMap = {"hoje":"Hoje","semana":"Semana","mes":_meses[(prodData.mes||1)],"trimestre":"Trimestre","custom":"Periodo"};
    const label = labelMap[_pcalQuick] || labelMap[prodPeriodo] || "Periodo";
    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    const tMa = marc.filter(u=>!EXCLUIR_RANKING.includes(u.usuario)).reduce((s,u)=>s+(u.marcacoes||0),0);
    const tAd = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    const pv = prodData.pacientes_primeira_vez || 0;

    // Canal real da .27
    const canal = octaClassificado?.canal || {};
    const cWpp = canal.whatsapp || 0, cTel = canal.telefone || 0, cHib = canal.hibrido || 0, cDir = canal.agendado_direto || 0;
    const cTotal = cWpp + cTel + cHib + cDir;

    // Cards com agendamentos por canal
    const agTel = cTel + cHib;  // telefone + hibrido = teve ligação
    const agWpp = cWpp + cHib;  // whatsapp + hibrido = teve chat
    const pctTel = cTotal > 0 ? (cTel/cTotal*100).toFixed(0) : '-';
    const pctWpp = cTotal > 0 ? (cWpp/cTotal*100).toFixed(0) : '-';

    el.cardTel.innerHTML = `<div class="prod-card-title">TELEFONE</div>
        <div class="prod-card-big">${tLig || '-'}</div>
        <div class="prod-card-label">${label}</div>
        <div class="prod-card-sub">${tLig ? tLig+' ligações 3CX' : ''}${agTel ? ` | <b>${agTel}</b> agendaram (${pctTel}%)` : ''}</div>`;

    el.cardWpp.innerHTML = `<div class="prod-card-title">WHATSAPP</div>
        <div class="prod-card-big">${tWpp || '-'}</div>
        <div class="prod-card-label">${label}</div>
        <div class="prod-card-sub">${tWpp ? tWpp+' conversas' : ''}${agWpp ? ` | <b>${agWpp}</b> agendaram (${pctWpp}%)` : ''}</div>`;

    let canalHtml = '';
    if (cTotal > 0) {
        canalHtml = `<div style="margin-top:6px;font-size:11px;">
            <span style="color:#25d366;">${(cWpp/cTotal*100).toFixed(0)}% WhatsApp</span> |
            <span style="color:#3a86ff;">${(cTel/cTotal*100).toFixed(0)}% Telefone</span>
            ${cHib ? ` | <span style="color:#f2c94c;">${(cHib/cTotal*100).toFixed(0)}% Híbrido</span>` : ''}
            ${cDir ? ` | <span style="color:#9b59b6;">${cDir} Ag.Direto</span>` : ''}
        </div>`;
    }
    const pvHtml = pv ? ` | <span style="color:#00e676;">${pv} novos</span>` : '';
    el.cardCon.innerHTML = `<div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${tMa || '-'}</div>
        <div class="prod-card-label">Agendamentos ${label}</div>
        <div class="prod-card-sub">${tAd} admissões${pvHtml}</div>
        ${canalHtml}`;
}

function renderMarcacao(marc, octaMap) {
    if (!el.panelMarc) return;
    // Separar atendentes normais e agendado direto
    const lista = marc.filter(u => !isOc(u.usuario) && !EXCLUIR_RANKING.includes(u.usuario) && !AGENDADO_DIRETO.includes(u.usuario) && ((u.marcacoes||0)+(u.ligacoes||0)>0))
        .map(u => { const wpp = (octaMap[u.usuario]||{}).total||0; return {...u, wpp, atendimentos: (u.ligacoes||0)+wpp}; });
    const diretos = marc.filter(u => AGENDADO_DIRETO.includes(u.usuario) && (u.marcacoes||0)>0);

    const efMap = {};
    if (octaClassificado?.agentes) { for (const a of octaClassificado.agentes) { const s = OCTA_MAP[a.agent_name]; if (s) efMap[s] = a; } }
    for (const u of lista) { const ef = efMap[u.usuario] || {}; u._mediaInter = ef.media_interacoes || 0; u._pctLongos = ef.pct_longos || 0; u._taxaEf = ef.taxa_efetiva || 0; }

    lista.sort((a,b) => { const va = a[_sortCol] ?? a['_'+_sortCol] ?? 0, vb = b[_sortCol] ?? b['_'+_sortCol] ?? 0;
        if (typeof va === 'string') return va.localeCompare(vb) * _sortDir; return (va > vb ? 1 : va < vb ? -1 : 0) * _sortDir; });

    const th = (label, col, tip) => `<th style="cursor:pointer;user-select:none;white-space:nowrap;" onclick="sortBy('${col}')" title="${tip||''}">${label}${sortArrow(col)}</th>`;

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th>${th('Nome','nome','')}
        ${th('Lig.','ligacoes','Ligações telefone')}<th>T.Med</th>
        ${th('WPP','wpp','WhatsApp total')}<th>T.Med</th>
        ${th('ATEND','atendimentos','Lig+WPP')}
        ${th('Agend.','marcacoes','Agendamentos Kliniki')}
        ${th('Efic.','_mediaInter','Msgs/chat')}<th>Enrol.</th>${th('Conv.','_taxaEf','Taxa conversão')}
        <th></th></tr></thead><tbody>`;

    let p=1;
    for(const u of lista){
        const octaInfo = octaMap[u.usuario], tMedWpp = octaInfo?.tempo_medio ? fmt(octaInfo.tempo_medio) : '-';
        const mi = u._mediaInter || '-', pl = u._pctLongos || 0, te = u._taxaEf || 0;
        const efC = mi === '-' ? '#555' : mi <= 5 ? '#2ecc71' : mi <= 8 ? '#f39c12' : '#e94560';
        const enC = pl === 0 ? '#555' : pl <= 20 ? '#2ecc71' : pl <= 30 ? '#f39c12' : '#e94560';
        const cvC = te === 0 ? '#555' : te >= 20 ? '#2ecc71' : te >= 12 ? '#3498db' : te >= 8 ? '#f39c12' : '#e94560';
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell">${u.ligacoes||'-'}</td><td class="num-cell" style="color:#888;">${fmt(u.tempo_medio_lig)}</td>
            <td class="num-cell">${u.wpp||'-'}</td><td class="num-cell" style="color:#888;">${tMedWpp}</td>
            <td class="num-cell total-cell">${u.atendimentos||'-'}</td>
            <td class="num-cell" style="color:#f2c94c;font-weight:600;">${u.marcacoes||0}</td>
            <td class="num-cell" style="color:${efC};font-weight:700;">${mi !== '-' ? (mi.toFixed?.(1) ?? mi) : '-'}</td>
            <td class="num-cell" style="color:${enC};font-weight:700;">${pl?pl.toFixed?.(0)+'%':'-'}</td>
            <td class="num-cell" style="color:${cvC};font-weight:700;">${te?te.toFixed?.(1)+'%':'-'}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')" title="Ocultar">×</button></td></tr>`;
    }

    // Agendado Direto (FPK)
    if (diretos.length) {
        for (const u of diretos) {
            h+=`<tr style="background:rgba(155,89,182,0.08);"><td></td>
                <td style="font-weight:bold;color:#9b59b6;">${u.usuario}</td><td style="text-align:left;color:#9b59b6;">${u.nome||'-'} <span style="font-size:10px;">(Ag.Direto)</span></td>
                <td colspan="6"></td><td class="num-cell" style="color:#9b59b6;font-weight:600;">${u.marcacoes||0}</td>
                <td colspan="3"></td><td></td></tr>`;
        }
    }

    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0), tW=lista.reduce((s,u)=>s+u.wpp,0), tAtend=tL+tW;
    const tM=lista.reduce((s,u)=>s+(u.marcacoes||0),0) + diretos.reduce((s,u)=>s+(u.marcacoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;color:#4cc9f0;">TOTAL</td>
        <td class="num-cell">${tL||'-'}</td><td></td><td class="num-cell">${tW||'-'}</td><td></td>
        <td class="num-cell total-cell" style="font-size:14px;">${tAtend}</td>
        <td class="num-cell" style="color:#f2c94c;">${tM}</td><td colspan="4"></td></tr></tbody></table>`;

    // Classificação WhatsApp + drill-down
    if (octaClassificado?.totais) {
        const t = octaClassificado.totais, total = t.atend_real || 1;
        const agEf = t.agendou_efetivo || 0;
        const agEfPct = total > 0 ? (agEf/total*100).toFixed(1) : '0';
        const cats = [
            {label:'Agendou Efetivo',val:agEf,color:'#00e676',bg:'rgba(0,230,118,0.12)',key:'agendou'},
            {label:'Pediram Marcação',val:t.marcacao,color:'#3a86ff',bg:'rgba(58,134,255,0.12)',key:'marcacao'},
            {label:'Confirmaram',val:t.confirmacao,color:'#2ecc71',bg:'rgba(46,204,113,0.12)',key:'confirmacao'},
            {label:'Cancelaram',val:t.cancelamento,color:'#e74c3c',bg:'rgba(231,76,60,0.12)',key:'cancelamento'},
            {label:'Reclamação',val:t.reclamacao,color:'#ff5252',bg:'rgba(255,82,82,0.12)',key:'reclamacao'},
            {label:'Pediram Info',val:t.informacao,color:'#f39c12',bg:'rgba(243,156,18,0.12)',key:'informacao'},
            {label:'Resultado/Laudo',val:t.resultado,color:'#9b59b6',bg:'rgba(155,89,182,0.12)',key:'resultado'},
        ];
        h += `<div style="margin-top:18px;"><div style="font-size:12px;font-weight:700;color:#96b7ff;letter-spacing:.08em;margin-bottom:8px;">WHATSAPP — CLASSIFICAÇÃO (${total} conversas)</div>`;
        h += `<div style="display:flex;gap:10px;flex-wrap:wrap;">`;
        for (const c of cats) {
            if (!c.val) continue;
            const pct = ((c.val||0)/total*100).toFixed(0);
            const hasDetail = octaClassificado?.detalhes?.[c.key];
            const cursor = hasDetail ? 'cursor:pointer;' : '';
            const click = hasDetail ? ` onclick="toggleDetalhe('${c.key}')"` : '';
            h += `<div style="background:${c.bg};border-radius:10px;padding:12px 16px;border-left:3px solid ${c.color};min-width:110px;flex:1;${cursor}"${click}>
                <div style="font-size:11px;color:${c.color};font-weight:700;letter-spacing:.05em;">${c.label.toUpperCase()}</div>
                <div style="font-size:26px;font-weight:800;color:#fff;margin:2px 0;">${c.val}</div>
                <div style="font-size:11px;color:#666;">${pct}%${hasDetail ? ' ▼' : ''}</div>
            </div>`;
        }
        h += `</div></div>`;

        // Painéis drill-down
        if (octaClassificado?.detalhes) {
            for (const [key, items] of Object.entries(octaClassificado.detalhes)) {
                const labelMap = {reclamacao:'Reclamações',cancelamento:'Cancelamentos',marcacao:'Marcações WhatsApp',resultado:'Resultado/Laudo'};
                h += `<div id="detalhe_${key}" style="display:none;margin-top:10px;background:#0f1738;border:1px solid #2f4f9c;border-radius:10px;padding:12px;max-height:300px;overflow-y:auto;">`;
                h += `<div style="font-size:12px;font-weight:700;color:#96b7ff;margin-bottom:8px;">${labelMap[key]||key} — ${items.length} registros</div>`;
                h += `<table class="prod-table prod-table-sm"><thead><tr><th>Data</th><th>Paciente</th><th>Telefone</th><th>Agente</th></tr></thead><tbody>`;
                for (const it of items) {
                    const dataFmt = it.data ? it.data.substring(5,16).replace('-','/') : '-';
                    h += `<tr><td class="num-cell">${dataFmt}</td><td style="text-align:left;">${it.nome||'-'}</td><td class="num-cell">${it.telefone||'-'}</td><td>${it.agente||'-'}</td></tr>`;
                }
                h += `</tbody></table></div>`;
            }
        }
    }

    h += `<div style="margin-top:12px;font-size:10px;color:#555;display:flex;gap:16px;flex-wrap:wrap;padding:4px 0;">
        <span><b style="color:#96b7ff;">Efic.</b> msgs/chat (<span style="color:#2ecc71">&#9679;</span>≤5 <span style="color:#f39c12">&#9679;</span>≤8 <span style="color:#e94560">&#9679;</span>>8)</span>
        <span><b style="color:#96b7ff;">Conv.</b> taxa marc. (<span style="color:#2ecc71">&#9679;</span>≥20% <span style="color:#3498db">&#9679;</span>≥12% <span style="color:#f39c12">&#9679;</span>≥8%)</span>
    </div>`;

    const oc=getOc();
    if(oc.length) h+=`<div style="margin-top:8px;font-size:11px;color:#96b7ff;">Ocultos: ${oc.map(s=>`<button class="btn-restaurar" onclick="toggleOc('${s}')">${s}</button>`).join(' ')}</div>`;
    el.panelMarc.innerHTML = h;
}

function renderRecepcao(recep) {
    if (!el.panelRecep) return;
    const lista = recep.filter(u => !isOc(u.usuario) && (u.admissoes||0)>0).sort((a,b)=>(b.admissoes||0)-(a.admissoes||0));
    let h = `<table class="prod-table"><thead><tr><th>#</th><th>Sigla</th><th>Nome</th><th>Admissões</th><th></th></tr></thead><tbody>`;
    let p=1;
    for(const u of lista) h+=`<tr><td class="rank-cell">${p++}</td><td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td><td class="num-cell total-cell">${u.admissoes||0}</td><td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')">×</button></td></tr>`;
    const tA=lista.reduce((s,u)=>s+(u.admissoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;color:#4cc9f0;">TOTAL</td><td class="num-cell total-cell" style="font-size:14px;">${tA}</td><td></td></tr></tbody></table>`;
    el.panelRecep.innerHTML = h;
}

function renderChart() {
    const titulo = document.getElementById("tituloChartRank");
    try { if (currentTab==="marc") { if(titulo) titulo.textContent="Ranking Marcação"; renderChartMarc(); } else { if(titulo) titulo.textContent="Ranking Recepção"; renderChartRecep(); } } catch(e) {}
}

function renderChartMarc() {
    const octaMap = buildOcta(prodData.octadesk || []);
    const marc = (prodData.marcacao||[]).filter(u=>!isOc(u.usuario)&&!EXCLUIR_RANKING.includes(u.usuario))
        .map(u=>{const w=(octaMap[u.usuario]||{}).total||0;return{...u,wpp:w,total:(u.marcacoes||0)+(u.ligacoes||0)+w};})
        .filter(u=>u.total>0).sort((a,b)=>b.total-a.total).slice(0,12);
    if(chartMarc)chartMarc.destroy(); if(chartRecep){chartRecep.destroy();chartRecep=null;} if(!marc.length) return;
    chartMarc = new Chart(el.chartRank, { type:"bar",
        data:{labels:marc.map(u=>u.usuario),datasets:[
            {label:"Agendamentos",data:marc.map(u=>u.marcacoes||0),backgroundColor:"#3a86ff"},
            {label:"Ligações",data:marc.map(u=>u.ligacoes||0),backgroundColor:"#f2c94c"},
            {label:"WhatsApp",data:marc.map(u=>u.wpp),backgroundColor:"#25d366"}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{display:false}},
            scales:{x:{stacked:true,ticks:{color:"#fff"},grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}}}}
    });
}

function renderChartRecep() {
    const recep = (prodData.recepcao||[]).filter(u=>!isOc(u.usuario)&&(u.admissoes||0)>0).sort((a,b)=>(b.admissoes||0)-(a.admissoes||0)).slice(0,12);
    if(chartRecep)chartRecep.destroy(); if(chartMarc){chartMarc.destroy();chartMarc=null;} if(!recep.length) return;
    chartRecep = new Chart(el.chartRank, { type:"bar",
        data:{labels:recep.map(u=>u.usuario),datasets:[{label:"Admissões",data:recep.map(u=>u.admissoes||0),backgroundColor:"#4cc9f0"}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",anchor:"end",align:"top",font:{size:10,weight:"bold"}}},
            scales:{x:{ticks:{color:"#fff"},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}}}}
    });
}

function renderChartWpp(octa) {
    const sorted = (octa||[]).filter(a=>a.agente!=="SEM AGENTE"&&a.agente!=="CLINICA CAVALLIERI"&&a.agente!=="Enfermagem Cavallieri").sort((a,b)=>b.total-a.total);
    if(chartWpp)chartWpp.destroy(); if(!sorted.length)return;
    chartWpp = new Chart(el.chartWpp, { type:"bar",
        data:{labels:sorted.map(a=>{const s=OCTA_MAP[a.agente];return s||a.agente;}),
            datasets:[{label:"Conversas",data:sorted.map(a=>a.total||0),backgroundColor:"#25d366"}]},
        options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",font:{size:9,weight:"bold"}}},
            scales:{x:{ticks:{color:"#666"},grid:{color:"rgba(255,255,255,0.05)"}},y:{ticks:{color:"#fff",font:{size:10}},grid:{display:false}}}}
    });
}

function toggleDetalhe(key) {
    const el = document.getElementById('detalhe_' + key);
    if (!el) return;
    document.querySelectorAll('[id^="detalhe_"]').forEach(d => { if (d !== el) d.style.display = 'none'; });
    el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ── Timeline ──
const API_TIMELINE = API_BASE + "/timeline";
const ST_RAMAIS = "cavalieri_ramais_custom";
const MAPA_PADRAO = {
    "192.168.0.1":{host:"205MARC01",ramal:null,setor:"marcacao"},"192.168.0.2":{host:"205MARC02",ramal:"2056",setor:"marcacao"},
    "192.168.0.3":{host:"205MARC03",ramal:"2057",setor:"marcacao"},"192.168.0.4":{host:"205MARC04",ramal:"2054",setor:"marcacao"},
    "192.168.0.5":{host:"205MARC05",ramal:"2055",setor:"marcacao"},"192.168.0.6":{host:"205MARC06",ramal:"2058",setor:"marcacao"},
    "192.168.0.7":{host:"DAYANE",ramal:"2053",setor:"adm"},"192.168.0.8":{host:"RENATA",ramal:"2050",setor:"adm"},
    "192.168.0.26":{host:"IMAG",ramal:"2051",setor:"ti"},
    "192.168.0.30":{host:"306RECEP01",ramal:"3061",setor:"recepcao"},"192.168.0.31":{host:"306RECEP02",ramal:"3061",setor:"recepcao"},
    "192.168.0.32":{host:"307RECEP01",ramal:"3071",setor:"recepcao"},"192.168.0.33":{host:"307RECEP02",ramal:"3072",setor:"recepcao"},
    "192.168.0.34":{host:"313RECEP01",ramal:"3131",setor:"recepcao"},
    "192.168.0.35":{host:"602RECEP02",ramal:"6021",setor:"recepcao"},"192.168.0.36":{host:"602RECEP01",ramal:"6021",setor:"recepcao"},
    "192.168.0.37":{host:"602RECEP03",ramal:"6022",setor:"recepcao"},
    "192.168.0.38":{host:"606RECEP01",ramal:"6061",setor:"recepcao"},"192.168.0.39":{host:"606RECEP02",ramal:"6062",setor:"recepcao"},
    "192.168.0.40":{host:"606RECEP03",ramal:"6062",setor:"recepcao"},"192.168.0.41":{host:"BIOPSIA",ramal:null,setor:"outro"},
};
function getRamaisCustom() { try { const r = localStorage.getItem(ST_RAMAIS); if (r) return JSON.parse(r); } catch(e) {} return {}; }

async function carregarTimeline() {
    const data = el.timelineData.value; if (!data) return;
    el.timelineConteudo.innerHTML = '<div style="color:#96b7ff;padding:20px;text-align:center;">Carregando timeline...</div>';
    try {
        const res = await fetch(`${API_TIMELINE}?data=${data}`); const json = await res.json();
        if (!json.ok) throw new Error(json.erro || "Erro");
        renderTimeline(json.timeline, json.nomes, json.mapa_estacoes, data);
    } catch (err) { el.timelineConteudo.innerHTML = `<div style="color:#ffb3c1;padding:20px;">Falha: ${err.message}<br><button onclick="carregarTimeline()" style="margin-top:8px;">Tentar novamente</button></div>`; }
}

function renderTimeline(timeline, nomes, mapaBackend, data) {
    const custom = getRamaisCustom(), mapa = {};
    for (const ip in mapaBackend) { mapa[ip] = { ...mapaBackend[ip] }; if (custom[ip]) mapa[ip].ramal = custom[ip]; }
    for (const usr in timeline) { for (const s of timeline[usr]) { if (custom[s.ip]) s.ramal = custom[s.ip]; } }
    const btnReset = document.getElementById("btnResetRamais");
    if (btnReset) { btnReset.onclick = () => { if (!confirm("Resetar ramais?")) return; localStorage.removeItem(ST_RAMAIS); carregarTimeline(); carregarProd(); }; }
    const usuarios = Object.keys(timeline).sort((a, b) => { const ha = timeline[a][0]?.hora||'z', hb = timeline[b][0]?.hora||'z'; return ha.localeCompare(hb); });
    const atendentes = usuarios.filter(usr => timeline[usr].some(s => s.setor === 'marcacao' || s.setor === 'recepcao'));
    const dataBr = data.split('-').reverse().join('/');
    let h = `<div style="color:#96b7ff;font-size:12px;margin-bottom:12px;">${dataBr} — ${atendentes.length} atendentes</div>`;
    for (const usr of atendentes) {
        const sessoes = timeline[usr], nome = nomes[usr]||'', p1 = sessoes[0]?.hora?.substring(11,16)||'', pN = sessoes[sessoes.length-1]?.hora?.substring(11,16)||'';
        h += `<div class="timeline-user"><div class="timeline-header"><span class="timeline-sigla">${usr}</span><span class="timeline-nome">${nome}</span><span style="color:#96b7ff;font-size:11px;">${p1} — ${pN} (${sessoes.length})</span></div><div class="timeline-sessoes">`;
        for (let i = 0; i < sessoes.length; i++) {
            const s = sessoes[i], hora = s.hora.substring(11,16), horaFim = sessoes[i+1]?.hora?.substring(11,16)||'...', setor = s.setor||'outro';
            h += `<div class="timeline-sessao"><span class="timeline-hora">${hora}</span><span style="color:#555;font-size:11px;">ate ${horaFim}</span><span class="timeline-host">${s.hostname}</span>
                <input type="text" class="ramal-inline" data-ip="${s.ip}" value="${s.ramal||''}" placeholder="ramal" style="width:55px;padding:2px 4px;background:#0f1738;color:#4cc9f0;border:1px solid #2f4f9c;border-radius:4px;text-align:center;font-size:12px;" />
                <span class="timeline-setor-tag tag-${setor}">${setor.toUpperCase()}</span></div>`;
        }
        h += `</div></div>`;
    }
    const outros = usuarios.filter(usr => !atendentes.includes(usr));
    if (outros.length) { h += `<details style="margin-top:12px;"><summary style="color:#96b7ff;font-size:12px;cursor:pointer;">Outros (${outros.length})</summary>`;
        for (const usr of outros) { const ss = timeline[usr]; h += `<div style="padding:4px 0;font-size:12px;color:#dce7ff;"><b>${usr}</b> ${(nomes[usr]||'').substring(0,25)} — ${ss.map(s=>s.hora.substring(11,16)+' '+s.hostname).join(' → ')}</div>`; }
        h += `</details>`; }
    el.timelineConteudo.innerHTML = h;
    document.querySelectorAll(".ramal-inline").forEach(input => { input.addEventListener("change", () => {
        const ip = input.dataset.ip, val = input.value.trim(), c = getRamaisCustom(), pad = (MAPA_PADRAO[ip]||{}).ramal||'';
        if (val && val !== pad) { c[ip] = val; input.style.borderColor = '#f2c94c'; } else { delete c[ip]; input.style.borderColor = '#2f4f9c'; }
        localStorage.setItem(ST_RAMAIS, JSON.stringify(c)); enviarMapaERecarregar();
    }); });
}

let _recarregarTimer = null;
function enviarMapaERecarregar() { if (_recarregarTimer) clearTimeout(_recarregarTimer); _recarregarTimer = setTimeout(() => { showSt("Recalculando...", "info"); carregarProd(); setTimeout(hideSt, 2000); }, 1000); }
