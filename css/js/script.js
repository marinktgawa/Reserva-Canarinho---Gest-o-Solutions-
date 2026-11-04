
// ==========================================
// RESERVACANARINHO
// SISTEMA DE RESERVAS E GERENCIAMENTO DE MESAS
// ==========================================

const CHAVE_CLIENTES = "canarinho_clientes";
const CHAVE_RESERVAS = "canarinho_reservas";
const CHAVE_ESPERA = "canarinho_espera";

const TOTAL_MESAS = 10;
const VALOR_CAUCao = 30;
const PERCENTUAL_REEMBOLSO = 10;

// ==========================================
// FUNÇÕES GERAIS
// ==========================================

// Ler dados salvos no navegador
function ler(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave)) || [];
    } catch {
        return [];
    }
}

// Salvar dados no navegador
function salvar(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

// Mostrar mensagens
function mensagem(id, texto, tipo = "sucesso") {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = "mensagem " + tipo;
}

// Gerar código da reserva
function gerarCodigo() {
    return "CANA-" +
        Math.floor(100000 + Math.random() * 900000);
}

// Formatar data
function dataLegivel(valor) {
    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return "Data não informada";
    }

    return data.toLocaleString("pt-BR");
}

// Formatar dinheiro
function dinheiro(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// Escapar textos inseridos na página
function escapar(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

// ==========================================
// REGRA DE NO-SHOW
// ==========================================

function verificarNoShow() {
    const agora = Date.now();
    const reservas = ler(CHAVE_RESERVAS);

    let mudou = false;

    reservas.forEach(reserva => {

        if (
            reserva.status === "Paga" &&
            !reserva.checkin &&
            reserva.data
        ) {
            const inicio = new Date(reserva.data).getTime();

            // Cancelamento 30 minutos ANTES do jogo
            if (
                !Number.isNaN(inicio) &&
                agora >= inicio - (30 * 60 * 1000)
            ) {
                reserva.status = "Cancelada por No-Show";

                reserva.motivo =
                    "Cliente não realizou o check-in no prazo.";

                reserva.canceladaEm =
                    new Date().toISOString();

                mudou = true;
            }
        }
    });

    if (mudou) {
        salvar(CHAVE_RESERVAS, reservas);
    }
}

// ==========================================
// REGRA DE REEMBOLSO DE 10%
// ==========================================

function podeSolicitarReembolso(reserva) {

    if (reserva.status !== "Cancelada por No-Show") {
        return false;
    }

    if (reserva.reembolso) {
        return false;
    }

    const inicio = new Date(reserva.data).getTime();

    if (Number.isNaN(inicio)) {
        return false;
    }

    // Libera a opção 30 minutos DEPOIS do horário marcado
    const horarioReembolso =
        inicio + (30 * 60 * 1000);

    return Date.now() >= horarioReembolso;
}

function solicitarReembolso(codigo) {

    const reservas = ler(CHAVE_RESERVAS);

    const reserva = reservas.find(
        item => item.codigo === codigo
    );

    if (!reserva) {
        alert("Reserva não encontrada.");
        return;
    }

    // Conferir se já pode solicitar
    if (!podeSolicitarReembolso(reserva)) {

        alert(
            "O reembolso ainda não está disponível. " +
            "Aguarde 30 minutos após o horário marcado."
        );

        return;
    }

    // Calcular 10% da caução de R$ 30,00
    const valorReembolso =
        VALOR_CAUCao * PERCENTUAL_REEMBOLSO / 100;

    reserva.reembolso = {
        percentual: PERCENTUAL_REEMBOLSO,
        valor: valorReembolso,
        solicitadoEm: new Date().toISOString(),
        status: "Solicitado"
    };

    salvar(CHAVE_RESERVAS, reservas);

    atualizarReservas();

    alert(
        "Solicitação de reembolso realizada!\n\n" +
        "Valor da caução: " + dinheiro(VALOR_CAUCao) + "\n" +
        "Percentual: 10%\n" +
        "Valor do reembolso: " + dinheiro(valorReembolso) + "\n\n" +
        "O reembolso está registrado como solicitado."
    );
}

// ==========================================
// CLIENTES
// ==========================================

function clienteExiste(email) {
    return ler(CHAVE_CLIENTES).some(
        cliente =>
            cliente.email.toLowerCase() === email.toLowerCase()
    );
}

// ==========================================
// MESAS
// ==========================================

// Verificar se a mesa está ocupada
function reservaAtivaMesa(numero) {

    return ler(CHAVE_RESERVAS).some(reserva =>

        Number(reserva.mesa) === Number(numero) &&

        [
            "Pendente",
            "Paga",
            "Check-in realizado"
        ].includes(reserva.status)
    );
}

// Guardar a mesa selecionada
let mesaSelecionada = "";

// Selecionar mesa pelo clique
function selecionarMesa(numero) {

    if (reservaAtivaMesa(numero)) {
        mensagem(
            "mensagemMesa",
            "Essa mesa já está reservada. Escolha outra.",
            "erro"
        );

        return;
    }

    mesaSelecionada = String(numero);

    const select = document.getElementById("mesaReserva");

    if (select) {
        select.value = String(numero);
    }

    atualizarSelecaoVisual();

    mensagem(
        "mensagemMesa",
        "Mesa " + numero + " selecionada com sucesso!"
    );
}

// Destacar a mesa escolhida
function atualizarSelecaoVisual() {

    document.querySelectorAll(".mesa.livre").forEach(botao => {

        const selecionada =
            botao.dataset.mesa === mesaSelecionada;

        botao.classList.toggle(
            "selecionada",
            selecionada
        );

        botao.setAttribute(
            "aria-pressed",
            String(selecionada)
        );
    });
}

// Criar as dez mesas clicáveis
function atualizarMapa() {

    const mapa = document.getElementById("mapaMesas");
    const select = document.getElementById("mesaReserva");

    if (!mapa) return;

    const selecaoAnterior = mesaSelecionada;

    mapa.innerHTML = "";

    if (select) {
        select.innerHTML =
            '<option value="">Selecione uma mesa</option>';
    }

    for (
        let numero = 1;
        numero <= TOTAL_MESAS;
        numero++
    ) {

        const ocupada = reservaAtivaMesa(numero);

        const botao = document.createElement("button");

        botao.type = "button";

        botao.className = "mesa " +
            (ocupada ? "ocupada" : "livre");

        botao.dataset.mesa = numero;

        botao.disabled = ocupada;

        botao.setAttribute(
            "aria-label",
            "Mesa " + numero + (ocupada ? ", reservada" : ", livre")
        );

        const titulo = document.createElement("strong");
        titulo.textContent = "Mesa " + numero;

        const status = document.createElement("span");
        status.textContent = ocupada ? "Reservada" : "Livre";

        botao.appendChild(titulo);
        botao.appendChild(status);

        if (!ocupada) {

            botao.addEventListener("click", () => {
                selecionarMesa(numero);
            });

            if (select) {
                const opcao = document.createElement("option");

                opcao.value = numero;
                opcao.textContent = "Mesa " + numero;

                select.appendChild(opcao);
            }
        }

        mapa.appendChild(botao);
    }

    // Manter a seleção se a mesa continuar livre
    if (
        selecaoAnterior &&
        !reservaAtivaMesa(selecaoAnterior)
    ) {
        mesaSelecionada = selecaoAnterior;

        if (select) {
            select.value = selecaoAnterior;
        }
    } else {
        mesaSelecionada = "";

        if (select) {
            select.value = "";
        }
    }

    atualizarSelecaoVisual();
}

// Permitir também selecionar pelo campo de opções
document.addEventListener("change", evento => {

    if (evento.target.id === "mesaReserva") {

        const numero = evento.target.value;

        if (numero) {
            selecionarMesa(numero);
        } else {
            mesaSelecionada = "";
            atualizarSelecaoVisual();
        }
    }
});

// ==========================================
// ATUALIZAR RESERVAS
// ==========================================

function classeStatus(status) {

    if (status === "Paga") return "pago";

    if (status === "Check-in realizado") return "checkin";

    if (status.includes("Cancelada")) return "cancelada";

    return "";
}

function atualizarReservas() {

    const lista = document.getElementById("listaReservas");

    if (lista) {

        const reservas = ler(CHAVE_RESERVAS);

        if (!reservas.length) {

            lista.innerHTML =
                '<p class="muted">Ainda não existem reservas.</p>';

        } else {

            lista.innerHTML = reservas
                .slice()
                .reverse()
                .map(reserva => {

                    let botaoReembolso = "";

                    if (podeSolicitarReembolso(reserva)) {

                        botaoReembolso = `
                            <button
                                type="button"
                                class="botao reembolso"
                                data-reembolso="${escapar(reserva.codigo)}"
                            >
                                Solicitar reembolso de 10%
                            </button>
                        `;

                    } else if (reserva.reembolso) {

                        botaoReembolso = `
                            <span class="reembolso-info">
                                Reembolso de 10% solicitado:
                                ${dinheiro(reserva.reembolso.valor)}
                            </span>
                        `;
                    }

                    return `
                        <div class="reserva-item">

                            <strong>
                                ${escapar(reserva.codigo)}
                            </strong>

                            · Mesa ${escapar(reserva.mesa)}

                            <br>

                            <span>
                                ${dataLegivel(reserva.data)}
                            </span>

                            <br>

                            Cliente:
                            ${escapar(reserva.email)}

                            <br>

                            Status:

                            <span class="status ${classeStatus(reserva.status)}">
                                ${escapar(reserva.status)}
                            </span>

                            ${botaoReembolso}

                            ${
                                reserva.status === "Pendente"
                                ? '<br><a href="pagamento.html">Ir para pagamento da caução</a>'
                                : ""
                            }

                        </div>
                    `;

                }).join("");
        }
    }

    // Atualizar opções de pagamento
    const selectPagamento =
        document.getElementById("reservaPagamento");

    if (selectPagamento) {

        const pendentes = ler(CHAVE_RESERVAS).filter(
            reserva => reserva.status === "Pendente"
        );

        selectPagamento.innerHTML =
            '<option value="">Selecione uma reserva</option>';

        pendentes.forEach(reserva => {

            const opcao = document.createElement("option");

            opcao.value = reserva.codigo;

            opcao.textContent =
                `${reserva.codigo} · Mesa ${reserva.mesa} · ${reserva.email}`;

            selectPagamento.appendChild(opcao);
        });
    }
}

// Clique no botão de reembolso
document.addEventListener("click", evento => {

    const botao = evento.target.closest("[data-reembolso]");

    if (!botao) return;

    solicitarReembolso(botao.dataset.reembolso);
});

// ==========================================
// LISTA DE ESPERA
// ==========================================

function atualizarEspera() {

    const lista = document.getElementById("listaEspera");

    if (!lista) return;

    const fila = ler(CHAVE_ESPERA);

    if (!fila.length) {

        lista.innerHTML =
            "<li>A lista de espera está vazia.</li>";

        return;
    }

    lista.innerHTML = fila.map((item, indice) => {

        return `
            <li>
                ${indice + 1}.
                ${escapar(item.email)}
                — aguardando mesa
            </li>
        `;

    }).join("");
}

// ==========================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    verificarNoShow();

    atualizarMapa();
    atualizarReservas();
    atualizarEspera();

    // ======================================
    // CADASTRO
    // ======================================

    const formCadastro =
        document.getElementById("formCadastro");

    if (formCadastro) {

        formCadastro.addEventListener("submit", evento => {

            evento.preventDefault();

            const cliente = {

                nome: document.getElementById("nome")
                    .value.trim(),

                email: document.getElementById("email")
                    .value.trim().toLowerCase(),

                telefone: document.getElementById("telefone")
                    .value.trim(),

                senha: document.getElementById("senha").value
            };

            const clientes = ler(CHAVE_CLIENTES);

            if (clientes.some(c => c.email === cliente.email)) {

                mensagem(
                    "mensagemCadastro",
                    "Já existe um cadastro com esse e-mail.",
                    "erro"
                );

                return;
            }

            clientes.push(cliente);

            salvar(CHAVE_CLIENTES, clientes);

            formCadastro.reset();

            mensagem(
                "mensagemCadastro",
                "Cadastro realizado com sucesso!"
            );
        });
    }

    // ======================================
    // LOGIN
    // ======================================

    const formLogin =
        document.getElementById("formLogin");

    if (formLogin) {

        formLogin.addEventListener("submit", evento => {

            evento.preventDefault();

            const email = document.getElementById("emailLogin")
                .value.trim().toLowerCase();

            const senha = document.getElementById("senhaLogin").value;

            const cliente = ler(CHAVE_CLIENTES).find(
                c => c.email === email && c.senha === senha
            );

            if (!cliente) {

                mensagem(
                    "mensagemLogin",
                    "E-mail ou senha incorretos.",
                    "erro"
                );

                return;
            }

            sessionStorage.setItem(
                "canarinho_cliente_logado",
                cliente.email
            );

            mensagem(
                "mensagemLogin",
                "Bem-vindo(a), " + cliente.nome +
                "! Login realizado com sucesso."
            );
        });
    }

    // ======================================
    // RESERVA DE MESAS
    // ======================================

    const formReserva =
        document.getElementById("formReserva");

    if (formReserva) {

        formReserva.addEventListener("submit", evento => {

            evento.preventDefault();

            verificarNoShow();

            const email = document.getElementById("clienteReserva")
                .value.trim().toLowerCase();

            const mesa = Number(
                document.getElementById("mesaReserva").value
            );

            const data = document.getElementById("dataReserva").value;

            if (!clienteExiste(email)) {

                mensagem(
                    "mensagemReserva",
                    "Cliente não cadastrado. Faça o cadastro primeiro.",
                    "erro"
                );

                return;
            }

            if (!mesa || reservaAtivaMesa(mesa)) {

                mensagem(
                    "mensagemReserva",
                    "Escolha uma mesa disponível.",
                    "erro"
                );

                atualizarMapa();

                return;
            }

            if (
                !data ||
                Number.isNaN(new Date(data).getTime()) ||
                new Date(data).getTime() <= Date.now()
            ) {

                mensagem(
                    "mensagemReserva",
                    "Escolha uma data e horário futuros.",
                    "erro"
                );

                return;
            }

            const reservas = ler(CHAVE_RESERVAS);

            const conflito = reservas.some(reserva =>
                reserva.email === email &&
                [
                    "Pendente",
                    "Paga",
                    "Check-in realizado"
                ].includes(reserva.status)
            );

            if (conflito) {

                mensagem(
                    "mensagemReserva",
                    "Esse cliente já possui uma reserva ativa.",
                    "erro"
                );

                return;
            }

            const novaReserva = {

                codigo: gerarCodigo(),

                email: email,

                mesa: mesa,

                data: data,

                status: "Pendente",

                checkin: false,

                criadoEm: new Date().toISOString()
            };

            reservas.push(novaReserva);

            salvar(CHAVE_RESERVAS, reservas);

            formReserva.reset();

            mesaSelecionada = "";

            mensagem(
                "mensagemReserva",
                "Reserva criada! Código: " + novaReserva.codigo +
                ". Agora confirme a caução na página de pagamento."
            );

            atualizarMapa();
            atualizarReservas();
        });
    }

    // ======================================
    // PAGAMENTO SIMULADO
    // ======================================

    const formPagamento =
        document.getElementById("formPagamento");

    if (formPagamento) {

        formPagamento.addEventListener("submit", evento => {

            evento.preventDefault();

            const codigo =
                document.getElementById("reservaPagamento").value;

            const reservas = ler(CHAVE_RESERVAS);

            const reserva = reservas.find(
                r => r.codigo === codigo &&
                r.status === "Pendente"
            );

            if (!reserva) {

                mensagem(
                    "mensagemPagamento",
                    "Selecione uma reserva pendente válida.",
                    "erro"
                );

                return;
            }

            reserva.status = "Paga";

            reserva.valorCaucao = VALOR_CAUCao;

            reserva.pagoEm = new Date().toISOString();

            salvar(CHAVE_RESERVAS, reservas);

            mensagem(
                "mensagemPagamento",
                "Pagamento simulado confirmado! Valor da caução: " +
                dinheiro(VALOR_CAUCao) +
                ". Nenhum dinheiro foi movimentado."
            );

            atualizarMapa();
            atualizarReservas();
        });
    }

    // ======================================
    // CHECK-IN
    // ======================================

    const formCheckin =
        document.getElementById("formCheckin");

    if (formCheckin) {

        formCheckin.addEventListener("submit", evento => {

            evento.preventDefault();

            verificarNoShow();

            const codigo = document.getElementById("codigoCheckin")
                .value.trim().toUpperCase();

            const reservas = ler(CHAVE_RESERVAS);

            const reserva = reservas.find(
                r => r.codigo.toUpperCase() === codigo
            );

            if (!reserva) {

                mensagem(
                    "mensagemCheckin",
                    "Código de reserva não encontrado.",
                    "erro"
                );

                return;
            }

            if (reserva.status !== "Paga") {

                mensagem(
                    "mensagemCheckin",
                    "Não é possível realizar o check-in. Status: " +
                    reserva.status,
                    "erro"
                );

                return;
            }

            const inicio = new Date(reserva.data).getTime();

            if (Date.now() >= inicio - (30 * 60 * 1000)) {

                verificarNoShow();

                mensagem(
                    "mensagemCheckin",
                    "O prazo de check-in encerrou. A reserva foi cancelada pela regra de No-Show.",
                    "erro"
                );

                atualizarMapa();
                atualizarReservas();

                return;
            }

            reserva.checkin = true;

            reserva.status = "Check-in realizado";

            reserva.checkinEm = new Date().toISOString();

            salvar(CHAVE_RESERVAS, reservas);

            mensagem(
                "mensagemCheckin",
                "Check-in confirmado! Sua mesa " +
                reserva.mesa + " está garantida."
            );

            atualizarMapa();
            atualizarReservas();
        });
    }

    // ======================================
    // LISTA DE ESPERA
    // ======================================

    const formEspera =
        document.getElementById("formEspera");

    if (formEspera) {

        formEspera.addEventListener("submit", evento => {

            evento.preventDefault();

            const email = document.getElementById("emailEspera")
                .value.trim().toLowerCase();

            if (!clienteExiste(email)) {

                mensagem(
                    "mensagemEspera",
                    "Cadastre-se antes de entrar na lista de espera.",
                    "erro"
                );

                return;
            }

            const fila = ler(CHAVE_ESPERA);

            if (fila.some(item => item.email === email)) {

                mensagem(
                    "mensagemEspera",
                    "Esse e-mail já está na lista de espera.",
                    "erro"
                );

                return;
            }

            fila.push({

                email: email,

                entrouEm: new Date().toISOString()
            });

            salvar(CHAVE_ESPERA, fila);

            formEspera.reset();

            mensagem(
                "mensagemEspera",
                "Você entrou na lista de espera com sucesso!"
            );

            atualizarEspera();
        });
    }
// Atualizar reservas e reembolsos a cada 30 segundos
setInterval(() => {
    verificarNoShow();
    atualizarMapa();
    atualizarReservas();
}, 30000);
});
