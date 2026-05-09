import dotenv from "dotenv";
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

import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function gerarComRetry(prompt, tentativas = 3) {
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (erro) {
            const status = erro?.status || erro?.statusCode;

            console.log(`
==================================
ERRO NA GEMINI
Tentativa: ${tentativa}/${tentativas}
==================================
`);

            if (status === 429) {
                console.log("Limite da API atingido. Aguardando...\n");
                await esperar(10000 * tentativa);
                continue;
            }

            if (tentativa === tentativas) {
                return `
Não consegui acessar a IA agora.
A API atingiu limite ou ocorreu um erro.
Tente novamente em alguns segundos.
`;
            }

            await esperar(3000);
        }
    }

    return `
Não foi possível gerar resposta agora.
`;
}

function salvarConversa(usuario, resposta) {
    try {
        const caminhoLog = path.join(process.cwd(), "05 - Logs", "conversa.md");
        const data = new Date().toLocaleString("pt-BR");

        const conteudo = `

# ${data}

## Alex:
${usuario}

## ATLAS:
${resposta}

-----------------------------------
`;

        fs.appendFileSync(caminhoLog, conteudo, "utf8");
    } catch {
        console.log("Erro ao salvar conversa.");
    }
}

function gerarStatusLocal() {
    const arquivos = listarArquivosRecursivo(process.cwd());
    const projetos = listarProjetos();

    return `
STATUS LOCAL DA ATLAS

Sistema:
- ATLAS rodando no terminal do VS Code
- Memória conectada ao Obsidian
- Leitura de arquivos ativa
- Modo agente disponível
- Modo econômico disponível

Pastas de memória:
${pastasMemoria.map(pasta => `- ${pasta}`).join("\n")}

Projetos encontrados:
${projetos.length ? projetos.map(p => `- ${p}`).join("\n") : "- Nenhum projeto encontrado"}

Arquivos mapeados:
- Total aproximado: ${arquivos.length}

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
    const arquivos = listarArquivosRecursivo(process.cwd());

    return `
ESTRUTURA DO PROJETO

${arquivos.slice(0, 250).join("\n")}
`;
}

function gerarHelp() {
    return `
COMANDOS DA ATLAS

Comandos locais, não gastam API:
- /help
Mostra esta lista.

- /status
Mostra o estado local da ATLAS.

- /tree
Mostra a estrutura do projeto.

- /projetos
Lista projetos salvos em 02 - Projetos.

- /arquivos
Lista arquivos do workspace.

- /ler caminho
Lê um arquivo específico.
Exemplo: /ler scripts/atlas-gemini.js

- /agente-lite
Gera uma análise local/econômica sem usar a Gemini.

Comandos com IA, gastam API:
- /analisar
Analisa a memória e salva em 05 - Logs/analise-atlas.md

- /organizar
Gera roadmap e salva em 05 - Logs/roadmap-atlas.md

- /agente
Modo agente completo com IA.

- /analisar-arquivo caminho
Analisa um arquivo usando IA.
Exemplo: /analisar-arquivo scripts/atlas-gemini.js

- /editar-arquivo caminho
Cria uma versão editada do arquivo.
Exemplo: /editar-arquivo scripts/atlas-gemini.js

Para sair:
- sair
`;
}

function executarAgenteLite() {
    const projetos = listarProjetos();
    const arquivos = listarArquivosRecursivo(process.cwd());

    const principais = arquivos.filter(arquivo =>
        arquivo.endsWith(".js") ||
        arquivo.endsWith(".html") ||
        arquivo.endsWith(".css") ||
        arquivo.endsWith(".json") ||
        arquivo.endsWith(".md")
    );

    const relatorio = `
AGENTE LITE - ANÁLISE LOCAL

Visão geral:
A ATLAS está estruturada como uma IA pessoal com memória em Obsidian, terminal inteligente, leitura de arquivos, comandos internos e base para integração com VS Code.

Projetos detectados:
${projetos.length ? projetos.map(p => `- ${p}`).join("\n") : "- Nenhum projeto detectado"}

Arquivos importantes:
${principais.slice(0, 80).map(a => `- ${a}`).join("\n")}

Prioridades recomendadas:
1. Estabilizar uso da API Gemini para evitar limite 429.
2. Separar o código em módulos menores.
3. Criar uma pasta "core" para memória, arquivos e comandos.
4. Criar integração real com VS Code.
5. Melhorar o atlas-server.js para suportar comandos como /projetos e /agente-lite.
6. Preparar integração futura com ChatGPT e Cloud Code.
7. Criar documentação técnica do projeto.

Gargalos:
- Gemini Free Tier limita comandos pesados.
- O arquivo atlas-gemini.js está concentrando muitas funções.
- A interface visual ainda depende do servidor separado.
- O sistema de voz depende do navegador.

Próximos passos:
- Criar modo econômico definitivo.
- Criar arquivos separados para comandos.
- Criar extensão simples para VS Code.
- Integrar ChatGPT como segundo cérebro.
- Usar Cloud Code depois que o fluxo interno estiver estável.
`;

    salvarLog("agente-lite-atlas.md", relatorio);

    return relatorio;
}

async function analisarArquivo(caminhoArquivo) {
    const conteudo = lerArquivoProjeto(caminhoArquivo);

    const prompt = `
Você é a ATLAS, IA pessoal de Alex.

Analise profundamente este arquivo.

Explique:
- objetivo do arquivo
- arquitetura
- lógica principal
- problemas encontrados
- melhorias possíveis
- automações possíveis
- qualidade geral do código
- próximos passos recomendados

ARQUIVO:
${caminhoArquivo}

CONTEÚDO:
${conteudo}
`;

    return await gerarComRetry(prompt);
}

async function editarArquivoIA(caminhoArquivo) {
    const conteudo = lerArquivoProjeto(caminhoArquivo);

    const prompt = `
Você é a ATLAS, IA pessoal de Alex.

Melhore este arquivo.

Objetivos:
- limpar código
- melhorar arquitetura
- adicionar comentários úteis
- melhorar organização
- reduzir bugs
- manter compatibilidade
- preservar funcionamento atual

Retorne APENAS o código final, sem explicações.

ARQUIVO:
${caminhoArquivo}

CÓDIGO:
${conteudo}
`;

    return await gerarComRetry(prompt);
}

async function executarAgente() {
    const memoria = carregarMemoria().substring(0, 12000);
    const arquivos = listarArquivosRecursivo(process.cwd()).slice(0, 80).join("\n");

    const prompt = `
Você é a ATLAS em modo agente.

Faça uma análise estratégica do sistema.

Gere:
- visão geral
- projetos encontrados
- melhorias importantes
- gargalos técnicos
- sugestões
- próximos passos
- automações possíveis
- evolução da arquitetura
- integração futura com VS Code, ChatGPT e Cloud Code

MEMÓRIA:

${memoria}

ARQUIVOS:

${arquivos}
`;

    const resposta = await gerarComRetry(prompt);

    if (!resposta || resposta.includes("Não consegui acessar")) {
        const fallback = executarAgenteLite();
        salvarLog("agente-atlas.md", fallback);
        return fallback;
    }

    salvarLog("agente-atlas.md", resposta);
    return resposta;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`
==============================
ATLAS ONLINE
==============================

Comandos:

/help
/status
/tree
/agente-lite
/analisar
/organizar
/agente
/projetos
/memoria
/arquivos
/ler caminho
/analisar-arquivo caminho
/editar-arquivo caminho

Digite "sair" para encerrar.

==============================
`);

async function conversar() {
    rl.question("Você: ", async (mensagem) => {
        const comando = mensagem.trim();

        if (comando.toLowerCase() === "sair") {
            console.log("\nATLAS encerrada.");
            rl.close();
            return;
        }

        if (comando === "/help") {
            console.log(`\nATLAS:\n${gerarHelp()}`);
            conversar();
            return;
        }

        if (comando === "/status") {
            console.log(`\nATLAS:\n${gerarStatusLocal()}`);
            conversar();
            return;
        }

        if (comando === "/tree") {
            console.log(`\nATLAS:\n${gerarTreeLocal()}`);
            conversar();
            return;
        }

        if (comando === "/agente-lite") {
            const relatorio = executarAgenteLite();

            console.log(`
ATLAS:

${relatorio}

Arquivo salvo:
05 - Logs/agente-lite-atlas.md
`);
            conversar();
            return;
        }

        if (comando === "/memoria") {
            const memoria = carregarMemoria();

            console.log(`
ATLAS:

${memoria.substring(0, 3000)}
`);
            conversar();
            return;
        }

        if (comando === "/projetos") {
            const projetos = listarProjetos();

            console.log(`
ATLAS:

Projetos encontrados:

${projetos.length ? projetos.join("\n") : "Nenhum projeto encontrado."}
`);
            conversar();
            return;
        }

        if (comando === "/arquivos") {
            const arquivos = listarArquivosRecursivo(process.cwd());

            console.log(`
ATLAS:

Arquivos encontrados:

${arquivos.slice(0, 250).join("\n")}
`);
            conversar();
            return;
        }

        if (comando.startsWith("/ler ")) {
            const caminhoArquivo = comando.replace("/ler ", "").trim();
            const conteudo = lerArquivoProjeto(caminhoArquivo);

            console.log(`
ATLAS:

ARQUIVO:
${caminhoArquivo}

${conteudo.substring(0, 8000)}
`);
            conversar();
            return;
        }

        if (comando.startsWith("/analisar-arquivo ")) {
            const caminhoArquivo = comando.replace("/analisar-arquivo ", "").trim();

            console.log(`
ATLAS:

Analisando arquivo...
`);

            const resposta = await analisarArquivo(caminhoArquivo);

            console.log(`
ATLAS:

${resposta}
`);
            conversar();
            return;
        }

        if (comando.startsWith("/editar-arquivo ")) {
            const caminhoArquivo = comando.replace("/editar-arquivo ", "").trim();

            console.log(`
ATLAS:

Editando arquivo...
`);

            const codigoEditado = await editarArquivoIA(caminhoArquivo);

            let novoNome = caminhoArquivo;

            if (novoNome.endsWith(".js")) {
                novoNome = novoNome.replace(".js", ".editado.js");
            } else {
                novoNome = `${novoNome}.editado`;
            }

            fs.writeFileSync(novoNome, codigoEditado, "utf8");

            console.log(`
ATLAS:

Arquivo editado salvo em:
${novoNome}
`);
            conversar();
            return;
        }

        if (comando === "/analisar" || comando === "/organizar") {
            const memoriaAtual = carregarMemoria().substring(0, 12000);

            const promptEspecial = `
Você é a ATLAS.

Analise toda a memória abaixo.

Gere:
- prioridades
- projetos ativos
- riscos
- próximos passos
- sugestões
- organização necessária
- tarefas recomendadas
- melhorias estruturais

MEMÓRIA:

${memoriaAtual}
`;

            const respostaIA = await gerarComRetry(promptEspecial);

            const respostaFinal =
                respostaIA && !respostaIA.includes("Não consegui acessar")
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

            salvarLog(nomeArquivo, respostaFinal);

            console.log(`
Arquivo salvo:
05 - Logs/${nomeArquivo}
`);
            conversar();
            return;
        }

        if (comando === "/agente") {
            console.log(`
ATLAS:

Modo agente iniciado...
`);

            const resposta = await executarAgente();

            console.log(`
ATLAS:

${resposta}

Arquivo salvo:
05 - Logs/agente-atlas.md
`);
            conversar();
            return;
        }

        try {
            const memoriaAtual = carregarMemoria().substring(0, 12000);

            const prompt = `
Você é a ATLAS.

Você possui:
- memória contínua
- foco em projetos
- organização
- automação
- integração com VS Code
- apoio estratégico para Alex
- capacidade de analisar arquivos
- capacidade de editar arquivos com segurança
- modo agente para evolução do sistema

REGRAS:
- Nunca inventar informações.
- Se não souber, diga que não encontrou na memória.
- Seja prática, estratégica e objetiva.
- Sempre sugira um próximo passo útil.

MEMÓRIA:
${memoriaAtual}

MENSAGEM:
${comando}
`;

            const respostaIA = await gerarComRetry(prompt);

            console.log(`
ATLAS:

${respostaIA}
`);

            salvarConversa(comando, respostaIA);
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