const capacidadePadrao = { "306": 38, "307": 30, "313": 20, "602": 40, "606": 40 };
const capacidade = { ...capacidadePadrao };
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
const hoje = new Date();
const STORAGE_CAPACIDADE = "cavalieri_capacidade_diaria";
const API_OCUPACAO = "https://kliniki.cavalliericlinica.com.br:444/klinikinew/index.php/api_agenda/get_ocupacao";
const MASTER_USER = { login: "MD", senha: "252525@Md", nome: "Maicon Daniel" };
const STORAGE_LOGIN = "cavalieri_login_ok";
const STORAGE_LOGIN_USER = "cavalieri_login_user";
const STORAGE_USUARIOS = "cavalieri_usuarios";

const GITHUB_TOKEN = ""; // Preencher com token GitHub pra salvar remoto
const GITHUB_REPO = "mdaniel2588/cavalieri";
const GITHUB_FILE = "usuarios.json";
let _usuariosCarregados = false;

function getUsuariosCadastrados() {
    try {
        const raw = window.localStorage.getItem(STORAGE_USUARIOS);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

async function carregarUsuariosRemoto() {
    try {
        const r = await fetch(GITHUB_FILE + '?t=' + Date.now());
        if (r.ok) {
            const usuarios = await r.json();
            if (usuarios && typeof usuarios === 'object') {
                // Só sobrescreve se localStorage estiver vazio ou na primeira carga
                const local = window.localStorage.getItem(STORAGE_USUARIOS);
                if (!local || local === '{}') {
                    window.localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(usuarios));
                } else {
                    // Merge: remoto + local (local tem prioridade)
                    const localObj = JSON.parse(local);
                    const merged = { ...usuarios, ...localObj };
                    window.localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(merged));
                }
                _usuariosCarregados = true;
            }
        }
    } catch (e) {}
}

function salvarUsuarios(usuarios) {
    window.localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(usuarios));
    // Salvar no GitHub se token configurado
    if (GITHUB_TOKEN) {
        salvarNoGitHub(usuarios);
    }
}

async function salvarNoGitHub(usuarios) {
    try {
        // Pegar SHA atual do arquivo
        const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
            headers: { 'Authorization': 'token ' + GITHUB_TOKEN }
        });
        const info = await r.json();
        const sha = info.sha || '';

        // Atualizar arquivo
        await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + GITHUB_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Atualizar usuarios',
                content: btoa(unescape(encodeURIComponent(JSON.stringify(usuarios, null, 2)))),
                sha: sha
            })
        });
    } catch (e) {
        console.log('Erro salvando no GitHub:', e);
    }
}

carregarUsuariosRemoto();

function autenticarUsuario(login, senha) {
    if (login === MASTER_USER.login && senha === MASTER_USER.senha) {
        return { nome: MASTER_USER.nome, perfil: "master", acesso: ["performance", "produtividade", "usuarios"] };
    }
    const usuarios = getUsuariosCadastrados();
    const user = usuarios[login];
    if (user && user.senha === senha) {
        return { nome: user.nome, perfil: user.perfil || "usuario", acesso: user.acesso || ["performance"] };
    }
    return null;
}

let data = [];
let salaFiltro = "ALL";
let periodoMeses = 1;
let recorteAtual = "periodo";
let chartRight;
let chartCapacidade;
let carregandoDados = false;
const salasExcluidas = new Set();

const elements = {};

window.addEventListener("load", init);

async function init() {
    cacheElements();
    bindLogin();
    if (!validarSessaoLogin()) {
        bloquearDashboard();
        return;
    }

    liberarDashboard();
    await iniciarDashboard();
}

async function iniciarDashboard() {
    // Identificar usuario logado
    const loginUser = window.localStorage.getItem(STORAGE_LOGIN_USER) || "";
    const auth = autenticarUsuario(loginUser, "");
    // Re-auth para pegar dados (sem senha pois já logou)
    let userAuth = null;
    if (loginUser === MASTER_USER.login) {
        userAuth = { nome: MASTER_USER.nome, perfil: "master", acesso: ["performance", "produtividade", "usuarios"] };
    } else {
        const usuarios = getUsuariosCadastrados();
        const u = usuarios[loginUser];
        if (u) {
            userAuth = { nome: u.nome, perfil: u.perfil || "usuario", acesso: u.acesso || ["performance"] };
        }
    }

    // Mostrar nome
    const nomeLogado = document.getElementById("nomeLogado");
    if (nomeLogado && userAuth) {
        nomeLogado.textContent = userAuth.nome;
    }

    // Aplicar permissões de navegação
    aplicarPermissoes(userAuth);

    // Navegação entre seções
    bindNavegacao();

    // Inicializar produtividade
    if (typeof initProdutividade === "function") {
        initProdutividade();
    }

    // Painel de usuarios (master)
    if (userAuth && userAuth.perfil === "master") {
        initPainelUsuarios();
    }

    preencherMeses();
    preencherAnos();
    definirPeriodoPadrao();
    bindEvents();

    if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") {
        showStatus("Bibliotecas de grafico indisponiveis. Verifique a conexao com a internet.", "error");
        return;
    }

    Chart.register(ChartDataLabels);

    await atualizarDados();
}

