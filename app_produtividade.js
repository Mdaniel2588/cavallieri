/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PRODUTIVIDADE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";
const API_DIARIO        = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/diario";

const OCTA_KLINIKI_MAP = {
    "Claudio Maximiano": "CMGJ", "Julia Chaves": "JSC", "Maria D Sousa": "MDS",
    "Rosangela Alcantara Lima": "RAL", "Rosangela Tavares": "RDT", "Vanessa Waeger": "VS",
    "Jane Sousa": "JSL", "Gessica Oliveira": "GOS", "Rose Martins": "RGM",
    "Claudia Barbosa": "DUDU", "Diana Anchieta": "DC", "Nelia de Abreu Silva": "RAS",
    "Cristialine Silva": "CJS", "Renata Aquino": "RAC", "Dayane": "DSR",
    "CLINICA CAVALLIERI": null, "Enfermagem Cavallieri": null
};

const STORAGE_SETORES = "cavalieri_setores";
const STORAGE_OCULTOS = "cavalieri_ocultos";
const STORAGE_ESCONDER_MEDICOS = "cavalieri_esconder_medicos";

let prodData = null;
let prodRefreshTimer = null;
let chartProdRanking = null;
let chartProdWhats = null;
const prodElements = {};

// ── Helpers ───────────────────────────────────────────────────────────

