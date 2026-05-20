import readline from "readline";
import { askAI } from "../core/ai.js";
import { speak } from "../core/voice.js";
import { carregarMemoria } from "../core/memory.js";
import {
    adicionarNaSessao,
    obterMemoriaSessao,
    limparMemoriaSessao
} from "../core/session-memory.js";

import { spawn, execFile } from "child_process";
import path from "path";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const memoriaLocal = {
    nome: null
};

function tocarAudio(audioPath) {
    return new Promise((resolve) => {
        if (!audioPath) return resolve();

        const caminho = path.resolve(audioPath);

        const comando = `
Add-Type -AssemblyName presentationCore;
$player = New-Object System.Windows.Media.MediaPlayer;
$player.Open([Uri]"${caminho.replace(/\\/g, "\\\\")}");

while ($player.NaturalDuration.HasTimeSpan -eq $false) {
    Start-Sleep -Milliseconds 100;
}

$duration = $player.NaturalDuration.TimeSpan.TotalSeconds;
$player.Play();

Start-Sleep -Seconds ([Math]::Ceiling($duration) + 1);

$player.Stop();
$player.Close();
`;

        const processo = execFile("powershell", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            comando
        ]);

        processo.on("close", () => resolve());
        processo.on("error", () => resolve());
    });
}

async function falarTexto(texto) {
    const audio = await speak(texto);

    if (audio) {
        await tocarAudio(audio);
    }
}

function executarPython(script) {
    return new Promise((resolve) => {
        const processo = spawn("py", [script]);

        let saida = "";

        processo.stdout.on("data", (data) => {
            saida += data.toString();
        });

        processo.stderr.on("data", (data) => {
            saida += data.toString();
        });

        processo.on("close", () => {
            resolve(saida.trim());
        });
    });
}

function extrairTextoMicrofone(saida) {
    if (!saida) return null;

    const linhas = saida
        .split("\n")
        .map(linha => linha.trim())
        .filter(Boolean);

    for (const linha of linhas) {
        if (linha.startsWith("TEXT:")) {
            return linha.replace("TEXT:", "").trim();
        }

        if (linha.startsWith("COMMAND:")) {
            return linha.replace("COMMAND:", "").trim();
        }
    }

    if (
        saida.includes("NAO_ENTENDI") ||
        saida.includes("ERRO")
    ) {
        return null;
    }

    return linhas[linhas.length - 1] || null;
}

function extrairNome(texto) {
    const padroes = [
        /meu nome é\s+(.+)/i,
        /meu nome e\s+(.+)/i,
        /eu me chamo\s+(.+)/i,
        /pode me chamar de\s+(.+)/i,
        /me chama de\s+(.+)/i
    ];

    for (const padrao of padroes) {
        const match = texto.match(padrao);

        if (match && match[1]) {
            return match[1].replace(/[.!?]/g, "").trim();
        }
    }

    return null;
}

function respostaLocal(mensagem) {
    const texto = mensagem.toLowerCase().trim();

    const nomeDetectado = extrairNome(mensagem);

    if (nomeDetectado) {
        memoriaLocal.nome = nomeDetectado;
        return `Entendido. Vou te chamar de ${memoriaLocal.nome}.`;
    }

    if (
        texto.includes("qual meu nome") ||
        texto.includes("qual o meu nome") ||
        texto.includes("como eu me chamo") ||
        texto.includes("quem sou eu")
    ) {
        if (memoriaLocal.nome) {
            return `Seu nome é ${memoriaLocal.nome}.`;
        }

        return "Ainda não sei seu nome nesta sessão.";
    }

    if (
        texto.includes("qual seu nome") ||
        texto.includes("qual o seu nome") ||
        texto.includes("seu nome") ||
        texto.includes("quem é você") ||
        texto.includes("quem é vc")
    ) {
        return "Eu sou a ATLAS, sua assistente pessoal.";
    }

    if (texto.includes("status")) {
        return "Sistema ATLAS operacional. Wake mode ativo, microfone ativo, voz ativa e memória local ativa.";
    }

    if (
        texto.includes("cloud code") ||
        texto.includes("cloudcode")
    ) {
        return "A integração com Cloud Code será a próxima etapa.";
    }

    if (
        texto.includes("limpar memória") ||
        texto.includes("limpar memoria")
    ) {
        memoriaLocal.nome = null;
        limparMemoriaSessao();
        return "Memória local apagada.";
    }

    return null;
}