function cacheElements() {
    elements.loginOverlay = document.getElementById("loginOverlay");
    elements.loginForm = document.getElementById("loginForm");
    elements.loginUsuario = document.getElementById("loginUsuario");
    elements.loginSenha = document.getElementById("loginSenha");
    elements.loginErro = document.getElementById("loginErro");
    elements.logoutButton = document.getElementById("logoutButton");
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
    elements.attHoje = document.getElementById("attHoje");
    elements.occ = document.getElementById("occ");
    elements.occHoje = document.getElementById("occHoje");
    elements.rec = document.getElementById("rec");
    elements.recHoje = document.getElementById("recHoje");
    elements.ticket = document.getElementById("ticket");
    elements.ticketHoje = document.getElementById("ticketHoje");
    elements.configCapacidade = document.getElementById("configCapacidade");
    elements.filtrosExclusao = document.getElementById("filtrosExclusao");
}

function bindLogin() {
    if (elements.loginForm.dataset.bound === "1") {
        return;
    }

    elements.loginForm.dataset.bound = "1";
    elements.loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usuario = elements.loginUsuario.value.trim();
        const senha = elements.loginSenha.value;

        const auth = autenticarUsuario(usuario, senha);
        if (!auth) {
            elements.loginErro.hidden = false;
            return;
        }

        elements.loginErro.hidden = true;
        window.localStorage.setItem(STORAGE_LOGIN, "1");
        window.localStorage.setItem(STORAGE_LOGIN_USER, usuario);
        liberarDashboard();
        await iniciarDashboard();
    });

    elements.logoutButton.addEventListener("click", sair);
}

function validarSessaoLogin() {
    return window.localStorage.getItem(STORAGE_LOGIN) === "1";
}

function bloquearDashboard() {
    elements.loginOverlay.classList.remove("hidden");
}

function liberarDashboard() {
    elements.loginOverlay.classList.add("hidden");
}

function sair() {
    window.localStorage.removeItem(STORAGE_LOGIN);
    window.localStorage.removeItem(STORAGE_LOGIN_USER);
    window.location.reload();
}

function aplicarPermissoes(userAuth) {
    const acesso = userAuth ? userAuth.acesso : ["performance"];
    const btnPerf = document.getElementById("navPerformance");
    const btnProd = document.getElementById("navProdutividade");
    const btnUsers = document.getElementById("navUsuarios");
    const secPerf = document.getElementById("secaoPerformance");
    const secProd = document.getElementById("secaoProdutividade");
    const secUsers = document.getElementById("secaoUsuarios");

    if (btnPerf) btnPerf.style.display = acesso.includes("performance") ? "" : "none";
    if (btnProd) btnProd.style.display = acesso.includes("produtividade") ? "" : "none";
    if (btnUsers) btnUsers.style.display = acesso.includes("usuarios") ? "" : "none";

    // Mostrar a primeira seção permitida
    const secoes = [
        { key: "performance", sec: secPerf, btn: btnPerf },
        { key: "produtividade", sec: secProd, btn: btnProd },
        { key: "usuarios", sec: secUsers, btn: btnUsers }
    ];

    let primeiraVisivel = false;
    for (const s of secoes) {
        if (s.sec) s.sec.style.display = "none";
        if (s.btn) s.btn.classList.remove("active");
    }
    for (const s of secoes) {
        if (acesso.includes(s.key) && !primeiraVisivel) {
            if (s.sec) s.sec.style.display = "";
            if (s.btn) s.btn.classList.add("active");
            primeiraVisivel = true;
        }
    }
}

function bindNavegacao() {
    const botoes = [
        { btn: document.getElementById("navPerformance"), sec: document.getElementById("secaoPerformance") },
        { btn: document.getElementById("navProdutividade"), sec: document.getElementById("secaoProdutividade") },
        { btn: document.getElementById("navUsuarios"), sec: document.getElementById("secaoUsuarios") }
    ];

    const todasSecoes = botoes.map(b => b.sec).filter(Boolean);
    const todosBotoes = botoes.map(b => b.btn).filter(Boolean);

    for (const item of botoes) {
        if (!item.btn || !item.sec) continue;
        item.btn.addEventListener("click", () => {
            todasSecoes.forEach(s => s.style.display = "none");
            todosBotoes.forEach(b => b.classList.remove("active"));
            item.sec.style.display = "";
            item.btn.classList.add("active");
        });
    }
}

function initPainelUsuarios() {
    const secao = document.getElementById("secaoUsuarios");
    if (!secao) return;

    renderPainelUsuarios();
}

