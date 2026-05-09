const vscode = require("vscode");
const path = require("path");
const dotenv = require("dotenv");

const {
    GoogleGenerativeAI
} = require("@google/generative-ai");

let model = null;
let ultimoEditorTexto = null;

function activate(context) {

    console.log("ATLAS ativada.");

    const envPath = path.join(
        context.extensionPath,
        "..",
        ".env"
    );

    dotenv.config({
        path: envPath
    });

    const apiKey =
        process.env.GEMINI_API_KEY;

    if (apiKey) {

        const genAI =
            new GoogleGenerativeAI(apiKey);

        model =
            genAI.getGenerativeModel({
                model: "gemini-2.5-flash"
            });

        console.log("Gemini conectado.");
    }

    if (vscode.window.activeTextEditor) {
        ultimoEditorTexto =
            vscode.window.activeTextEditor;
    }

    vscode.window.onDidChangeActiveTextEditor(
        (editor) => {

            if (
                editor &&
                editor.document &&
                editor.document.uri.scheme === "file"
            ) {
                ultimoEditorTexto = editor;
            }
        }
    );

    const disposable =
        vscode.commands.registerCommand(
            "atlas.openPanel",
            function () {

                const panel =
                    vscode.window.createWebviewPanel(
                        "atlasPanel",
                        "ATLAS",
                        vscode.ViewColumn.One,
                        {
                            enableScripts: true
                        }
                    );

                panel.webview.html =
                    getWebviewContent();

                panel.webview.onDidReceiveMessage(
                    async (message) => {

                        if (
                            message.command === "enviar"
                        ) {

                            const resposta =
                                await gerarResposta(
                                    message.texto
                                );

                            panel.webview.postMessage({
                                command: "resposta",
                                texto: resposta
                            });
                        }
                    }
                );
            }
        );

    context.subscriptions.push(disposable);
}

function deactivate() {}

function obterEditor() {

    const editorAtual =
        vscode.window.activeTextEditor;

    if (
        editorAtual &&
        editorAtual.document &&
        editorAtual.document.uri.scheme === "file"
    ) {
        ultimoEditorTexto =
            editorAtual;

        return editorAtual;
    }

    return ultimoEditorTexto;
}

function obterSelecaoAtual() {

    const editor =
        obterEditor();

    if (!editor) {
        return null;
    }

    const textoSelecionado =
        editor.document.getText(
            editor.selection
        );

    if (!textoSelecionado.trim()) {
        return null;
    }

    return {
        editor,
        textoSelecionado
    };
}

async function chamarGemini(prompt) {

    if (!model) {

        return `
Gemini não conectado.

Verifique o .env:
GEMINI_API_KEY=sua_chave
`;
    }

    try {

        const resultado =
            await model.generateContent(prompt);

        const resposta =
            await resultado.response;

        return resposta.text();

    } catch (erro) {

        console.log(erro);

        return `
Erro ao acessar Gemini.
`;
    }
}

