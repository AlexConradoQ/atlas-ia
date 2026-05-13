const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { exec } = require("child_process");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

let geminiModel = null;
let openaiClient = null;
let ultimoEditorTexto = null;
let raizAtlas = null;
let planoPendente = null;
let contextoExtensao = null;

function activate(context) {
    console.log("ATLAS ativada.");

    contextoExtensao = context;

    atualizarRaizAtlas();
    configurarGemini();
    configurarOpenAI();

    if (vscode.window.activeTextEditor) {
        ultimoEditorTexto = vscode.window.activeTextEditor;
    }

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document && editor.document.uri.scheme === "file") {
            ultimoEditorTexto = editor;
        }
    });

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        atualizarRaizAtlas();
        configurarGemini();
        configurarOpenAI();
    });

    const disposable = vscode.commands.registerCommand("atlas.openPanel", () => {
        atualizarRaizAtlas();

        const panel = vscode.window.createWebviewPanel(
            "atlasPanel",
            "ATLAS",
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "enviar") {
                const resposta = await gerarResposta(message.texto);

                panel.webview.postMessage({
                    command: "resposta",
                    texto: resposta
                });
            }
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

function atualizarRaizAtlas() {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (workspace) {
        if (path.basename(workspace).toLowerCase() === "vscode-extension") {
            raizAtlas = path.dirname(workspace);
        } else {
            raizAtlas = workspace;
        }
    } else if (contextoExtensao) {
        raizAtlas = path.join(contextoExtensao.extensionPath, "..");
    } else {
        raizAtlas = process.cwd();
    }

    dotenv.config({
        path: path.join(raizAtlas, ".env"),
        override: true
    });

    console.log("Raiz ATLAS:", raizAtlas);
}

function configurarGemini() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.log("GEMINI_API_KEY não encontrada.");
        geminiModel = null;
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
    });

    console.log("Gemini conectado.");
}

function configurarOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.log("OPENAI_API_KEY não encontrada.");
        openaiClient = null;
        return;
    }

    openaiClient = new OpenAI({ apiKey });

    console.log("OpenAI conectada.");
}

function obterEditor() {
    const editorAtual = vscode.window.activeTextEditor;

    if (editorAtual && editorAtual.document && editorAtual.document.uri.scheme === "file") {
        ultimoEditorTexto = editorAtual;
        return editorAtual;
    }

    return ultimoEditorTexto;
}

function obterSelecaoAtual() {
    const editor = obterEditor();

    if (!editor) return null;

    const textoSelecionado = editor.document.getText(editor.selection);

    if (!textoSelecionado.trim()) return null;

    return {
        editor,
        textoSelecionado
    };
}

function caminhoSeguro(caminhoRelativo) {
    atualizarRaizAtlas();

    const caminhoNormalizado = caminhoRelativo.replace(/\\/g, "/").trim() || ".";
    const caminhoFinal = path.resolve(raizAtlas, caminhoNormalizado);
    const raizResolvida = path.resolve(raizAtlas);

    if (!caminhoFinal.startsWith(raizResolvida)) {
        throw new Error("Caminho inválido fora da pasta ATLAS-IA.");
    }

    return caminhoFinal;
}

function lerArquivosMarkdownRecursivo(caminhoPasta) {
    let conteudoCompleto = "";

    if (!fs.existsSync(caminhoPasta)) return conteudoCompleto;

    const itens = fs.readdirSync(caminhoPasta, { withFileTypes: true });

    for (const item of itens) {
        const caminhoItem = path.join(caminhoPasta, item.name);

        if (
            item.name === "node_modules" ||
            item.name === ".git" ||
            item.name === ".vscode"
        ) {
            continue;
        }

        if (item.isDirectory()) {
            conteudoCompleto += lerArquivosMarkdownRecursivo(caminhoItem);
        }

        if (item.isFile() && item.name.endsWith(".md")) {
            const conteudo = fs.readFileSync(caminhoItem, "utf8");

            conteudoCompleto += `

ARQUIVO: ${path.relative(raizAtlas, caminhoItem)}

${conteudo}

`;
        }
    }

    return conteudoCompleto;
}

