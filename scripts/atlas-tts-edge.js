import edgeTTS from "edge-tts";
import path from "path";
import fs from "fs";
import { exec } from "child_process";

const texto =
  process.argv.slice(2).join(" ") ||
  "Olá Alex. Eu sou a ATLAS. Voz neural ativada.";

const pastaAudio = path.join(process.cwd(), "05 - Logs", "audio");

if (!fs.existsSync(pastaAudio)) {
  fs.mkdirSync(pastaAudio, { recursive: true });
}

const arquivo = path.join(pastaAudio, "atlas-edge.mp3");

async function falar() {
  try {
    const tts = new edgeTTS.Communicate(
      texto,
      "pt-BR-FranciscaNeural"
    );

    await tts.save(arquivo);

    console.log("Áudio criado:");
    console.log(arquivo);

    exec(`start "" "${arquivo}"`);
  } catch (erro) {
    console.error("Erro:");
    console.error(erro.message);
  }
}

falar();