import sounddevice as sd
import speech_recognition as sr

recognizer = sr.Recognizer()

SAMPLE_RATE = 16000
DURATION = 6

print("WAKE_MODE_ON")

while True:
    try:
        audio = sd.rec(
            int(DURATION * SAMPLE_RATE),
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="int16"
        )

        sd.wait()

        audio_data = sr.AudioData(
            audio.tobytes(),
            SAMPLE_RATE,
            2
        )

        texto = recognizer.recognize_google(
            audio_data,
            language="pt-BR"
        ).lower().strip()

        if "atlas" in texto:
            comando = texto.replace("atlas", "").strip()

            if comando:
                print(f"COMMAND:{comando}")
            else:
                print("WAKE_WORD")

            break

    except sr.UnknownValueError:
        pass

    except Exception as e:
        print(f"ERRO:{e}")
        break