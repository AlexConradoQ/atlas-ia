const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const messages = document.getElementById("messages");
const clearBtn = document.getElementById("clearBtn");
const clock = document.getElementById("clock");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;
let ouvindo = false;

function atualizarRelogio() {
    const agora = new Date();
    clock.textContent = agora.toLocaleTimeString("pt-BR");
}

setInterval(atualizarRelogio, 1000);
atualizarRelogio();

function limparTextoParaVoz(texto) {
    return texto
        .replace(/[#*_`>\-\[\]\(\)]/g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function falarTexto(texto) {
    window.speechSynthesis.cancel();

    const voz = new SpeechSynthesisUtterance(
        limparTextoParaVoz(texto)
    );

    voz.lang = "pt-BR";
    voz.rate = 1;
    voz.pitch = 1;
    voz.volume = 1;

    window.speechSynthesis.speak(voz);
}

function adicionarMensagem(texto, tipo) {
    const div = document.createElement("div");

    div.classList.add("message", tipo);

    if (tipo === "user") {
        div.innerHTML = `
            <strong>YOU</strong>
            <p>${texto}</p>
        `;
    } else {
        div.innerHTML = `
            <strong>ATLAS</strong>
            <p>${texto}</p>
        `;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

async function enviarMensagem(mensagem, responderComVoz = true) {
    if (!mensagem) return;

    adicionarMensagem(mensagem, "user");

    adicionarMensagem("Processando comando...", "atlas");
    const pensando = messages.lastChild;

    try {
        const resposta = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ mensagem })
        });

        const dados = await resposta.json();

        pensando.innerHTML = `
            <strong>ATLAS</strong>
            <p>${dados.resposta}</p>
        `;

        if (responderComVoz) {
            falarTexto(dados.resposta);
        }

    } catch (erro) {
        const textoErro = "Erro ao conectar com a ATLAS.";

        pensando.innerHTML = `
            <strong>ATLAS</strong>
            <p>${textoErro}</p>
        `;

        if (responderComVoz) {
            falarTexto(textoErro);
        }
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mensagem = input.value.trim();
    input.value = "";

    await enviarMensagem(mensagem, true);
});

clearBtn.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message atlas">
            <strong>ATLAS</strong>
            <p>Conversa limpa. ATLAS online.</p>
        </div>
    `;
});

document.querySelectorAll(".footer button").forEach((button) => {
    button.addEventListener("click", () => {
        const nome = button.textContent.trim();

        const comandos = {
            "DASHBOARD": "faça um resumo geral do sistema ATLAS",
            "MEMORY": "/memoria",
            "PROJECTS": "/projetos",
            "KNOWLEDGE": "quais conhecimentos estão registrados na sua memória?",
            "PROMPTS": "quais prompts e regras você conhece?",
            "LOGS": "resuma os logs mais recentes"
        };

        if (comandos[nome]) {
            enviarMensagem(comandos[nome], true);
        }
    });
});

document.querySelectorAll(".actions button").forEach((button) => {
    if (button.id === "voiceBtn") return;

    button.addEventListener("click", () => {
        const comando = button.dataset.command;

        if (comando) {
            enviarMensagem(comando, true);
        }
    });
});

if (SpeechRecognition && voiceBtn) {
    recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        ouvindo = true;
        voiceBtn.textContent = "OUVINDO...";
        voiceStatus.textContent = "● Listening...";
    };

    recognition.onresult = (event) => {
        let textoFinal = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                textoFinal += event.results[i][0].transcript;
            }
        }

        if (textoFinal.trim()) {
            const texto = textoFinal.trim();

            input.value = texto;

            recognition.stop();

            enviarMensagem(texto, true);
        }
    };

    recognition.onerror = (event) => {
        voiceBtn.textContent = "VOICE";

        if (event.error === "no-speech") {
            voiceStatus.textContent = "● Nenhuma fala detectada. Tente novamente.";
            return;
        }

        voiceStatus.textContent = "● Voice error";
        falarTexto("Não consegui capturar sua voz.");
    };

    recognition.onend = () => {
        ouvindo = false;
        voiceBtn.textContent = "VOICE";
        voiceStatus.textContent = "● Waiting for command...";
    };

    voiceBtn.addEventListener("click", () => {
        if (ouvindo) {
            recognition.stop();
            return;
        }

        window.speechSynthesis.cancel();
        recognition.start();
    });

} else if (voiceBtn) {
    voiceBtn.addEventListener("click", () => {
        alert("Reconhecimento de voz não suportado neste navegador.");
    });
}