import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

const pastasMemoria = [
    "00 - Sistema",
    "01 - Memória",
    "02 - Projetos",
    "03 - Conhecimento",
    "04 - Prompts",
    "05 - Logs"
];

function lerArquivosMarkdownRecursivo(
    caminhoPasta
) {

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
                lerArquivosMarkdownRecursivo(
                    caminhoItem
                );
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
            lerArquivosMarkdownRecursivo(
                caminhoPasta
            );
    }

    return memoriaCompleta;
}

app.post("/chat", async (req, res) => {

    try {

        const { mensagem } = req.body;

        const memoria =
            carregarMemoria();

        const prompt = `
Você é a ATLAS.

MEMÓRIA:
${memoria}

MENSAGEM:
${mensagem}
`;

        const result =
            await model.generateContent(
                prompt
            );

        const response =
            await result.response;

        const texto =
            response.text();

        res.json({
            resposta: texto
        });

    } catch (erro) {

        console.log(erro);

        res.status(500).json({
            resposta:
                "Erro interno da ATLAS."
        });
    }
});

app.listen(PORT, () => {

    console.log(`
==============================
ATLAS SERVER ONLINE
==============================

http://localhost:3000
`);
});