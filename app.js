const capacidade = { "306": 38, "307": 30, "313": 20, "602": 40, "606": 40 };
const nomesMeses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
];
const opcoesMeses = nomesMeses.slice(1).map((nome, index) => ({ value: index + 1, label: nome }));
const URL_PUBLICA = "https://opensheet.elk.sh/1y6_yX-8aggFAmbB5tLV0ZSvyh6ffq5-jJbf5VP8DpwM/base";
const hoje = new Date();

let data = [];
let salaFiltro = "ALL";
let periodoMeses = 1;
let chartRight;
let chartCapacidade;
const salasExcluidas = new Set();

const elements = {};

window.addEventListener("load", init);

async function init() {
    cacheElements();
    preencherMeses();
    bindEvents();

    if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") {
        showStatus("Bibliotecas de grafico indisponiveis. Verifique a conexao com a internet.", "error");
        return;
    }

    Chart.register(ChartDataLabels);

    const historicoLocal = carregarHistoricoLocal();
    data = historicoLocal;

    try {
        const dadosRecentes = await carregarDadosRecentes();
        data = [...historicoLocal, ...dadosRecentes];
        showStatus(`Base carregada com ${data.length} registros. Dados locais + planilha online.`, "info");
    } catch (error) {
        showStatus("Falha ao carregar a planilha online. Exibindo apenas a base local validada.", "warn");
        console.error("Erro no carregamento remoto:", error);
    }

    if (!data.length) {
        showStatus("Nenhum dado valido foi encontrado para montar o dashboard.", "error");
        return;
    }

    carregarAnos();
    definirPeriodoPadrao();
    render();
}

function cacheElements() {
    elements.anoFiltro = document.getElementById("anoFiltro");
    elements.mesFiltro = document.getElementById("mesFiltro");
    elements.statusBanner = document.getElementById("statusBanner");
    elements.tituloPrincipal = document.getElementById("tituloPrincipal");
    elements.tituloEsquerdo = document.getElementById("tituloEsquerdo");
    elements.tituloDireito = document.getElementById("tituloDireito");
    elements.legendCustom = document.getElementById("legendCustom");
    elements.calendar = document.getElementById("calendar");
    elements.chartCapacidade = document.getElementById("chartCapacidade");
    elements.chartRight = document.getElementById("chartRight");
    elements.container = document.querySelector(".container");
    elements.att = document.getElementById("att");
    elements.occ = document.getElementById("occ");
    elements.rec = document.getElementById("rec");
    elements.ticket = document.getElementById("ticket");
    elements.filtrosExclusao = document.getElementById("filtrosExclusao");
}

function bindEvents() {
    elements.anoFiltro.addEventListener("change", render);
    elements.mesFiltro.addEventListener("change", render);

    document.querySelectorAll("#grupoBotoes button").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.disabled) {
                return;
            }
            salaFiltro = button.dataset.sala;
            document.querySelectorAll("#grupoBotoes button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            render();
        });
    });

    document.querySelectorAll("#grupoPeriodo button").forEach((button) => {
        button.addEventListener("click", () => {
            periodoMeses = Number(button.dataset.periodo);
            document.querySelectorAll("#grupoPeriodo button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            render();
        });
    });

    renderFiltrosExclusao();
    sincronizarBotoesSala();
}

function preencherMeses() {
    elements.mesFiltro.replaceChildren(
        ...opcoesMeses.map((mes) => {
            const option = document.createElement("option");
            option.value = String(mes.value);
            option.textContent = mes.label;
            return option;
        })
    );
}

function showStatus(message, type) {
    elements.statusBanner.hidden = false;
    elements.statusBanner.className = `status-banner ${type}`;
    elements.statusBanner.textContent = message;
}

