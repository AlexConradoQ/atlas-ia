import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

function esperar(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

export async function gerarComRetry(
    prompt,
    tentativas = 3
) {

    for (
        let tentativa = 1;
        tentativa <= tentativas;
        tentativa++
    ) {

        try {

            const result =
                await model.generateContent(prompt);

            const response =
                await result.response;

            return response.text();

        } catch (erro) {

            const status =
                erro?.status ||
                erro?.statusCode;

            console.log(`
==================================
ERRO NA GEMINI
Tentativa: ${tentativa}/${tentativas}
==================================
`);

            if (status === 429) {

                console.log(
                    "Limite da API atingido. Aguardando...\n"
                );

                await esperar(
                    10000 * tentativa
                );

                continue;
            }

            if (tentativa === tentativas) {

                return `
Não consegui acessar a IA agora.
A API atingiu limite ou ocorreu um erro.
Tente novamente em alguns segundos.
`;
            }

            await esperar(3000);
        }
    }

    return `
Não foi possível gerar resposta agora.
`;
}