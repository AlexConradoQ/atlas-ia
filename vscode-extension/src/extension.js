const vscode = require("vscode");
const path = require("path");
const dotenv = require("dotenv");

const {
    GoogleGenerativeAI
} = require("@google/generative-ai");

let model = null;
let ultimoEditorTexto = null;

function activate(context) {
    console.log("ATLAS ativada com sucesso.");

    const envPath = path.join(
        context.extensionPath,
        "..",
        ".env"
    );

    dotenv.config({
        path: envPath
    });

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);

        model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

        console.log("Gemini conectado.");
    }

    if (vscode.window.activeTextEditor) {
        ultimoEditorTexto = vscode.window.activeTextEditor;
    }

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            ultimoEditorTexto = editor;
        }
    });

    const disposable = vscode.commands.registerCommand(
        "atlas.openPanel",
        function () {

            const panel = vscode.window.createWebviewPanel(
                "atlasPanel",
                "ATLAS",
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            panel.webview.html = getWebviewContent();

            panel.webview.onDidReceiveMessage(
                async (message) => {

                    if (message.command === "enviar") {

                        const resposta =
                            await gerarResposta(message.texto);

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

function obterEditor() {

    const editorAtual =
        vscode.window.activeTextEditor;

    if (
        editorAtual &&
        editorAtual.document &&
        editorAtual.document.uri.scheme === "file"
    ) {
        ultimoEditorTexto = editorAtual;
        return editorAtual;
    }

    return ultimoEditorTexto;
}

async function gerarResposta(texto) {

    const comando = texto.trim();

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
`;
    }

    // STATUS
    if (comando === "/status") {

        return `
STATUS DA ATLAS

- Painel ativo
- VS Code conectado
- Gemini conectado
- IA contextual ativa
- Sistema operacional
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

    // ARQUIVO ATUAL
    if (comando === "/arquivo-atual") {

        const editor = obterEditor();

        if (!editor) {
            return "Nenhum arquivo aberto.";
        }

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

    // SELEÇÃO
    if (comando === "/selecao") {

        const editor = obterEditor();

        if (!editor) {
            return "Nenhum editor aberto.";
        }

        const textoSelecionado =
            editor.document.getText(
                editor.selection
            );

        if (!textoSelecionado.trim()) {
            return "Nenhum texto selecionado.";
        }

        return `
SELEÇÃO ATUAL

${textoSelecionado}
`;
    }

    // IA NORMAL
    if (comando.startsWith("/ia ")) {

        if (!model) {
            return "Gemini não conectado.";
        }

        const prompt =
            comando.replace("/ia ", "");

        try {

            const resultado =
                await model.generateContent(prompt);

            const resposta =
                await resultado.response;

            return resposta.text();

        } catch (erro) {

            console.log(erro);

            return "Erro ao acessar Gemini.";
        }
    }

    // IA COM ARQUIVO
    if (comando.startsWith("/ia-arquivo ")) {

        if (!model) {
            return "Gemini não conectado.";
        }

        const editor = obterEditor();

        if (!editor) {
            return "Nenhum arquivo aberto.";
        }

        const documento = editor.document;

        const codigo =
            documento.getText();

        const pergunta =
            comando.replace("/ia-arquivo ", "");

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
clara e objetiva.
`;

        try {

            const resultado =
                await model.generateContent(prompt);

            const resposta =
                await resultado.response;

            return resposta.text();

        } catch (erro) {

            console.log(erro);

            return "Erro ao analisar arquivo.";
        }
    }

    return `
ATLAS recebeu:

${texto}
`;
}

function deactivate() {}

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
    height: 160px;

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

<p>Painel inteligente da ATLAS.</p>

<textarea
id="input"
placeholder="Digite um comando da ATLAS..."
></textarea>

<br>

<button onclick="enviar()">
Enviar
</button>

<div id="resposta">
ATLAS ONLINE
</div>

<script>

const vscode = acquireVsCodeApi();

function enviar() {

    const texto =
        document.getElementById("input").value;

    vscode.postMessage({
        command: "enviar",
        texto
    });
}

window.addEventListener("message", event => {

    const message = event.data;

    if (message.command === "resposta") {

        document.getElementById(
            "resposta"
        ).textContent = message.texto;
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