import fs from "fs";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";
import { exec } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";

const raiz = process.cwd();

dotenv.config({
  path: path.join(raiz, ".env"),
  override: true
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "ATLAS> "
});

const ignorar = [
  "node_modules",
  ".git",
  ".obsidian",
  ".atlas-backups",
  ".atlas-snapshots"
];

const geminiApiKey = process.env.GEMINI_API_KEY;
let geminiModel = null;

if (geminiApiKey) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);

  geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
  });
}

function dataNome() {
  return new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function caminhoSeguro(caminhoRelativo) {
  const final = path.resolve(raiz, caminhoRelativo || ".");
  const raizResolvida = path.resolve(raiz);

  if (!final.startsWith(raizResolvida)) {
    throw new Error("Caminho bloqueado fora da pasta ATLAS-IA.");
  }

  return final;
}

function listarArquivos(pasta = ".") {
  const caminho = caminhoSeguro(pasta);

  if (!fs.existsSync(caminho)) {
    return "Pasta não encontrada.";
  }

  const itens = fs.readdirSync(caminho, { withFileTypes: true });

  return itens
    .filter((item) => !ignorar.includes(item.name))
    .map((item) => {
      const icone = item.isDirectory() ? "📁" : "📄";
      return `${icone} ${item.name}`;
    })
    .join("\n");
}

function lerArquivo(caminhoRelativo) {
  if (!caminhoRelativo) {
    return "Uso: /ler caminho/do/arquivo.js";
  }

  const caminho = caminhoSeguro(caminhoRelativo);

  if (!fs.existsSync(caminho)) {
    return "Arquivo não encontrado.";
  }

  if (fs.statSync(caminho).isDirectory()) {
    return "Esse caminho é uma pasta.";
  }

  const conteudo = fs.readFileSync(caminho, "utf8");

  return conteudo.length > 20000
    ? conteudo.slice(0, 20000) + "\n\n[ARQUIVO CORTADO POR LIMITE]"
    : conteudo;
}

function carregarMemoria() {
  const pastasMemoria = [
    "00 - Sistema",
    "01 - Memória",
    "02 - Projetos",
    "03 - Conhecimento",
    "04 - Prompts",
    "05 - Logs"
  ];

  let memoria = "";

  for (const pasta of pastasMemoria) {
    const caminhoPasta = path.join(raiz, pasta);

    if (!fs.existsSync(caminhoPasta)) continue;

    memoria += lerMarkdownRecursivo(caminhoPasta);
  }

  return memoria;
}

function lerMarkdownRecursivo(pasta) {
  let resultado = "";

  const itens = fs.readdirSync(pasta, { withFileTypes: true });

  for (const item of itens) {
    if (ignorar.includes(item.name)) continue;

    const caminhoItem = path.join(pasta, item.name);

    if (item.isDirectory()) {
      resultado += lerMarkdownRecursivo(caminhoItem);
      continue;
    }

    if (item.isFile() && item.name.endsWith(".md")) {
      const conteudo = fs.readFileSync(caminhoItem, "utf8");
      const relativo = path.relative(raiz, caminhoItem);

      resultado += `

ARQUIVO: ${relativo}

${conteudo}

`;
    }
  }

  return resultado;
}

function snapshot() {
  const destino = path.join(raiz, ".atlas-snapshots");

  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
  }

  const nomeSnapshot = `snapshot-cli-${dataNome()}`;
  const pastaSnapshot = path.join(destino, nomeSnapshot);

  copiarPasta(raiz, pastaSnapshot);

  return `Snapshot criado com sucesso:\n${pastaSnapshot}`;
}

function copiarPasta(origem, destinoFinal) {
  if (!fs.existsSync(destinoFinal)) {
    fs.mkdirSync(destinoFinal, { recursive: true });
  }

  const itens = fs.readdirSync(origem, { withFileTypes: true });

  for (const item of itens) {
    if (ignorar.includes(item.name)) continue;

    const origemItem = path.join(origem, item.name);
    const destinoItem = path.join(destinoFinal, item.name);

    if (item.isDirectory()) {
      copiarPasta(origemItem, destinoItem);
    } else {
      fs.copyFileSync(origemItem, destinoItem);
    }
  }
}

