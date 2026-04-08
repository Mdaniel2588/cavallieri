/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PROD = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";

const OCTA_MAP = {
    "Claudio Maximiano":"CMGJ","Julia Chaves":"JSC","Maria D Sousa":"MDS",
    "Rosangela Alcantara Lima":"RAL","Rosangela Tavares":"RDT","Vanessa Waeger":"VS",
    "Jane Sousa":"JSL","Gessica Oliveira":"GOS","Rose Martins":"RGM",
    "Claudia Barbosa":"DUDU","Diana Anchieta":"DC","Nelia de Abreu Silva":"RAS",
    "Cristialine Silva":"CJS","Renata Aquino":"RAC","Dayane":"DSR"
};

const ST_OC = "cavalieri_ocultos";
let prodData = null;
let prodPeriodo = "hoje";
let prodTimer = null;
let chartMarc = null;
let chartRecep = null;
let chartWpp = null;
const el = {};

const fmt = s => { if(!s) return '-'; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m${String(r).padStart(2,'0')}s`:`${r}s`; };
const getOc = () => { try{return JSON.parse(localStorage.getItem(ST_OC))||[];}catch(e){return[];} };
const isOc = s => getOc().indexOf(s)>=0;
function toggleOc(s){const a=getOc();const i=a.indexOf(s);if(i>=0)a.splice(i,1);else a.push(s);localStorage.setItem(ST_OC,JSON.stringify(a));renderProd();}
function buildOcta(o){const r={};for(const a of(o||[])){const s=OCTA_MAP[a.agente];if(s)r[s]={total:a.total||0,inbound:a.inbound||0,outbound:a.outbound||0,tempo_medio:a.tempo_medio||0};}return r;}

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

    // Timeline
    el.timelineData.value = new Date().toISOString().slice(0,10);
    el.btnTimelineCarregar.addEventListener("click", carregarTimeline);

    el.btnHoje.addEventListener("click", () => setPeriodo("hoje"));
    el.btnSemana.addEventListener("click", () => setPeriodo("semana"));
    el.btnMes.addEventListener("click", () => setPeriodo("mes"));
    el.btnAno.addEventListener("click", () => setPeriodo("ano"));
    el.ano.addEventListener("change", () => setPeriodo("mes"));
    el.mes.addEventListener("change", () => setPeriodo("mes"));

    // Auto-load HOJE
    setPeriodo("hoje");
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
    el.btnHoje.classList.toggle("active", p==="hoje");
    el.btnSemana.classList.toggle("active", p==="semana");
    el.btnMes.classList.toggle("active", p==="mes");
    el.btnAno.classList.toggle("active", p==="ano");
    carregarProd();
    if (p === "hoje") prodTimer = setInterval(carregarProd, 120000);
}

async function carregarProd() {
    const ano=el.ano.value, mes=el.mes.value;
    // Montar mapa customizado como query param
    const custom = getRamaisCustom();
    const mapaParam = Object.keys(custom).length ? '&mapa=' + encodeURIComponent(JSON.stringify(custom)) : '';
    const url = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${prodPeriodo}&com_3cx=1${mapaParam}`;
    const urlOcta = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${prodPeriodo}&com_octa=1`;

    showSt("Carregando...", "info");
    try {
        // Kliniki+3CX primeiro (rápido)
        const r1 = await fetch(url);
        const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro||"Erro");
        prodData = j1.data;
        renderProd();
        hideSt();
        if(prodPeriodo==="hoje"){showSt("HOJE realtime — atualiza a cada 2 min","info");setTimeout(hideSt,3000);}

        // OctaDesk em background (não bloqueia)
        fetch(urlOcta).then(r=>r.json()).then(j2=>{
            if(j2.ok&&j2.data&&j2.data.octadesk){prodData.octadesk=j2.data.octadesk;renderProd();}
        }).catch(()=>{});
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
    const meses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const p = prodData.periodo || prodPeriodo;
    const ano = prodData.ano;
    const mes = prodData.mes;
    let txt = "PRODUTIVIDADE";
    if (p === "hoje") {
        const h = new Date();
        txt = `PRODUTIVIDADE | HOJE ${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${h.getFullYear()} (REALTIME)`;
    } else if (p === "semana") {
        txt = `PRODUTIVIDADE | SEMANA CORRENTE`;
    } else if (p === "mes") {
        txt = `PRODUTIVIDADE | ${meses[mes] || ''} ${ano}`;
    } else if (p === "ano") {
        txt = `PRODUTIVIDADE | ANO ${ano}`;
    }
    titulo.textContent = txt;
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    const periodo = prodData.periodo || prodPeriodo;
    const labels = {"hoje":"Hoje","semana":"Semana","mes":"Mes","ano":"Ano"};
    const label = labels[periodo] || "Mes";

    el.cardTel.innerHTML = tLig
        ? `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE ${label}</div><div class="prod-card-big">${tLig}</div><div class="prod-card-label">Ligacoes Atendidas</div>`
        : `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE ${label}</div><div class="prod-card-big" style="font-size:16px;color:#96b7ff;">-</div>`;

    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    el.cardWpp.innerHTML = `<div class="prod-card-icon">&#128172;</div><div class="prod-card-title">WHATSAPP ${label}</div><div class="prod-card-big">${tWpp}</div><div class="prod-card-label">Conversas</div>`;

    const tMa = marc.reduce((s,u)=>s+(u.marcacoes||0),0);
    const tAd = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    const tAtend = tLig + tWpp;
    el.cardCon.innerHTML = `<div class="prod-card-icon">&#128200;</div><div class="prod-card-title">CONSOLIDADO ${label}</div>
        <div class="prod-card-big">${tAtend}</div><div class="prod-card-label">Atendimentos</div>
        <div class="prod-card-sub">Marcacoes: ${tMa} | Admissoes: ${tAd}</div>`;
}

function renderMarcacao(marc, octaMap) {
    if (!el.panelMarc) return;
    const lista = marc.filter(u => !isOc(u.usuario) && ((u.marcacoes||0)+(u.ligacoes||0)>0))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total||0;
            const atendimentos = (u.ligacoes||0)+wpp;
            const total = atendimentos + (u.marcacoes||0);
            return {...u, wpp, atendimentos, total};
        }).sort((a,b)=>b.atendimentos-a.atendimentos);

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th>
        <th>Ligacoes</th><th>T.Med Lig</th><th>WhatsApp</th><th>T.Med Wpp</th>
        <th>ATENDIMENTOS</th><th>Marcacoes</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        const octaInfo = octaMap[u.usuario];
        const tMedWpp = octaInfo && octaInfo.tempo_medio ? fmt(octaInfo.tempo_medio) : '-';
        const atendimentos = (u.ligacoes||0) + u.wpp;
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell">${u.ligacoes||'-'}</td>
            <td class="num-cell">${fmt(u.tempo_medio_lig)}</td>
            <td class="num-cell">${u.wpp||'-'}</td>
            <td class="num-cell">${tMedWpp}</td>
            <td class="num-cell total-cell">${atendimentos||'-'}</td>
            <td class="num-cell">${u.marcacoes||0}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')">x</button></td></tr>`;
    }
    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0);
    const tW=lista.reduce((s,u)=>s+u.wpp,0);
    const tAtend=tL+tW;
    const tM=lista.reduce((s,u)=>s+(u.marcacoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${tL||'-'}</td><td></td>
        <td class="num-cell">${tW||'-'}</td><td></td>
        <td class="num-cell total-cell">${tAtend}</td>
        <td class="num-cell">${tM}</td><td></td></tr></tbody></table>`;

    const oc=getOc();
    if(oc.length) h+=`<div style="margin-top:8px;font-size:11px;color:#96b7ff;">Ocultos: ${oc.map(s=>`<button class="btn-restaurar" onclick="toggleOc('${s}')">${s}</button>`).join(' ')}</div>`;
    el.panelMarc.innerHTML = h;
}

function renderRecepcao(recep) {
    if (!el.panelRecep) return;
    const lista = recep.filter(u => !isOc(u.usuario) && (u.admissoes||0)>0)
        .sort((a,b)=>(b.admissoes||0)-(a.admissoes||0));

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th><th>Admissoes</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell total-cell">${u.admissoes||0}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')">x</button></td></tr>`;
    }
    const tA=lista.reduce((s,u)=>s+(u.admissoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell total-cell">${tA}</td><td></td></tr></tbody></table>`;
    el.panelRecep.innerHTML = h;
}

function renderChart() {
    const titulo = document.getElementById("tituloChartRank");
    if (currentTab === "marc") {
        if (titulo) titulo.textContent = "Ranking Marcacao";
        renderChartMarc();
    } else {
        if (titulo) titulo.textContent = "Ranking Recepcao";
        renderChartRecep();
    }
}

function renderChartMarc() {
    const octaMap = buildOcta(prodData.octadesk || []);
    const marc = (prodData.marcacao||[]).filter(u=>!isOc(u.usuario))
        .map(u=>{const w=(octaMap[u.usuario]||{}).total||0;return{...u,wpp:w,total:(u.marcacoes||0)+(u.ligacoes||0)+w};})
        .filter(u=>u.total>0).sort((a,b)=>b.total-a.total).slice(0,12);

    if(chartMarc)chartMarc.destroy();
    if(chartRecep){chartRecep.destroy();chartRecep=null;}

    chartMarc = new Chart(el.chartRank, {
        type:"bar",
        data:{labels:marc.map(u=>u.usuario),datasets:[
            {label:"Marcacoes",data:marc.map(u=>u.marcacoes||0),backgroundColor:"#3a86ff"},
            {label:"Ligacoes",data:marc.map(u=>u.ligacoes||0),backgroundColor:"#f2c94c"},
            {label:"WhatsApp",data:marc.map(u=>u.wpp),backgroundColor:"#25d366"}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{display:false}},
            scales:{x:{stacked:true,ticks:{color:"#fff"},grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{color:"#aaa"},grid:{color:"rgba(255,255,255,0.1)"}}}
        }
    });
}

function renderChartRecep() {
    const recep = (prodData.recepcao||[]).filter(u=>!isOc(u.usuario)&&(u.admissoes||0)>0)
        .sort((a,b)=>(b.admissoes||0)-(a.admissoes||0)).slice(0,12);

    if(chartRecep)chartRecep.destroy();
    if(chartMarc){chartMarc.destroy();chartMarc=null;}

    chartRecep = new Chart(el.chartRank, {
        type:"bar",
        data:{labels:recep.map(u=>u.usuario),datasets:[
            {label:"Admissoes",data:recep.map(u=>u.admissoes||0),backgroundColor:"#4cc9f0"}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",anchor:"end",align:"top",font:{size:10,weight:"bold"}}},
            scales:{x:{ticks:{color:"#fff"},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#aaa"},grid:{color:"rgba(255,255,255,0.1)"}}}
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
            scales:{x:{stacked:true,ticks:{color:"#aaa"},grid:{color:"rgba(255,255,255,0.1)"}},
                y:{stacked:true,ticks:{color:"#fff",font:{size:10}},grid:{display:false}}}}
    });
}

// ── Timeline ──────────────────────────────────────────────────────────

const API_TIMELINE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/timeline";
const ST_RAMAIS = "cavalieri_ramais_custom";

// Mapa padrão (vem do backend, mas editável no frontend)
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

function renderEditorRamais(mapaEstacoes) {
    const div = document.getElementById("editorRamais");
    if (!div) return;
    const mapa = mapaEstacoes || MAPA_PADRAO;
    const custom = getRamaisCustom();

    let h = `<table class="prod-table prod-table-sm"><thead><tr>
        <th>IP</th><th>Hostname</th><th>Setor</th><th>Ramal Padrao</th><th>Ramal Atual</th>
    </tr></thead><tbody>`;

    const ips = Object.keys(mapa).sort((a, b) => {
        const na = a.split('.').map(Number);
        const nb = b.split('.').map(Number);
        return na[3] - nb[3];
    });

    for (const ip of ips) {
        const info = mapa[ip] || {};
        const ramalPadrao = info.ramal || '-';
        const ramalAtual = custom[ip] || info.ramal || '';
        const isCustom = custom[ip] && custom[ip] !== info.ramal;

        h += `<tr${isCustom ? ' style="background:rgba(242,201,76,0.1);"' : ''}>
            <td style="font-weight:bold;">${ip}</td>
            <td>${info.host || ip}</td>
            <td><span class="timeline-setor-tag tag-${info.setor || 'outro'}">${(info.setor || 'outro').toUpperCase()}</span></td>
            <td class="num-cell">${ramalPadrao}</td>
            <td><input type="text" class="ramal-input" data-ip="${ip}" value="${ramalAtual}"
                style="width:60px;padding:4px;background:#0f1738;color:#fff;border:1px solid ${isCustom ? '#f2c94c' : '#3a86ff'};border-radius:4px;text-align:center;" /></td>
        </tr>`;
    }

    h += `</tbody></table>`;
    div.innerHTML = h;

    // Bind salvar/reset
    document.getElementById("btnSalvarRamais").onclick = () => {
        const custom = {};
        document.querySelectorAll(".ramal-input").forEach(input => {
            const ip = input.dataset.ip;
            const val = input.value.trim();
            const padrao = (mapa[ip] || {}).ramal || '';
            if (val && val !== padrao) custom[ip] = val;
        });
        localStorage.setItem(ST_RAMAIS, JSON.stringify(custom));
        renderEditorRamais(mapa);
        showSt("Ramais salvos! Recarregue os dados para aplicar.", "info");
        setTimeout(hideSt, 3000);
    };

    document.getElementById("btnResetRamais").onclick = () => {
        localStorage.removeItem(ST_RAMAIS);
        renderEditorRamais(mapa);
        showSt("Ramais resetados para padrao.", "info");
        setTimeout(hideSt, 3000);
    };
}

async function carregarTimeline() {
    const data = el.timelineData.value;
    if (!data) return;
    el.timelineConteudo.innerHTML = '<div style="color:#96b7ff;padding:10px;">Carregando timeline...</div>';

    try {
        const res = await fetch(`${API_TIMELINE}?data=${data}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.erro || "Erro");
        renderTimeline(json.timeline, json.nomes, json.mapa_estacoes, data);
    } catch (err) {
        el.timelineConteudo.innerHTML = `<div style="color:#ffb3c1;padding:10px;">Falha: ${err.message}</div>`;
    }
}

function renderTimeline(timeline, nomes, mapaBackend, data) {
    // Aplicar ramais customizados sobre o mapa do backend
    const custom = getRamaisCustom();
    const mapa = {};
    for (const ip in mapaBackend) {
        mapa[ip] = { ...mapaBackend[ip] };
        if (custom[ip]) mapa[ip].ramal = custom[ip];
    }
    // Aplicar custom nos dados da timeline
    for (const usr in timeline) {
        for (const s of timeline[usr]) {
            if (custom[s.ip]) s.ramal = custom[s.ip];
        }
    }
    // Bind reset ramais
    const btnReset = document.getElementById("btnResetRamais");
    if (btnReset) {
        btnReset.onclick = () => {
            localStorage.removeItem(ST_RAMAIS);
            carregarTimeline();
            carregarProd(prodPeriodo === "hoje");
            showSt("Ramais resetados.", "info"); setTimeout(hideSt, 2000);
        };
    }
    const usuarios = Object.keys(timeline).sort((a, b) => {
        const ha = timeline[a][0] ? timeline[a][0].hora : 'z';
        const hb = timeline[b][0] ? timeline[b][0].hora : 'z';
        return ha.localeCompare(hb);
    });

    // Filtrar só quem logou em marcação ou recepção
    const atendentes = usuarios.filter(usr => {
        return timeline[usr].some(s => s.setor === 'marcacao' || s.setor === 'recepcao');
    });

    const dataBr = data.split('-').reverse().join('/');

    let h = `<div style="color:#96b7ff;font-size:12px;margin-bottom:10px;">${dataBr} — ${atendentes.length} atendentes com atividade</div>`;

    for (const usr of atendentes) {
        const sessoes = timeline[usr];
        const nome = nomes[usr] || '';
        const primeiraHora = sessoes[0] ? sessoes[0].hora.substring(11, 16) : '';
        const ultimaHora = sessoes[sessoes.length - 1] ? sessoes[sessoes.length - 1].hora.substring(11, 16) : '';

        h += `<div class="timeline-user">`;
        h += `<div class="timeline-header">
            <span class="timeline-sigla">${usr}</span>
            <span class="timeline-nome">${nome}</span>
            <span style="color:#96b7ff;font-size:11px;">${primeiraHora} — ${ultimaHora} (${sessoes.length} sessoes)</span>
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

    // Outros (médicos, TI, etc)
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

    // Bind inline ramal edits — salva ao sair do campo
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
            // Atualizar backend com novo mapa e recarregar produtividade
            enviarMapaERecarregar();
        });
    });
}

let _recarregarTimer = null;
function enviarMapaERecarregar() {
    // Debounce — espera 1s após última edição
    if (_recarregarTimer) clearTimeout(_recarregarTimer);
    _recarregarTimer = setTimeout(() => {
        showSt("Ramal atualizado, recalculando...", "info");
        // Enviar mapa custom pro backend via query param
        carregarProd(prodPeriodo === "hoje");
        setTimeout(hideSt, 2000);
    }, 1000);
}
