import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const configPath = path.join(here, "config.json");
const config = JSON.parse(fs.readFileSync(fs.existsSync(configPath) ? configPath : path.join(here, "config.example.json"), "utf8"));
const abs = (p) => path.resolve(root, p);
const watchDir = abs(config.watchDirectory);
const queuePath = abs(config.queueFile);
const stateDir = path.dirname(queuePath);
const processedDir = abs(config.processedDirectory);
const errorDir = abs(config.errorDirectory);
for (const dir of [watchDir, stateDir, processedDir, errorDir]) fs.mkdirSync(dir, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function readQueue() {
  try { return JSON.parse(fs.readFileSync(queuePath, "utf8")); } catch { return []; }
}
function saveQueue(q) {
  const tmp = queuePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, queuePath);
}
async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function localIso(date = new Date()) {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function parseLocalSlot(day, time) {
  // Schedule values are interpreted in the configured timezone (Brazil default UTC-3).
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetProbe = new Date(utcGuess);
  const p = localParts(offsetProbe);
  const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  const offset = represented - utcGuess;
  return new Date(utcGuess - offset);
}
function nextSlots(queue, count) {
  const used = new Set(queue.filter(x => x.scheduledAt).map(x => x.scheduledAt));
  const slots = [];
  const now = Date.now();
  for (let day = 0; day < 60 && slots.length < count; day++) {
    const date = new Date(now + day * 86400000);
    const p = localParts(date);
    const dayKey = `${p.year}-${p.month}-${p.day}`;
    for (const time of config.schedule.slice(0, config.videosPerDay)) {
      const iso = `${dayKey}T${time}:00`;
      if (used.has(iso)) continue;
      const instant = parseLocalSlot(dayKey, time);
      if (instant.getTime() <= now) continue;
      slots.push({ scheduledAt: iso, publishAt: instant.toISOString() });
      used.add(iso);
      if (slots.length === count) break;
    }
  }
  return slots;
}
async function scan() {
  const queue = readQueue();
  const known = new Set(queue.map(x => x.sha256));
  const entries = fs.readdirSync(watchDir, { withFileTypes: true })
    .filter(e => e.isFile() && config.allowedExtensions.includes(path.extname(e.name).toLowerCase()));
  let added = 0;
  for (const entry of entries) {
    const file = path.join(watchDir, entry.name);
    try {
      const first = fs.statSync(file);
      if (!first.size) continue;
      await sleep(1500); // evita ler arquivos ainda sendo copiados
      const second = fs.statSync(file);
      if (first.size !== second.size || first.mtimeMs !== second.mtimeMs) continue;
      const sha256 = await hashFile(file);
      if (known.has(sha256)) continue;
      const title = path.parse(entry.name).name.replace(/[_-]+/g, " ").trim();
      const slot = nextSlots(queue, 1)[0];
      queue.push({
        id: crypto.randomUUID(), file, originalName: entry.name, sha256,
        titleDraft: title.slice(0, 100), descriptionDraft: title,
        hashtagsDraft: ["#shorts"], scheduledAt: slot?.scheduledAt ?? null,
        publishAt: slot?.publishAt ?? null, timezone: config.timezone,
        status: slot ? "scheduled" : "waiting-for-slot",
        platforms: { youtube: "pending", tiktok: "blocked-not-configured" },
        createdAt: new Date().toISOString()
      });
      known.add(sha256);
      added++;
      console.log(`[NOVO CORTE] ${entry.name} → ${slot?.scheduledAt ?? "aguardando horário"}`);
    } catch (e) { console.error("[ERRO AO LER]", entry.name, e.message); }
  }
  if (added) saveQueue(queue);
}
function youtubeClient() {
  const c = config.platforms?.youtube;
  if (!c?.enabled) return null;
  const credentialsPath = abs(c.credentialsFile || "./secrets/google-oauth-client.json");
  const tokenPath = abs(c.tokenFile || "./secrets/youtube-token.json");
  if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
    console.warn("[YOUTUBE] OAuth não configurado. Rode npm run clip-agent:auth.");
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const data = raw.installed || raw.web;
  if (!data?.client_id || !data?.client_secret) throw new Error("Credenciais OAuth do Google inválidas.");
  const oauth = new google.auth.OAuth2(data.client_id, data.client_secret, data.redirect_uris?.[0] || "http://localhost:43821/oauth2callback");
  oauth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf8")));
  return google.youtube({ version: "v3", auth: oauth });
}
async function publishYouTube(item, youtube) {
  if (!youtube || item.platforms.youtube === "published" || item.platforms.youtube === "scheduled") return;
  const now = Date.now();
  const publishAt = item.publishAt;
  if (!publishAt || new Date(publishAt).getTime() <= now + 60000) {
    console.warn("[YOUTUBE] Horário precisa estar pelo menos 1 minuto no futuro:", item.originalName);
    return;
  }
  console.log("[YOUTUBE] Enviando:", item.originalName);
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: (item.titleDraft || item.originalName).slice(0, 100),
        description: `${item.descriptionDraft || item.titleDraft || ""}\n\n${(item.hashtagsDraft || []).join(" ")}`.slice(0, 5000),
        categoryId: String(config.platforms.youtube.categoryId || "20")
      },
      status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false }
    },
    media: { body: createReadStream(item.file) }
  });
  item.platforms.youtube = "scheduled";
  item.youtubeVideoId = response.data.id;
  item.youtubeScheduledAt = publishAt;
  item.youtubeResultAt = new Date().toISOString();
  console.log("[YOUTUBE] Agendado:", response.data.id, publishAt);
}
async function processDue() {
  if (config.dryRun) return;
  const youtube = youtubeClient();
  if (!youtube) return;
  const queue = readQueue();
  let changed = false;
  for (const item of queue) {
    // Migra a fila criada pela versão inicial do agente.
    if (item.scheduledAt && !item.publishAt) {
      const [day, time] = item.scheduledAt.split("T");
      item.publishAt = parseLocalSlot(day, time.slice(0, 5)).toISOString();
      changed = true;
    }
    if (item.platforms?.youtube === "not-configured") {
      item.platforms.youtube = "pending";
      changed = true;
    }
    if (item.status === "scheduled" && item.platforms?.youtube === "pending" && fs.existsSync(item.file)) {
      try { await publishYouTube(item, youtube); changed = true; }
      catch (e) {
        item.platforms.youtube = "error";
        item.lastError = e.message;
        item.lastAttemptAt = new Date().toISOString();
        changed = true;
        console.error("[YOUTUBE ERRO]", item.originalName, e.message);
      }
      if (changed) saveQueue(queue);
    }
  }
}
console.log("ATLAS Clip Agent iniciado.");
console.log("Pasta monitorada:", watchDir);
console.log("Modo:", config.dryRun ? "SIMULAÇÃO (não publica)" : "PUBLICAÇÃO ATIVA");
console.log("Plataformas habilitadas:", Object.entries(config.platforms || {}).filter(([, v]) => v.enabled).map(([k]) => k).join(", ") || "nenhuma");
console.log("TikTok: integração pública depende de app aprovado e permissões video.publish; não há contorno.");
await scan();
await processDue();
setInterval(() => scan().catch(e => console.error("[SCAN]", e.message)), Math.max(5000, config.scanIntervalMs));
setInterval(() => processDue().catch(e => console.error("[PUBLISH]", e.message)), 60000);
