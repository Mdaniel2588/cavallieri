/* ─── Produtividade — Clinica Cavallieri v4 ──────────────────────────── */

const API_BASE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade";
const API_PROD = API_BASE + "/resumo";
const API_WHATSAPP = API_BASE + "/whatsapp";

const OCTA_MAP = {
    "Claudio Maximiano":"CMGJ","Julia Chaves":"JSC","Maria D Sousa":"MDS",
    "Rosangela Alcantara Lima":"RAL","Rosangela Tavares":"RDT","Vanessa Waeger":"VS",
    "Jane Sousa":"JSL","Gessica Oliveira":"GOS","Rose Martins":"RGM",
    "Claudia Barbosa":"DUDU","Diana Anchieta":"DC","Nelia de Abreu Silva":"RAS",
    "Cristialine Silva":"CJS","Renata Aquino":"RAC","Dayane":"DSR",
    "Karina Cristina Carvalho":"KCC","Rubens Oliver":"RJO",
    "Jessika Libório Venancio":"JLV"
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
let _canal = {};  // dados de canal (global)
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
    el.panelComparativos = document.getElementById("panelComparativos");
    el.tabComparativos = document.getElementById("tabComparativos");
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
    el.tabComparativos.addEventListener("click", () => setTab("comparativos"));
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

function _periodoLabel() {
    const nomeMes = _meses[_pcalMes + 1];
    if (_pcalQuick === "trimestre") return (Math.floor(_pcalMes/3)+1) + "º Tri " + _pcalAno;
    if (_pcalQuick === "semestral") return (Math.floor(_pcalMes/6)+1) + "º Sem " + _pcalAno;
    if (_pcalQuick === "anual") return "Ano " + _pcalAno;
    return nomeMes + " " + _pcalAno;
}

function _renderCalProd() {
    const box = document.getElementById("calendarPickerProd");
    if (!box) return;
    const h = new Date();
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
    html += '<span class="cal-month-label" id="pcalLabel">' + _periodoLabel() + '</span>';
    html += '<button class="cal-arrow" id="pcalNext" type="button">&#9654;</button>';
    if (textoSel && !_pcalExpanded) html += '<span style="margin-left:10px;font-size:11px;color:#96b7ff;font-weight:600;">' + textoSel + '</span>';
    html += '</div>';

    if (!_pcalExpanded) {
        html += '<div class="cal-quick" style="margin-top:4px;">';
        for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MÊS"},{id:"trimestre",label:"TRIMESTRE"},{id:"semestral",label:"SEMESTRE"},{id:"anual",label:"ANO"}])
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
    for (const q of [{id:"hoje",label:"HOJE"},{id:"semana",label:"SEMANA"},{id:"mes",label:"MÊS"},{id:"trimestre",label:"TRIMESTRE"},{id:"semestral",label:"SEMESTRE"},{id:"anual",label:"ANO"}])
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

function _navegarPeriodo(direcao) {
    // direcao: -1 = anterior, +1 = proximo
    if (_pcalQuick === "anual") {
        _pcalAno += direcao;
        _pcalMes = 0;
        _pcalSelA = new Date(_pcalAno, 0, 1);
        _pcalSelB = new Date(_pcalAno, 11, 31);
        prodPeriodo = "anual";
    } else if (_pcalQuick === "semestral") {
        const semIdx = Math.floor(_pcalMes/6) + direcao;
        if (semIdx < 0) { _pcalAno--; _pcalMes = 6; }
        else if (semIdx > 1) { _pcalAno++; _pcalMes = 0; }
        else { _pcalMes = semIdx * 6; }
        _pcalSelA = new Date(_pcalAno, _pcalMes, 1);
        _pcalSelB = new Date(_pcalAno, _pcalMes+6, 0);
        prodPeriodo = "semestral";
    } else if (_pcalQuick === "trimestre") {
        const triIdx = Math.floor(_pcalMes/3) + direcao;
        if (triIdx < 0) { _pcalAno--; _pcalMes = 9; }
        else if (triIdx > 3) { _pcalAno++; _pcalMes = 0; }
        else { _pcalMes = triIdx * 3; }
        _pcalSelA = new Date(_pcalAno, _pcalMes, 1);
        _pcalSelB = new Date(_pcalAno, _pcalMes+3, 0);
        prodPeriodo = "trimestre";
    } else {
        // Padrao: navega por mes, e se estava com quick != mes, vira "mes" so se NAO estiver expandido
        _pcalMes += direcao;
        if (_pcalMes < 0) { _pcalMes = 11; _pcalAno--; }
        if (_pcalMes > 11) { _pcalMes = 0; _pcalAno++; }
        if (!_pcalExpanded) {
            _pcalQuick = "mes";
            _pcalSelA = new Date(_pcalAno, _pcalMes, 1);
            _pcalSelB = new Date(_pcalAno, _pcalMes+1, 0);
            prodPeriodo = "mes";
        }
    }
}

function _bindCalProdHeader(box) {
    const prev = document.getElementById("pcalPrev"), next = document.getElementById("pcalNext"), label = document.getElementById("pcalLabel");
    if (prev) prev.addEventListener("click", () => {
        _navegarPeriodo(-1);
        if (!_pcalExpanded) { _applyCalProd(); carregarProd(); }
        _renderCalProd();
    });
    if (next) next.addEventListener("click", () => {
        _navegarPeriodo(+1);
        if (!_pcalExpanded) { _applyCalProd(); carregarProd(); }
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
    else if (tipo === "semestral") { _pcalSelA=new Date(h.getFullYear(),h.getMonth()-5,1); _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0); prodPeriodo = "semestral"; }
    else if (tipo === "anual") { _pcalSelA=new Date(h.getFullYear(),0,1); _pcalSelB=new Date(h.getFullYear(),h.getMonth()+1,0); prodPeriodo = "anual"; }
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
    el.panelMarc.style.display = tab==="marc" ? "" : "none";
    el.panelRecep.style.display = tab==="recep" ? "" : "none";
    el.panelTimeline.style.display = tab==="timeline" ? "" : "none";
    if (el.panelComparativos) el.panelComparativos.style.display = tab==="comparativos" ? "" : "none";
    el.tabComparativos.classList.toggle("active", tab==="comparativos");
    if (tab === "comparativos") carregarComparativos();
    if (tab === "timeline" && !el.timelineConteudo.innerHTML) carregarTimeline();
    if (prodData) renderChart();
}

function setPeriodo(p) { prodPeriodo = p; if(prodTimer){clearInterval(prodTimer);prodTimer=null;} carregarProd(); if (p === "hoje") prodTimer = setInterval(carregarProd, 120000); }

async function carregarProd() {
    const ano=el.ano.value, mes=el.mes.value, range = _getDateRange();
    const custom = getRamaisCustom();
    const mapaParam = Object.keys(custom).length ? '&mapa=' + encodeURIComponent(JSON.stringify(custom)) : '';
    let periodoParam = prodPeriodo, dateParams = '';
    if (["trimestre","semestral","anual","custom"].includes(prodPeriodo) || (_pcalSelA && _pcalSelB && !_pcalQuick)) {
        periodoParam = "custom"; dateParams = `&data_inicio=${range.ini}&data_fim=${range.fim}`;
    }

    const url = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${periodoParam}&com_3cx=1${mapaParam}${dateParams}`;
    showSt("Carregando...", "info");
    try {
        const r1 = await window.apiFetch(url); const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro||"Erro");
        prodData = j1.data;

        // WhatsApp + canal via proxy clinic_bridge → .27
        const octaUrl = `${API_WHATSAPP}?periodo=${periodoParam}&ano=${ano}&mes=${mes}${dateParams}`;
        try {
            const r2 = await window.apiFetch(octaUrl); const j2 = await r2.json();
            if(j2.ok&&j2.data){
                octaClassificado = j2.data;
                prodData.octadesk = (j2.data.agentes||[]).map(a => ({
                    agente: a.agent_name, total: a.atend_real||0, inbound: 0, outbound: 0, tempo_medio: a.tempo_medio||0
                }));
            }
        } catch(e) { console.warn("API WhatsApp:", e); }

        renderProd(); hideSt();
        if(prodPeriodo==="hoje"){showSt("Realtime — atualiza a cada 2 min","info");setTimeout(hideSt,4000);}
        // Se tab Comparativos esta visivel, recarrega gráficos com novo periodo
        if (currentTab === "comparativos") carregarComparativos();

        // Tempo médio WPP: buscar do com_octa=1 em background (não bloqueia)
        const tmUrl = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${periodoParam}&com_octa=1${dateParams}`;
        window.apiFetch(tmUrl).then(r=>r.json()).then(j=>{
            if(j.ok&&j.data&&j.data.octadesk){
                const tmMap = {};
                for(const a of j.data.octadesk) tmMap[a.agente] = a.tempo_medio||0;
                // Merge tempo_medio no octadesk existente
                if(prodData.octadesk){
                    for(const a of prodData.octadesk){
                        if(tmMap[a.agente]) a.tempo_medio = tmMap[a.agente];
                    }
                }
                renderProd();
            }
        }).catch(()=>{});
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
    const ini = (range.ini || '').split('-').reverse().join('/');
    const fim = (range.fim || '').split('-').reverse().join('/');
    const dateStr = ini && fim ? (ini === fim ? ini : `${ini} a ${fim}`) : '';

    let label = "";
    if (prodPeriodo === "hoje") label = "HOJE";
    else if (_pcalQuick === "semana") label = "SEMANA";
    else if (_pcalQuick === "trimestre") label = "TRIMESTRE";
    else if (_pcalQuick === "semestral") label = "SEMESTRE";
    else if (_pcalQuick === "anual") label = "ANO";
    else if (prodPeriodo === "mes") {
        const m = prodData.mes || (new Date().getMonth()+1);
        const nomeMes = (_meses[m] || '').toUpperCase();
        const ano = prodData.ano || new Date().getFullYear();
        titulo.textContent = `PRODUTIVIDADE | ${nomeMes} ${ano}`;
        return;
    }

    titulo.textContent = label && dateStr
        ? `PRODUTIVIDADE | ${label} ${dateStr}`
        : (label ? `PRODUTIVIDADE | ${label}` : `PRODUTIVIDADE | ${dateStr || ''}`);
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    const labelMap = {"hoje":"Hoje","semana":"Semana","mes":_meses[(prodData.mes||1)],"trimestre":"Trimestre","semestral":"Semestre","anual":"Ano","custom":"Periodo"};
    const label = labelMap[_pcalQuick] || labelMap[prodPeriodo] || "Periodo";
    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    const tMa = marc.filter(u=>!EXCLUIR_RANKING.includes(u.usuario)).reduce((s,u)=>s+(u.marcacoes||0),0);
    const tAd = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    const pv = prodData.pacientes_primeira_vez || 0;

    // Canal real da .27
    _canal = octaClassificado?.canal || {};
    const cWpp = _canal.whatsapp || 0, cTel = _canal.telefone || 0, cHib = _canal.hibrido || 0, cDir = _canal.agendado_direto || 0;
    const cTotal = cWpp + cTel + cHib + cDir;

    // Telefone — ligações + quantas geraram agendamento + %
    const agTel = cTel + cHib;
    const pctAgTel = tLig > 0 && agTel > 0 ? ` (${(agTel/tLig*100).toFixed(0)}% das ligações)` : '';
    el.cardTel.innerHTML = `<div class="prod-card-title">TELEFONE</div>
        <div class="prod-card-big">${tLig || '-'}</div>
        <div class="prod-card-label">Ligações ${label}</div>
        ${agTel ? `<div class="prod-card-sub"><b>${agTel}</b> geraram agendamento${pctAgTel}</div>` : ''}`;

    // WhatsApp — conversas + classificação + agendamentos + %
    const agWpp = cWpp;
    const pctAgWpp = tWpp > 0 && agWpp > 0 ? ` (${(agWpp/tWpp*100).toFixed(0)}% das conversas)` : '';
    const tMarcOcta = octaClassificado?.totais?.marcacao || 0;
    const tConfOcta = octaClassificado?.totais?.confirmacao || 0;
    const tInfoOcta = octaClassificado?.totais?.informacao || 0;
    el.cardWpp.innerHTML = `<div class="prod-card-title">WHATSAPP</div>
        <div class="prod-card-big">${tWpp || '-'}</div>
        <div class="prod-card-label">Conversas ${label}</div>
        <div class="prod-card-sub" style="font-size:11px;line-height:1.6;">
            ${agWpp ? '<b>'+agWpp+'</b> geraram agendamento'+pctAgWpp+'<br>':''}
            ${tMarcOcta?'<span style="color:#e94560;">●</span> '+tMarcOcta+' marcações ':''}
            ${tConfOcta?'<span style="color:#2ecc71;">●</span> '+tConfOcta+' confirmações ':''}
            ${tInfoOcta?'<span style="color:#f39c12;">●</span> '+tInfoOcta+' informação':''}
        </div>`;

    const tAtend = tLig + tWpp;
    let canalHtml = '';
    if (cTotal > 0) {
        canalHtml = `<br>Canal: ~${(cWpp/cTotal*100).toFixed(0)}% WhatsApp | ~${((cTel+cHib)/cTotal*100).toFixed(0)}% Telefone`;
        if (cDir) canalHtml += ` | ${cDir} Direto`;
    }
    const pvHtml = pv ? ` | <span style="color:#00e676;">${pv} novos</span>` : '';
    el.cardCon.innerHTML = `<div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${tAtend || '-'}</div>
        <div class="prod-card-label">Atendimentos ${label}</div>
        <div class="prod-card-sub" style="font-size:11px;line-height:1.6;">
            Agendamentos: <b>${tMa}</b> | Admissões: <b>${tAd}</b>${pvHtml}${canalHtml}
        </div>`;
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
        ${th('Tel','ligacoes','Ligações telefone')}<th>T.Med</th>
        ${th('WPP','wpp','Conversas WhatsApp')}<th>T.Med</th>
        ${th('ATEND','atendimentos','Tel+WPP')}
        ${th('Agend.','marcacoes','Agendamentos Kliniki')}
        ${th('Efic.','_mediaInter','Msgs/chat WPP (menor=mais objetiva)')}${th('Enrol.','_pctLongos','% chats WPP longos (>10 msgs)')}${th('Conv.','_taxaEf','% conversas WPP que viraram marcação')}
        <th></th></tr></thead><tbody>`;

    let p=1;
    for(const u of lista){
        const octaInfo = octaMap[u.usuario], tMedWpp = octaInfo?.tempo_medio ? fmt(octaInfo.tempo_medio) : '-';
        const mi = u._mediaInter || '-', pl = u._pctLongos || 0, te = u._taxaEf || 0;
        const efC = mi === '-' ? '#555' : mi <= 5 ? '#2ecc71' : mi <= 8 ? '#f39c12' : '#e94560';
        const enC = pl === 0 ? '#555' : pl <= 20 ? '#2ecc71' : pl <= 30 ? '#f39c12' : '#e94560';
        const cvC = te === 0 ? '#555' : te >= 20 ? '#2ecc71' : te >= 12 ? '#3498db' : te >= 8 ? '#f39c12' : '#e94560';
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||OCTA_MAP_REV[u.usuario]||'-'}</td>
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
                <td style="font-weight:bold;color:#9b59b6;">${u.usuario}</td><td style="text-align:left;color:#9b59b6;">${u.nome||OCTA_MAP_REV[u.usuario]||'-'} <span style="font-size:10px;">(Ag.Direto)</span></td>
                <td colspan="6"></td><td class="num-cell" style="color:#9b59b6;font-weight:600;">${u.marcacoes||0}</td>
                <td colspan="3"></td><td></td></tr>`;
        }
    }

    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0), tW=lista.reduce((s,u)=>s+u.wpp,0), tAtend=tL+tW;
    const tM=lista.reduce((s,u)=>s+(u.marcacoes||0),0) + diretos.reduce((s,u)=>s+(u.marcacoes||0),0);
    const txConv = tAtend > 0 ? (tM / tAtend * 100).toFixed(1) : '-';
    const txConvColor = tAtend > 0 ? (parseFloat(txConv) >= 20 ? '#2ecc71' : parseFloat(txConv) >= 12 ? '#3498db' : parseFloat(txConv) >= 8 ? '#f39c12' : '#e94560') : '#666';
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;color:#4cc9f0;">TOTAL</td>
        <td class="num-cell">${tL||'-'}</td><td></td><td class="num-cell">${tW||'-'}</td><td></td>
        <td class="num-cell total-cell" style="font-size:14px;">${tAtend}</td>
        <td class="num-cell" style="color:#f2c94c;">${tM}</td>
        <td colspan="2"></td>
        <td class="num-cell" style="color:${txConvColor};font-weight:700;font-size:13px;">${txConv}${tAtend>0?'%':''}</td>
        <td></td></tr></tbody></table>`;

    // Cards de classificação — canal real + WhatsApp
    const cWpp = _canal.whatsapp||0, cTel = _canal.telefone||0, cHib = _canal.hibrido||0, cDir = _canal.agendado_direto||0, cTotal = cWpp+cTel+cHib+cDir;
    const tMa = lista.reduce((s,u)=>s+(u.marcacoes||0),0) + diretos.reduce((s,u)=>s+(u.marcacoes||0),0);
    if (octaClassificado?.totais || cTotal > 0) {
        const t = octaClassificado?.totais || {};
        const total = t.atend_real || 1;
        // Reclamacoes: contar so as confirmadas pela IA + as ainda nao analisadas (excluir false-positives)
        const reclList = (octaClassificado?.detalhes?.reclamacao || []);
        const reclReais = reclList.filter(r => r.confirmada !== false).length;
        const cats = [
            {label:'Via WhatsApp',val:cWpp,color:'#25d366',bg:'rgba(37,211,102,0.12)',key:'marcacao',base:cTotal,showPct:true},
            {label:'Via Telefone',val:cTel+cHib,color:'#3a86ff',bg:'rgba(58,134,255,0.12)',key:null,base:cTotal,showPct:true},
            {label:'Ag. Direto',val:cDir,color:'#9b59b6',bg:'rgba(155,89,182,0.12)',key:null,base:cTotal,showPct:true},
            {label:'Confirmaram',val:t.confirmacao,color:'#2ecc71',bg:'rgba(46,204,113,0.12)',key:null,base:total},
            {label:'Cancelaram',val:t.cancelamento,color:'#e74c3c',bg:'rgba(231,76,60,0.12)',key:'cancelamento',base:total},
            {label:'Reclamação',val:reclReais,color:'#ff5252',bg:'rgba(255,82,82,0.12)',key:'reclamacao',base:total},
            {label:'Pediram Info',val:t.informacao,color:'#f39c12',bg:'rgba(243,156,18,0.12)',key:null,base:total},
            {label:'Resultado/Laudo',val:t.resultado,color:'#9b59b6',bg:'rgba(155,89,182,0.08)',key:'resultado',base:total},
        ];
        const totalAgend = cTotal || tMa || 1;
        h += `<div style="margin-top:18px;"><div style="font-size:12px;font-weight:700;color:#96b7ff;letter-spacing:.08em;margin-bottom:8px;">AGENDAMENTOS POR CANAL + WHATSAPP (${tMa} agendamentos | ${total} conversas)</div>`;
        h += `<div style="display:flex;gap:10px;flex-wrap:wrap;">`;
        for (const c of cats) {
            if (!c.val) continue;
            const pct = ((c.val||0)/(c.base||1)*100).toFixed(0);
            const hasDetail = c.key && octaClassificado?.detalhes?.[c.key];
            const cursor = hasDetail ? 'cursor:pointer;' : '';
            const click = hasDetail ? ` onclick="toggleDetalhe('${c.key}')"` : '';
            if (c.showPct) {
                // Canal: % grande, número pequeno
                h += `<div style="background:${c.bg};border-radius:10px;padding:12px 16px;border-left:3px solid ${c.color};min-width:110px;flex:1;${cursor}"${click}>
                    <div style="font-size:11px;color:${c.color};font-weight:700;letter-spacing:.05em;">${c.label.toUpperCase()}</div>
                    <div style="font-size:26px;font-weight:800;color:#fff;margin:2px 0;">${pct}%</div>
                    <div style="font-size:11px;color:#666;">${c.val} agendamentos${hasDetail ? ' ▼' : ''}</div>
                </div>`;
            } else {
                h += `<div style="background:${c.bg};border-radius:10px;padding:12px 16px;border-left:3px solid ${c.color};min-width:110px;flex:1;${cursor}"${click}>
                    <div style="font-size:11px;color:${c.color};font-weight:700;letter-spacing:.05em;">${c.label.toUpperCase()}</div>
                    <div style="font-size:26px;font-weight:800;color:#fff;margin:2px 0;">${c.val}</div>
                    <div style="font-size:11px;color:#666;">${pct}% das conversas${hasDetail ? ' ▼' : ''}</div>
                </div>`;
            }
        }
        h += `</div></div>`;

        // Painéis drill-down
        if (octaClassificado?.detalhes) {
            for (const [key, itemsRaw] of Object.entries(octaClassificado.detalhes)) {
                // Reclamacoes: ocultar as confirmada=false (IA descartou como falso positivo)
                const items = key === 'reclamacao' ? itemsRaw.filter(it => it.confirmada !== false) : itemsRaw;
                const labelMap = {reclamacao:'Reclamações',cancelamento:'Cancelamentos',marcacao:'Marcações WhatsApp',resultado:'Resultado/Laudo'};
                h += `<div id="detalhe_${key}" style="display:none;margin-top:10px;background:#0f1738;border:1px solid #2f4f9c;border-radius:10px;padding:12px;max-height:300px;overflow-y:auto;">`;
                h += `<div style="font-size:12px;font-weight:700;color:#96b7ff;margin-bottom:8px;">${labelMap[key]||key} — ${items.length} registros</div>`;
                const isReclam = key === 'reclamacao';
                const headCols = isReclam
                    ? '<th>Data</th><th style="text-align:left;">Paciente</th><th>Telefone</th><th>Categoria</th><th style="text-align:left;width:100%;">Resumo</th><th>Agente</th>'
                    : '<th>Data</th><th style="text-align:left;">Paciente</th><th>Telefone</th><th>Agente</th>';
                h += `<table class="prod-table prod-table-sm" style="table-layout:auto;"><thead><tr>${headCols}</tr></thead><tbody>`;
                for (const it of items) {
                    const dataFmt = it.data ? it.data.substring(5,16).replace('-','/') : '-';
                    if (isReclam) {
                        const sub = it.sub_categoria || '';
                        const conf = it.confirmada;
                        const resumo = it.resumo || '';
                        let catCell, resumoCell, rowStyle = '';
                        if (conf === false) {
                            rowStyle = ' style="opacity:0.45;"';
                            catCell = `<td><span style="color:#888;">não conf.</span></td>`;
                            resumoCell = `<td style="text-align:left;color:#888;font-style:italic;">${resumo || '(sem reclamação real)'}</td>`;
                        } else if (conf === true) {
                            const subColor = {preco:'#f2c94c',horario:'#f39c12',atendimento:'#e94560',laudo:'#9b59b6',exame:'#3498db',outros:'#95a5a6'}[sub] || '#96b7ff';
                            catCell = `<td><span style="color:${subColor};font-weight:600;">${sub||'-'}</span></td>`;
                            resumoCell = `<td style="text-align:left;">${resumo||'-'}</td>`;
                        } else {
                            catCell = `<td><span style="color:#666;">⌛</span></td>`;
                            resumoCell = `<td style="text-align:left;color:#666;">analisando...</td>`;
                        }
                        h += `<tr${rowStyle}><td class="num-cell" style="white-space:nowrap;">${dataFmt}</td><td style="text-align:left;white-space:nowrap;">${it.nome||'-'}</td><td class="num-cell" style="white-space:nowrap;">${it.telefone||'-'}</td>${catCell}${resumoCell}<td style="white-space:nowrap;">${it.agente||'-'}</td></tr>`;
                    } else {
                        h += `<tr><td class="num-cell">${dataFmt}</td><td style="text-align:left;">${it.nome||'-'}</td><td class="num-cell">${it.telefone||'-'}</td><td>${it.agente||'-'}</td></tr>`;
                    }
                }
                h += `</tbody></table></div>`;
            }
        }
    }

    h += `<div style="margin-top:12px;font-size:10px;color:#555;display:flex;gap:16px;flex-wrap:wrap;padding:4px 0;">
        <span><b style="color:#96b7ff;">Efic.</b> msgs/chat (<span style="color:#2ecc71">&#9679;</span>≤5 <span style="color:#f39c12">&#9679;</span>≤8 <span style="color:#e94560">&#9679;</span>>8)</span>
        <span><b style="color:#96b7ff;">Conv.</b> taxa marc. (<span style="color:#2ecc71">&#9679;</span>≥20% <span style="color:#3498db">&#9679;</span>≥12% <span style="color:#f39c12">&#9679;</span>≥8%)</span>
    </div>`;

    el.panelMarc.innerHTML = h;
}

function renderRecepcao(recep) {
    if (!el.panelRecep) return;
    const lista = recep.filter(u => !isOc(u.usuario) && (u.admissoes||0)>0).sort((a,b)=>(b.admissoes||0)-(a.admissoes||0));
    let h = `<table class="prod-table"><thead><tr><th>#</th><th>Sigla</th><th>Nome</th><th>Admissões</th><th></th></tr></thead><tbody>`;
    let p=1;
    for(const u of lista) h+=`<tr><td class="rank-cell">${p++}</td><td style="font-weight:bold;color:#4cc9f0;">${u.usuario}</td><td style="text-align:left;">${u.nome||OCTA_MAP_REV[u.usuario]||'-'}</td><td class="num-cell total-cell">${u.admissoes||0}</td><td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')">×</button></td></tr>`;
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
const API_COMPARATIVO = API_BASE + "/comparativo";

let chartCompCanal = null;
let chartCompPipeline = null;
let chartCompTaxas = null;

async function carregarComparativos() {
    // Decide range + granularidade baseado no filtro do topo
    const h = new Date();
    let ini, fim, gran = "";
    if (_pcalQuick === "hoje") {
        ini = new Date(h.getFullYear(), h.getMonth(), h.getDate());
        fim = new Date(ini);
        gran = "hora";
    } else if (_pcalQuick === "semana") {
        // Semana inteira: segunda 00:00 ate domingo 23:59
        const dow = h.getDay();
        const seg = h.getDate() - (dow === 0 ? 6 : dow - 1);
        ini = new Date(h.getFullYear(), h.getMonth(), seg);
        fim = new Date(h.getFullYear(), h.getMonth(), seg + 6);
        gran = "dia";
    } else if (_pcalQuick === "mes") {
        ini = new Date(h.getFullYear(), h.getMonth(), 1);
        fim = new Date(h.getFullYear(), h.getMonth()+1, 0);
        gran = "semana";
    } else if (_pcalQuick === "trimestre" || _pcalQuick === "semestral" || _pcalQuick === "anual") {
        if (_pcalSelA && _pcalSelB) { ini = _pcalSelA; fim = _pcalSelB; }
        else { ini = new Date(h.getFullYear(), h.getMonth()-2, 1); fim = h; }
        gran = "mes";
    } else if (_pcalSelA && _pcalSelB) {
        const a = _pcalSelA, b = _pcalSelB;
        ini = a < b ? a : b; fim = a < b ? b : a;
        // sem override → backend decide pelo range
    } else {
        ini = new Date(h.getFullYear(), h.getMonth()-1, h.getDate());
        fim = h;
    }

    const di = _toISO(ini), df = _toISO(fim);
    let qs = `data_inicio=${di}&data_fim=${df}`;
    if (gran) qs += `&gran=${gran}`;

    try {
        const r = await window.apiFetch(`${API_COMPARATIVO}?${qs}`);
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || j.erro || "Erro");
        renderComparativos(j);
    } catch (e) {
        console.warn("Comparativos:", e);
    }
}

function renderComparativos(data) {
    const serie = data.serie || [];
    const labels = serie.map(s => s.label);
    const tel = serie.map(s => s.tel);
    const wpp = serie.map(s => s.wpp);
    const atend = serie.map(s => s.atendimentos);
    const marc = serie.map(s => s.marcacoes);
    const pac = serie.map(s => s.pacientes_novos);
    const txMarc = serie.map(s => s.tx_marcacao);
    const txCapt = serie.map(s => s.tx_captacao);

    const baseScales = (extra = {}) => ({
        x: { ticks: { color: "#96b7ff" }, grid: { display: false } },
        y: Object.assign({ ticks: { color: "#96b7ff" }, grid: { color: "#1a2a4a" }, beginAtZero: true, grace: "15%" }, extra)
    });
    const baseLayout = { padding: { top: 18 } };

    // Chart 1: Atendimentos por canal (barras lado a lado, com numeros)
    if (chartCompCanal) chartCompCanal.destroy();
    chartCompCanal = new Chart(document.getElementById("chartCompCanal"), {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Telefone", data: tel, backgroundColor: "#3a86ff", borderRadius: 4 },
                { label: "WhatsApp", data: wpp, backgroundColor: "#25d366", borderRadius: 4 }
            ]
        },
        options: {
            plugins: {
                legend: { labels: { color: "#c4dbff", font: { size: 11 } }, position: "top" },
                datalabels: {
                    color: "#fff", anchor: "end", align: "top", font: { size: 10, weight: 600 },
                    formatter: v => v > 0 ? v : ""
                }
            },
            scales: baseScales(), layout: baseLayout, maintainAspectRatio: false
        }
    });

    // Chart 2: Pipeline (3 lines com numeros)
    if (chartCompPipeline) chartCompPipeline.destroy();
    chartCompPipeline = new Chart(document.getElementById("chartCompPipeline"), {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "Atendimentos", data: atend, borderColor: "#4cc9f0", backgroundColor: "rgba(76,201,240,0.10)", fill: true, tension: 0.25, pointRadius: 3, borderWidth: 2 },
                { label: "Marcações", data: marc, borderColor: "#f2c94c", backgroundColor: "rgba(242,201,76,0.10)", fill: false, tension: 0.25, pointRadius: 3, borderWidth: 2 },
                { label: "Pacientes novos", data: pac, borderColor: "#2ecc71", backgroundColor: "rgba(46,204,113,0.10)", fill: false, tension: 0.25, pointRadius: 3, borderWidth: 2 }
            ]
        },
        options: {
            plugins: {
                legend: { labels: { color: "#c4dbff", font: { size: 11 } }, position: "top" },
                datalabels: {
                    color: ctx => ctx.dataset.borderColor, anchor: "end", align: "top",
                    font: { size: 10, weight: 600 },
                    formatter: v => v > 0 ? v : ""
                }
            },
            scales: baseScales(), layout: baseLayout, maintainAspectRatio: false
        }
    });

    // Chart 3: Taxas (com numeros visiveis sempre)
    if (chartCompTaxas) chartCompTaxas.destroy();
    chartCompTaxas = new Chart(document.getElementById("chartCompTaxas"), {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "% atend → marcação", data: txMarc, borderColor: "#f2c94c", backgroundColor: "rgba(242,201,76,0.12)", fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2 },
                { label: "% atend → paciente novo", data: txCapt, borderColor: "#2ecc71", backgroundColor: "rgba(46,204,113,0.12)", fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2 }
            ]
        },
        options: {
            plugins: {
                legend: { labels: { color: "#c4dbff", font: { size: 11 } }, position: "top" },
                datalabels: {
                    color: ctx => ctx.dataset.borderColor, anchor: "end", align: "top",
                    font: { size: 10, weight: 600 },
                    formatter: v => v > 0 ? v + "%" : ""
                }
            },
            scales: baseScales({ ticks: { color: "#96b7ff", callback: v => v + "%" } }), layout: baseLayout, maintainAspectRatio: false
        }
    });

    // Resumo
    const t = data.totais || {};
    const granLabel = { dia: "dia a dia", semana: "por semana", mes: "mês a mês" }[data.granularidade] || data.granularidade;
    document.getElementById("compResumo").innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
            <div style="font-size:11px;color:#96b7ff;">Granularidade: <b style="color:#c4dbff;">${granLabel}</b> (${serie.length} ${serie.length>1?'pontos':'ponto'})</div>
            <div><b style="color:#3a86ff;">Tel:</b> ${(t.tel||0).toLocaleString("pt-BR")}</div>
            <div><b style="color:#25d366;">WPP:</b> ${(t.wpp||0).toLocaleString("pt-BR")}</div>
            <div><b style="color:#4cc9f0;">Atendimentos:</b> ${(t.atendimentos||0).toLocaleString("pt-BR")}</div>
            <div><b style="color:#f2c94c;">Marcações:</b> ${(t.marcacoes||0).toLocaleString("pt-BR")} <span style="color:#666;">(${t.tx_marcacao||0}%)</span></div>
            <div><b style="color:#2ecc71;">Pacientes novos:</b> ${(t.pacientes_novos||0).toLocaleString("pt-BR")} <span style="color:#666;">(${t.tx_captacao||0}%)</span></div>
        </div>
    `;
}
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
    "192.168.0.196":{host:"RAC",ramal:"2050",setor:"marcacao"},"192.168.0.217":{host:"RAC2",ramal:"2050",setor:"marcacao"},
};
function getRamaisCustom() { try { const r = localStorage.getItem(ST_RAMAIS); if (r) return JSON.parse(r); } catch(e) {} return {}; }

async function carregarTimeline() {
    const data = el.timelineData.value; if (!data) return;
    el.timelineConteudo.innerHTML = '<div style="color:#96b7ff;padding:20px;text-align:center;">Carregando timeline...</div>';
    try {
        const res = await window.apiFetch(`${API_TIMELINE}?data=${data}`); const json = await res.json();
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

    // Ocultos — gerenciar dentro da timeline
    const ocDiv = document.getElementById("ocultosMgmt");
    if (ocDiv) {
        const oc = getOc();
        if (oc.length) {
            ocDiv.innerHTML = `<div style="font-size:11px;color:#96b7ff;">Ocultos no ranking: ${oc.map(s=>`<button class="btn-restaurar" onclick="toggleOc('${s}')">${s} ✕</button>`).join(' ')}</div>`;
        } else {
            ocDiv.innerHTML = '';
        }
    }

    document.querySelectorAll(".ramal-inline").forEach(input => { input.addEventListener("change", () => {
        const ip = input.dataset.ip, val = input.value.trim(), c = getRamaisCustom(), pad = (MAPA_PADRAO[ip]||{}).ramal||'';
        if (val && val !== pad) { c[ip] = val; input.style.borderColor = '#f2c94c'; } else { delete c[ip]; input.style.borderColor = '#2f4f9c'; }
        localStorage.setItem(ST_RAMAIS, JSON.stringify(c)); enviarMapaERecarregar();
    }); });
}

let _recarregarTimer = null;
function enviarMapaERecarregar() { if (_recarregarTimer) clearTimeout(_recarregarTimer); _recarregarTimer = setTimeout(() => { showSt("Recalculando...", "info"); carregarProd(); setTimeout(hideSt, 2000); }, 1000); }
