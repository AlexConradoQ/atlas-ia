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
let audioAtual = null;
let audioLiberado = false;

function atualizarRelogio() {
    const agora = new Date();
    clock.textContent = agora.toLocaleTimeString("pt-BR");
}

setInterval(atualizarRelogio, 1000);
atualizarRelogio();

function liberarAudio() {
    audioLiberado = true;

    if (voiceStatus) {
        voiceStatus.textContent = "● Audio ready.";
    }

    document.removeEventListener("click", liberarAudio);
    document.removeEventListener("keydown", liberarAudio);
}

document.addEventListener("click", liberarAudio);
document.addEventListener("keydown", liberarAudio);

function limparTextoParaHtml(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function adicionarMensagem(texto, tipo) {
    const div = document.createElement("div");

    div.classList.add("message", tipo);

    const autor = tipo === "user" ? "YOU" : "ATLAS";

    div.innerHTML = `
        <strong>${autor}</strong>
        <p>${limparTextoParaHtml(texto)}</p>
    `;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    return div;
}

function tocarAudioPremium(audioUrl) {
    if (!audioUrl) return;

    if (audioAtual) {
        audioAtual.pause();
        audioAtual.currentTime = 0;
    }

    audioAtual = new Audio();
    audioAtual.src = audioUrl;
    audioAtual.volume = 1;
    audioAtual.autoplay = true;
    audioAtual.preload = "auto";

    const playPromise = audioAtual.play();

    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                if (voiceStatus) {
                    voiceStatus.textContent = "● ATLAS speaking...";
                }
            })
            .catch((erro) => {
                console.error("Autoplay bloqueado:", erro);

                if (voiceStatus) {
                    voiceStatus.textContent =
                        "● Clique na tela e envie de novo para liberar a voz.";
                }
            });
    }

    audioAtual.onended = () => {
        if (voiceStatus) {
            voiceStatus.textContent = "● Waiting for command...";
        }
    };
}

async function enviarMensagem(mensagem, responderComVoz = true) {
    if (!mensagem) return;

    adicionarMensagem(mensagem, "user");

    const pensando = adicionarMensagem("Processando comando...", "atlas");

    try {
        const resposta = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mensagem,
                voice: responderComVoz
            })
        });

        const dados = await resposta.json();

        const textoResposta =
            dados.resposta ||
            dados.text ||
            "Sem resposta da ATLAS.";

        pensando.innerHTML = `
            <strong>ATLAS</strong>
            <p>${limparTextoParaHtml(textoResposta)}</p>
        `;

        if (responderComVoz && dados.audio) {
            tocarAudioPremium(dados.audio);
        }

    } catch (erro) {
        const textoErro = "Erro ao conectar com a ATLAS.";

        pensando.innerHTML = `
            <strong>ATLAS</strong>
            <p>${textoErro}</p>
        `;

        if (voiceStatus) {
            voiceStatus.textContent = "● Erro de conexão.";
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
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
        ouvindo = true;
        voiceBtn.textContent = "OUVINDO...";

        if (voiceStatus) {
            voiceStatus.textContent = "● Listening...";
        }
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
            if (voiceStatus) {
                voiceStatus.textContent =
                    "● Nenhuma fala detectada. Tente novamente.";
            }

            return;
        }

        if (voiceStatus) {
            voiceStatus.textContent = "● Voice error";
        }
    };

    recognition.onend = () => {
        ouvindo = false;
        voiceBtn.textContent = "VOICE";

        if (
            voiceStatus &&
            voiceStatus.textContent === "● Listening..."
        ) {
            voiceStatus.textContent = "● Waiting for command...";
        }
    };

    voiceBtn.addEventListener("click", () => {
        liberarAudio();

        if (ouvindo) {
            recognition.stop();
            return;
        }

        if (audioAtual) {
            audioAtual.pause();
            audioAtual.currentTime = 0;
        }

        recognition.start();
    });

} else if (voiceBtn) {
    voiceBtn.addEventListener("click", () => {
        alert("Reconhecimento de voz não suportado neste navegador.");
    });
}