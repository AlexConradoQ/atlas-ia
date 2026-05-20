import readline from "readline";
import { askAI } from "../core/ai.js";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function pegarTexto(resposta) {
    if (typeof resposta === "string") return resposta;
    return resposta?.text || "Sem resposta.";
}

function deuErroGemini(texto) {
    return (
        texto.includes("Erro Gemini") ||
        texto.includes("Too Many Requests") ||
        texto.includes("429") ||
        texto.includes("quota")
    );
}

async function responder(mensagem) {
    console.log("\n🧠 ATLAS pensando...\n");

    let resposta = await askAI(
        mensagem,
        "",
        "gemini",
        true
    );

    let texto = pegarTexto(resposta);

    if (deuErroGemini(texto)) {
        console.log("⚠️ Gemini sem cota agora. Tentando OpenAI...\n");

        resposta = await askAI(
            mensagem,
            "",
            "openai",
            true
        );

        texto = pegarTexto(resposta);
    }

    console.log(`🤖 ATLAS: ${texto}`);
}

function perguntar() {
    rl.question("\n🎤 Você: ", async (mensagem) => {
        const texto = mensagem.trim();

        if (!texto) {
            return perguntar();
        }

        if (texto.toLowerCase() === "sair") {
            console.log("\nATLAS encerrada.");
            rl.close();
            process.exit(0);
        }

        try {
            await responder(texto);
        } catch (erro) {
            console.log("\n❌ Erro geral:", erro.message);
        }

        perguntar();
    });
}

console.log(`
====================================
ATLAS TERMINAL VOICE ONLINE
====================================

Voz ativa
Fallback Gemini → OpenAI
Digite "sair" para fechar

====================================
`);

perguntar();