function renderFiltrosExclusao() {
    const buttons = Object.keys(capacidade).map((sala) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn-exclusao${salasExcluidas.has(sala) ? " excluida" : ""}`;
        button.textContent = salasExcluidas.has(sala) ? `${sala} OCULTA` : sala;
        button.addEventListener("click", () => {
            if (salasExcluidas.has(sala)) {
                salasExcluidas.delete(sala);
            } else {
                salasExcluidas.add(sala);
                if (salaFiltro === sala) {
                    salaFiltro = "ALL";
                    const botaoGeral = document.querySelector('#grupoBotoes button[data-sala="ALL"]');
                    document.querySelectorAll("#grupoBotoes button").forEach((item) => item.classList.remove("active"));
                    if (botaoGeral) {
                        botaoGeral.classList.add("active");
                    }
                }
            }
            renderFiltrosExclusao();
            sincronizarBotoesSala();
            render();
        });
        return button;
    });

    elements.filtrosExclusao.replaceChildren(...buttons);
}

function sincronizarBotoesSala() {
    document.querySelectorAll("#grupoBotoes button").forEach((button) => {
        const sala = button.dataset.sala;
        const excluida = sala !== "ALL" && salasExcluidas.has(sala);
        button.disabled = excluida;
        if (excluida) {
            button.classList.remove("active");
        }
    });

    if (salaFiltro !== "ALL" && salasExcluidas.has(salaFiltro)) {
        salaFiltro = "ALL";
    }

    const botaoAtivo = document.querySelector(`#grupoBotoes button[data-sala="${salaFiltro}"]`);
    if (botaoAtivo) {
        document.querySelectorAll("#grupoBotoes button").forEach((item) => item.classList.remove("active"));
        botaoAtivo.classList.add("active");
    }
}

function carregarHistoricoLocal() {
    if (typeof dadosHistoricos !== "string" || !dadosHistoricos.trim()) {
        return [];
    }

    return parseDelimited(dadosHistoricos, ";")
        .map(normalizarRegistro)
        .filter(Boolean);
}

async function carregarDadosRecentes() {
    const response = await fetch(URL_PUBLICA);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!Array.isArray(json)) {
        throw new Error("Resposta remota invalida");
    }

    return json
        .map(normalizarRegistro)
        .filter(Boolean);
}

function parseDelimited(text, delimiter) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            row.push(current.trim());
            current = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                i += 1;
            }
            row.push(current.trim());
            if (row.some((value) => value !== "")) {
                rows.push(row);
            }
            row = [];
            current = "";
            continue;
        }

        current += char;
    }

    if (current || row.length) {
        row.push(current.trim());
        if (row.some((value) => value !== "")) {
            rows.push(row);
        }
    }

    if (!rows.length) {
        return [];
    }

    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((values) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index] ? values[index].trim() : "";
        });
        return record;
    });
}

function normalizarRegistro(record) {
    if (!record || !record.ANO || !record.MES || !record.DATA) {
        return null;
    }

    const ano = Number(record.ANO);
    const mes = Number(record.MES);
    if (!Number.isFinite(ano) || !Number.isFinite(mes)) {
        return null;
    }

    const sala = String(record.SALA_FINAL || "").trim();
    if (!capacidade[sala]) {
        return null;
    }

    return {
        ...record,
        ANO: ano,
        MES: mes,
        SALA_FINAL: sala,
        DATA: String(record.DATA).trim(),
        VALOR: num(record.VALOR)
    };
}

function carregarAnos() {
    const anos = [...new Set(data.map((item) => item.ANO))].sort((a, b) => b - a);
    elements.anoFiltro.replaceChildren(
        ...anos.map((ano) => {
            const option = document.createElement("option");
            option.value = String(ano);
            option.textContent = String(ano);
            return option;
        })
    );
}

function definirPeriodoPadrao() {
    const registroMaisRecente = data
        .slice()
        .sort((a, b) => (b.ANO - a.ANO) || (b.MES - a.MES))[0];

    if (!registroMaisRecente) {
        return;
    }

    elements.anoFiltro.value = String(registroMaisRecente.ANO);
    elements.mesFiltro.value = String(registroMaisRecente.MES);
}

function num(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    return Number.parseFloat(
        String(value)
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
    ) || 0;
}

