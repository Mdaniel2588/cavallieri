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
    el.tabMarc = document.getElementById("tabMarcacao");
    el.tabRecep = document.getElementById("tabRecepcao");
    el.panelMarc = document.getElementById("panelMarcacao");
    el.panelRecep = document.getElementById("panelRecepcao");
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

    el.btnHoje.addEventListener("click", () => setPeriodo("hoje"));
    el.btnSemana.addEventListener("click", () => setPeriodo("semana"));
    el.btnMes.addEventListener("click", () => setPeriodo("mes"));
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
    el.panelMarc.style.display = tab==="marc" ? "" : "none";
    el.panelRecep.style.display = tab==="recep" ? "" : "none";
    // Redesenhar gráfico da aba ativa
    if (prodData) renderChart();
}

function setPeriodo(p) {
    prodPeriodo = p;
    if(prodTimer){clearInterval(prodTimer);prodTimer=null;}
    el.btnHoje.classList.toggle("active", p==="hoje");
    el.btnSemana.classList.toggle("active", p==="semana");
    el.btnMes.classList.toggle("active", p==="mes");
    carregarProd();
    if (p === "hoje") prodTimer = setInterval(carregarProd, 120000);
}

async function carregarProd() {
    const ano=el.ano.value, mes=el.mes.value;
    const url = `${API_PROD}?ano=${ano}&mes=${mes}&periodo=${prodPeriodo}&com_3cx=1`;
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

    renderCards(marc, recep, octa);
    renderMarcacao(marc, octaMap);
    renderRecepcao(recep);
    renderChart();
    renderChartWpp(octa);
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    const periodo = prodData.periodo || prodPeriodo;
    const label = periodo==="hoje" ? "Hoje" : (periodo==="semana" ? "Semana" : "Mes");

    el.cardTel.innerHTML = tLig
        ? `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE ${label}</div><div class="prod-card-big">${tLig}</div><div class="prod-card-label">Ligacoes Atendidas</div>`
        : `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE ${label}</div><div class="prod-card-big" style="font-size:16px;color:#96b7ff;">-</div>`;

    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    el.cardWpp.innerHTML = `<div class="prod-card-icon">&#128172;</div><div class="prod-card-title">WHATSAPP ${label}</div><div class="prod-card-big">${tWpp}</div><div class="prod-card-label">Conversas</div>`;

    const tMa = marc.reduce((s,u)=>s+(u.marcacoes||0),0);
    const tAd = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    el.cardCon.innerHTML = `<div class="prod-card-icon">&#128200;</div><div class="prod-card-title">CONSOLIDADO ${label}</div>
        <div class="prod-card-big">${tMa}</div><div class="prod-card-label">Marcacoes</div>
        <div class="prod-card-sub">Admissoes: ${tAd}</div>`;
}

function renderMarcacao(marc, octaMap) {
    if (!el.panelMarc) return;
    const lista = marc.filter(u => !isOc(u.usuario) && ((u.marcacoes||0)+(u.ligacoes||0)>0))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total||0;
            const total = (u.marcacoes||0)+(u.ligacoes||0)+wpp;
            return {...u, wpp, total};
        }).sort((a,b)=>b.total-a.total);

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th>
        <th>Marcacoes</th><th>Ligacoes</th><th>T.Med Lig</th><th>WhatsApp</th><th>T.Med Wpp</th><th>TOTAL</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        const octaInfo = octaMap[u.usuario];
        const tMedWpp = octaInfo && octaInfo.tempo_medio ? fmt(octaInfo.tempo_medio) : '-';
        h+=`<tr><td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;">${u.usuario}</td><td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell">${u.marcacoes||0}</td><td class="num-cell">${u.ligacoes||'-'}</td>
            <td class="num-cell">${fmt(u.tempo_medio_lig)}</td><td class="num-cell">${u.wpp||'-'}</td>
            <td class="num-cell">${tMedWpp}</td>
            <td class="num-cell total-cell">${u.total}</td>
            <td><button class="btn-ocultar" onclick="toggleOc('${u.usuario}')">x</button></td></tr>`;
    }
    const tM=lista.reduce((s,u)=>s+(u.marcacoes||0),0);
    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0);
    const tW=lista.reduce((s,u)=>s+u.wpp,0);
    const tT=lista.reduce((s,u)=>s+u.total,0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${tM}</td><td class="num-cell">${tL||'-'}</td><td></td>
        <td class="num-cell">${tW||'-'}</td><td></td><td class="num-cell total-cell">${tT}</td><td></td></tr></tbody></table>`;

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
