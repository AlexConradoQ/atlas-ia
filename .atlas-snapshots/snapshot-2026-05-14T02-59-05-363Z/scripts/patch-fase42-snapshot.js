import fs from "fs";
import path from "path";

const raiz = process.cwd();
const arquivo = path.join(raiz, "vscode-extension", "src", "extension.js");
const pastaBackups = path.join(raiz, ".atlas-backups");

if (!fs.existsSync(arquivo)) {
  console.error("Arquivo extension.js não encontrado:");
  console.error(arquivo);
  process.exit(1);
}

if (!fs.existsSync(pastaBackups)) {
  fs.mkdirSync(pastaBackups, { recursive: true });
}

const timestamp = new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace(/\./g, "-");

const backup = path.join(
  pastaBackups,
  timestamp + "__fase42-antes-snapshot__vscode-extension__src__extension.js.bak"
);

fs.copyFileSync(arquivo, backup);

let codigo = fs.readFileSync(arquivo, "utf8");

if (codigo.includes("function criarSnapshotProjeto()")) {
  console.log("O comando /snapshot já existe. Nenhuma alteração feita.");
  process.exit(0);
}

const funcaoSnapshot = `
function criarSnapshotProjeto() {
    atualizarRaizAtlas();

    const pastaSnapshots = path.join(raizAtlas, ".atlas-snapshots");

    const ignorar = [
        "node_modules",
        ".git",
        ".obsidian",
        ".atlas-backups",
        ".atlas-snapshots"
    ];

    function dataNomeSnapshot() {
        return new Date()
            .toISOString()
            .replace(/:/g, "-")
            .replace(/\\./g, "-");
    }

    function copiarPastaSnapshot(origem, destinoFinal) {
        if (!fs.existsSync(destinoFinal)) {
            fs.mkdirSync(destinoFinal, { recursive: true });
        }

        const itens = fs.readdirSync(origem, { withFileTypes: true });

        for (const item of itens) {
            if (ignorar.includes(item.name)) continue;

            const caminhoOrigem = path.join(origem, item.name);
            const caminhoDestino = path.join(destinoFinal, item.name);

            if (item.isDirectory()) {
                copiarPastaSnapshot(caminhoOrigem, caminhoDestino);
            } else {
                fs.copyFileSync(caminhoOrigem, caminhoDestino);
            }
        }
    }

    if (!fs.existsSync(pastaSnapshots)) {
        fs.mkdirSync(pastaSnapshots, { recursive: true });
    }

    const nomeSnapshot = "snapshot-" + dataNomeSnapshot();
    const caminhoSnapshot = path.join(pastaSnapshots, nomeSnapshot);

    copiarPastaSnapshot(raizAtlas, caminhoSnapshot);

    registrarAcaoAtlas(
        "SNAPSHOT MANUAL CRIADO",
        "SNAPSHOT:\\n.atlas-snapshots/" + nomeSnapshot
    );

    return \`
Snapshot criado com sucesso.

PASTA:
.atlas-snapshots/\${nomeSnapshot}

CAMINHO COMPLETO:
\${caminhoSnapshot}
\`;
}

`;

const marcadorFuncao = "function lerArquivosMarkdownRecursivo";
if (!codigo.includes(marcadorFuncao)) {
  console.error("Marcador de função não encontrado.");
  process.exit(1);
}

codigo = codigo.replace(marcadorFuncao, funcaoSnapshot + marcadorFuncao);

const trechoHelp = "/restaurar-backup nome-do-backup";
if (codigo.includes(trechoHelp) && !codigo.includes("/snapshot\\n")) {
  codigo = codigo.replace(trechoHelp, trechoHelp + "\\n/snapshot");
}

const trechoStatus = "- Log de ações: ativo";
if (codigo.includes(trechoStatus) && !codigo.includes("- Snapshot manual: ativo")) {
  codigo = codigo.replace(trechoStatus, trechoStatus + "\\n- Snapshot manual: ativo");
}

const trechoHandler = `    if (comando === "/restaurar-backup" || comando === "/backups" || comando.startsWith("/restaurar-backup ")) {
        return await restaurarBackup(comando.replace(/^\\\\/backups/i, "/restaurar-backup"));
    }`;

const novoHandler = `${trechoHandler}

    if (comando === "/snapshot") {
        return criarSnapshotProjeto();
    }`;

if (!codigo.includes(trechoHandler)) {
  console.error("Handler de backup não encontrado.");
  process.exit(1);
}

codigo = codigo.replace(trechoHandler, novoHandler);

const botaoBackups = `<button onclick="atalho('/backups')">/backups</button>`;
const botaoSnapshot = `<button onclick="atalho('/snapshot')">/snapshot</button>`;

if (codigo.includes(botaoBackups) && !codigo.includes(botaoSnapshot)) {
  codigo = codigo.replace(botaoBackups, botaoBackups + "\\n    " + botaoSnapshot);
}

fs.writeFileSync(arquivo, codigo, "utf8");

console.log("Patch Fase 4.2 aplicado com sucesso.");
console.log("Backup criado em:");
console.log(backup);