function render() {
    if (!data.length) {
        return;
    }

    const anoSel = Number(elements.anoFiltro.value);
    const mesSel = Number(elements.mesFiltro.value);

    const salasAtivas = getSalasAtivas();
    const filteredMes = data.filter((item) =>
        item.ANO === anoSel &&
        item.MES === mesSel &&
        salasAtivas.includes(item.SALA_FINAL) &&
        (salaFiltro === "ALL" || item.SALA_FINAL === salaFiltro)
    );

    const dataFim = new Date(anoSel, mesSel, 0);
    const dataInicio = new Date(anoSel, mesSel - 1, 1);
    dataInicio.setMonth(dataInicio.getMonth() - (periodoMeses - 1));

    const filteredPeriodo = data.filter((item) => {
        const dataItem = new Date(item.ANO, item.MES - 1, 1);
        return dataItem >= dataInicio &&
            dataItem <= dataFim &&
            registroDentroDaDataCorrente(item) &&
            salasAtivas.includes(item.SALA_FINAL) &&
            (salaFiltro === "ALL" || item.SALA_FINAL === salaFiltro);
    });

    const sufixo = periodoMeses === 1 ? "" : ` (ACUMULADO ${periodoMeses}M)`;
    elements.tituloPrincipal.textContent = `${salaFiltro === "ALL" ? "GERAL" : `SALA ${salaFiltro}`} | ${nomesMeses[mesSel]} ${anoSel}${sufixo}`;

    const atendimentos = filteredPeriodo.length;
    const receita = filteredPeriodo.reduce((acc, item) => acc + num(item.VALOR), 0);
    const capacidadePeriodo = calcularCapacidadePeriodo(dataInicio, dataFim, salaFiltro, salasAtivas);

    elements.att.textContent = `${atendimentos} / ${capacidadePeriodo}`;
    elements.rec.textContent = `R$ ${receita.toLocaleString("pt-BR")}`;
    elements.occ.textContent = capacidadePeriodo ? `${((atendimentos / capacidadePeriodo) * 100).toFixed(1)}%` : "0%";
    elements.ticket.textContent = `R$ ${atendimentos ? (receita / atendimentos).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "0"}`;

    if (salaFiltro === "ALL") {
        elements.container.classList.add("modo-geral");
        elements.calendar.style.display = "none";
        elements.chartCapacidade.style.display = "block";
        elements.tituloEsquerdo.textContent = `Ocupacao por Sala (${periodoMeses}M)`;
        elements.tituloDireito.textContent = `Receita por Sala (${periodoMeses}M)`;
        elements.legendCustom.replaceChildren();
        buildChartCapacidade(filteredPeriodo, dataInicio, dataFim, salasAtivas);
        buildChartReceita(filteredPeriodo, salasAtivas);
        return;
    }

    elements.container.classList.remove("modo-geral");
    elements.calendar.style.display = "table";
    elements.chartCapacidade.style.display = "none";
    elements.tituloEsquerdo.textContent = `Calendario (${nomesMeses[mesSel]})`;
    elements.tituloDireito.textContent = `Historico Regressivo (${periodoMeses}M)`;
    buildCalendar(filteredMes);
    buildChartTrendBars(salaFiltro, anoSel, mesSel, periodoMeses);
}

function getSalasAtivas() {
    return Object.keys(capacidade).filter((sala) => !salasExcluidas.has(sala));
}

function parseDataBr(texto) {
    const [dia, mes, ano] = String(texto || "").split("/").map(Number);
    if (!dia || !mes || !ano) {
        return null;
    }
    return new Date(ano, mes - 1, dia);
}

function registroDentroDaDataCorrente(item) {
    const dataRegistro = parseDataBr(item.DATA);
    if (!dataRegistro) {
        return false;
    }

    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
    return dataRegistro <= fimHoje;
}

function diasDisponiveisNoMes(ano, mes) {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const mesReferencia = new Date(ano, mes - 1, 1);

    if (mesReferencia > inicioMesAtual) {
        return 0;
    }

    if (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) {
        return hoje.getDate();
    }

    return diasNoMes;
}

function listarMesesNoPeriodo(dataInicio, dataFim) {
    const cursor = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
    const limite = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1);
    const meses = [];

    while (cursor <= limite) {
        meses.push({ ano: cursor.getFullYear(), mes: cursor.getMonth() + 1 });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return meses;
}

function calcularCapacidadePeriodo(dataInicio, dataFim, salaSelecionada, salasAtivas) {
    const salasConsideradas = salaSelecionada === "ALL"
        ? salasAtivas
        : salasAtivas.filter((sala) => sala === salaSelecionada);

    if (!salasConsideradas.length) {
        return 0;
    }

    return listarMesesNoPeriodo(dataInicio, dataFim).reduce((total, periodo) => {
        const dias = diasDisponiveisNoMes(periodo.ano, periodo.mes);
        const capacidadeSalas = salasConsideradas.reduce((acc, sala) => acc + capacidade[sala], 0);
        return total + (capacidadeSalas * dias);
    }, 0);
}