function carregarMemoria() {
    atualizarRaizAtlas();

    const pastasMemoria = [
        "00 - Sistema",
        "01 - Memória",
        "02 - Projetos",
        "03 - Conhecimento",
        "04 - Prompts",
        "05 - Logs"
    ];

    let memoriaCompleta = "";

    for (const pasta of pastasMemoria) {
        memoriaCompleta += lerArquivosMarkdownRecursivo(
            path.join(raizAtlas, pasta)
        );
    }

    return memoriaCompleta;
}

function limparComandoIA(comando) {
    return comando
        .replace(/^\/chatgpt\s*/i, "")
        .replace(/^\/gemini\s*/i, "")
        .replace(/^\/atlas\s*/i, "")
        .trim();
}

function identificarProvider(comando) {
    const texto = comando.trim().toLowerCase();

    if (texto.startsWith("/chatgpt")) return "openai";
    if (texto.startsWith("/gemini")) return "gemini";
    if (texto.startsWith("/atlas")) return "auto";

    return "gemini";
}

async function chamarGemini(prompt) {
    if (!geminiModel) {
        return `
Gemini não conectado.

Verifique o arquivo .env na raiz do projeto:

GEMINI_API_KEY=sua_chave

Raiz atual:
${raizAtlas}
`;
    }

    try {
        const resultado = await geminiModel.generateContent(prompt);
        const resposta = await resultado.response;

        return resposta.text();
    } catch (erro) {
        console.log(erro);

        return `
Erro ao acessar Gemini.

Detalhe:
${erro.message}
`;
    }
}

async function chamarOpenAI(prompt) {
    if (!openaiClient) {
        return `
OpenAI não conectada.

Verifique o arquivo .env:

OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-5.5
`;
    }

    try {
        const modelo = process.env.OPENAI_MODEL || "gpt-5.5";

        const resposta = await openaiClient.responses.create({
            model: modelo,
            input: prompt
        });

        return resposta.output_text || "OpenAI respondeu sem texto.";
    } catch (erro) {
        console.log(erro);

        const mensagemErro = erro.message || "";

        if (
            erro.status === 429 ||
            mensagemErro.includes("429") ||
            mensagemErro.toLowerCase().includes("quota")
        ) {
            return await chamarGemini(`
A OpenAI está sem quota/billing no momento.
Continue a tarefa usando Gemini como fallback.

PROMPT ORIGINAL:
${prompt}
`);
        }

        return `
Erro ao acessar OpenAI.

Detalhe:
${erro.message}
`;
    }
}

async function chamarIA(textoUsuario, provider = "auto") {
    atualizarRaizAtlas();

    const memoria = carregarMemoria();

    let providerFinal = provider;

    if (providerFinal === "auto") {
        providerFinal = identificarProvider(textoUsuario);
    }

    const prompt = `
Você é a ATLAS IA, assistente local do Alexander dentro do VS Code.

IDENTIDADE:
- Você ajuda com projetos, código, organização, arquitetura e estudos.
- Responda sempre em português brasileiro.
- Seja direto, prático e organizado.
- Quando o usuário pedir código, entregue código completo.
- Não mande pequenos trechos soltos.
- Não invente arquivos que você não viu.
- Use a memória local quando ela ajudar.

RAIZ DO PROJETO:
${raizAtlas}

MEMÓRIA LOCAL:
${memoria}

PEDIDO DO USUÁRIO:
${textoUsuario}
`;

    if (providerFinal === "openai") {
        return await chamarOpenAI(prompt);
    }

    return await chamarGemini(prompt);
}

function extrairCodigoLimpo(texto) {
    const match = texto.match(/```(?:\w+)?\n([\s\S]*?)```/);

    if (match && match[1]) {
        return match[1].trim();
    }

    return texto.trim();
}

function listarArquivosRecursivo(caminhoPasta, limite = 120) {
    const resultados = [];

    function andar(pasta) {
        if (resultados.length >= limite) return;
        if (!fs.existsSync(pasta)) return;

        const itens = fs.readdirSync(pasta, { withFileTypes: true });

        for (const item of itens) {
            if (resultados.length >= limite) break;

            if (
                item.name === "node_modules" ||
                item.name === ".git" ||
                item.name === ".vscode"
            ) {
                continue;
            }

            const caminhoItem = path.join(pasta, item.name);
            const relativo = path.relative(raizAtlas, caminhoItem);

            if (item.isDirectory()) {
                resultados.push(`📁 ${relativo}`);
                andar(caminhoItem);
            } else {
                resultados.push(`📄 ${relativo}`);
            }
        }
    }

    andar(caminhoPasta);

    return resultados.join("\n");
}