function executarTerminal(comando) {
  return new Promise((resolve) => {
    if (!comando) {
      resolve("Uso: /terminal comando");
      return;
    }

    const bloqueados = [
      "rm ",
      "del ",
      "format",
      "shutdown",
      "restart",
      "powershell -enc",
      "curl ",
      "wget "
    ];

    const lower = comando.toLowerCase();

    if (bloqueados.some((b) => lower.includes(b))) {
      resolve("Comando bloqueado por segurança.");
      return;
    }

    exec(
      comando,
      {
        cwd: raiz,
        timeout: 30000,
        maxBuffer: 1024 * 1024
      },
      (erro, stdout, stderr) => {
        resolve(`
COMANDO:
${comando}

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

async function perguntarIA(pergunta) {
  if (!geminiModel) {
    return `
Gemini não conectado.

Verifique se existe no .env:

GEMINI_API_KEY=sua_chave
`;
  }

  const memoria = carregarMemoria();

  const prompt = `
Você é a ATLAS IA, assistente local do Alexander no terminal.

IDENTIDADE:
- Responda em português brasileiro.
- Seja direto, prático e organizado.
- Ajude com código, arquitetura, estudos e projetos.
- Quando pedir código, entregue código completo.
- Não invente arquivos que você não viu.
- Use a memória local quando fizer sentido.

RAIZ DO PROJETO:
${raiz}

MEMÓRIA LOCAL:
${memoria.slice(0, 30000)}

PEDIDO DO USUÁRIO:
${pergunta}
`;

  try {
    const resultado = await geminiModel.generateContent(prompt);
    const resposta = await resultado.response;

    return resposta.text();
  } catch (erro) {
    return `Erro ao chamar Gemini: ${erro.message}`;
  }
}

function ajuda() {
  return `
ATLAS CLI — comandos disponíveis

/status
Mostra status da ATLAS no terminal.

/listar
Lista arquivos da raiz.

/listar pasta
Lista arquivos de uma pasta.

/ler caminho
Lê um arquivo.

/snapshot
Cria snapshot manual do projeto.

/terminal comando
Executa comando no terminal com bloqueios básicos.

/sair
Fecha a ATLAS CLI.

MODO CONVERSA:
Digite qualquer pergunta sem "/" e a ATLAS responde com IA.

Exemplos:
como melhorar meu core/ai.js?
me explique a arquitetura atual do projeto
qual próximo passo do projeto ATLAS?
`;
}

async function processarEntrada(input) {
  const comando = input.trim();

  if (!comando) return;

  if (comando === "/sair" || comando === "exit") {
    console.log("ATLAS CLI encerrada.");
    rl.close();
    return;
  }

  if (comando === "/help" || comando === "/ajuda") {
    console.log(ajuda());
    return;
  }

  if (comando === "/status") {
    console.log(`
ATLAS CLI ativa.

RAIZ:
${raiz}

MODO:
Terminal local + conversa IA

IA:
Gemini: ${geminiModel ? "conectado" : "não conectado"}

RECURSOS:
- leitura de arquivos
- listagem
- snapshot
- terminal seguro
- conversa natural com IA
`);
    return;
  }

  if (comando.startsWith("/listar")) {
    const pasta = comando.replace(/^\/listar\s*/i, "").trim() || ".";
    console.log(listarArquivos(pasta));
    return;
  }

  if (comando.startsWith("/ler ")) {
    const arquivo = comando.replace(/^\/ler\s*/i, "").trim();
    console.log(lerArquivo(arquivo));
    return;
  }

  if (comando === "/snapshot") {
    console.log(snapshot());
    return;
  }

  if (comando.startsWith("/terminal ")) {
    const cmd = comando.replace(/^\/terminal\s*/i, "").trim();
    const saida = await executarTerminal(cmd);
    console.log(saida);
    return;
  }

  console.log("ATLAS pensando...\n");
  const resposta = await perguntarIA(comando);
  console.log(resposta);
}

console.log("ATLAS CLI iniciada.");
console.log("Digite /help para ver os comandos.");
console.log("Digite /sair para encerrar.");
console.log("");
rl.prompt();

rl.on("line", async (line) => {
  await processarEntrada(line);
  rl.prompt();
});

rl.on("close", () => {
  process.exit(0);
});