function extrairTextoResposta(resposta) {
    if (typeof resposta === "string") return resposta;
    return resposta?.text || "Sem resposta.";
}

function respostaComErro(texto) {
    const t = texto.toLowerCase();

    return (
        t.includes("erro") ||
        t.includes("quota") ||
        t.includes("429") ||
        t.includes("too many requests") ||
        t.includes("insufficient")
    );
}

async function responder(textoUsuario) {
    adicionarNaSessao("Usuário", textoUsuario);

    const local = respostaLocal(textoUsuario);

    if (local) {
        adicionarNaSessao("ATLAS", local);
        console.log(`🤖 ATLAS: ${local}\n`);
        await falarTexto(local);
        return;
    }

    const contexto = `
MEMÓRIA PERMANENTE:
${carregarMemoria()}

MEMÓRIA DA SESSÃO:
${obterMemoriaSessao()}

MEMÓRIA LOCAL:
Nome do usuário: ${memoriaLocal.nome || "não informado"}
`;

    let resposta = await askAI(
        textoUsuario,
        contexto,
        "auto",
        false
    );

    let textoResposta = extrairTextoResposta(resposta);

    if (respostaComErro(textoResposta)) {
        textoResposta = "Estou sem acesso às IAs externas, mas continuo operacional localmente.";
    }

    adicionarNaSessao("ATLAS", textoResposta);

    console.log(`🤖 ATLAS: ${textoResposta}\n`);
    await falarTexto(textoResposta);
}

async function modoWake() {
    while (true) {
        console.log("\n👂 ATLAS ouvindo wake word...\n");

        const saidaWake = await executarPython("scripts/atlas-wake.py");

        if (!saidaWake.includes("WAKE_WORD") && !saidaWake.includes("COMMAND:")) {
            continue;
        }

        const comandoDireto = extrairTextoMicrofone(saidaWake);

        if (comandoDireto && !comandoDireto.includes("WAKE_WORD")) {
            console.log(`🎤 Você disse: atlas ${comandoDireto}\n`);
            await responder(comandoDireto);
            continue;
        }

        const confirmacao = "Sim, estou ouvindo.";

        console.log(`🤖 ATLAS: ${confirmacao}\n`);
        await falarTexto(confirmacao);

        const saidaComando = await executarPython("scripts/atlas-mic.py");
        const comando = extrairTextoMicrofone(saidaComando);

        if (!comando) {
            const erro = "Não entendi. Voltando ao modo de escuta.";
            console.log(`🤖 ATLAS: ${erro}\n`);
            await falarTexto(erro);
            continue;
        }

        console.log(`🎤 Você disse: ${comando}\n`);

        await responder(comando);
    }
}

function perguntar() {
    rl.question("🎤 Você: ", async (entrada) => {
        const comando = entrada.trim().toLowerCase();

        if (comando === "sair") {
            await falarTexto("Encerrando sistema.");
            rl.close();
            process.exit(0);
        }

        if (comando === "/limpar") {
            memoriaLocal.nome = null;
            limparMemoriaSessao();

            console.log("🧹 Memória apagada.\n");
            await falarTexto("Memória apagada.");
            return perguntar();
        }

        if (comando === "/wake") {
            console.log("🚀 Wake mode ativado.\n");
            await modoWake();
            return;
        }

        await responder(entrada);
        perguntar();
    });
}

console.log(`
=================================
ATLAS TERMINAL WAKE MODE ONLINE
=================================

Comandos:
/wake      -> ativar wake mode
/limpar    -> apagar memória
sair       -> fechar

Fale:
"atlas qual seu nome"

ou fale:
"atlas"
e depois o comando.

=================================
`);

perguntar();