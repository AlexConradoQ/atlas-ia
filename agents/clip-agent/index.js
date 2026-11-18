import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const configPath = path.join(here, "config.json");
const examplePath = path.join(here, "config.example.json");

function loadConfig() {
  const selected = fs.existsSync(configPath) ? configPath : examplePath;
  return JSON.parse(fs.readFileSync(selected, "utf8"));
}

const config = loadConfig();
const resolve = (value) => path.resolve(root, value);
const watchDir = resolve(config.watchDirectory);
const processedDir = resolve(config.processedDirectory);
const errorDir = resolve(config.errorDirectory);
const queuePath = resolve(config.queueFile);

for (const dir of [watchDir, processedDir, errorDir, path.dirname(queuePath)]) {
  fs.mkdirSync(dir, { recursive: true });
}

function readQueue() {
  if (!fs.existsSync(queuePath)) return [];
  try { return JSON.parse(fs.readFileSync(queuePath, "utf8")); }
  catch { return []; }
}

function saveQueue(queue) {
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
}

function hashFile(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function nextScheduleSlots(queue, count) {
  const slots = [];
  const timezone = config.timezone || "America/Sao_Paulo";
  const now = new Date();
  const used = new Set(queue.filter(item => item.status === "scheduled").map(item => item.scheduledAt));

  for (let dayOffset = 0; slots.length < count && dayOffset < 60; dayOffset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    const yyyy = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric" }).format(date);
    const mm = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "2-digit" }).format(date);
    const dd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, day: "2-digit" }).format(date);
    for (const time of config.schedule.slice(0, config.videosPerDay)) {
      const iso = `${yyyy}-${mm}-${dd}T${time}:00`;
      const [hour, minute] = time.split(":").map(Number);
      const candidate = new Date(date);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate.getTime() <= now.getTime() || used.has(iso)) continue;
      slots.push({ scheduledAt: iso, timezone });
      used.add(iso);
      if (slots.length === count) break;
    }
  }
  return slots;
}

function scan() {
  const queue = readQueue();
  const known = new Set(queue.map(item => item.sha256));
  const files = fs.readdirSync(watchDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && config.allowedExtensions.includes(path.extname(entry.name).toLowerCase()))
    .map(entry => path.join(watchDir, entry.name));

  const fresh = [];
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.size === 0) continue;
      const sha256 = hashFile(file);
      if (known.has(sha256)) continue;
      fresh.push({ file, sha256, title: path.parse(file).name.replace(/[_-]+/g, " ").trim() });
      known.add(sha256);
    } catch (error) {
      console.error("[ATLAS Clip Agent] Não foi possível ler", file, error.message);
    }
  }

  const slots = nextScheduleSlots(queue, fresh.length);
  for (let i = 0; i < fresh.length; i++) {
    const item = {
      id: crypto.randomUUID(),
      file: fresh[i].file,
      originalName: path.basename(fresh[i].file),
      sha256: fresh[i].sha256,
      titleDraft: fresh[i].title,
      descriptionDraft: "",
      hashtagsDraft: [],
      scheduledAt: slots[i]?.scheduledAt ?? null,
      timezone: config.timezone,
      status: slots[i] ? "scheduled" : "waiting-for-slot",
      platforms: { youtube: "not-configured", tiktok: "not-configured" },
      createdAt: new Date().toISOString()
    };
    queue.push(item);
    console.log(`[NOVO CORTE] ${item.originalName} → ${item.scheduledAt ?? "aguardando horário"}`);
  }
  if (fresh.length) saveQueue(queue);
}

console.log("ATLAS Clip Agent iniciado.");
console.log("Pasta monitorada:", watchDir);
console.log("Modo:", config.dryRun ? "SIMULAÇÃO (não publica)" : "INTEGRAÇÕES");
console.log("Plataformas habilitadas:", Object.entries(config.platforms).filter(([, v]) => v.enabled).map(([k]) => k).join(", ") || "nenhuma");
console.log("Este primeiro módulo monitora e organiza a fila; publicação só será ativada após configurar e validar OAuth/API de cada plataforma.");

scan();
setInterval(scan, Math.max(3000, config.scanIntervalMs));
