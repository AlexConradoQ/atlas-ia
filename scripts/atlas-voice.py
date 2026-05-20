import asyncio
import edge_tts
import sys

VOICE = "pt-BR-FranciscaNeural"

async def gerar_audio(texto, arquivo_saida):
    tts = edge_tts.Communicate(
        text=texto,
        voice=VOICE
    )

    await tts.save(arquivo_saida)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)

    texto = sys.argv[1]
    arquivo_saida = sys.argv[2]

    asyncio.run(gerar_audio(texto, arquivo_saida))