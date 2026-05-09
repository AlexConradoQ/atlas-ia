import fs from "fs";
import path from "path";

export const pastasMemoria = [
    "00 - Sistema",
    "01 - Memória",
    "02 - Projetos",
    "03 - Conhecimento",
    "04 - Prompts",
    "05 - Logs"
];

export function lerMarkdownRecursivo(caminhoPasta, nomePastaBase) {

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

            conteudoCompleto += lerMarkdownRecursivo(
                caminhoItem,
                nomePastaBase
            );
        }

        if (
            item.isFile() &&
            item.name.endsWith(".md")
        ) {

            try {

                const conteudo = fs.readFileSync(
                    caminhoItem,
                    "utf8"
                );

                conteudoCompleto += `

========================
ARQUIVO: ${item.name}
PASTA: ${nomePastaBase}
========================

${conteudo}

`;

            } catch {

                console.log(
                    `Erro ao ler: ${item.name}`
                );
            }
        }
    }

    return conteudoCompleto;
}

export function carregarMemoria() {

    let memoriaCompleta = "";

    for (const pasta of pastasMemoria) {

        const caminhoPasta = path.join(
            process.cwd(),
            pasta
        );

        memoriaCompleta += lerMarkdownRecursivo(
            caminhoPasta,
            pasta
        );
    }

    return memoriaCompleta;
}