import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { google } from "googleapis";

const root = process.cwd();
const secrets = path.join(root, "secrets");
const credentialsPath = path.join(secrets, "google-oauth-client.json");
const tokenPath = path.join(secrets, "youtube-token.json");
if (!fs.existsSync(credentialsPath)) {
  console.error("Arquivo não encontrado:", credentialsPath);
  console.error("Salve o OAuth Client JSON (Desktop app) nesse caminho.");
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
const c = raw.installed || raw.web;
const redirect = "http://localhost:43821/oauth2callback";
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret, redirect);
const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/youtube.upload"] });
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) return;
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) { res.end("Autorização não concluída. Tente novamente."); server.close(); return; }
  try {
    const { tokens } = await oauth.getToken(code);
    fs.mkdirSync(secrets, { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    res.end("ATLAS autorizado no YouTube. Pode fechar esta janela.");
    console.log("Token salvo em", tokenPath);
  } catch (e) { res.end("Falha ao obter token: " + e.message); console.error(e); }
  server.close();
});
server.listen(43821, () => {
  console.log("Abra este endereço no navegador e autorize o ATLAS:");
  console.log(url);
});
