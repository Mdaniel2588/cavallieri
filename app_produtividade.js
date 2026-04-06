/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PRODUTIVIDADE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";
const API_DIARIO        = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/diario";

let prodData = null;
let prodDiario = null;
let chartProdBar = null;
let chartProdPhone = null;
let chartProdWhats = null;

const prodElements = {};

// ── Init ──────────────────────────────────────────────────────────────

function initProdutividade() {
    prodElements.section       = document.getElementById("secaoProdutividade");
    prodElements.anoProd       = document.getElementById("anoProd");
    prodElements.mesProd       = document.getElementById("mesProd");
    prodElements.btnAtualizar  = document.getElementById("btnAtualizarProd");
    prodElements.tabela        = document.getElementById("tabelaProd");
    prodElements.cardTelefone  = document.getElementById("cardTelefone");
    prodElements.cardWhatsapp  = document.getElementById("cardWhatsapp");
    prodElements.cardConsolid  = document.getElementById("cardConsolidado");
    prodElements.chartBarProd  = document.getElementById("chartBarProd");
    prodElements.chartPhoneProd = document.getElementById("chartPhoneProd");
    prodElements.chartWhatsProd = document.getElementById("chartWhatsProd");
    prodElements.statusProd    = document.getElementById("statusProd");

    if (!prodElements.section) return;

    preencherFiltrosProd();
    prodElements.btnAtualizar.addEventListener("click", carregarProdutividade);
    prodElements.anoProd.addEventListener("change", carregarProdutividade);
    prodElements.mesProd.addEventListener("change", carregarProdutividade);
}

function preencherFiltrosProd() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    for (let a = anoAtual; a >= anoAtual - 3; a--) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        prodElements.anoProd.appendChild(opt);
    }
    const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    meses.forEach((m, i) => {
        const opt = document.createElement("option");
        opt.value = i + 1;
        opt.textContent = m;
        prodElements.mesProd.appendChild(opt);
    });
    prodElements.anoProd.value = anoAtual;
    prodElements.mesProd.value = hoje.getMonth() + 1;
}

async function carregarProdutividade() {
    const ano = prodElements.anoProd.value;
    const mes = prodElements.mesProd.value;

    showProdStatus("Carregando dados...", "info");

    try {
        const [resResumo, resDiario] = await Promise.all([
            fetch(`${API_PRODUTIVIDADE}?ano=${ano}&mes=${mes}&com_3cx=1&com_octa=1`),
            fetch(`${API_DIARIO}?ano=${ano}&mes=${mes}`)
        ]);

        const jsonResumo = await resResumo.json();
        const jsonDiario = await resDiario.json();

        if (!jsonResumo.ok) throw new Error(jsonResumo.erro || "Erro na API");

        prodData = jsonResumo.data;
        prodDiario = jsonDiario.ok ? jsonDiario.diario : [];

        renderProdutividade();
        hideProdStatus();
    } catch (err) {
        showProdStatus("Falha ao carregar: " + err.message, "error");
        console.error(err);
    }
}

function showProdStatus(msg, type) {
    if (prodElements.statusProd) {
        prodElements.statusProd.hidden = false;
        prodElements.statusProd.className = `status-banner ${type}`;
        prodElements.statusProd.textContent = msg;
    }
}

function hideProdStatus() {
    if (prodElements.statusProd) {
        prodElements.statusProd.hidden = true;
    }
}

// ── Render Principal ──────────────────────────────────────────────────

function renderProdutividade() {
    if (!prodData) return;

    const usuarios = prodData.usuarios || [];
    const ligacoes = prodData.ligacoes || [];
    const octadesk = prodData.octadesk || [];

    renderCardsTotais(usuarios, ligacoes, octadesk);
    renderTabelaUsuarios(usuarios);
    renderChartBarProd(usuarios);
    renderChartPhone(ligacoes);
    renderChartWhatsapp(octadesk);
}

// ── Cards Totais ──────────────────────────────────────────────────────

