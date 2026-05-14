import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { exec } from "child_process";

const raiz = process.cwd();

dotenv.config({
  path: path.join(raiz, ".env"),
  override: true
});

const texto = process.argv.slice(2).join(" ").trim() || "Olá Alex. Eu sou a ATLAS. Voz neural ativada.";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY não encontrada no .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey
});

const pastaAudio = path.join(raiz, "05 - Logs", "audio");

if (!fs.existsSync(pastaAudio)) {
  fs.mkdirSync(pastaAudio, { recursive: true });
}

const arquivoAudio = path.join(pastaAudio, "atlas-voz.mp3");

try {
  const mp3 = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "nova",
    input: texto
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  fs.writeFileSync(arquivoAudio, buffer);

  console.log("Áudio criado:");
  console.log(arquivoAudio);

  exec(`start "" "${arquivoAudio}"`);
} catch (erro) {
  console.error("Erro ao gerar voz OpenAI:");
  console.error(erro.message);
  process.exit(1);
}