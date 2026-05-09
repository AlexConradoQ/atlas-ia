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

        console.log("Gemini conectado na extensão.");
    } else {
        console.log("GEMINI_API_KEY não encontrada.");
    }

    if (vscode.window.activeTextEditor) {
        ultimoEditorTexto = vscode.window.activeTextEditor;
    }

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document) {
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

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "enviar") {
                    const texto = message.texto;
                    const resposta = await gerarResposta(texto);

                    panel.webview.postMessage({
                        command: "resposta",
                        texto: resposta
                    });
                }
            });
        }
    );

    context.subscriptions.push(disposable);
}

function obterEditorDeCodigo() {
    const editorAtivo = vscode.window.activeTextEditor;

    if (
        editorAtivo &&
        editorAtivo.document &&
        editorAtivo.document.uri.scheme === "file"
    ) {
        ultimoEditorTexto = editorAtivo;
        return editorAtivo;
    }

    return ultimoEditorTexto;
}

async function gerarResposta(texto) {
    const comando = texto.trim();

    if (comando === "/help") {
        return `
COMANDOS

/help
/status
/plugins
/arquivo-atual
/selecao
/ia sua pergunta
`;
    }

    if (comando === "/status") {
        return `
STATUS DA ATLAS

- Extensão ativa
- Webview online
- Backend Node.js ativo
- VS Code integrado
- Gemini: ${model ? "conectado" : "não conectado"}
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

    if (comando === "/arquivo-atual") {
        const editor = obterEditorDeCodigo();

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

    if (comando === "/selecao") {
        const editor = obterEditorDeCodigo();

        if (!editor) {
            return "Nenhum editor aberto.";
        }

        const textoSelecionado = editor.document.getText(
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

    if (comando.startsWith("/ia ")) {
        if (!model) {
            return `
Gemini não conectado.

Verifique se existe um arquivo .env na raiz do projeto ATLAS-IA com:

GEMINI_API_KEY=sua_chave_aqui
`;
        }

        const prompt = comando.replace("/ia ", "").trim();

        try {
            const resultado = await model.generateContent(prompt);
            const resposta = await resultado.response;

            return resposta.text();
        } catch (erro) {
            console.log("Erro Gemini:", erro);

            return `
Erro ao acessar Gemini.

Possíveis causas:
- chave inválida
- limite da API
- internet/API instável
- modelo indisponível
`;
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
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
body {
    background: #0b0b0f;
    color: white;
    font-family: Arial;
    padding: 24px;
}

.container {
    max-width: 900px;
    margin: auto;
}

h1 {
    color: #7dd3fc;
}

textarea {
    width: 100%;
    height: 140px;
    background: #18181b;
    color: white;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 14px;
    resize: none;
}

button {
    margin-top: 14px;
    padding: 12px 18px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}

.box {
    margin-top: 20px;
    background: #18181b;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 18px;
    white-space: pre-wrap;
}
</style>
</head>

<body>
<div class="container">
<h1>ATLAS</h1>

<p>Painel inteligente da ATLAS.</p>

<textarea
    id="input"
    placeholder="Digite um comando..."
></textarea>

<button onclick="enviar()">
Enviar
</button>

<div class="box" id="resposta">
ATLAS ONLINE
</div>
</div>

<script>
const vscode = acquireVsCodeApi();

function enviar() {
    const texto = document
        .getElementById("input")
        .value;

    vscode.postMessage({
        command: "enviar",
        texto
    });
}

window.addEventListener("message", event => {
    const message = event.data;

    if (message.command === "resposta") {
        document
            .getElementById("resposta")
            .textContent = message.texto;
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