function formatSeg(seg) {
    if (!seg) return '-';
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return min > 0 ? `${min}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

function getSetoresConfig() {
    try { const r = window.localStorage.getItem(STORAGE_SETORES); if (r) return JSON.parse(r); } catch (e) {}
    return {};
}
function salvarSetores(s) { window.localStorage.setItem(STORAGE_SETORES, JSON.stringify(s)); }

function getOcultos() {
    try { const r = window.localStorage.getItem(STORAGE_OCULTOS); if (r) return JSON.parse(r); } catch (e) {}
    return [];
}
function salvarOcultos(arr) { window.localStorage.setItem(STORAGE_OCULTOS, JSON.stringify(arr)); }

function getMedicosEscondidos() { return window.localStorage.getItem(STORAGE_ESCONDER_MEDICOS) === "1"; }
function salvarMedicosEscondidos(v) { window.localStorage.setItem(STORAGE_ESCONDER_MEDICOS, v ? "1" : "0"); }

function classUsuario(u) {
    const cfg = getSetoresConfig();
    if (cfg[u.usuario]) return cfg[u.usuario];
    const cargo = (u.cargo || "").toUpperCase();
    const setor = (u.setor || "").toUpperCase();
    if (cargo.indexOf("MEDIC") >= 0 || cargo.indexOf("DRA") >= 0 || cargo.indexOf("DR ") >= 0) return "medico";
    if (cargo.indexOf("INFORM") >= 0) return "ti";
    if (setor.indexOf("RECEP") >= 0 || cargo.indexOf("ATENDENTE") >= 0) {
        if ((u.agendamentos || 0) > (u.cadastros_paciente || 0)) return "marcacao";
        return "recepcao";
    }
    if ((u.agendamentos || 0) > 0 && (u.cadastros_paciente || 0) === 0) return "marcacao";
    if ((u.cadastros_paciente || 0) > 0) return "recepcao";
    if ((u.laudos_digitados || 0) > 0) return "medico";
    return "outro";
}

function isAtendente(u) { const t = classUsuario(u); return t === "marcacao" || t === "recepcao"; }
function isMarcacao(u) { return classUsuario(u) === "marcacao"; }
function isRecepcao(u) { return classUsuario(u) === "recepcao"; }
function isMedico(u) { return classUsuario(u) === "medico"; }

function buildOctaPorSigla(octadesk) {
    const r = {};
    for (const a of octadesk) { const s = OCTA_KLINIKI_MAP[a.agente]; if (s) r[s] = a; }
    return r;
}

function isHoje() {
    const h = new Date();
    return prodElements.anoProd.value == h.getFullYear() && prodElements.mesProd.value == (h.getMonth() + 1);
}

function isOculto(sigla) { return getOcultos().indexOf(sigla) >= 0; }

function toggleOculto(sigla) {
    const arr = getOcultos();
    const idx = arr.indexOf(sigla);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(sigla);
    salvarOcultos(arr);
    renderProdutividade();
}

// ── Init ──────────────────────────────────────────────────────────────

function initProdutividade() {
    prodElements.section       = document.getElementById("secaoProdutividade");
    prodElements.anoProd       = document.getElementById("anoProd");
    prodElements.mesProd       = document.getElementById("mesProd");
    prodElements.btnAtualizar  = document.getElementById("btnAtualizarProd");
    prodElements.btnHoje       = document.getElementById("btnHojeProd");
    prodElements.tabela        = document.getElementById("tabelaProd");
    prodElements.cardTelefone  = document.getElementById("cardTelefone");
    prodElements.cardWhatsapp  = document.getElementById("cardWhatsapp");
    prodElements.cardConsolid  = document.getElementById("cardConsolidado");
    prodElements.chartRanking  = document.getElementById("chartRankingProd");
    prodElements.chartWhatsProd = document.getElementById("chartWhatsProd");
    prodElements.statusProd    = document.getElementById("statusProd");

    if (!prodElements.section) return;

    preencherFiltrosProd();
    prodElements.btnAtualizar.addEventListener("click", carregarProdutividade);
    prodElements.anoProd.addEventListener("change", carregarProdutividade);
    prodElements.mesProd.addEventListener("change", carregarProdutividade);
    if (prodElements.btnHoje) {
        prodElements.btnHoje.addEventListener("click", () => {
            const h = new Date();
            prodElements.anoProd.value = h.getFullYear();
            prodElements.mesProd.value = h.getMonth() + 1;
            carregarProdutividade();
            iniciarAutoRefresh();
        });
    }
}

function preencherFiltrosProd() {
    const h = new Date();
    for (let a = h.getFullYear(); a >= h.getFullYear() - 3; a--) {
        const o = document.createElement("option"); o.value = a; o.textContent = a;
        prodElements.anoProd.appendChild(o);
    }
    ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
        .forEach((m, i) => { const o = document.createElement("option"); o.value = i+1; o.textContent = m; prodElements.mesProd.appendChild(o); });
    prodElements.anoProd.value = h.getFullYear();
    prodElements.mesProd.value = h.getMonth() + 1;
}

function iniciarAutoRefresh() {
    if (prodRefreshTimer) clearInterval(prodRefreshTimer);
    prodRefreshTimer = setInterval(() => {
        if (isHoje()) carregarProdutividade();
        else { clearInterval(prodRefreshTimer); prodRefreshTimer = null; }
    }, 120000);
}

async function carregarProdutividade() {
    const ano = prodElements.anoProd.value;
    const mes = prodElements.mesProd.value;
    showProdStatus("Carregando...", "info");
    try {
        const res = await fetch(`${API_PRODUTIVIDADE}?ano=${ano}&mes=${mes}&com_3cx=1&com_octa=1`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.erro || "Erro");
        prodData = json.data;
        renderProdutividade();
        hideProdStatus();
        if (isHoje()) { showProdStatus("Realtime — atualiza a cada 2 min", "info"); setTimeout(hideProdStatus, 3000); }
    } catch (err) { showProdStatus("Falha: " + err.message, "error"); }
}

function showProdStatus(msg, type) {
    if (!prodElements.statusProd) return;
    prodElements.statusProd.hidden = false;
    prodElements.statusProd.className = `status-banner ${type}`;
    prodElements.statusProd.textContent = msg;
}
function hideProdStatus() { if (prodElements.statusProd) prodElements.statusProd.hidden = true; }

// ── Render ────────────────────────────────────────────────────────────

function renderProdutividade() {
    if (!prodData) return;
    const usuarios = prodData.usuarios || [];
    const ligacoes = prodData.ligacoes || [];
    const octadesk = prodData.octadesk || [];
    const octaPorSigla = buildOctaPorSigla(octadesk);

    renderCards(usuarios, ligacoes, octadesk);
    renderTabelas(usuarios, octaPorSigla);
    renderChartRanking(usuarios, octaPorSigla);
    renderChartWhatsapp(octadesk);
}

// ── Cards ─────────────────────────────────────────────────────────────

function renderCards(usuarios, ligacoes, octadesk) {
    const totalAtend = ligacoes.reduce((s, l) => s + (l.atendidas || 0), 0);
    prodElements.cardTelefone.innerHTML = totalAtend
        ? `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div>
           <div class="prod-card-big">${totalAtend}</div><div class="prod-card-label">Ligacoes Atendidas</div>`
        : `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div>
           <div class="prod-card-big" style="font-size:16px;color:#96b7ff;">Sem dados</div>`;

    const totalChats = octadesk.reduce((s, a) => s + (a.total || 0), 0);
    prodElements.cardWhatsapp.innerHTML = `<div class="prod-card-icon">&#128172;</div><div class="prod-card-title">WHATSAPP</div>
        <div class="prod-card-big">${totalChats}</div><div class="prod-card-label">Conversas</div>`;

    const atend = usuarios.filter(isAtendente);
    const totalAg = atend.reduce((s, u) => s + (u.agendamentos || 0), 0);
    const totalCad = atend.reduce((s, u) => s + (u.cadastros_paciente || 0), 0);
    prodElements.cardConsolid.innerHTML = `<div class="prod-card-icon">&#128200;</div><div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${totalAg}</div><div class="prod-card-label">Agendamentos</div>
        <div class="prod-card-sub">Cadastros: ${totalCad} | Online: ${prodData.resultados_online || 0}</div>`;
}

// ── Tabelas ───────────────────────────────────────────────────────────

function renderTabelas(usuarios, octaPorSigla) {
    if (!prodElements.tabela) return;
    const ocultos = getOcultos();
    let html = "";

    // ── MARCACAO ──
    const marc = usuarios
        .filter(u => isMarcacao(u) && !isOculto(u.usuario) && ((u.agendamentos || 0) > 0 || (u.ligacoes_atendidas || 0) > 0))
        .map(u => {
            const wpp = (octaPorSigla[u.usuario] || {}).total || 0;
            const outros = (u.entregas_arquivo || 0) + (u.emails_laudo || 0) + (u.emails_enviados || 0);
            const total = (u.agendamentos || 0) + (u.ligacoes_atendidas || 0) + wpp + outros;
            return { ...u, wpp, outros, total };
        }).sort((a, b) => b.total - a.total);

    html += `<div class="prod-section-title">MARCACAO</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th>
        <th>Agend.</th><th>Ligacoes</th><th>T.Med Lig.</th>
        <th>WhatsApp</th><th>Outros</th><th>TOTAL</th><th></th>
    </tr></thead><tbody>`;
    let pos = 1;
    for (const u of marc) {
        html += `<tr>
            <td class="rank-cell">${pos++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="num-cell">${u.agendamentos || 0}</td>
            <td class="num-cell">${u.ligacoes_atendidas || '-'}</td>
            <td class="num-cell">${formatSeg(u.tempo_conversa_medio)}</td>
            <td class="num-cell">${u.wpp || '-'}</td>
            <td class="num-cell">${u.outros || '-'}</td>
            <td class="num-cell total-cell">${u.total}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tMAg = marc.reduce((s, u) => s + (u.agendamentos || 0), 0);
    const tMLig = marc.reduce((s, u) => s + (u.ligacoes_atendidas || 0), 0);
    const tMWpp = marc.reduce((s, u) => s + u.wpp, 0);
    const tMTot = marc.reduce((s, u) => s + u.total, 0);
    html += `<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${tMAg}</td><td class="num-cell">${tMLig || '-'}</td><td></td>
        <td class="num-cell">${tMWpp || '-'}</td><td></td><td class="num-cell total-cell">${tMTot}</td><td></td>
    </tr></tbody></table>`;

    // ── RECEPCAO ──
    const recep = usuarios
        .filter(u => isRecepcao(u) && !isOculto(u.usuario) && ((u.cadastros_paciente || 0) > 0))
        .map(u => {
            const outros = (u.entregas_arquivo || 0) + (u.emails_laudo || 0) + (u.emails_enviados || 0);
            const total = (u.cadastros_paciente || 0) + outros;
            return { ...u, outros, total };
        }).sort((a, b) => b.total - a.total);

    html += `<div class="prod-section-title">RECEPCAO</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th>
        <th>Cadastros</th><th>Entregas</th><th>Emails</th><th>TOTAL</th><th></th>
    </tr></thead><tbody>`;
    pos = 1;
    for (const u of recep) {
        html += `<tr>
            <td class="rank-cell">${pos++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="num-cell">${u.cadastros_paciente || 0}</td>
            <td class="num-cell">${u.entregas_arquivo || 0}</td>
            <td class="num-cell">${(u.emails_laudo || 0) + (u.emails_enviados || 0)}</td>
            <td class="num-cell total-cell">${u.total}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tRTot = recep.reduce((s, u) => s + u.total, 0);
    html += `<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${recep.reduce((s,u)=>s+(u.cadastros_paciente||0),0)}</td><td></td><td></td>
        <td class="num-cell total-cell">${tRTot}</td><td></td>
    </tr></tbody></table>`;

    // ── MEDICOS (escondível) ──
    const esconderMed = getMedicosEscondidos();
    html += `<div class="prod-section-title" style="display:flex;justify-content:space-between;align-items:center;">
        MEDICOS / LAUDO
        <label style="font-size:11px;font-weight:normal;color:#96b7ff;cursor:pointer;">
            <input type="checkbox" id="chkEsconderMedicos" ${esconderMed ? 'checked' : ''} onchange="salvarMedicosEscondidos(this.checked);renderProdutividade();" /> Esconder
        </label>
    </div>`;

    if (!esconderMed) {
        const medicos = usuarios.filter(u => isMedico(u) && (u.laudos_digitados || 0) > 0)
            .sort((a, b) => (b.laudos_digitados || 0) - (a.laudos_digitados || 0));
        if (medicos.length) {
            html += `<table class="prod-table"><thead><tr>
                <th>Sigla</th><th>Nome</th><th>Laudos</th><th>Liberados</th><th>Emails</th><th>Capturas</th>
            </tr></thead><tbody>`;
            for (const u of medicos) {
                html += `<tr>
                    <td style="font-weight:bold;">${u.usuario}</td>
                    <td style="text-align:left;">${u.nome || '-'}</td>
                    <td class="num-cell">${u.laudos_digitados || 0}</td>
                    <td class="num-cell">${u.laudos_liberados || 0}</td>
                    <td class="num-cell">${(u.emails_laudo || 0) + (u.emails_enviados || 0)}</td>
                    <td class="num-cell">${u.capturas || 0}</td>
                </tr>`;
            }
            html += "</tbody></table>";
        }
    }

    // ── Usuarios ocultos (restaurar) ──
    if (ocultos.length) {
        html += `<div style="margin-top:12px;padding:8px;font-size:11px;color:#96b7ff;">
            Ocultos: ${ocultos.map(s => `<button class="btn-restaurar" onclick="toggleOculto('${s}')">${s}</button>`).join(' ')}
        </div>`;
    }

    prodElements.tabela.innerHTML = html;
}

// ── Chart: Ranking ────────────────────────────────────────────────────

function renderChartRanking(usuarios, octaPorSigla) {
    const atendentes = usuarios.filter(u => isAtendente(u) && !isOculto(u.usuario))
        .map(u => {
            const wpp = (octaPorSigla[u.usuario] || {}).total || 0;
            const lig = u.ligacoes_atendidas || 0;
            const ag = u.agendamentos || 0;
            const cad = u.cadastros_paciente || 0;
            const outros = (u.entregas_arquivo || 0) + (u.emails_laudo || 0) + (u.emails_enviados || 0);
            const total = ag + cad + lig + wpp + outros;
            return { ...u, wpp, lig, ag, cad, outros, total };
        })
        .filter(u => u.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

    if (chartProdRanking) chartProdRanking.destroy();

    chartProdRanking = new Chart(prodElements.chartRanking, {
        type: "bar",
        data: {
            labels: atendentes.map(u => u.usuario),
            datasets: [
                { label: "Agendamentos", data: atendentes.map(u => u.ag), backgroundColor: "#3a86ff" },
                { label: "Cadastros", data: atendentes.map(u => u.cad), backgroundColor: "#4cc9f0" },
                { label: "Ligacoes", data: atendentes.map(u => u.lig), backgroundColor: "#f2c94c" },
                { label: "WhatsApp", data: atendentes.map(u => u.wpp), backgroundColor: "#25d366" },
                { label: "Outros", data: atendentes.map(u => u.outros), backgroundColor: "#9b59b6" }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 10, font: { size: 11 } } },
                datalabels: { display: false }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}

// ── Chart: WhatsApp ───────────────────────────────────────────────────

function renderChartWhatsapp(octadesk) {
    if (!octadesk.length) { if (chartProdWhats) chartProdWhats.destroy(); return; }

    const sorted = octadesk.filter(a => a.agente !== "SEM AGENTE" && a.agente !== "CLINICA CAVALLIERI" && a.agente !== "Enfermagem Cavallieri")
        .sort((a, b) => b.total - a.total);

    if (chartProdWhats) chartProdWhats.destroy();
    chartProdWhats = new Chart(prodElements.chartWhatsProd, {
        type: "bar",
        data: {
            labels: sorted.map(a => { const s = OCTA_KLINIKI_MAP[a.agente]; return s ? `${s} (${a.agente.split(" ")[0]})` : a.agente; }),
            datasets: [
                { label: "Recebidos", data: sorted.map(a => a.inbound || 0), backgroundColor: "#25d366" },
                { label: "Enviados", data: sorted.map(a => a.outbound || 0), backgroundColor: "#128c7e" }
            ]
        },
        options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 10 } },
                datalabels: { color: "#fff", font: { size: 9, weight: "bold" } }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}