async function gerarResposta(texto) {

    const comando =
        texto.trim();

    // HELP

    if (comando === "/help") {

        return `
COMANDOS DA ATLAS

/help
/status
/plugins
/arquivo-atual
/selecao

/ia pergunta
/ia-arquivo pergunta
/ia-selecao pergunta

/gerar-codigo prompt
`;
    }

    // STATUS

    if (comando === "/status") {

        return `
STATUS DA ATLAS

- Painel ativo
- VS Code conectado
- Gemini conectado
- IA contextual
- Gerador de código ativo
`;
    }

    // PLUGINS

    if (comando === "/plugins") {

        return `
PLUGINS

- dev
- obsidian
- system
`;
    }

    // ARQUIVO

    if (comando === "/arquivo-atual") {

        const editor =
            obterEditor();

        if (!editor) {
            return "Nenhum arquivo aberto.";
        }

        const documento =
            editor.document;

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

    // SELEÇÃO

    if (comando === "/selecao") {

        const dadosSelecao =
            obterSelecaoAtual();

        if (!dadosSelecao) {
            return "Nenhum texto selecionado.";
        }

        return `
SELEÇÃO ATUAL

${dadosSelecao.textoSelecionado}
`;
    }

    // IA NORMAL

    if (comando.startsWith("/ia ")) {

        const prompt =
            comando.replace("/ia ", "");

        return await chamarGemini(prompt);
    }

    // IA ARQUIVO

    if (
        comando.startsWith("/ia-arquivo ")
    ) {

        const editor =
            obterEditor();

        if (!editor) {
            return "Nenhum arquivo aberto.";
        }

        const documento =
            editor.document;

        const codigo =
            documento.getText();

        const pergunta =
            comando.replace(
                "/ia-arquivo ",
                ""
            );

        const prompt = `
Você é a IA ATLAS.

Analise este código:

ARQUIVO:
${documento.fileName}

LINGUAGEM:
${documento.languageId}

CÓDIGO:
${codigo}

PERGUNTA:
${pergunta}

Responda de forma técnica,
objetiva e estratégica.
`;

        return await chamarGemini(prompt);
    }

    // IA SELEÇÃO

    if (
        comando.startsWith(
            "/ia-selecao "
        )
    ) {

        const dadosSelecao =
            obterSelecaoAtual();

        if (!dadosSelecao) {
            return "Nenhum texto selecionado.";
        }

        const documento =
            dadosSelecao.editor.document;

        const pergunta =
            comando.replace(
                "/ia-selecao ",
                ""
            );

        const prompt = `
Você é a IA ATLAS.

Analise apenas este trecho.

ARQUIVO:
${documento.fileName}

LINGUAGEM:
${documento.languageId}

TRECHO:
${dadosSelecao.textoSelecionado}

PERGUNTA:
${pergunta}

Explique a lógica
e sugira melhorias.
`;

        return await chamarGemini(prompt);
    }

    // GERADOR DE CÓDIGO

    if (
        comando.startsWith(
            "/gerar-codigo "
        )
    ) {

        const promptUsuario =
            comando.replace(
                "/gerar-codigo ",
                ""
            );

        const prompt = `
Você é a IA ATLAS,
especialista em engenharia
de software.

Gere código limpo,
moderno, organizado
e pronto para produção.

REQUISIÇÃO:
${promptUsuario}

REGRAS:
- explique o que o código faz
- gere código completo
- use boas práticas
- organize bem
- comente apenas o necessário
`;

        return await chamarGemini(prompt);
    }

    return `
ATLAS recebeu:

${texto}

Use /help
`;
}

function getWebviewContent() {

    return `
<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">

<style>

body {

    background: #050816;
    color: white;

    font-family: Arial;

    padding: 20px;
}

h1 {
    color: #4cc2ff;
}

textarea {

    width: 100%;
    height: 180px;

    background: #111827;
    color: white;

    border: 1px solid #2a2a2a;
    border-radius: 10px;

    padding: 15px;

    resize: none;
}

button {

    margin-top: 15px;

    background: #2563eb;
    color: white;

    border: none;
    border-radius: 10px;

    padding: 12px 22px;

    cursor: pointer;
}

#resposta {

    margin-top: 25px;

    background: #111827;

    border: 1px solid #2a2a2a;
    border-radius: 10px;

    padding: 20px;

    white-space: pre-wrap;
}

</style>
</head>

<body>

<h1>ATLAS</h1>

<p>
Painel inteligente da ATLAS.
</p>

<textarea
id="input"
placeholder="Digite um comando..."
></textarea>

<br>

<button onclick="enviar()">
Enviar
</button>

<div id="resposta">
ATLAS ONLINE
</div>

<script>

const vscode =
    acquireVsCodeApi();

function enviar() {

    const texto =
        document.getElementById(
            "input"
        ).value;

    vscode.postMessage({
        command: "enviar",
        texto
    });
}

window.addEventListener(
    "message",
    event => {

        const message =
            event.data;

        if (
            message.command ===
            "resposta"
        ) {

            document.getElementById(
                "resposta"
            ).textContent =
                message.texto;
        }
    }
);

</script>

</body>
</html>
`;
}

module.exports = {
    activate,
    deactivate
};