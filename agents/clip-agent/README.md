# ATLAS Clip Agent

Primeira etapa do agente local de cortes do ATLAS.

## O que esta etapa faz
- Monitora uma pasta local do Windows por vídeos novos.
- Evita duplicados usando SHA-256.
- Cria uma fila persistente em JSON.
- Distribui os vídeos pelos 10 horários configurados (fuso America/Sao_Paulo).
- Não publica nada ainda: começa em modo de simulação por segurança.

## Instalação
1. Copie `config.example.json` para `config.json`.
2. Ajuste `watchDirectory` para a pasta real dos seus cortes.
3. Na raiz do ATLAS, execute `npm run clip-agent`.

## Pastas
Os diretórios de entrada, processados, erros e fila são criados automaticamente conforme a configuração.

## Próximas etapas necessárias
1. Integrar geração de metadados com o provedor de IA escolhido.
2. Configurar OAuth e upload oficial do YouTube.
3. Criar app no TikTok for Developers, solicitar `video.publish` e passar pela auditoria para publicações públicas.
4. Implementar envio, consulta de status, retentativas e movimentação do arquivo após confirmação.

## Importante
O TikTok restringe publicações de clientes não auditados a visualização privada. O projeto não tenta contornar essa regra. Não coloque tokens ou chaves neste repositório; use variáveis de ambiente em um arquivo `.env` local.