function buildChartTrendBars(sala, ano, mesRef, qtdMeses) {
    const periodos = [];

    for (let i = 0; i < qtdMeses; i += 1) {
        let tempMes = mesRef - i;
        let tempAno = ano;
        while (tempMes <= 0) {
            tempMes += 12;
            tempAno -= 1;
        }
        periodos.push({ m: tempMes, a: tempAno });
    }

    const stats = periodos.map((periodo) => {
        const registros = data.filter((item) =>
            item.SALA_FINAL === sala &&
            item.MES === periodo.m &&
            item.ANO === periodo.a &&
            registroDentroDaDataCorrente(item)
        );
        const receita = registros.reduce((acc, item) => acc + num(item.VALOR), 0);
        const dias = diasDisponiveisNoMes(periodo.a, periodo.m);
        const capacidadePeriodo = dias * (capacidade[sala] || 0);
        const ocupacao = capacidadePeriodo ? (registros.length / capacidadePeriodo) * 100 : 0;

        return {
            label: `${nomesMeses[periodo.m].substring(0, 3)}/${String(periodo.a).substring(2)}`,
            rec: receita,
            ocup: ocupacao
        };
    });

    if (chartRight) {
        chartRight.destroy();
    }

    chartRight = new Chart(elements.chartRight, {
        type: "bar",
        data: {
            labels: stats.map((item) => item.label),
            datasets: [
                {
                    label: "Receita",
                    data: stats.map((item) => item.rec),
                    backgroundColor: "#3a86ff",
                    yAxisID: "y",
                    barPercentage: 0.8,
                    categoryPercentage: 0.7
                },
                {
                    label: "Ocupacao %",
                    data: stats.map((item) => item.ocup),
                    backgroundColor: "#f2c94c",
                    yAxisID: "y1",
                    barPercentage: 0.8,
                    categoryPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 15, right: 10 } },
            scales: {
                y: { beginAtZero: true, display: false, grace: "25%" },
                y1: { beginAtZero: true, max: 130, display: false },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#fff",
                        font: { size: qtdMeses > 6 ? 9 : 11 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#fff",
                    anchor: "end",
                    align: "top",
                    offset: 2,
                    font: {
                        weight: "bold",
                        size: qtdMeses > 6 ? 8 : (window.innerWidth < 600 ? 10 : 12)
                    },
                    formatter: (value, context) => context.datasetIndex === 1
                        ? `${value.toFixed(0)}%`
                        : `R$ ${(value / 1000).toFixed(0)}k`
                }
            }
        }
    });

    const receitaItem = document.createElement("span");
    receitaItem.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#3a86ff;margin-right:4px;"></span>Receita';
    receitaItem.style.marginRight = "12px";

    const ocupacaoItem = document.createElement("span");
    ocupacaoItem.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#f2c94c;margin-right:4px;"></span>Ocupacao %';

    elements.legendCustom.replaceChildren(receitaItem, ocupacaoItem);
}

function buildChartCapacidade(dados, dataInicio, dataFim, salasAtivas) {
    const stats = {};
    salasAtivas.forEach((sala) => {
        stats[sala] = { atend: 0, cap: calcularCapacidadePeriodo(dataInicio, dataFim, sala, salasAtivas) };
    });

    dados.forEach((item) => {
        if (stats[item.SALA_FINAL]) {
            stats[item.SALA_FINAL].atend += 1;
        }
    });

    const labels = Object.keys(stats);

    if (chartCapacidade) {
        chartCapacidade.destroy();
    }

    chartCapacidade = new Chart(elements.chartCapacidade, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: labels.map((sala) => stats[sala].atend),
                backgroundColor: labels.map((sala) => {
                    const percentual = stats[sala].cap ? (stats[sala].atend / stats[sala].cap) * 100 : 0;
                    return percentual >= 70 ? "#1faa59" : percentual >= 50 ? "#f2c94c" : "#eb5757";
                }),
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30, bottom: 10 } },
            scales: {
                y: {
                    beginAtZero: true,
                    grace: "20%",
                    grid: { color: "rgba(255,255,255,0.1)" },
                    ticks: { color: "#aaa", font: { size: 10 } }
                },
                x: { ticks: { color: "#fff" }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    align: "top",
                    anchor: "end",
                    color: "#fff",
                    font: { weight: "bold", size: 10 },
                    formatter: (value, context) => {
                        const cap = stats[context.chart.data.labels[context.dataIndex]].cap;
                        const percentual = cap ? ((value / cap) * 100).toFixed(0) : "0";
                        return `${value}\n(${percentual}%)`;
                    }
                }
            }
        }
    });
}