function renderCardsTotais(usuarios, ligacoes, octadesk) {
    // Telefone
    const totalRecebidas = ligacoes.reduce((s, l) => s + (l.recebidas || 0), 0);
    const totalAtendidas = ligacoes.reduce((s, l) => s + (l.atendidas || 0), 0);
    const totalNaoAtendidas = ligacoes.reduce((s, l) => s + (l.nao_atendidas || 0), 0);
    const taxaAtendimento = totalRecebidas ? ((totalAtendidas / totalRecebidas) * 100).toFixed(0) : 0;

    prodElements.cardTelefone.innerHTML = `
        <div class="prod-card-icon">&#128222;</div>
        <div class="prod-card-title">TELEFONE (3CX)</div>
        <div class="prod-card-big">${totalRecebidas + ligacoes.reduce((s, l) => s + (l.realizadas || 0), 0)}</div>
        <div class="prod-card-sub">Recebidas: ${totalRecebidas} | Atendidas: ${totalAtendidas}</div>
        <div class="prod-card-sub">Nao atendidas: ${totalNaoAtendidas} | Taxa: ${taxaAtendimento}%</div>
    `;

    // WhatsApp
    const totalChats = octadesk.reduce((s, a) => s + (a.total || 0), 0);
    const totalInbound = octadesk.reduce((s, a) => s + (a.inbound || 0), 0);
    const totalOutbound = octadesk.reduce((s, a) => s + (a.outbound || 0), 0);
    const totalClosed = octadesk.reduce((s, a) => s + (a.closed || 0), 0);

    prodElements.cardWhatsapp.innerHTML = `
        <div class="prod-card-icon">&#128172;</div>
        <div class="prod-card-title">WHATSAPP (OCTADESK)</div>
        <div class="prod-card-big">${totalChats}</div>
        <div class="prod-card-sub">Recebidos: ${totalInbound} | Enviados: ${totalOutbound}</div>
        <div class="prod-card-sub">Finalizados: ${totalClosed}</div>
    `;

    // Consolidado
    const totalAgendamentos = usuarios.reduce((s, u) => s + (u.agendamentos || 0), 0);
    const totalLaudos = usuarios.reduce((s, u) => s + (u.laudos_digitados || 0), 0);
    const totalEmails = usuarios.reduce((s, u) => s + (u.emails_laudo || 0) + (u.emails_enviados || 0), 0);
    const totalCadastros = usuarios.reduce((s, u) => s + (u.cadastros_paciente || 0), 0);

    prodElements.cardConsolid.innerHTML = `
        <div class="prod-card-icon">&#128200;</div>
        <div class="prod-card-title">CONSOLIDADO KLINIKI</div>
        <div class="prod-card-big">${totalAgendamentos}</div>
        <div class="prod-card-label">Agendamentos</div>
        <div class="prod-card-sub">Laudos: ${totalLaudos} | Emails: ${totalEmails} | Cadastros: ${totalCadastros}</div>
        <div class="prod-card-sub">Resultados Online: ${prodData.resultados_online || 0}</div>
    `;
}

// ── Tabela de Usuarios ────────────────────────────────────────────────

function renderTabelaUsuarios(usuarios) {
    if (!prodElements.tabela) return;

    // Filtrar usuarios sem atividade
    const ativos = usuarios
        .filter(u => (u.agendamentos || 0) + (u.laudos_digitados || 0) + (u.cadastros_paciente || 0) + (u.entregas_arquivo || 0) + (u.capturas || 0) > 0)
        .sort((a, b) => (b.agendamentos || 0) - (a.agendamentos || 0));

    let html = `<thead><tr>
        <th>Usuario</th>
        <th>Estacao</th>
        <th>Agendamentos</th>
        <th>Cadastros</th>
        <th>Laudos Dig.</th>
        <th>Laudos Lib.</th>
        <th>Emails</th>
        <th>SMS</th>
        <th>Capturas</th>
        <th>Entregas</th>
        <th>Lig. Receb.</th>
        <th>Lig. Atend.</th>
    </tr></thead><tbody>`;

    for (const u of ativos) {
        html += `<tr>
            <td style="text-align:left;font-weight:bold;">${u.usuario}</td>
            <td>${u.estacao || u.ip_hoje || '-'}</td>
            <td>${u.agendamentos || 0}</td>
            <td>${u.cadastros_paciente || 0}</td>
            <td>${u.laudos_digitados || 0}</td>
            <td>${u.laudos_liberados || 0}</td>
            <td>${(u.emails_laudo || 0) + (u.emails_enviados || 0)}</td>
            <td>${u.sms_laudo || 0}</td>
            <td>${u.capturas || 0}</td>
            <td>${u.entregas_arquivo || 0}</td>
            <td>${u.ligacoes_recebidas || '-'}</td>
            <td>${u.ligacoes_atendidas || '-'}</td>
        </tr>`;
    }

    html += "</tbody>";
    prodElements.tabela.innerHTML = html;
}