function buscarTextoRecursivo(caminhoPasta, termo, limite = 80) {
    const resultados = [];

    function andar(pasta) {
        if (resultados.length >= limite) return;
        if (!fs.existsSync(pasta)) return;

        const itens = fs.readdirSync(pasta, { withFileTypes: true });

        for (const item of itens) {
            if (resultados.length >= limite) break;

            if (
                item.name === "node_modules" ||
                item.name === ".git" ||
                item.name === ".vscode"
            ) {
                continue;
            }

            const caminhoItem = path.join(pasta, item.name);

            if (item.isDirectory()) {
                andar(caminhoItem);
                continue;
            }

            const extensoesPermitidas = [
                ".js", ".json", ".md", ".html", ".css", ".txt", ".env"
            ];

            if (!extensoesPermitidas.includes(path.extname(item.name))) {
                continue;
            }

            const conteudo = fs.readFileSync(caminhoItem, "utf8");

            if (conteudo.toLowerCase().includes(termo.toLowerCase())) {
                resultados.push(path.relative(raizAtlas, caminhoItem));
            }
        }
    }

    andar(caminhoPasta);

    return resultados;
}

async function criarArquivo(comando) {
    const conteudoComando = comando.replace(/^\/criar-arquivo\s*/i, "").trim();

    if (!conteudoComando.includes("|")) {
        return `
Formato correto:

/criar-arquivo caminho/do/arquivo.js | conteúdo do arquivo
`;
    }

    const [caminhoRelativo, ...partesConteudo] = conteudoComando.split("|");
    const conteudo = partesConteudo.join("|").trim();

    const caminhoFinal = caminhoSeguro(caminhoRelativo.trim());
    const pastaFinal = path.dirname(caminhoFinal);

    fs.mkdirSync(pastaFinal, { recursive: true });
    fs.writeFileSync(caminhoFinal, conteudo, "utf8");

    return `
Arquivo criado com sucesso.

CAMINHO:
${path.relative(raizAtlas, caminhoFinal)}
`;
}

async function editarArquivo(comando) {
    const conteudoComando = comando.replace(/^\/editar-arquivo\s*/i, "").trim();

    if (!conteudoComando.includes("|")) {
        return `
Formato correto:

/editar-arquivo caminho/do/arquivo.js | instrução da edição
`;
    }

    const [caminhoRelativo, ...partesInstrucao] = conteudoComando.split("|");
    const instrucao = partesInstrucao.join("|").trim();

    const caminhoFinal = caminhoSeguro(caminhoRelativo.trim());

    if (!fs.existsSync(caminhoFinal)) {
        return `
Arquivo não encontrado:

${path.relative(raizAtlas, caminhoFinal)}
`;
    }

    const conteudoAtual = fs.readFileSync(caminhoFinal, "utf8");

    const respostaIA = await chamarIA(
        `
Você vai editar um arquivo do projeto.

IMPORTANTE:
- Devolva APENAS o conteúdo final completo do arquivo.
- Não explique fora do código.
- Não use markdown se não for necessário.
- Não coloque comentários extras fora do arquivo.
- Preserve o objetivo original do arquivo.

ARQUIVO:
${path.relative(raizAtlas, caminhoFinal)}

CONTEÚDO ATUAL:
${conteudoAtual}

INSTRUÇÃO:
${instrucao}
`,
        "gemini"
    );

    const novoConteudo = extrairCodigoLimpo(respostaIA);

    fs.writeFileSync(caminhoFinal, novoConteudo, "utf8");

    return `
Arquivo editado e salvo com sucesso.

CAMINHO:
${path.relative(raizAtlas, caminhoFinal)}

INSTRUÇÃO EXECUTADA:
${instrucao}
`;
}

function deletarArquivo(comando) {
    const caminhoRelativo = comando.replace(/^\/deletar-arquivo\s*/i, "").trim();

    if (!caminhoRelativo) {
        return `
Formato correto:

/deletar-arquivo caminho/do/arquivo.js
`;
    }

    const caminhoFinal = caminhoSeguro(caminhoRelativo);

    if (!fs.existsSync(caminhoFinal)) {
        return `Arquivo não encontrado: ${caminhoRelativo}`;
    }

    if (fs.statSync(caminhoFinal).isDirectory()) {
        return "Por segurança, este comando não deleta pastas.";
    }

    fs.unlinkSync(caminhoFinal);

    return `
Arquivo deletado com sucesso.

CAMINHO:
${caminhoRelativo}
`;
}

