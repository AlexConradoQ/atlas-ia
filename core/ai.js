import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { askOpenAI } from "./openai.js";
import { speak } from "./voice.js";

dotenv.config();

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askAI(prompt, memory = "", provider = "auto", voiceEnabled = false) {
  try {
    let answer = "";

    if (provider === "openai") {
      answer = await askOpenAI(prompt, memory);
    } else if (provider === "gemini") {
      answer = await askGemini(prompt, memory);
    } else {
      const lowerPrompt = prompt.toLowerCase();

      if (
        lowerPrompt.includes("arquitetura") ||
        lowerPrompt.includes("refatorar") ||
        lowerPrompt.includes("debug") ||
        lowerPrompt.includes("corrigir código")
      ) {
        answer = await askOpenAI(prompt, memory);
      } else {
        answer = await askGemini(prompt, memory);
      }
    }

    let audioPath = null;

    if (voiceEnabled && answer && !answer.startsWith("Erro")) {
      audioPath = await speak(answer);
    }

    return {
      text: answer,
      audio: audioPath,
    };
  } catch (error) {
    console.error("Erro AI:", error);

    return {
      text: `Erro AI: ${error.message}`,
      audio: null,
    };
  }
}

async function askGemini(prompt, memory = "") {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return "❌ GEMINI_API_KEY não encontrada.";
    }

    const model = gemini.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(`
Você é a ATLAS IA.

Seu papel:
- Assistente local inteligente
- Responder em português brasileiro
- Ajudar com código e projetos
- Sempre entregar código completo quando solicitado
- Ter uma personalidade feminina, direta, inteligente e levemente futurista
- Evitar respostas longas demais quando o usuário pedir algo simples

MEMÓRIA:
${memory}

USUÁRIO:
${prompt}
    `);

    return result.response.text();
  } catch (error) {
    console.error("Erro Gemini:", error);
    return `Erro Gemini: ${error.message}`;
  }
}