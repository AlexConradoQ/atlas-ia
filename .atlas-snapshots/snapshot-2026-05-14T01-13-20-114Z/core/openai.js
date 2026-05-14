import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function askOpenAI(prompt, memory = "") {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return "❌ OPENAI_API_KEY não encontrada no .env";
    }

    const model = process.env.OPENAI_MODEL || "gpt-5.5";

    const response = await client.responses.create({
      model: model,
      input: `
Você é a ATLAS IA.

Seu papel:
- Assistente local inteligente
- Responder em português do Brasil
- Ajudar com código, projetos e automação
- Quando gerar código, entregar código completo
- Usar memória quando disponível

MEMÓRIA:
${memory}

USUÁRIO:
${prompt}
      `,
    });

    return response.output_text || "Sem resposta da OpenAI.";
  } catch (error) {
    console.error("Erro OpenAI:", error);

    if (error.status === 401) {
      return "❌ Chave OpenAI inválida.";
    }

    if (error.status === 429) {
      return "⚠️ Limite da OpenAI atingido.";
    }

    return `Erro OpenAI: ${error.message}`;
  }
}