function substituirTexto(comando) {
    const conteudoComando = comando.replace(/^\/substituir-texto\s*/i, "").trim();

    if (!conteudoComando.includes("|")) {
        return `
Formato correto:

/substituir-texto arquivo.js | texto antigo | texto novo
`;
    }

    const partes = conteudoComando.split("|").map(p => p.trim());

    if (partes.length < 3) {
        return `
Formato correto:

/substituir-texto arquivo.js | texto antigo | texto novo
`;
    }

    const caminhoFinal = caminhoSeguro(partes[0]);
    const antigo = partes[1];
    const novo = partes.slice(2).join("|");

    if (!fs.existsSync(caminhoFinal)) {
        return `Arquivo não encontrado: ${partes[0]}`;
    }

    const conteudoAtual = fs.readFileSync(caminhoFinal, "utf8");

    if (!conteudoAtual.includes(antigo)) {
        return `Texto antigo não encontrado no arquivo: ${partes[0]}`;
    }

    const atualizado = conteudoAtual.split(antigo).join(novo);

    fs.writeFileSync(caminhoFinal, atualizado, "utf8");

    return `
Texto substituído com sucesso.

ARQUIVO:
${partes[0]}
`;
}

function executarComando(comando) {
    const comandoShell = comando.replace(/^\/executar\s*/i, "").trim();

    if (!comandoShell) {
        return Promise.resolve(`
Formato correto:

/executar comando

Exemplo:
/executar npm test
`);
    }

    const comandosBloqueados = [
        "rm ",
        "del ",
        "format",
        "shutdown",
        "restart",
        "powershell -enc",
        "curl ",
        "wget "
    ];

    const lower = comandoShell.toLowerCase();

    if (comandosBloqueados.some(b => lower.includes(b))) {
        return Promise.resolve("Comando bloqueado por segurança.");
    }

    return new Promise((resolve) => {
        exec(
            comandoShell,
            {
                cwd: raizAtlas,
                timeout: 30000,
                maxBuffer: 1024 * 1024
            },
            (erro, stdout, stderr) => {
                resolve(`
COMANDO EXECUTADO:
${comandoShell}

PASTA:
${raizAtlas}

SAÍDA:
${stdout || "(sem saída)"}

ERROS:
${stderr || "(sem erros)"}

STATUS:
${erro ? "Finalizado com erro" : "Finalizado com sucesso"}
`);
            }
        );
    });
}

