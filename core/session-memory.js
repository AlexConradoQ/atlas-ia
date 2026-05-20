import fs from "fs";
import path from "path";

const historicoSessao = [];

const caminhoMemoriaUsuario = path.join(
    process.cwd(),
    "01 - Memória",
    "usuario.md"
);

function garantirArquivo() {
    const pasta = path.dirname(caminhoMemoriaUsuario);

    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
    }

    if (!fs.existsSync(caminhoMemoriaUsuario)) {
        fs.writeFileSync(
            caminhoMemoriaUsuario,
            "# Memória do Usuário\n\n",
            "utf8"
        );
    }
}

export function adicionarNaSessao(autor, texto) {
    historicoSessao.push({
        autor,
        texto,
        data: new Date().toISOString()
    });

    if (historicoSessao.length > 20) {
        historicoSessao.shift();
    }
}

export function obterMemoriaSessao() {
    if (historicoSessao.length === 0) {
        return "";
    }

    return historicoSessao
        .map(item => `${item.autor}: ${item.texto}`)
        .join("\n");
}

export function limparMemoriaSessao() {
    historicoSessao.length = 0;
}

export function salvarMemoriaPermanente(chave, valor) {
    garantirArquivo();

    let conteudo = fs.readFileSync(
        caminhoMemoriaUsuario,
        "utf8"
    );

    const regex = new RegExp(`^${chave}:.*$`, "mi");

    if (regex.test(conteudo)) {
        conteudo = conteudo.replace(
            regex,
            `${chave}: ${valor}`
        );
    } else {
        conteudo += `\n${chave}: ${valor}`;
    }

    fs.writeFileSync(
        caminhoMemoriaUsuario,
        conteudo,
        "utf8"
    );
}

export function lerMemoriaPermanente() {
    garantirArquivo();

    return fs.readFileSync(
        caminhoMemoriaUsuario,
        "utf8"
    );
}