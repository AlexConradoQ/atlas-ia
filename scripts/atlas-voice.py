import asyncio
import edge_tts
from playsound import playsound
import os
import sys
import uuid

VOICE = "pt-BR-FranciscaNeural"

async def falar(texto):
    nome = f"atlas_{uuid.uuid4().hex}.mp3"

    tts = edge_tts.Communicate(
        text=texto,
        voice=VOICE
    )

    await tts.save(nome)

    playsound(nome)

    if os.path.exists(nome):
        os.remove(nome)

if __name__ == "__main__":
    texto = " ".join(sys.argv[1:])

    if not texto:
        texto = "Olá Alex. Eu sou a ATLAS."

    asyncio.run(falar(texto))