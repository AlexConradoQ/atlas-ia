import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function iniciarATLAS() {
    const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

    const result = await model.generateContent(
        "Se apresente como ATLAS, a IA pessoal de Alex."
    );

    const response = await result.response;

    console.log("\nATLAS:\n");
    console.log(response.text());
}

iniciarATLAS();