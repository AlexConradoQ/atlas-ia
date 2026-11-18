# ATLAS Clip Agent

Agente local para organizar cortes e agendar publicação no YouTube Shorts pela API oficial.

## Instalar/atualizar
Na raiz do projeto:
```powershell
git pull origin feature/atlas-clip-agent
npm install
```

## Configurar
1. Copie `agents/clip-agent/config.example.json` para `agents/clip-agent/config.json` (se já existe, mantenha sua cópia e confira watchDirectory).
2. O caminho atual dos cortes fica no seu config local. Não precisa mover os vídeos.
3. O padrão é seguro: `dryRun: true`, nenhuma publicação é feita.

## YouTube (OAuth oficial)
1. No Google Cloud Console, crie/selecione um projeto e ative **YouTube Data API v3**.
2. Configure a tela de consentimento OAuth e crie credencial **OAuth client ID > Desktop app**.
3. Baixe o JSON e salve localmente como `secrets/google-oauth-client.json` na raiz do ATLAS. Nunca envie esse arquivo ao GitHub.
4. Rode `npm run clip-agent:auth` e conclua o login no navegador. O token será salvo em `secrets/youtube-token.json`.
5. No `agents/clip-agent/config.json`, altere `platforms.youtube.enabled` para `true`. Teste primeiro com `dryRun: true`; para ativar agendamento real, altere `dryRun` para `false`.

O agente envia os vídeos como privados com `publishAt` futuro, para o YouTube publicar no horário agendado. O vídeo precisa cumprir os requisitos de agendamento do YouTube. A API tem cotas e pode exigir verificação do app.

## TikTok
A integração pública exige app no TikTok for Developers, aprovação do escopo `video.publish` e auditoria. Clientes não auditados ficam limitados a publicações privadas. Por isso o agente não tenta simular cliques nem contornar restrições; TikTok permanece desativado até credenciais e aprovação.

## Observações
- O agente verifica estabilidade do arquivo antes de ler e usa SHA-256 para evitar duplicados.
- A fila fica em `data/clip-agent/queue.json`.
- Não apague a fila se quiser preservar o histórico anti-duplicação.
- Títulos/descrições iniciais são derivados do nome do arquivo; geração de metadados por IA ainda não está ativada.
- Mantenha o computador ligado e o processo aberto para que o agente envie os vídeos à API.
