import fs from "fs";
import path from "path";

export function salvarLog(nomeArquivo, conteudoTexto) {

    try {

        const caminho = path.join(
            process.cwd(),
            "05 - Logs",
            nomeArquivo
        );

        const data = new Date().toLocaleString("pt-BR");

        const conteudo = `

# ${data}

${conteudoTexto}

==================================
`;

        fs.writeFileSync(
            caminho,
            conteudo,
            "utf8"
        );

        return true;

    } catch {

        return false;
    }
}