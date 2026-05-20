import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const audioDir = path.join(process.cwd(), "audio");
const voiceScript = path.join(process.cwd(), "scripts", "atlas-voice.py");

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

export async function speak(text) {
  try {
    const outputFile = path.join(audioDir, "atlas-response.mp3");

    await execFileAsync("py", [
      voiceScript,
      text,
      outputFile
    ]);

    return outputFile;
  } catch (error) {
    console.error("Erro na voz ATLAS:", error);
    return null;
  }
}