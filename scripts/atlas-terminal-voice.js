import readline from "readline";
import { askAI } from "../core/ai.js";
import { speak } from "../core/voice.js";
import { carregarMemoria } from "../core/memory.js";
import { limparMemoriaSessao } from "../core/session-memory.js";
import { processarIntentLocal } from "../core/intents.js";

import { spawn, execFile } from "child_process";
import path from "path";
import fs from "fs";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const IGNORAR = [
    "node_modules",
    ".git",
    ".atlas-snapshots",
    ".atlas-backups"
];

function tocarAudio(audioPath) {
    return new Promise((resolve) => {
        if (!audioPath) return resolve();

        const caminho = path.resolve(audioPath);

        const comando = `
Add-Type -AssemblyName presentationCore;
$player = New-Object System.Windows.Media.MediaPlayer;
$player.Open([Uri]"${caminho.replace(/\\/g, "\\\\")}");
while ($player.NaturalDuration.HasTimeSpan -eq $false) {
Start-Sleep -Milliseconds 100;
}
$duration = $player.NaturalDuration.TimeSpan.TotalSeconds;
$player.Play();
Start-Sleep -Seconds ([Math]::Ceiling($duration) + 1);
$player.Stop();
$player.Close();
`;

        execFile("powershell", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            comando
        ], () => resolve());
    });
}

async function falarTexto(texto) {
    const audio = await speak(texto);
    if (audio) await tocarAudio(audio);
}

async function executarIAComSilencio(prompt, memoria, provider = "auto") {
    const erroOriginal = console.error;
    const logOriginal = console.log;

    console.error = () => {};
    console.log = (...args) => {
        const texto = args.join(" ");

        if (
            texto.includes("Erro OpenAI") ||
            texto.includes("Erro Gemini") ||
            texto.includes("RateLimitError") ||
            texto.includes("GoogleGenerativeAI") ||
            texto.includes("insufficient_quota") ||
            texto.includes("Too Many Requests")
        ) {
            return;
        }

        logOriginal(...args);
    };

    try {
        return await askAI(prompt, memoria, provider, false);
    } finally {
        console.error = erroOriginal;
        console.log = logOriginal;
    }
}

function executarPython(script) {
    return new Promise((resolve) => {
        const processo = spawn("py", [script]);

        let saida = "";

        processo.stdout.on("data", d => {
            saida += d.toString();
        });

        processo.stderr.on("data", d => {
            saida += d.toString();
        });

        processo.on("close", () => {
            resolve(saida.trim());
        });
    });
}

function extrairTexto(saida) {
    if (!saida) return null;

    const linhas = saida
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    for (const linha of linhas) {
        if (linha.startsWith("TEXT:")) {
            return linha.replace("TEXT:", "").trim();
        }

        if (linha.startsWith("COMMAND:")) {
            return linha.replace("COMMAND:", "").trim();
        }
    }

    return null;
}

function normalizarBusca(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\bbarra\b/g, " ")
        .replace(/\bponto\b/g, " ")
        .replace(/\btraco\b/g, " ")
        .replace(/\bhifen\b/g, " ")
        .replace(/\baí\b/g, "ai")
        .replace(/\//g, " ")
        .replace(/\\/g, " ")
        .replace(/\./g, " ")
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function deveIgnorar(nome) {
    return IGNORAR.includes(nome);
}

function listarArquivosProjeto() {
    const encontrados = [];

    function scan(dir) {
        const itens = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of itens) {
            if (deveIgnorar(item.name)) continue;

            const completo = path.join(dir, item.name);

            if (item.isDirectory()) {
                scan(completo);
            } else {
                encontrados.push(completo);
            }
        }
    }

    scan(process.cwd());
    return encontrados;
}

function listarPastasProjeto() {
    const encontrados = [];

    function scan(dir) {
        const itens = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of itens) {
            if (deveIgnorar(item.name)) continue;

            const completo = path.join(dir, item.name);

            if (item.isDirectory()) {
                encontrados.push(completo);
                scan(completo);
            }
        }
    }

    scan(process.cwd());
    return encontrados;
}

function pontuarAlvo(caminhoAlvo, busca) {
    const relativo = path.relative(process.cwd(), caminhoAlvo);
    const alvo = normalizarBusca(relativo);
    const nome = normalizarBusca(path.basename(caminhoAlvo));
    const termos = normalizarBusca(busca).split(" ").filter(Boolean);

    let pontos = 0;

    for (const termo of termos) {
        if (alvo.includes(termo)) pontos += 2;
        if (nome.includes(termo)) pontos += 4;
    }

    if (alvo.includes(normalizarBusca(busca))) pontos += 10;
    if (nome.includes(normalizarBusca(busca))) pontos += 15;

    return pontos;
}

