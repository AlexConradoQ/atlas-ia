import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { askOpenAI } from "./openai.js";

dotenv.config();

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askAI(prompt, memory = "", provider = "auto") {
  try {
    if (provider === "openai") {
      return await askOpenAI(prompt, memory);
    }

    if (provider === "gemini") {
      return await askGemini(prompt, memory);
    }

    // AUTO MODE
    if (
      prompt.toLowerCase().includes("arquitetura") ||
      prompt.toLowerCase().includes("refatorar") ||
      prompt.toLowerCase().includes("debug") ||
      prompt.toLowerCase().includes("corrigir código")
    ) {
      return await askOpenAI(prompt, memory);
    }

    return await askGemini(prompt, memory);

  } catch (error) {
    console.error("Erro AI:", error);
    return `Erro AI: ${error.message}`;
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