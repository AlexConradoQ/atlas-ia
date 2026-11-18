import fs from "node:fs";
import path from "node:path";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const configPath = path.join(here, "config.json");
const examplePath = path.join(here, "config.example.json");
const config = JSON.parse(fs.readFileSync(fs.existsSync(configPath) ? configPath : examplePath, "utf8"));
const abs = (value) => path.resolve(root, value);
const queuePath = abs(config.queueFile);
const credentialsPath = abs(config.platforms.youtube.credentialsFile || "./secrets/google-oauth-client.json");
const tokenPath = abs(config.platforms.youtube.tokenFile || "./secrets/youtube-token.json");

if (!fs.existsSync(queuePath)) throw new Error("Fila não encontrada: " + queuePath);
if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
  throw new Error("Credenciais OAuth ou token não encontrados. Rode npm run clip-agent:auth.");
}

const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const targetName = "Avião anda sozinho e fuga termina em chamas.mp4";
const item = queue.find((entry) => entry.originalName === targetName);

if (!item) throw new Error("Vídeo de teste não encontrado na fila: " + targetName);
if (!fs.existsSync(item.file)) throw new Error("Arquivo de vídeo não encontrado: " + item.file);
if (item.youtubePrivateTestVideoId || item.platforms?.youtube === "private-test-uploaded") {
  throw new Error("Este vídeo já foi enviado como teste privado. Não vou enviar uma segunda vez.");
}

const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
const client = raw.installed || raw.web;
if (!client?.client_id || !client?.client_secret) throw new Error("Credenciais OAuth inválidas.");
const auth = new google.auth.OAuth2(client.client_id, client.client_secret);
auth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf8")));
const youtube = google.youtube({ version: "v3", auth });

console.log("[TESTE PRIVADO] Enviando somente:", item.originalName);
const response = await youtube.videos.insert({
  part: ["snippet", "status"],
  requestBody: {
    snippet: {
      title: (item.titleDraft || item.originalName).slice(0, 100),
      description: `${item.descriptionDraft || item.titleDraft || ""}\n\n${(item.hashtagsDraft || []).join(" ")}`.slice(0, 5000),
      categoryId: String(config.platforms.youtube.categoryId || "20")
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false
    }
  },
  media: { body: createReadStream(item.file) }
});

item.youtubePrivateTestVideoId = response.data.id;
item.platforms = { ...(item.platforms || {}), youtube: "private-test-uploaded" };
item.privateTestUploadedAt = new Date().toISOString();
fs.writeFileSync(queuePath + ".tmp", JSON.stringify(queue, null, 2));
fs.renameSync(queuePath + ".tmp", queuePath);

console.log("[TESTE PRIVADO] Upload concluído.");
console.log("[TESTE PRIVADO] ID do vídeo:", response.data.id);
console.log("[TESTE PRIVADO] Visibilidade: privado (sem publicação agendada).");
console.log("[TESTE PRIVADO] Os outros vídeos da fila não foram alterados nem enviados.");
