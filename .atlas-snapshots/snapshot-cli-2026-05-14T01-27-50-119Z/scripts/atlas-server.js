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

    const itens = fs.readdirSync(
        caminhoPasta,
        { withFileTypes: true }
    );

    for (const item of itens) {

        const caminhoItem = path.join(
            caminhoPasta,
            item.name
        );

        if (item.isDirectory()) {
            conteudoCompleto +=
                lerArquivosMarkdownRecursivo(caminhoItem);
        }

        if (
            item.isFile() &&
            item.name.endsWith(".md")
        ) {
            const conteudo = fs.readFileSync(
                caminhoItem,
                "utf8"
            );

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

        const caminhoPasta = path.join(
            process.cwd(),
            pasta
        );

        memoriaCompleta +=
            lerArquivosMarkdownRecursivo(caminhoPasta);
    }

    return memoriaCompleta;
}

function identificarProvider(mensagem) {

    const texto = mensagem.trim().toLowerCase();

    if (texto.startsWith("/chatgpt")) {
        return "openai";
    }

    if (texto.startsWith("/gemini")) {
        return "gemini";
    }

    if (texto.startsWith("/atlas")) {
        return "auto";
    }

    return "auto";
}

function limparComando(mensagem) {

    return mensagem
        .replace(/^\/chatgpt\s*/i, "")
        .replace(/^\/gemini\s*/i, "")
        .replace(/^\/atlas\s*/i, "")
        .trim();
}

app.get("/", (req, res) => {
    res.json({
        status: "ATLAS SERVER ONLINE",
        comandos: [
            "/chatgpt",
            "/gemini",
            "/atlas"
        ]
    });
});

app.post("/chat", async (req, res) => {

    try {

        const { mensagem } = req.body;

        if (!mensagem || !mensagem.trim()) {
            return res.json({
                resposta: "Digite uma mensagem para a ATLAS."
            });
        }

        const provider = identificarProvider(mensagem);

        const mensagemLimpa = limparComando(mensagem);

        const memoria = carregarMemoria();

        const resposta = await askAI(
            mensagemLimpa || mensagem,
            memoria,
            provider
        );

        res.json({
            resposta,
            provider
        });

    } catch (erro) {

        console.log(erro);

        res.status(500).json({
            resposta: "Erro interno da ATLAS.",
            erro: erro.message
        });
    }
});

app.listen(PORT, () => {

    console.log(`
==============================
ATLAS SERVER ONLINE
==============================

Servidor:
http://localhost:3000

Comandos:
/chatgpt  -> OpenAI
/gemini   -> Gemini
/atlas    -> Auto
==============================
`);
});