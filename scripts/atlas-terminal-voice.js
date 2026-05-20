import readline from "readline";
import { askAI } from "../core/ai.js";
import { speak } from "../core/voice.js";
import { execFile } from "child_process";
import path from "path";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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

function respostaLocal(mensagem) {
    const texto = mensagem.toLowerCase().trim();

    if (["oi", "olá", "ola", "eai", "e aí", "bom dia", "boa tarde", "boa noite"].includes(texto)) {
        return "Olá, Alex. Estou online no terminal e pronta para te ajudar.";
    }

    if (texto.includes("quem é você") || texto.includes("quem e voce")) {
        return "Eu sou a ATLAS, sua assistente local. Posso responder por texto e voz dentro do terminal do VS Code.";
    }

    if (texto.includes("status")) {
        return "Sistema ATLAS operacional. Voz ativa. Terminal ativo. APIs externas podem estar limitadas no momento.";
    }

    if (texto.includes("cloud code") || texto.includes("cloudcode")) {
        return "A integração com Cloud Code será feita na próxima etapa. Primeiro vamos estabilizar minha conversa por voz e texto no terminal.";
    }

    if (texto.includes("ajuda") || texto.includes("comandos")) {
        return "Comandos disponíveis: sair, status, quem é você, cloud code, gemini, chatgpt e atlas.";
    }

    return null;
}

function extrairTexto(resposta) {
    if (typeof resposta === "string") return resposta;
    return resposta?.text || "Sem resposta.";
}

function respostaComErro(texto) {
    const t = texto.toLowerCase();

    return (
        t.includes("erro gemini") ||
        t.includes("erro openai") ||
        t.includes("too many requests") ||
        t.includes("insufficient_quota") ||
        t.includes("limite") ||
        t.includes("quota") ||
        t.includes("429")
    );
}

async function falarTexto(texto) {
    const audio = await speak(texto);

    if (audio) {
        await tocarAudio(audio);
    }
}

async function responder(mensagem) {
    console.log("\n🧠 ATLAS pensando...\n");

    const textoLocal = respostaLocal(mensagem);

    if (textoLocal) {
        console.log(`🤖 ATLAS: ${textoLocal}`);
        await falarTexto(textoLocal);
        return;
    }

    let resposta = await askAI(mensagem, "", "gemini", true);
    let texto = extrairTexto(resposta);

    if (respostaComErro(texto)) {
        console.log("⚠️ Gemini indisponível. Tentando OpenAI...\n");

        resposta = await askAI(mensagem, "", "openai", true);
        texto = extrairTexto(resposta);
    }

    if (respostaComErro(texto)) {
        texto = "Estou sem cota nas IAs externas agora, mas continuo operacional no modo local. Posso executar respostas simples, comandos e preparar a integração com Cloud Code.";
    }

    console.log(`🤖 ATLAS: ${texto}`);

    const audio =
        typeof resposta === "object" && resposta?.audio
            ? resposta.audio
            : await speak(texto);

    await tocarAudio(audio);
}

function perguntar() {
    rl.question("\n🎤 Você: ", async (mensagem) => {
        const texto = mensagem.trim();

        if (!texto) {
            return perguntar();
        }

        if (texto.toLowerCase() === "sair") {
            const despedida = "Encerrando sistema. Até logo, Alex.";
            console.log(`🤖 ATLAS: ${despedida}`);
            await falarTexto(despedida);
            rl.close();
            process.exit(0);
        }

        try {
            await responder(texto);
        } catch (erro) {
            const falha = "Tive um erro interno, mas continuo online.";
            console.log(`❌ ${erro.message}`);
            console.log(`🤖 ATLAS: ${falha}`);
            await falarTexto(falha);
        }

        perguntar();
    });
}

console.log(`
====================================
ATLAS TERMINAL VOICE ONLINE
====================================

Modo local ativo
Voz feminina ativa
Fallback Gemini → OpenAI → Local

Digite "sair" para fechar.

====================================
`);

perguntar();