function buildChartReceita(dados, salasAtivas) {
    const receitas = {};
    salasAtivas.forEach((sala) => {
        receitas[sala] = 0;
    });

    dados.forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(receitas, item.SALA_FINAL)) {
            receitas[item.SALA_FINAL] += num(item.VALOR);
        }
    });

    if (chartRight) {
        chartRight.destroy();
    }

    chartRight = new Chart(elements.chartRight, {
        type: "bar",
        data: {
            labels: Object.keys(receitas),
            datasets: [{
                data: Object.values(receitas),
                backgroundColor: "#3a86ff",
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 10 } },
            scales: {
                y: {
                    beginAtZero: true,
                    display: false,
                    suggestedMax: Math.max(...Object.values(receitas), 0) * 1.3
                },
                x: { ticks: { color: "#fff" }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    align: "top",
                    anchor: "end",
                    color: "#fff",
                    font: { weight: "bold", size: 10 },
                    formatter: (value) => `R$ ${(value / 1000).toFixed(1)}k`
                }
            }
        }
    });
}

function buildCalendar(dataCal) {
    elements.calendar.replaceChildren();

    const headerRow = document.createElement("tr");
    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].forEach((dia) => {
        const th = document.createElement("th");
        th.textContent = dia;
        headerRow.appendChild(th);
    });
    elements.calendar.appendChild(headerRow);

    if (!dataCal.length) {
        return;
    }

    const ano = Number(dataCal[0].ANO);
    const mes = Number(dataCal[0].MES);
    const diasMes = new Date(ano, mes, 0).getDate();
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const porData = {};

    dataCal.forEach((item) => {
        if (!porData[item.DATA]) {
            porData[item.DATA] = { qtd: 0, rec: 0, sala: item.SALA_FINAL };
        }
        porData[item.DATA].qtd += 1;
        porData[item.DATA].rec += num(item.VALOR);
    });

    let row = document.createElement("tr");
    for (let i = 0; i < primeiroDia; i += 1) {
        const td = document.createElement("td");
        td.style.background = "#111a3a";
        row.appendChild(td);
    }

    for (let dia = 1; dia <= diasMes; dia += 1) {
        const td = document.createElement("td");
        const day = document.createElement("div");
        day.className = "day";
        day.textContent = String(dia);
        td.appendChild(day);

        const key = Object.keys(porData).find((item) => Number(item.split("/")[0]) === dia);
        if (key) {
            const cap = capacidade[porData[key].sala] || 0;
            const percentual = cap ? (porData[key].qtd / cap) * 100 : 0;
            td.style.background = percentual >= 70 ? "#1faa59" : percentual >= 50 ? "#f2c94c" : "#eb5757";

            const content = document.createElement("div");
            content.className = "cell-content";
            content.style.color = percentual >= 50 && percentual < 70 ? "#000" : "#fff";

            const ocupacao = document.createElement("div");
            ocupacao.style.fontWeight = "bold";
            ocupacao.textContent = `${porData[key].qtd} / ${cap} (${percentual.toFixed(0)}%)`;

            const receita = document.createElement("div");
            receita.style.fontSize = "10px";
            receita.textContent = `R$ ${porData[key].rec.toLocaleString("pt-BR")}`;

            content.appendChild(ocupacao);
            content.appendChild(receita);
            td.appendChild(content);
        } else {
            td.style.background = "#1c2541";
        }

        row.appendChild(td);
        if ((primeiroDia + dia) % 7 === 0) {
            elements.calendar.appendChild(row);
            row = document.createElement("tr");
        }
    }

    if (row.children.length) {
        while (row.children.length < 7) {
            row.appendChild(document.createElement("td"));
        }
        elements.calendar.appendChild(row);
    }
}
