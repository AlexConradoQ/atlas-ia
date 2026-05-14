param(
    [string]$Texto = "ATLAS online."
)

Add-Type -AssemblyName System.Speech

$voz = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voz.Rate = 0
$voz.Volume = 100
$voz.Speak($Texto)