function renderPainelUsuarios() {
    const secao = document.getElementById("secaoUsuarios");
    if (!secao) return;

    const usuarios = getUsuariosCadastrados();
    const lista = Object.entries(usuarios);

    let html = `
        <div style="padding:20px;">
            <h3 style="color:#3a86ff;margin-bottom:16px;">Gerenciar Usuarios</h3>
            <div id="formNovoUsuario" class="user-form">
                <input id="novoLogin" class="login-input" placeholder="Login" style="width:120px;" />
                <input id="novoNome" class="login-input" placeholder="Nome completo" style="width:200px;" />
                <input id="novoSenha" class="login-input" type="password" placeholder="Senha" style="width:140px;" />
                <label style="color:#96b7ff;font-size:12px;display:flex;align-items:center;gap:4px;">
                    <input type="checkbox" id="acessoPerf" checked /> Performance
                </label>
                <label style="color:#96b7ff;font-size:12px;display:flex;align-items:center;gap:4px;">
                    <input type="checkbox" id="acessoProd" /> Produtividade
                </label>
                <button id="btnAdicionarUsuario" type="button" class="active" style="padding:8px 16px;">ADICIONAR</button>
            </div>
            <div id="erroUsuario" style="color:#ffb3c1;font-size:13px;margin-top:8px;" hidden></div>
            <table class="prod-table" style="margin-top:16px;">
                <thead><tr>
                    <th>Login</th><th>Nome</th><th>Acesso</th><th>Acao</th>
                </tr></thead>
                <tbody>
                    <tr style="background:#1a2a4a;">
                        <td style="font-weight:bold;color:#f2c94c;">MD</td>
                        <td>Maicon Daniel</td>
                        <td>MASTER (tudo)</td>
                        <td style="color:#555;">-</td>
                    </tr>`;

    for (const [login, u] of lista) {
        const acessoStr = (u.acesso || ["performance"]).join(", ");
        const temPerf = (u.acesso || []).includes("performance");
        const temProd = (u.acesso || []).includes("produtividade");
        html += `<tr>
            <td style="font-weight:bold;">${login}</td>
            <td>${u.nome}</td>
            <td>${acessoStr}</td>
            <td style="display:flex;gap:4px;">
                <button class="btn-editar-user" data-login="${login}" data-nome="${u.nome}" data-perf="${temPerf}" data-prod="${temProd}" style="background:#1a3a5c;border-color:#5ca1ff;color:#c4dbff;padding:4px 10px;font-size:11px;cursor:pointer;">Editar</button>
                <button class="btn-remover-user" data-login="${login}" style="background:#5c1d2b;border-color:#ff8aa1;color:#ffe3e7;padding:4px 10px;font-size:11px;cursor:pointer;">Remover</button>
            </td>
        </tr>`;
    }

    html += `</tbody></table></div>`;
    secao.innerHTML = html;

    // Bind adicionar/salvar
    document.getElementById("btnAdicionarUsuario").addEventListener("click", () => {
        const btnAdd = document.getElementById("btnAdicionarUsuario");
        const editando = btnAdd.dataset.editando || "";
        const login = editando || document.getElementById("novoLogin").value.trim();
        const nome = document.getElementById("novoNome").value.trim();
        const senha = document.getElementById("novoSenha").value;
        const acessoPerf = document.getElementById("acessoPerf").checked;
        const acessoProd = document.getElementById("acessoProd").checked;
        const erro = document.getElementById("erroUsuario");

        if (!login || !nome) {
            erro.textContent = "Preencha login e nome.";
            erro.hidden = false;
            return;
        }
        if (!editando && !senha) {
            erro.textContent = "Preencha a senha.";
            erro.hidden = false;
            return;
        }
        if (login === MASTER_USER.login) {
            erro.textContent = "Login reservado.";
            erro.hidden = false;
            return;
        }

        const acesso = [];
        if (acessoPerf) acesso.push("performance");
        if (acessoProd) acesso.push("produtividade");
        if (!acesso.length) {
            erro.textContent = "Selecione pelo menos um acesso.";
            erro.hidden = false;
            return;
        }

        const usuarios = getUsuariosCadastrados();
        if (editando && usuarios[login]) {
            // Editar: manter senha se não preencheu nova
            usuarios[login].nome = nome;
            usuarios[login].acesso = acesso;
            if (senha) usuarios[login].senha = senha;
        } else {
            usuarios[login] = { nome, senha, perfil: "usuario", acesso };
        }
        salvarUsuarios(usuarios);
        erro.hidden = true;

        // Reset form
        btnAdd.textContent = "ADICIONAR";
        btnAdd.dataset.editando = "";
        document.getElementById("novoLogin").disabled = false;
        document.getElementById("novoSenha").placeholder = "Senha";
        renderPainelUsuarios();
    });

    // Bind editar
    document.querySelectorAll(".btn-editar-user").forEach(btn => {
        btn.addEventListener("click", () => {
            const login = btn.dataset.login;
            const nome = btn.dataset.nome;
            const temPerf = btn.dataset.perf === "true";
            const temProd = btn.dataset.prod === "true";

            // Preencher form com dados atuais
            document.getElementById("novoLogin").value = login;
            document.getElementById("novoLogin").disabled = true;
            document.getElementById("novoNome").value = nome;
            document.getElementById("novoSenha").value = "";
            document.getElementById("novoSenha").placeholder = "Deixe vazio pra manter";
            document.getElementById("acessoPerf").checked = temPerf;
            document.getElementById("acessoProd").checked = temProd;

            // Mudar botão pra "SALVAR"
            const btnAdd = document.getElementById("btnAdicionarUsuario");
            btnAdd.textContent = "SALVAR";
            btnAdd.dataset.editando = login;

            // Scroll pro form
            document.getElementById("formNovoUsuario").scrollIntoView({ behavior: "smooth" });
        });
    });

    // Bind remover
    document.querySelectorAll(".btn-remover-user").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!confirm("Remover usuario " + btn.dataset.login + "?")) return;
            const login = btn.dataset.login;
            const usuarios = getUsuariosCadastrados();
            delete usuarios[login];
            salvarUsuarios(usuarios);
            renderPainelUsuarios();
        });
    });
}


