import fs from "fs";
import path from "path";
import readline from "readline";

import { salvarLog } from "../core/logs.js";

import {
    listarArquivosRecursivo,
    lerArquivoProjeto,
    listarProjetos
} from "../core/files.js";

import {
    carregarMemoria,
    pastasMemoria
} from "../core/memory.js";

import {
    gerarComRetry
} from "../core/ai.js";

function salvarConversa(usuario, resposta) {
    try {

        const caminhoLog = path.join(
            process.cwd(),
            "05 - Logs",
            "conversa.md"
        );

        const data =
            new Date().toLocaleString("pt-BR");

        const conteudo = `

# ${data}

## Alex:
${usuario}

## ATLAS:
${resposta}

-----------------------------------
`;

        fs.appendFileSync(
            caminhoLog,
            conteudo,
            "utf8"
        );

    } catch {

        console.log(
            "Erro ao salvar conversa."
        );
    }
}

function gerarStatusLocal() {

    const arquivos =
        listarArquivosRecursivo(
            process.cwd()
        );

    const projetos =
        listarProjetos();

    return `
STATUS LOCAL DA ATLAS

Sistema:
- ATLAS rodando no terminal do VS Code
- Memória conectada ao Obsidian
- Leitura de arquivos ativa
- Modo agente disponível
- Modo econômico disponível

Pastas de memória:
${pastasMemoria.map(
    pasta => `- ${pasta}`
).join("\n")}

Projetos encontrados:
${projetos.length
    ? projetos.map(
        p => `- ${p}`
    ).join("\n")
    : "- Nenhum projeto encontrado"
}

Arquivos mapeados:
- Total aproximado:
${arquivos.length}

Comandos locais disponíveis:
- /help
- /status
- /tree
- /agente-lite

Comandos com IA:
- /analisar
- /organizar
- /agente
- /analisar-arquivo caminho
- /editar-arquivo caminho
`;
}

function gerarTreeLocal() {

    const arquivos =
        listarArquivosRecursivo(
            process.cwd()
        );

    return `
ESTRUTURA DO PROJETO

${arquivos
    .slice(0, 250)
    .join("\n")}
`;
}

function gerarHelp() {

    return `
COMANDOS DA ATLAS

Comandos locais:
- /help
- /status
- /tree
- /projetos
- /arquivos
- /ler caminho
- /agente-lite

Comandos IA:
- /analisar
- /organizar
- /agente
- /analisar-arquivo caminho
- /editar-arquivo caminho

Digite:
- sair
`;
}

function executarAgenteLite() {

    const projetos =
        listarProjetos();

    const arquivos =
        listarArquivosRecursivo(
            process.cwd()
        );

    const principais =
        arquivos.filter(arquivo =>
            arquivo.endsWith(".js") ||
            arquivo.endsWith(".html") ||
            arquivo.endsWith(".css") ||
            arquivo.endsWith(".json") ||
            arquivo.endsWith(".md")
        );

    const relatorio = `
AGENTE LITE - ANÁLISE LOCAL

Visão geral:
A ATLAS está estruturada
como uma IA pessoal
com memória em Obsidian,
terminal inteligente,
leitura de arquivos
e comandos internos.

Projetos detectados:
${projetos.length
    ? projetos.map(
        p => `- ${p}`
    ).join("\n")
    : "- Nenhum projeto detectado"
}

Arquivos importantes:
${principais
    .slice(0, 80)
    .map(a => `- ${a}`)
    .join("\n")}
`;

    salvarLog(
        "agente-lite-atlas.md",
        relatorio
    );

    return relatorio;
}

async function analisarArquivo(
    caminhoArquivo
) {

    const conteudo =
        lerArquivoProjeto(
            caminhoArquivo
        );

    const prompt = `
Você é a ATLAS.

Analise profundamente
este arquivo:

${caminhoArquivo}

${conteudo}
`;

    return await gerarComRetry(
        prompt
    );
}

async function editarArquivoIA(
    caminhoArquivo
) {

    const conteudo =
        lerArquivoProjeto(
            caminhoArquivo
        );

    const prompt = `
Você é a ATLAS.

Melhore este código
mantendo compatibilidade.

Retorne somente
o código final.

${conteudo}
`;

    return await gerarComRetry(
        prompt
    );
}

async function executarAgente() {

    const memoria =
        carregarMemoria()
            .substring(0, 12000);

    const arquivos =
        listarArquivosRecursivo(
            process.cwd()
        )
        .slice(0, 80)
        .join("\n");

    const prompt = `
Você é a ATLAS
em modo agente.

MEMÓRIA:

${memoria}

ARQUIVOS:

${arquivos}
`;

    const resposta =
        await gerarComRetry(prompt);

    if (
        !resposta ||
        resposta.includes(
            "Não consegui acessar"
        )
    ) {

        const fallback =
            executarAgenteLite();

        salvarLog(
            "agente-atlas.md",
            fallback
        );

        return fallback;
    }

    salvarLog(
        "agente-atlas.md",
        resposta
    );

    return resposta;
}

const rl =
    readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