function localizarArquivo(busca) {
    return listarArquivosProjeto()
        .map(arquivo => ({
            arquivo,
            pontos: pontuarAlvo(arquivo, busca)
        }))
        .filter(item => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)[0]?.arquivo || null;
}

function localizarPasta(busca) {
    return listarPastasProjeto()
        .map(pasta => ({
            pasta,
            pontos: pontuarAlvo(pasta, busca)
        }))
        .filter(item => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)[0]?.pasta || null;
}

function abrirNoVSCode(alvoFalado) {
    return new Promise((resolve) => {
        const encontrado = localizarArquivo(alvoFalado);

        if (!encontrado) {
            resolve({ ok: false, caminho: null });
            return;
        }

        execFile("cmd", ["/c", "code", "-r", encontrado], () => {
            resolve({ ok: true, caminho: encontrado });
        });
    });
}

function abrirPastaNoVSCode(alvoFalado) {
    return new Promise((resolve) => {
        const encontrada = localizarPasta(alvoFalado);

        if (!encontrada) {
            resolve({ ok: false, caminho: null });
            return;
        }

        execFile("cmd", ["/c", "code", "-r", encontrada], () => {
            resolve({ ok: true, caminho: encontrada });
        });
    });
}

function lerArquivoProjeto(alvoFalado) {
    const encontrado = localizarArquivo(alvoFalado);

    if (!encontrado) return null;

    return {
        caminho: encontrado,
        conteudo: fs.readFileSync(encontrado, "utf8")
    };
}

function resumoLocalArquivo(info) {
    const relativo = path.relative(process.cwd(), info.caminho);
    const linhas = info.conteudo.split("\n");
    const totalLinhas = linhas.length;

    const imports = linhas
        .filter(linha =>
            linha.trim().startsWith("import ") ||
            (linha.trim().startsWith("const ") && linha.includes("require("))
        )
        .slice(0, 6)
        .map(linha => linha.trim());

    const funcoes = linhas
        .filter(linha =>
            linha.includes("function ") ||
            linha.includes("export function ") ||
            linha.includes("async function ") ||
            linha.includes("export async function ")
        )
        .slice(0, 8)
        .map(linha => linha.trim());

    let resumo = `Arquivo ${relativo}. Ele tem aproximadamente ${totalLinhas} linhas.`;

    if (imports.length > 0) {
        resumo += ` Usa módulos como: ${imports.join(" | ")}.`;
    }

    if (funcoes.length > 0) {
        resumo += ` Funções detectadas: ${funcoes.join(" | ")}.`;
    }

    resumo += " Resumo local usado porque a IA externa está indisponível.";

    return resumo;
}

function respostaTemErroIA(texto) {
    const t = String(texto).toLowerCase();

    return (
        t.includes("erro openai") ||
        t.includes("erro gemini") ||
        t.includes("429") ||
        t.includes("quota") ||
        t.includes("insufficient_quota") ||
        t.includes("too many requests") ||
        t.includes("limite")
    );
}

async function resumirArquivo(info) {
    const relativo = path.relative(process.cwd(), info.caminho);
    const trecho = info.conteudo.slice(0, 6000);

    try {
        const resposta = await executarIAComSilencio(
            `
Analise esse arquivo do projeto e explique resumidamente o que ele faz.

Arquivo:
${relativo}

Conteúdo:
${trecho}
`,
            carregarMemoria(),
            "auto"
        );

        const texto =
            typeof resposta === "string"
                ? resposta
                : resposta?.text || "";

        if (!texto || respostaTemErroIA(texto)) {
            console.log("⚠️ IA externa indisponível. Usando resumo local.\n");
            return resumoLocalArquivo(info);
        }

        return texto;
    } catch {
        console.log("⚠️ IA externa indisponível. Usando resumo local.\n");
        return resumoLocalArquivo(info);
    }
}

function listarEstruturaProjeto() {
    const pastasPrincipais = fs.readdirSync(process.cwd(), { withFileTypes: true })
        .filter(item => item.isDirectory() && !deveIgnorar(item.name))
        .map(item => item.name);

    const arquivosRaiz = fs.readdirSync(process.cwd(), { withFileTypes: true })
        .filter(item => item.isFile())
        .map(item => item.name);

    return `Estrutura principal do projeto. Pastas: ${pastasPrincipais.join(", ")}. Arquivos na raiz: ${arquivosRaiz.join(", ")}.`;
}