function bindEvents() {
    if (elements.anoFiltro.dataset.bound === "1") {
        return;
    }
    elements.anoFiltro.dataset.bound = "1";
    elements.anoFiltro.addEventListener("change", atualizarDados);
    elements.mesFiltro.addEventListener("change", atualizarDados);

    document.querySelectorAll("#grupoBotoes button").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.disabled) {
                return;
            }
            salaFiltro = button.dataset.sala;
            document.querySelectorAll("#grupoBotoes button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            atualizarDados();
        });
    });

    document.querySelectorAll("#grupoPeriodo button").forEach((button) => {
        button.addEventListener("click", () => {
            periodoMeses = Number(button.dataset.periodo);
            document.querySelectorAll("#grupoPeriodo button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            atualizarDados();
        });
    });

    document.querySelectorAll("#grupoRecorte button").forEach((button) => {
        button.addEventListener("click", () => {
            recorteAtual = button.dataset.recorte;
            document.querySelectorAll("#grupoRecorte button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            atualizarDados();
        });
    });

    carregarCapacidadeSalva();
    renderConfigCapacidade();
    renderFiltrosExclusao();
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

function preencherAnos() {
    const anoAtual = hoje.getFullYear();
    const anos = Array.from({ length: 6 }, (_, index) => anoAtual - index);
    elements.anoFiltro.replaceChildren(
        ...anos.map((ano) => {
            const option = document.createElement("option");
            option.value = String(ano);
            option.textContent = String(ano);
            return option;
        })
    );
}

function showStatus(message, type) {
    if (!message || type === "info") {
        hideStatus();
        return;
    }

    elements.statusBanner.hidden = false;
    elements.statusBanner.className = `status-banner ${type}`;
    elements.statusBanner.textContent = message;
}

function hideStatus() {
    elements.statusBanner.hidden = true;
    elements.statusBanner.textContent = "";
    elements.statusBanner.className = "status-banner";
}

function carregarCapacidadeSalva() {
    try {
        const bruto = window.localStorage.getItem(STORAGE_CAPACIDADE);
        if (!bruto) {
            return;
        }

        const salvo = JSON.parse(bruto);
        Object.keys(capacidade).forEach((sala) => {
            const valor = Number(salvo[sala]);
            if (Number.isFinite(valor) && valor > 0) {
                capacidade[sala] = valor;
            }
        });
    } catch (error) {
        console.error("Falha ao carregar capacidade salva:", error);
    }
}

function salvarCapacidade() {
    try {
        window.localStorage.setItem(STORAGE_CAPACIDADE, JSON.stringify(capacidade));
    } catch (error) {
        console.error("Falha ao salvar capacidade:", error);
    }
}

function renderConfigCapacidade() {
    const items = Object.keys(capacidade).map((sala) => {
        const wrapper = document.createElement("div");
        wrapper.className = "capacidade-item";

        const label = document.createElement("label");
        label.htmlFor = `capacidade-${sala}`;
        label.textContent = sala;

        const input = document.createElement("input");
        input.id = `capacidade-${sala}`;
        input.type = "number";
        input.min = "1";
        input.step = "1";
        input.value = String(capacidade[sala]);
        input.addEventListener("change", () => {
            const valor = Number(input.value);
            if (!Number.isFinite(valor) || valor <= 0) {
                input.value = String(capacidade[sala]);
                return;
            }
            capacidade[sala] = valor;
            salvarCapacidade();
            render();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return wrapper;
    });

    elements.configCapacidade.replaceChildren(...items);
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
                }
            }
            sincronizarBotoesSala();
            renderFiltrosExclusao();
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

async function carregarDados() {
    const consultas = construirConsultas();
    const respostas = await Promise.all(consultas.map(buscarDadosApi));

    return respostas
        .flat()
        .map((item) => ({
            DATA: item.DATA,
            ANO: item.ANO,
            MES: item.MES,
            SALA_FINAL: item.SALA_FINAL,
            VALOR: parseFloat(item.VALOR || 0)
        }))
        .map(normalizarRegistro)
        .filter(Boolean);
}

function construirConsultas() {
    if (recorteAtual !== "semana") {
        return [{
            ano: elements.anoFiltro.value,
            mes: elements.mesFiltro.value,
            periodo_meses: String(periodoMeses),
            sala: salaFiltro !== "ALL" ? salaFiltro : ""
        }];
    }

    const inicioSemana = getInicioSemanaAtual();
    const fimSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const meses = new Map();
    const cursor = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate());

    while (cursor <= fimSemana) {
        const chave = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
        if (!meses.has(chave)) {
            meses.set(chave, {
                ano: String(cursor.getFullYear()),
                mes: String(cursor.getMonth() + 1),
                periodo_meses: "1",
                sala: salaFiltro !== "ALL" ? salaFiltro : ""
            });
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return Array.from(meses.values());
}

async function buscarDadosApi(paramsBase) {
    const params = new URLSearchParams();
    Object.entries(paramsBase).forEach(([chave, valor]) => {
        if (valor) {
            params.set(chave, valor);
        }
    });

    const response = await fetch(`${API_OCUPACAO}?${params.toString()}`);
    if (!response.ok) {
        throw new Error("Erro ao buscar dados da API");
    }

    const resultado = await response.json();
    if (!Array.isArray(resultado)) {
        throw new Error("Resposta remota invalida");
    }

    return resultado;
}

async function atualizarDados() {
    if (carregandoDados) {
        return;
    }

    carregandoDados = true;
    hideStatus();

    try {
        data = await carregarDados();
        console.log("Dados API:", data);
        hideStatus();
    } catch (error) {
        data = [];
        showStatus("Falha ao carregar dados da API interna.", "error");
        console.error("Erro no carregamento da API:", error);
    } finally {
        carregandoDados = false;
    }

    if (!data.length) {
        render();
        return;
    }

    render();
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
        DATA: normalizarData(record.DATA),
        VALOR: num(record.VALOR)
    };
}

function normalizarData(valor) {
    const texto = String(valor || "").trim();
    if (!texto) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        const [ano, mes, dia] = texto.split("-");
        return `${dia}/${mes}/${ano}`;
    }

    return texto;
}

function definirPeriodoPadrao() {
    elements.anoFiltro.value = String(hoje.getFullYear());
    elements.mesFiltro.value = String(hoje.getMonth() + 1);
}

function num(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }
    // Se já é número, retorna direto
    if (typeof value === "number") {
        return value;
    }
    const str = String(value).replace("R$", "").trim();
    // Se tem ponto E vírgula (formato BR: 1.650,00), remove ponto e troca vírgula
    if (str.includes(".") && str.includes(",")) {
        return Number.parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    // Se só tem vírgula (formato BR sem milhar: 1650,00), troca vírgula por ponto
    if (str.includes(",") && !str.includes(".")) {
        return Number.parseFloat(str.replace(",", ".")) || 0;
    }
    // Se só tem ponto (formato US: 1650.00), usa direto
    return Number.parseFloat(str) || 0;
}

function render() {
    sincronizarBotoesSala();

    if (!data.length) {
        elements.calendar.replaceChildren();
        elements.att.textContent = "0 / 0";
        elements.attHoje.textContent = "Hoje: 0 / 0";
        elements.occ.textContent = "0%";
        elements.occHoje.textContent = "Hoje: 0%";
        elements.rec.textContent = "R$ 0";
        elements.recHoje.textContent = "Hoje: R$ 0";
        elements.ticket.textContent = "R$ 0";
        elements.ticketHoje.textContent = "Hoje: R$ 0";
        return;
    }

    const anoSel = Number(elements.anoFiltro.value);
    const mesSel = Number(elements.mesFiltro.value);
    const salasAtivas = Object.keys(capacidade).filter((sala) => !salasExcluidas.has(sala));
    const intervaloRecorte = obterIntervaloRecorte(anoSel, mesSel);

    const filteredMes = data.filter((item) =>
        registroNoIntervalo(item, intervaloRecorte.inicio, intervaloRecorte.fim) &&
        salasAtivas.includes(item.SALA_FINAL) &&
        (salaFiltro === "ALL" || item.SALA_FINAL === salaFiltro)
    );

    const dataFim = intervaloRecorte.fim;
    const dataInicio = intervaloRecorte.inicio;

    const filteredPeriodo = data.filter((item) => {
        return registroNoIntervalo(item, dataInicio, dataFim) &&
            registroDentroDaDataCorrente(item) &&
            salasAtivas.includes(item.SALA_FINAL) &&
            (salaFiltro === "ALL" || item.SALA_FINAL === salaFiltro);
    });
    const hojeTexto = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
    const filteredHoje = filteredPeriodo.filter((item) => item.DATA === hojeTexto);

    const mesTitulo = recorteAtual === "semana" ? nomesMeses[hoje.getMonth() + 1] : nomesMeses[mesSel];
    const anoTitulo = recorteAtual === "semana" ? hoje.getFullYear() : anoSel;
    const sufixo = recorteAtual === "semana"
        ? " (SEMANA CORRENTE)"
        : (periodoMeses === 1 ? "" : ` (ACUMULADO ${periodoMeses}M)`);
    elements.tituloPrincipal.textContent = `${salaFiltro === "ALL" ? "GERAL" : `SALA ${salaFiltro}`} | ${mesTitulo} ${anoTitulo}${sufixo}`;

    const atendimentos = filteredPeriodo.length;
    const atendimentosHoje = filteredHoje.length;
    const receita = filteredPeriodo.reduce((acc, item) => acc + num(item.VALOR), 0);
    const receitaHoje = filteredHoje.reduce((acc, item) => acc + num(item.VALOR), 0);
    const capacidadePeriodo = calcularCapacidadePeriodo(dataInicio, dataFim, salaFiltro, salasAtivas);
    const capacidadeHoje = calcularCapacidadeHoje(salaFiltro, salasAtivas, dataInicio, dataFim);
    const ticketHoje = atendimentosHoje ? receitaHoje / atendimentosHoje : 0;

    elements.att.textContent = `${atendimentos} / ${capacidadePeriodo}`;
    elements.attHoje.textContent = `Hoje: ${atendimentosHoje} / ${capacidadeHoje}`;
    elements.rec.textContent = `R$ ${receita.toLocaleString("pt-BR")}`;
    elements.recHoje.textContent = `Hoje: R$ ${receitaHoje.toLocaleString("pt-BR")}`;
    elements.occ.textContent = capacidadePeriodo ? `${((atendimentos / capacidadePeriodo) * 100).toFixed(1)}%` : "0%";
    elements.occHoje.textContent = `Hoje: ${capacidadeHoje ? ((atendimentosHoje / capacidadeHoje) * 100).toFixed(1) : "0"}%`;
    elements.ticket.textContent = `R$ ${atendimentos ? (receita / atendimentos).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "0"}`;
    elements.ticketHoje.textContent = `Hoje: R$ ${ticketHoje.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

    if (salaFiltro === "ALL") {
        elements.container.classList.add("modo-geral");
        elements.calendar.style.display = "none";
        elements.chartCapacidade.style.display = "block";
        elements.tituloEsquerdo.textContent = recorteAtual === "semana"
            ? "Ocupacao por Sala (Semana + Hoje)"
            : `Ocupacao por Sala (${periodoMeses}M + Hoje)`;
        elements.tituloDireito.textContent = recorteAtual === "semana" ? "Receita por Sala (Semana)" : `Receita por Sala (${periodoMeses}M)`;
        elements.legendCustom.replaceChildren();
        buildChartCapacidade(filteredPeriodo, dataInicio, dataFim, salasAtivas);
        buildChartReceita(filteredPeriodo, salasAtivas);
        return;
    }

    elements.container.classList.remove("modo-geral");
    elements.calendar.style.display = "table";
    elements.chartCapacidade.style.display = "none";
    elements.tituloEsquerdo.textContent = recorteAtual === "semana" ? "Calendario (Semana)" : `Calendario (${nomesMeses[mesSel]})`;
    elements.tituloDireito.textContent = recorteAtual === "semana" ? "Historico Diario (Semana)" : `Historico Regressivo (${periodoMeses}M)`;
    if (recorteAtual === "semana") {
        buildWeekCalendar(filteredMes, dataInicio);
        buildWeekTrendBars(filteredPeriodo, dataInicio);
    } else {
        buildCalendar(filteredMes);
        buildChartTrendBars(salaFiltro, anoSel, mesSel, periodoMeses);
    }
}

function obterIntervaloRecorte(anoSel, mesSel) {
    if (recorteAtual === "semana") {
        return {
            inicio: getInicioSemanaAtual(),
            fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999)
        };
    }

    const dataFim = new Date(anoSel, mesSel, 0, 23, 59, 59, 999);
    const dataInicio = new Date(anoSel, mesSel - 1, 1);
    dataInicio.setMonth(dataInicio.getMonth() - (periodoMeses - 1));
    dataInicio.setHours(0, 0, 0, 0);
    return { inicio: dataInicio, fim: dataFim };
}

function getInicioSemanaAtual() {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const diaSemana = inicio.getDay();
    const deslocamento = diaSemana === 0 ? 6 : diaSemana - 1;
    inicio.setDate(inicio.getDate() - deslocamento);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

function registroNoIntervalo(item, inicio, fim) {
    const dataRegistro = parseDataBr(item.DATA);
    if (!dataRegistro) {
        return false;
    }
    return dataRegistro >= inicio && dataRegistro <= fim;
}

function parseDataBr(texto) {
    const valor = String(texto || "").trim();
    if (!valor) {
        return null;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
        const [dia, mes, ano] = valor.split("/").map(Number);
        if (!dia || !mes || !ano) {
            return null;
        }
        return new Date(ano, mes - 1, dia);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [ano, mes, dia] = valor.split("-").map(Number);
        if (!dia || !mes || !ano) {
            return null;
        }
        return new Date(ano, mes - 1, dia);
    }

    return null;
}

function registroDentroDaDataCorrente(item) {
    const dataRegistro = parseDataBr(item.DATA);
    if (!dataRegistro) {
        return false;
    }

    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
    return dataRegistro <= fimHoje;
}

function isDiaUtil(dataReferencia) {
    const diaSemana = dataReferencia.getDay();
    return diaSemana >= 1 && diaSemana <= 5;
}

function contarDiasUteisNoIntervalo(inicio, fim) {
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const limite = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    let diasUteis = 0;

    while (cursor <= limite) {
        if (isDiaUtil(cursor)) {
            diasUteis += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return diasUteis;
}

function diasDisponiveisNoMes(ano, mes) {
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0);
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    if (inicioMes > inicioMesAtual) {
        return 0;
    }

    const limiteFinal = (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1)
        ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
        : fimMes;

    let diasUteis = 0;
    const cursor = new Date(inicioMes.getFullYear(), inicioMes.getMonth(), inicioMes.getDate());

    while (cursor <= limiteFinal) {
        if (isDiaUtil(cursor)) {
            diasUteis += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return diasUteis;
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

function calcularCapacidadePeriodo(dataInicio, dataFim, salaSelecionada, salasAtivas = Object.keys(capacidade)) {
    const salasConsideradas = salaSelecionada === "ALL"
        ? salasAtivas
        : salasAtivas.filter((sala) => sala === salaSelecionada);

    if (!salasConsideradas.length) {
        return 0;
    }

    const diasUteis = contarDiasUteisNoIntervalo(dataInicio, dataFim);
    const capacidadeSalas = salasConsideradas.reduce((acc, sala) => acc + capacidade[sala], 0);
    return capacidadeSalas * diasUteis;
}

function calcularCapacidadeHoje(salaSelecionada, salasAtivas = Object.keys(capacidade), dataInicio, dataFim) {
    const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
    const hojeFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
    if (hojeInicio < dataInicio || hojeFim > dataFim || !isDiaUtil(hoje)) {
        return 0;
    }

    const salasConsideradas = salaSelecionada === "ALL"
        ? salasAtivas
        : salasAtivas.filter((sala) => sala === salaSelecionada);

    return salasConsideradas.reduce((acc, sala) => acc + capacidade[sala], 0);
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

function buildWeekTrendBars(dados, inicioSemana) {
    const labels = [];
    const receita = [];
    const ocupacao = [];

    for (let i = 0; i < 7; i += 1) {
        const dataDia = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate());
        dataDia.setDate(inicioSemana.getDate() + i);
        if (dataDia > hoje) {
            break;
        }

        const dia = String(dataDia.getDate()).padStart(2, "0");
        const mes = String(dataDia.getMonth() + 1).padStart(2, "0");
        const ano = dataDia.getFullYear();
        const chave = `${dia}/${mes}/${ano}`;
        const registros = dados.filter((item) => item.DATA === chave);
        const totalReceita = registros.reduce((acc, item) => acc + num(item.VALOR), 0);
        const capacidadeDia = capacidade[salaFiltro] || 0;

        labels.push(["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"][i] || chave);
        receita.push(totalReceita);
        ocupacao.push(capacidadeDia ? (registros.length / capacidadeDia) * 100 : 0);
    }

    if (chartRight) {
        chartRight.destroy();
    }

    chartRight = new Chart(elements.chartRight, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Receita",
                    data: receita,
                    backgroundColor: "#3a86ff",
                    yAxisID: "y"
                },
                {
                    label: "Ocupacao %",
                    data: ocupacao,
                    backgroundColor: "#f2c94c",
                    yAxisID: "y1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, display: false },
                y1: { beginAtZero: true, max: 130, display: false },
                x: { ticks: { color: "#fff" }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#fff",
                    anchor: "end",
                    align: "top",
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

function buildChartCapacidade(dados, dataInicio, dataFim, salasAtivas = Object.keys(capacidade)) {
    const stats = {};
    const hojeTexto = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
    const hojeDentroDoRecorte = hoje >= dataInicio && hoje <= dataFim;

    salasAtivas.forEach((sala) => {
        stats[sala] = {
            atend: 0,
            cap: calcularCapacidadePeriodo(dataInicio, dataFim, sala, salasAtivas),
            atendHoje: 0,
            capHoje: hojeDentroDoRecorte && isDiaUtil(hoje) ? capacidade[sala] : 0
        };
    });

    dados.forEach((item) => {
        if (stats[item.SALA_FINAL]) {
            stats[item.SALA_FINAL].atend += 1;
            if (item.DATA === hojeTexto) {
                stats[item.SALA_FINAL].atendHoje += 1;
            }
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
            datasets: [
                {
                    label: "Acumulado",
                    data: labels.map((sala) => stats[sala].atend),
                    backgroundColor: labels.map((sala) => {
                        const percentual = stats[sala].cap ? (stats[sala].atend / stats[sala].cap) * 100 : 0;
                        return percentual >= 70 ? "#1faa59" : percentual >= 50 ? "#f2c94c" : "#eb5757";
                    }),
                    barPercentage: 0.55,
                    categoryPercentage: 0.72
                },
                {
                    label: "Hoje",
                    data: labels.map((sala) => stats[sala].atendHoje),
                    backgroundColor: labels.map((sala) => {
                        const percentual = stats[sala].capHoje ? (stats[sala].atendHoje / stats[sala].capHoje) * 100 : 0;
                        return percentual >= 70 ? "#4cc9f0" : percentual >= 50 ? "#8bd3dd" : "#577590";
                    }),
                    barPercentage: 0.55,
                    categoryPercentage: 0.72
                }
            ]
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
                legend: {
                    display: true,
                    labels: { color: "#fff", boxWidth: 12 }
                },
                datalabels: {
                    align: "top",
                    anchor: "end",
                    color: "#fff",
                    font: { weight: "bold", size: 10 },
                    formatter: (value, context) => {
                        const stat = stats[context.chart.data.labels[context.dataIndex]];
                        const cap = context.datasetIndex === 0 ? stat.cap : stat.capHoje;
                        const percentual = cap ? ((value / cap) * 100).toFixed(0) : "0";
                        return `${value}/${cap}\n(${percentual}%)`;
                    }
                }
            }
        }
    });
}

function buildChartReceita(dados, salasAtivas = Object.keys(capacidade)) {
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

function buildWeekCalendar(dataCal, inicioSemana) {
    elements.calendar.replaceChildren();

    const headerRow = document.createElement("tr");
    ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].forEach((dia) => {
        const th = document.createElement("th");
        th.textContent = dia;
        headerRow.appendChild(th);
    });
    elements.calendar.appendChild(headerRow);

    const row = document.createElement("tr");
    const porData = {};
    dataCal.forEach((item) => {
        if (!porData[item.DATA]) {
            porData[item.DATA] = { qtd: 0, rec: 0 };
        }
        porData[item.DATA].qtd += 1;
        porData[item.DATA].rec += num(item.VALOR);
    });

    for (let i = 0; i < 7; i += 1) {
        const dataDia = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate());
        dataDia.setDate(inicioSemana.getDate() + i);
        const td = document.createElement("td");
        const dia = document.createElement("div");
        dia.className = "day";
        dia.textContent = String(dataDia.getDate());
        td.appendChild(dia);

        if (dataDia <= hoje) {
            const chave = `${String(dataDia.getDate()).padStart(2, "0")}/${String(dataDia.getMonth() + 1).padStart(2, "0")}/${dataDia.getFullYear()}`;
            const resumo = porData[chave];
            if (resumo) {
                const percentual = capacidade[salaFiltro] ? (resumo.qtd / capacidade[salaFiltro]) * 100 : 0;
                td.style.background = percentual >= 70 ? "#1faa59" : percentual >= 50 ? "#f2c94c" : "#eb5757";

                const content = document.createElement("div");
                content.className = "cell-content";
                content.style.color = percentual >= 50 && percentual < 70 ? "#000" : "#fff";

                const ocupacao = document.createElement("div");
                ocupacao.style.fontWeight = "bold";
                ocupacao.textContent = `${resumo.qtd} / ${capacidade[salaFiltro] || 0} (${percentual.toFixed(0)}%)`;

                const receita = document.createElement("div");
                receita.style.fontSize = "10px";
                receita.textContent = `R$ ${resumo.rec.toLocaleString("pt-BR")}`;

                content.appendChild(ocupacao);
                content.appendChild(receita);
                td.appendChild(content);
            } else {
                td.style.background = "#1c2541";
            }
        } else {
            td.style.background = "#111a3a";
        }

        row.appendChild(td);
    }

    elements.calendar.appendChild(row);
}