function extrairJson(texto) {
    const limpo = texto
        .replace(/```json/g, "```")
        .replace(/```JSON/g, "```");

    const matchCodigo = limpo.match(/```\n([\s\S]*?)```/);

    if (matchCodigo && matchCodigo[1]) {
        return JSON.parse(matchCodigo[1].trim());
    }

    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");

    if (inicio !== -1 && fim !== -1 && fim > inicio) {
        return JSON.parse(limpo.slice(inicio, fim + 1));
    }

    throw new Error("Não consegui extrair JSON válido da resposta da IA.");
}

async function criarPlanoAgente(comando) {
    const pedido = comando.replace(/^\/agent\s*/i, "").trim();

    if (!pedido) {
        return `
Formato correto:

/agent descreva o que você quer que a ATLAS construa
`;
    }

    const estrutura = listarArquivosRecursivo(raizAtlas, 180);

    const respostaIA = await chamarIA(
        `
Você é a ATLAS em modo agente executor.

O usuário quer:
${pedido}

Você deve criar um plano SEGURO de execução.

REGRAS IMPORTANTES:
- Responda APENAS JSON válido.
- Não use markdown.
- Não explique fora do JSON.
- Nunca edite package.json, .env, package-lock.json ou arquivos em node_modules.
- Prefira criar arquivos novos em pastas seguras.
- Cada ação deve ter:
  - tipo: "criar" ou "editar"
  - caminho: caminho relativo do arquivo
  - descricao: o que será feito
  - conteudo: conteúdo completo, se tipo for "criar"
  - instrucao: instrução clara, se tipo for "editar"

ESTRUTURA ATUAL DO PROJETO:
${estrutura}

FORMATO EXATO:
{
  "titulo": "nome curto do plano",
  "resumo": "resumo do que será feito",
  "acoes": [
    {
      "tipo": "criar",
      "caminho": "exemplo/arquivo.js",
      "descricao": "criar arquivo exemplo",
      "conteudo": "console.log('exemplo');"
    }
  ]
}
`,
        "gemini"
    );

    let plano;

    try {
        plano = extrairJson(respostaIA);
    } catch (erro) {
        return `
Não consegui montar um plano seguro.

Erro:
${erro.message}

Resposta bruta da IA:
${respostaIA}
`;
    }

    if (!plano || !Array.isArray(plano.acoes)) {
        return "A IA não retornou um plano válido.";
    }

    planoPendente = plano;

    const listaAcoes = plano.acoes
        .map((acao, index) => {
            return `${index + 1}. ${acao.tipo.toUpperCase()} - ${acao.caminho}\n   ${acao.descricao || ""}`;
        })
        .join("\n\n");

    return `
PLANO DO AGENTE CRIADO

TÍTULO:
${plano.titulo || "Plano sem título"}

RESUMO:
${plano.resumo || "Sem resumo."}

AÇÕES:
${listaAcoes}

Para executar, digite:

/confirmar

Para cancelar, digite:

/cancelar
`;
}

async function confirmarPlanoAgente() {
    if (!planoPendente) {
        return "Não existe plano pendente para confirmar.";
    }

    const plano = planoPendente;
    const resultados = [];

    for (const acao of plano.acoes) {
        const tipo = String(acao.tipo || "").toLowerCase();
        const caminho = acao.caminho;

        if (!caminho) {
            resultados.push("Ação ignorada: caminho vazio.");
            continue;
        }

        if (
            caminho.includes("node_modules") ||
            caminho.endsWith(".env") ||
            caminho.endsWith("package.json") ||
            caminho.endsWith("package-lock.json")
        ) {
            resultados.push(`Bloqueado por segurança: ${caminho}`);
            continue;
        }

        const caminhoFinal = caminhoSeguro(caminho);

        if (tipo === "criar") {
            fs.mkdirSync(path.dirname(caminhoFinal), { recursive: true });
            fs.writeFileSync(caminhoFinal, acao.conteudo || "", "utf8");

            resultados.push(`Criado: ${caminho}`);
            continue;
        }

        if (tipo === "editar") {
            if (!fs.existsSync(caminhoFinal)) {
                resultados.push(`Não encontrado para editar: ${caminho}`);
                continue;
            }

            const conteudoAtual = fs.readFileSync(caminhoFinal, "utf8");

            const respostaIA = await chamarIA(
                `
Edite este arquivo conforme a instrução.

IMPORTANTE:
- Devolva APENAS o conteúdo final completo.
- Não use markdown.
- Não explique.

ARQUIVO:
${caminho}

CONTEÚDO ATUAL:
${conteudoAtual}

INSTRUÇÃO:
${acao.instrucao || acao.descricao || "Melhore o arquivo sem alterar seu objetivo."}
`,
                "gemini"
            );

            fs.writeFileSync(caminhoFinal, extrairCodigoLimpo(respostaIA), "utf8");

            resultados.push(`Editado: ${caminho}`);
            continue;
        }

        resultados.push(`Tipo desconhecido ignorado: ${tipo} em ${caminho}`);
    }

    planoPendente = null;

    return `
PLANO EXECUTADO COM SUCESSO

${resultados.join("\n")}
`;
}

function cancelarPlanoAgente() {
    planoPendente = null;

    return "Plano pendente cancelado.";
}

async function gerarResposta(texto) {
    atualizarRaizAtlas();

    const comando = texto.trim();

    if (!comando) return "Digite um comando ou uma mensagem.";

    if (comando === "/help") {
        return `
COMANDOS DA ATLAS

GERAIS:
/help
/status
/plugins
/memoria
/arquivo-atual
/selecao
/listar-arquivos
/buscar-texto termo

IA:
/chatgpt pergunta
/gemini pergunta
/atlas pergunta

CÓDIGO:
/ia-arquivo pergunta
/ia-selecao pergunta
/gerar-codigo pedido

EXECUTOR LOCAL:
/criar-arquivo caminho | conteúdo
/editar-arquivo caminho | instrução
/substituir-texto arquivo | texto antigo | texto novo
/deletar-arquivo caminho
/executar comando

AGENTE:
/agent pedido complexo
/confirmar
/cancelar
`;
    }

    if (comando === "/status") {
        return `
STATUS DA ATLAS

- Painel interno do VS Code ativo
- Gemini: ${geminiModel ? "conectado" : "não conectado"}
- OpenAI: ${openaiClient ? "conectada, mas pode estar sem quota/billing" : "não conectada"}
- Fallback OpenAI → Gemini: ativo
- Executor local: ativo
- Modo agente: ativo com confirmação
- Comandos operacionais: ativos
- Memória local: ativa
- Raiz ATLAS: ${raizAtlas}
`;
    }

    if (comando === "/plugins") {
        return `
PLUGINS

- dev
- obsidian
- system
`;
    }

    if (comando === "/memoria") {
        const memoria = carregarMemoria();

        if (!memoria.trim()) return "Nenhuma memória markdown encontrada.";

        return `
MEMÓRIA CARREGADA

Caracteres carregados:
${memoria.length}

Raiz:
${raizAtlas}
`;
    }

    if (comando === "/arquivo-atual") {
        const editor = obterEditor();

        if (!editor) return "Nenhum arquivo aberto.";

        const documento = editor.document;

        return `
ARQUIVO ATUAL

Nome:
${documento.fileName}

Linguagem:
${documento.languageId}

Linhas:
${documento.lineCount}
`;
    }

    if (comando === "/selecao") {
        const dadosSelecao = obterSelecaoAtual();

        if (!dadosSelecao) return "Nenhum texto selecionado.";

        return `
SELEÇÃO ATUAL

${dadosSelecao.textoSelecionado}
`;
    }

    if (comando.startsWith("/listar-arquivos")) {
        const pasta = comando.replace(/^\/listar-arquivos\s*/i, "").trim() || ".";
        const caminhoPasta = caminhoSeguro(pasta);

        if (!fs.existsSync(caminhoPasta)) {
            return `
Pasta não encontrada:

${pasta}

Raiz atual:
${raizAtlas}
`;
        }

        return `
ARQUIVOS ENCONTRADOS:

${listarArquivosRecursivo(caminhoPasta)}
`;
    }

    if (comando.startsWith("/buscar-texto ")) {
        const termo = comando.replace(/^\/buscar-texto\s*/i, "").trim();

        const resultados = buscarTextoRecursivo(raizAtlas, termo);

        if (!resultados.length) {
            return `Nenhum arquivo encontrado com o termo: ${termo}`;
        }

        return `
TERMO BUSCADO:
${termo}

RAIZ:
${raizAtlas}

ARQUIVOS ENCONTRADOS:
${resultados.join("\n")}
`;
    }

    if (comando.startsWith("/criar-arquivo ")) {
        return await criarArquivo(comando);
    }

    if (comando.startsWith("/editar-arquivo ")) {
        return await editarArquivo(comando);
    }

    if (comando.startsWith("/deletar-arquivo ")) {
        return deletarArquivo(comando);
    }

    if (comando.startsWith("/substituir-texto ")) {
        return substituirTexto(comando);
    }

    if (comando.startsWith("/executar ")) {
        return await executarComando(comando);
    }

    if (comando.startsWith("/agent ")) {
        return await criarPlanoAgente(comando);
    }

    if (comando === "/confirmar") {
        return await confirmarPlanoAgente();
    }

    if (comando === "/cancelar") {
        return cancelarPlanoAgente();
    }

    if (
        comando.startsWith("/chatgpt ") ||
        comando.startsWith("/gemini ") ||
        comando.startsWith("/atlas ")
    ) {
        const provider = identificarProvider(comando);
        const pergunta = limparComandoIA(comando);

        return await chamarIA(pergunta, provider);
    }

    if (comando.startsWith("/ia-arquivo ")) {
        const editor = obterEditor();

        if (!editor) return "Nenhum arquivo aberto.";

        const documento = editor.document;
        const codigo = documento.getText();
        const pergunta = comando.replace("/ia-arquivo ", "");

        const promptUsuario = `
Analise este arquivo aberto no VS Code.

ARQUIVO:
${documento.fileName}

LINGUAGEM:
${documento.languageId}

CÓDIGO:
${codigo}

PERGUNTA:
${pergunta}
`;

        return await chamarIA(promptUsuario, "gemini");
    }

    if (comando.startsWith("/ia-selecao ")) {
        const dadosSelecao = obterSelecaoAtual();

        if (!dadosSelecao) return "Nenhum texto selecionado.";

        const documento = dadosSelecao.editor.document;
        const pergunta = comando.replace("/ia-selecao ", "");

        const promptUsuario = `
Analise apenas este trecho selecionado no VS Code.

ARQUIVO:
${documento.fileName}

LINGUAGEM:
${documento.languageId}

TRECHO:
${dadosSelecao.textoSelecionado}

PERGUNTA:
${pergunta}
`;

        return await chamarIA(promptUsuario, "gemini");
    }

    if (comando.startsWith("/gerar-codigo ")) {
        const promptUsuario = comando.replace("/gerar-codigo ", "");

        return await chamarIA(
            `
Gere código completo para este pedido:

${promptUsuario}
`,
            "gemini"
        );
    }

    return await chamarIA(comando, "gemini");
}

function getWebviewContent() {
    return `
<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">

<style>
* { box-sizing: border-box; }

body {
    background: #050816;
    color: white;
    font-family: Arial, sans-serif;
    padding: 20px;
}

h1 {
    color: #00e5ff;
    letter-spacing: 4px;
}

.subtitle {
    color: #a5b4fc;
    margin-bottom: 20px;
}

textarea {
    width: 100%;
    height: 170px;
    background: #111827;
    color: white;
    border: 1px solid #1f9fff;
    border-radius: 12px;
    padding: 15px;
    resize: vertical;
    outline: none;
}

button {
    margin-top: 15px;
    background: #00bcd4;
    color: #020617;
    border: none;
    border-radius: 10px;
    padding: 12px 22px;
    cursor: pointer;
    font-weight: bold;
}

button:hover { filter: brightness(1.15); }

.quick {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.quick button {
    margin-top: 0;
    background: #111827;
    color: #00e5ff;
    border: 1px solid #00e5ff;
    padding: 8px 12px;
}

#resposta {
    margin-top: 25px;
    background: #111827;
    border: 1px solid #1f9fff;
    border-radius: 12px;
    padding: 20px;
    white-space: pre-wrap;
    min-height: 220px;
    line-height: 1.5;
}

.status {
    color: #22c55e;
    margin-bottom: 15px;
}
</style>
</head>

<body>

<h1>ATLAS IA</h1>

<div class="subtitle">
Painel interno do VS Code — Agent Operacional
</div>

<div class="status">
● ATLAS pronta para comando
</div>

<textarea
id="input"
placeholder="Digite aqui. Ex: /buscar-texto askAI"
></textarea>

<br>

<button onclick="enviar()">Enviar</button>

<div class="quick">
    <button onclick="atalho('/help')">/help</button>
    <button onclick="atalho('/status')">/status</button>
    <button onclick="atalho('/memoria')">/memoria</button>
    <button onclick="atalho('/arquivo-atual')">/arquivo-atual</button>
    <button onclick="atalho('/listar-arquivos core')">/listar</button>
    <button onclick="atalho('/buscar-texto askAI')">/buscar</button>
    <button onclick="atalho('/ia-arquivo explique esse arquivo')">/ia-arquivo</button>
    <button onclick="atalho('/agent criar um módulo simples de exemplo')">/agent</button>
</div>

<div id="resposta">
ATLAS ONLINE

Use /help para ver os comandos.
</div>

<script>
const vscode = acquireVsCodeApi();

function enviar() {
    const input = document.getElementById("input");
    const texto = input.value.trim();

    if (!texto) return;

    document.getElementById("resposta").textContent =
        "ATLAS processando...";

    vscode.postMessage({
        command: "enviar",
        texto
    });
}

function atalho(texto) {
    document.getElementById("input").value = texto;
    enviar();
}

window.addEventListener("message", event => {
    const message = event.data;

    if (message.command === "resposta") {
        document.getElementById("resposta").textContent =
            message.texto;
    }
});
</script>

</body>
</html>
`;
}

module.exports = {
    activate,
    deactivate
};  