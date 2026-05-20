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

        execFile(
            "powershell",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                comando
            ],
            () => resolve()
        );
    });
}

async function falarTexto(texto) {
    const audio = await speak(texto);

    if (audio) {
        await tocarAudio(audio);
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
        .replace(/\bjs\b/g, " js ")
        .replace(/\//g, " ")
        .replace(/\\/g, " ")
        .replace(/\./g, " ")
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function listarArquivosProjeto() {
    const encontrados = [];

    function scan(dir) {
        const itens = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of itens) {
            if (
                item.name === "node_modules" ||
                item.name === ".git" ||
                item.name === ".atlas-snapshots" ||
                item.name === ".atlas-backups"
            ) {
                continue;
            }

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

function pontuarArquivo(caminhoArquivo, busca) {
    const relativo = path.relative(process.cwd(), caminhoArquivo);
    const alvo = normalizarBusca(relativo);
    const nome = normalizarBusca(path.basename(caminhoArquivo));

    const termos = normalizarBusca(busca)
        .split(" ")
        .filter(Boolean);

    let pontos = 0;

    for (const termo of termos) {
        if (alvo.includes(termo)) pontos += 2;
        if (nome.includes(termo)) pontos += 3;
    }

    if (alvo.includes(normalizarBusca(busca))) pontos += 10;
    if (nome.includes(normalizarBusca(busca))) pontos += 15;

    return pontos;
}

function localizarArquivo(busca) {
    const arquivos = listarArquivosProjeto();

    const ranqueados = arquivos
        .map(arquivo => ({
            arquivo,
            pontos: pontuarArquivo(arquivo, busca)
        }))
        .filter(item => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos);

    return ranqueados[0]?.arquivo || null;
}

function abrirNoVSCode(arquivoFalado) {
    return new Promise((resolve) => {
        const encontrado = localizarArquivo(arquivoFalado);

        if (!encontrado) {
            resolve({
                ok: false,
                caminho: null
            });
            return;
        }

        execFile(
            "cmd",
            ["/c", "code", "-r", encontrado],
            () => {
                resolve({
                    ok: true,
                    caminho: encontrado
                });
            }
        );
    });
}

async function responder(textoUsuario) {
    const local = processarIntentLocal(textoUsuario);

    if (local) {
        if (local.acao === "open_file") {
            const resultado = await abrirNoVSCode(local.arquivo);

            if (resultado.ok) {
                const relativo = path.relative(process.cwd(), resultado.caminho);
                const msg = `Arquivo aberto: ${relativo}.`;

                console.log(`🤖 ATLAS: ${msg}\n`);
                await falarTexto(msg);
            } else {
                const msg = "Arquivo não encontrado.";

                console.log(`🤖 ATLAS: ${msg}\n`);
                await falarTexto(msg);
            }

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
        const resposta = await askAI(
            textoUsuario,
            carregarMemoria(),
            "auto",
            false
        );

        const texto =
            typeof resposta === "string"
                ? resposta
                : resposta?.text || "Sem resposta.";

        console.log(`🤖 ATLAS: ${texto}\n`);
        await falarTexto(texto);

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

        if (!texto) {
            continue;
        }

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

            if (resultado === "__SLEEP__") {
                continue;
            }

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

        if (cmd === "sair") {
            process.exit(0);
        }

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