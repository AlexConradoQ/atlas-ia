import sounddevice as sd
from scipy.io.wavfile import write
import speech_recognition as sr
import tempfile
import os
import sys

DURACAO = 8
TAXA_AUDIO = 16000

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

print("OUVINDO")

try:
    audio = sd.rec(
        int(DURACAO * TAXA_AUDIO),
        samplerate=TAXA_AUDIO,
        channels=1,
        dtype="int16"
    )

    sd.wait()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        caminho_audio = temp_audio.name

    write(caminho_audio, TAXA_AUDIO, audio)

    recognizer = sr.Recognizer()

    with sr.AudioFile(caminho_audio) as source:
        dados_audio = recognizer.record(source)

    texto = recognizer.recognize_google(
        dados_audio,
        language="pt-BR"
    )

    print(f"TEXT:{texto}")

    if os.path.exists(caminho_audio):
        os.remove(caminho_audio)

except sr.UnknownValueError:
    print("NAO_ENTENDI")

except Exception as e:
    print(f"ERRO:{e}")