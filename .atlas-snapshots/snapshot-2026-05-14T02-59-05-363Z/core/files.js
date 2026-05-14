import fs from "fs";
import path from "path";

export const ignorarPastas = [
    "node_modules",
    ".git",
    ".obsidian"
];

export function listarArquivosRecursivo(caminhoPasta, prefixo = "") {
    let lista = [];

    if (!fs.existsSync(caminhoPasta)) return lista;

    const itens = fs.readdirSync(caminhoPasta, { withFileTypes: true });

    for (const item of itens) {
        if (ignorarPastas.includes(item.name)) continue;

        const caminhoCompleto = path.join(caminhoPasta, item.name);
        const caminhoRelativo = path.join(prefixo, item.name);

        if (item.isDirectory()) {
            lista.push(`${caminhoRelativo}/`);
            lista = lista.concat(
                listarArquivosRecursivo(caminhoCompleto, caminhoRelativo)
            );
        } else {
            lista.push(caminhoRelativo);
        }
    }

    return lista;
}

export function lerArquivoProjeto(caminhoRelativo) {
    try {
        const caminhoSeguro = path.normalize(caminhoRelativo);

        if (caminhoSeguro.includes("..")) return "Caminho inválido.";

        const caminhoArquivo = path.join(process.cwd(), caminhoSeguro);

        if (!fs.existsSync(caminhoArquivo)) return "Arquivo não encontrado.";

        const stats = fs.statSync(caminhoArquivo);

        if (stats.isDirectory()) return "Esse caminho é uma pasta.";
        if (stats.size > 50000) return "Arquivo muito grande para leitura direta.";

        return fs.readFileSync(caminhoArquivo, "utf8");
    } catch {
        return "Erro ao ler arquivo.";
    }
}

export function listarProjetos() {
    try {
        const pastaProjetos = path.join(process.cwd(), "02 - Projetos");

        return fs
            .readdirSync(pastaProjetos)
            .filter(arquivo => arquivo.endsWith(".md"));
    } catch {
        return [];
    }
}