// ── Chart: Agendamentos por Usuario ───────────────────────────────────

function renderChartBarProd(usuarios) {
    const top = usuarios
        .filter(u => (u.agendamentos || 0) > 0)
        .sort((a, b) => (b.agendamentos || 0) - (a.agendamentos || 0))
        .slice(0, 15);

    if (chartProdBar) chartProdBar.destroy();

    chartProdBar = new Chart(prodElements.chartBarProd, {
        type: "bar",
        data: {
            labels: top.map(u => u.usuario),
            datasets: [
                {
                    label: "Agendamentos",
                    data: top.map(u => u.agendamentos || 0),
                    backgroundColor: "#3a86ff"
                },
                {
                    label: "Cadastros",
                    data: top.map(u => u.cadastros_paciente || 0),
                    backgroundColor: "#4cc9f0"
                },
                {
                    label: "Laudos",
                    data: top.map(u => u.laudos_digitados || 0),
                    backgroundColor: "#f2c94c"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 12 } },
                datalabels: { color: "#fff", anchor: "end", align: "top", font: { size: 10, weight: "bold" } }
            },
            scales: {
                x: { ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}

// ── Chart: Telefone por Ramal ─────────────────────────────────────────

function renderChartPhone(ligacoes) {
    if (!ligacoes.length) {
        if (chartProdPhone) chartProdPhone.destroy();
        return;
    }

    const top = ligacoes
        .sort((a, b) => (b.recebidas + b.realizadas) - (a.recebidas + a.realizadas))
        .slice(0, 10);

    if (chartProdPhone) chartProdPhone.destroy();

    chartProdPhone = new Chart(prodElements.chartPhoneProd, {
        type: "bar",
        data: {
            labels: top.map(l => `${l.ramal} ${l.nome}`),
            datasets: [
                {
                    label: "Atendidas",
                    data: top.map(l => l.atendidas || 0),
                    backgroundColor: "#1faa59"
                },
                {
                    label: "Nao Atendidas",
                    data: top.map(l => l.nao_atendidas || 0),
                    backgroundColor: "#eb5757"
                }
            ]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 12 } },
                datalabels: { color: "#fff", font: { size: 9, weight: "bold" } }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}

// ── Chart: WhatsApp por Agente ────────────────────────────────────────

function renderChartWhatsapp(octadesk) {
    if (!octadesk.length) {
        if (chartProdWhats) chartProdWhats.destroy();
        return;
    }

    const sorted = octadesk
        .filter(a => a.agente !== "SEM AGENTE")
        .sort((a, b) => b.total - a.total);

    if (chartProdWhats) chartProdWhats.destroy();

    chartProdWhats = new Chart(prodElements.chartWhatsProd, {
        type: "bar",
        data: {
            labels: sorted.map(a => a.agente),
            datasets: [
                {
                    label: "Recebidos",
                    data: sorted.map(a => a.inbound || 0),
                    backgroundColor: "#25d366"
                },
                {
                    label: "Enviados",
                    data: sorted.map(a => a.outbound || 0),
                    backgroundColor: "#128c7e"
                }
            ]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 12 } },
                datalabels: { color: "#fff", font: { size: 9, weight: "bold" } }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}
