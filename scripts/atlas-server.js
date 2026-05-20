import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { askAI } from "../core/ai.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const audioDir = path.join(process.cwd(), "audio");

if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

app.use("/audio", express.static(audioDir));

const pastasMemoria = [
    "00 - Sistema",
    "01 - Memória",
    "02 - Projetos",
    "03 - Conhecimento",
    "04 - Prompts",
    "05 - Logs"
];

function lerArquivosMarkdownRecursivo(caminhoPasta) {
    let conteudoCompleto = "";

    if (!fs.existsSync(caminhoPasta)) {
        return conteudoCompleto;
    }

    const itens = fs.readdirSync(caminhoPasta, { withFileTypes: true });

    for (const item of itens) {
        const caminhoItem = path.join(caminhoPasta, item.name);

        if (item.isDirectory()) {
            conteudoCompleto += lerArquivosMarkdownRecursivo(caminhoItem);
        }

        if (item.isFile() && item.name.endsWith(".md")) {
            const conteudo = fs.readFileSync(caminhoItem, "utf8");

            conteudoCompleto += `

ARQUIVO: ${caminhoItem}

${conteudo}

`;
        }
    }

    return conteudoCompleto;
}

function carregarMemoria() {
    let memoriaCompleta = "";

    for (const pasta of pastasMemoria) {
        const caminhoPasta = path.join(process.cwd(), pasta);
        memoriaCompleta += lerArquivosMarkdownRecursivo(caminhoPasta);
    }

    return memoriaCompleta;
}

function identificarProvider(mensagem) {
    const texto = mensagem.trim().toLowerCase();

    if (texto.startsWith("/chatgpt")) return "openai";
    if (texto.startsWith("/gemini")) return "gemini";
    if (texto.startsWith("/atlas")) return "auto";

    return "auto";
}

function limparComando(mensagem) {
    return mensagem
        .replace(/^\/chatgpt\s*/i, "")
        .replace(/^\/gemini\s*/i, "")
        .replace(/^\/atlas\s*/i, "")
        .trim();
}

function gerarUrlAudio(audioPath) {
    if (!audioPath) return null;

    const nomeArquivo = path.basename(audioPath);
    return `http://localhost:${PORT}/audio/${nomeArquivo}?t=${Date.now()}`;
}

app.get("/", (req, res) => {
    res.json({
        status: "ATLAS SERVER ONLINE",
        comandos: ["/chatgpt", "/gemini", "/atlas"],
        voz: "pt-BR-FranciscaNeural"
    });
});

app.post("/chat", async (req, res) => {
    console.log("\n==============================");
    console.log("NOVA MENSAGEM RECEBIDA");
    console.log("==============================");

    try {
        const { mensagem, voice } = req.body;

        console.log("Mensagem:", mensagem);
        console.log("Voice:", voice);

        if (!mensagem || !mensagem.trim()) {
            return res.json({
                resposta: "Digite uma mensagem para a ATLAS.",
                audio: null
            });
        }

        const provider = identificarProvider(mensagem);
        const mensagemLimpa = limparComando(mensagem);

        console.log("Provider:", provider);
        console.log("Carregando memória...");

        const memoria = carregarMemoria();

        console.log("Memória carregada.");
        console.log("Chamando IA...");

        const resultado = await askAI(
            mensagemLimpa || mensagem,
            memoria,
            provider,
            Boolean(voice)
        );

        console.log("IA respondeu.");

        const textoResposta =
            typeof resultado === "string"
                ? resultado
                : resultado.text;

        const audioUrl =
            typeof resultado === "object"
                ? gerarUrlAudio(resultado.audio)
                : null;

        console.log("Texto:", textoResposta);
        console.log("Audio URL:", audioUrl);
        console.log("Resposta enviada ao painel.");

        res.json({
            resposta: textoResposta,
            audio: audioUrl,
            provider
        });

    } catch (erro) {
        console.log("ERRO INTERNO DA ATLAS:");
        console.log(erro);

        res.status(500).json({
            resposta: "Erro interno da ATLAS.",
            audio: null,
            erro: erro.message
        });
    }
});

const server = app.listen(PORT, () => {
    console.log(`
==============================
ATLAS SERVER ONLINE
==============================

Servidor:
http://localhost:${PORT}

Áudio:
http://localhost:${PORT}/audio/atlas-response.mp3

Voz:
pt-BR-FranciscaNeural

Comandos:
/chatgpt  -> OpenAI
/gemini   -> Gemini
/atlas    -> Auto
==============================
`);
});

server.on("error", (erro) => {
    console.log("ERRO AO INICIAR SERVIDOR:");
    console.log(erro);
});