console.log(`
==============================
ATLAS ONLINE
==============================

/help
/status
/tree
/agente-lite
/analisar
/organizar
/agente

==============================
`);

async function conversar() {

    rl.question(
        "Você: ",
        async (mensagem) => {

        const comando =
            mensagem.trim();

        if (
            comando.toLowerCase()
            === "sair"
        ) {

            console.log(
                "\nATLAS encerrada."
            );

            rl.close();

            return;
        }

        if (comando === "/help") {

            console.log(`
ATLAS:

${gerarHelp()}
`);

            conversar();
            return;
        }

        if (comando === "/status") {

            console.log(`
ATLAS:

${gerarStatusLocal()}
`);

            conversar();
            return;
        }

        if (comando === "/tree") {

            console.log(`
ATLAS:

${gerarTreeLocal()}
`);

            conversar();
            return;
        }

        if (
            comando === "/agente-lite"
        ) {

            const relatorio =
                executarAgenteLite();

            console.log(`
ATLAS:

${relatorio}
`);

            conversar();
            return;
        }

        if (comando === "/memoria") {

            const memoria =
                carregarMemoria();

            console.log(`
ATLAS:

${memoria.substring(
    0,
    3000
)}
`);

            conversar();
            return;
        }

        if (comando === "/projetos") {

            const projetos =
                listarProjetos();

            console.log(`
ATLAS:

${projetos.join("\n")}
`);

            conversar();
            return;
        }

        if (comando === "/arquivos") {

            const arquivos =
                listarArquivosRecursivo(
                    process.cwd()
                );

            console.log(`
ATLAS:

${arquivos
    .slice(0, 250)
    .join("\n")}
`);

            conversar();
            return;
        }

        if (
            comando.startsWith(
                "/ler "
            )
        ) {

            const caminhoArquivo =
                comando
                    .replace(
                        "/ler ",
                        ""
                    )
                    .trim();

            const conteudo =
                lerArquivoProjeto(
                    caminhoArquivo
                );

            console.log(`
ATLAS:

${conteudo.substring(
    0,
    8000
)}
`);

            conversar();
            return;
        }

        if (
            comando.startsWith(
                "/analisar-arquivo "
            )
        ) {

            const caminhoArquivo =
                comando
                    .replace(
                        "/analisar-arquivo ",
                        ""
                    )
                    .trim();

            console.log(`
ATLAS:

Analisando arquivo...
`);

            const resposta =
                await analisarArquivo(
                    caminhoArquivo
                );

            console.log(`
ATLAS:

${resposta}
`);

            conversar();
            return;
        }

        if (
            comando.startsWith(
                "/editar-arquivo "
            )
        ) {

            const caminhoArquivo =
                comando
                    .replace(
                        "/editar-arquivo ",
                        ""
                    )
                    .trim();

            console.log(`
ATLAS:

Editando arquivo...
`);

            const codigoEditado =
                await editarArquivoIA(
                    caminhoArquivo
                );

            let novoNome =
                caminhoArquivo;

            if (
                novoNome.endsWith(".js")
            ) {

                novoNome =
                    novoNome.replace(
                        ".js",
                        ".editado.js"
                    );

            } else {

                novoNome =
                    `${novoNome}.editado`;
            }

            fs.writeFileSync(
                novoNome,
                codigoEditado,
                "utf8"
            );

            console.log(`
ATLAS:

Arquivo editado:
${novoNome}
`);

            conversar();
            return;
        }

        if (
            comando === "/analisar" ||
            comando === "/organizar"
        ) {

            const memoriaAtual =
                carregarMemoria()
                    .substring(
                        0,
                        12000
                    );

            const promptEspecial = `
Você é a ATLAS.

Analise esta memória:

${memoriaAtual}
`;

            const respostaIA =
                await gerarComRetry(
                    promptEspecial
                );

            const respostaFinal =
                respostaIA &&
                !respostaIA.includes(
                    "Não consegui acessar"
                )
                    ? respostaIA
                    : executarAgenteLite();

            console.log(`
ATLAS:

${respostaFinal}
`);

            const nomeArquivo =
                comando === "/analisar"
                    ? "analise-atlas.md"
                    : "roadmap-atlas.md";

            salvarLog(
                nomeArquivo,
                respostaFinal
            );

            conversar();
            return;
        }

        if (comando === "/agente") {

            console.log(`
ATLAS:

Modo agente iniciado...
`);

            const resposta =
                await executarAgente();

            console.log(`
ATLAS:

${resposta}
`);

            conversar();
            return;
        }

        try {

            const memoriaAtual =
                carregarMemoria()
                    .substring(
                        0,
                        12000
                    );

            const prompt = `
Você é a ATLAS.

MEMÓRIA:
${memoriaAtual}

MENSAGEM:
${comando}
`;

            const respostaIA =
                await gerarComRetry(
                    prompt
                );

            console.log(`
ATLAS:

${respostaIA}
`);

            salvarConversa(
                comando,
                respostaIA
            );

        } catch (erro) {

            console.log(`
Erro geral da ATLAS:
`);

            console.log(erro);
        }

        conversar();
    });
}

conversar();