function buscarNoProjeto(termo) {
    const resultados = listarArquivosProjeto()
        .map(arquivo => ({
            arquivo,
            pontos: pontuarAlvo(arquivo, termo)
        }))
        .filter(item => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 5);

    if (resultados.length === 0) {
        return "Não encontrei nada com esse termo no projeto.";
    }

    return "Encontrei: " + resultados
        .map(item => path.relative(process.cwd(), item.arquivo))
        .join(" | ");
}

async function responder(textoUsuario) {
    const local = processarIntentLocal(textoUsuario);

    if (local) {
        if (local.acao === "open_file") {
            const resultado = await abrirNoVSCode(local.alvo);

            const msg = resultado.ok
                ? `Arquivo aberto: ${path.relative(process.cwd(), resultado.caminho)}.`
                : "Arquivo não encontrado.";

            console.log(`🤖 ATLAS: ${msg}\n`);
            await falarTexto(msg);
            return;
        }

        if (local.acao === "open_folder") {
            const resultado = await abrirPastaNoVSCode(local.alvo);

            const msg = resultado.ok
                ? `Pasta aberta: ${path.relative(process.cwd(), resultado.caminho)}.`
                : "Pasta não encontrada.";

            console.log(`🤖 ATLAS: ${msg}\n`);
            await falarTexto(msg);
            return;
        }

        if (local.acao === "read_file") {
            const info = lerArquivoProjeto(local.alvo);

            if (!info) {
                const msg = "Arquivo não encontrado.";
                console.log(`🤖 ATLAS: ${msg}\n`);
                await falarTexto(msg);
                return;
            }

            const resumo = await resumirArquivo(info);
            console.log(`🤖 ATLAS: ${resumo}\n`);
            await falarTexto(resumo);
            return;
        }

        if (local.acao === "list_project") {
            const msg = listarEstruturaProjeto();
            console.log(`🤖 ATLAS: ${msg}\n`);
            await falarTexto(msg);
            return;
        }

        if (local.acao === "search_project") {
            const msg = buscarNoProjeto(local.termo);
            console.log(`🤖 ATLAS: ${msg}\n`);
            await falarTexto(msg);
            return;
        }

        console.log(`🤖 ATLAS: ${local.resposta}\n`);
        await falarTexto(local.resposta);

        if (local.acao === "clear") {
            limparMemoriaSessao();
        }

        if (local.acao === "sleep") {
            return "__SLEEP__";
        }

        return;
    }

    try {
        const resposta = await executarIAComSilencio(
            textoUsuario,
            carregarMemoria(),
            "auto"
        );

        const texto =
            typeof resposta === "string"
                ? resposta
                : resposta?.text || "Sem resposta.";

        const respostaFinal = respostaTemErroIA(texto)
            ? "Estou sem acesso às IAs externas agora, mas continuo funcionando localmente."
            : texto;

        console.log(`🤖 ATLAS: ${respostaFinal}\n`);
        await falarTexto(respostaFinal);
    } catch {
        const fallback =
            "Estou sem acesso às IAs externas agora, mas continuo funcionando localmente.";

        console.log(`🤖 ATLAS: ${fallback}\n`);
        await falarTexto(fallback);
    }
}

async function modoConversaContinua() {
    console.log("🟢 Modo conversa contínua ativado.\n");

    while (true) {
        console.log("🎤 Ouvindo você...\n");

        const comando = await executarPython("scripts/atlas-mic.py");
        const texto = extrairTexto(comando);

        if (!texto) continue;

        console.log(`🎤 Você disse: ${texto}\n`);

        const resultado = await responder(texto);

        if (resultado === "__SLEEP__") {
            break;
        }
    }
}

async function modoWake() {
    while (true) {
        console.log("👂 Aguardando wake word...\n");

        const wake = await executarPython("scripts/atlas-wake.py");

        if (!wake.includes("WAKE_WORD") && !wake.includes("COMMAND:")) {
            continue;
        }

        const comandoDireto = extrairTexto(wake);

        if (comandoDireto) {
            const resultado = await responder(comandoDireto);

            if (resultado === "__SLEEP__") continue;

            await modoConversaContinua();
            continue;
        }

        await falarTexto("Sim, estou ouvindo.");
        await modoConversaContinua();
    }
}

function perguntar() {
    rl.question("🎤 Você: ", async (entrada) => {
        const cmd = entrada.trim().toLowerCase();

        if (cmd === "sair") process.exit(0);

        if (cmd === "/wake") {
            await modoWake();
            return;
        }

        if (cmd === "/limpar") {
            limparMemoriaSessao();
            console.log("Memória limpa.\n");
            return perguntar();
        }

        await responder(entrada);
        perguntar();
    });
}

console.log(`
ATLAS ONLINE

/wake
/limpar
sair
`);

perguntar();