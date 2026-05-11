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

import {
    comandoExiste,
    listarComandos
} from "../core/commands.js";

import {
    listarPlugins,
    gerarResumoPlugins
} from "../core/plugins.js";

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

    const plugins =
        listarPlugins();

    return `
STATUS LOCAL DA ATLAS

Sistema:
- Modularizada
- IA separada
- Memória separada
- Logs separados
- Arquivos separados
- Plugins ativos
- Obsidian conectado

Plugins carregados:
${plugins.map(
    plugin => `- ${plugin.nome}`
).join("\n")}

Pastas:
${pastasMemoria.map(
    pasta => `- ${pasta}`
).join("\n")}

Projetos:
${projetos.length
    ? projetos.map(
        p => `- ${p}`
    ).join("\n")
    : "- Nenhum projeto"
}

Arquivos:
- ${arquivos.length}
`;
}

function gerarTreeLocal() {

    const arquivos =
        listarArquivosRecursivo(
            process.cwd()
        );

    return `
ESTRUTURA:

${arquivos
    .slice(0, 250)
    .join("\n")}
`;
}

function gerarHelp() {

    return `
COMANDOS DISPONÍVEIS

${listarComandos().join("\n")}

/plugins
/plugin-status

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
AGENTE LITE

Projetos:
${projetos.map(
    p => `- ${p}`
).join("\n")}

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
Analise este arquivo:

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
Melhore este código:

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

    const plugins =
        gerarResumoPlugins();

    const prompt = `
Você é a ATLAS.

PLUGINS:
${plugins}

MEMÓRIA:
${memoria}

ARQUIVOS:
${arquivos}
`;

    const resposta =
        await gerarComRetry(prompt);

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

        if (
            comando.startsWith("/")
            &&
            !comandoExiste(comando)
            &&
            comando !== "/plugins"
            &&
            comando !== "/plugin-status"
        ) {

            console.log(`
ATLAS:

Comando não encontrado.
Use /help
`);

            conversar();
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

        if (comando === "/plugins") {

            console.log(`
ATLAS:

${gerarResumoPlugins()}
`);

            conversar();
            return;
        }

        if (comando === "/plugin-status") {

            const plugins =
                listarPlugins();

            console.log(`
ATLAS:

Plugins carregados:
${plugins.length}

${plugins.map(
    plugin => `- ${plugin.nome}`
).join("\n")}
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

            const respostaIA =
                await gerarComRetry(
                    memoriaAtual
                );

            console.log(`
ATLAS:

${respostaIA}
`);

            conversar();
            return;
        }

        if (comando === "/agente") {

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
PLUGINS:
${gerarResumoPlugins()}

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
Erro geral:
`);

            console.log(erro);
        }

        conversar();
    });
}

conversar();