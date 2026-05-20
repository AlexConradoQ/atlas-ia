import fs from "fs";
import path from "path";

const caminhoPerfil = path.join(
    process.cwd(),
    "01 - Memória",
    "perfil-usuario.md"
);

function garantirPerfil() {
    const pasta = path.dirname(caminhoPerfil);

    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
    }

    if (!fs.existsSync(caminhoPerfil)) {
        fs.writeFileSync(
            caminhoPerfil,
            "# Perfil do Usuário\n\n",
            "utf8"
        );
    }
}

function salvarNome(nome) {
    garantirPerfil();

    fs.writeFileSync(
        caminhoPerfil,
        `# Perfil do Usuário

Nome: ${nome}
`,
        "utf8"
    );
}

function carregarNome() {
    try {
        garantirPerfil();

        const conteudo = fs.readFileSync(
            caminhoPerfil,
            "utf8"
        );

        const match = conteudo.match(/Nome:\s*(.+)/i);

        if (match) return match[1].trim();

        return null;
    } catch {
        return null;
    }
}

export const memoriaLocal = {
    nomeUsuario: carregarNome(),
    nomeIA: "ATLAS",
    projeto: "ATLAS IA"
};

function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\baí\b/g, "ai")
        .replace(/\bahi\b/g, "ai")
        .replace(/\s+/g, " ")
        .trim();
}

function limparArquivoFalado(texto) {
    return normalizar(texto)
        .replace(/\bbarra\b/g, "/")
        .replace(/\bponto\b/g, ".")
        .replace(/\btraco\b/g, "-")
        .replace(/\bhifen\b/g, "-")
        .trim();
}

function contemAlgum(texto, lista) {
    return lista.some(item => texto.includes(item));
}

export function processarIntentLocal(textoOriginal) {
    if (!textoOriginal) return null;

    const texto = normalizar(textoOriginal);

    if (texto.startsWith("abrir ")) {
        const arquivo = limparArquivoFalado(
            texto.replace(/^abrir\s+/, "")
        );

        return {
            resposta: `Abrindo ${arquivo}.`,
            acao: "open_file",
            arquivo
        };
    }

    if (
        texto.startsWith("ler ") ||
        texto.startsWith("le ")
    ) {
        const arquivo = limparArquivoFalado(
            texto
                .replace(/^ler\s+/, "")
                .replace(/^le\s+/, "")
        );

        return {
            resposta: `Lendo ${arquivo}.`,
            acao: "read_file",
            arquivo
        };
    }

    if (
        contemAlgum(texto, [
            "qual seu nome",
            "quem e voce",
            "como voce se chama"
        ])
    ) {
        return {
            resposta: `Eu sou a ${memoriaLocal.nomeIA}.`,
            acao: null
        };
    }

    if (texto.includes("status")) {
        return {
            resposta: "Sistema ATLAS operacional.",
            acao: null
        };
    }

    if (
        contemAlgum(texto, [
            "qual o projeto",
            "sobre o que estamos trabalhando"
        ])
    ) {
        return {
            resposta: `Estamos trabalhando no ${memoriaLocal.projeto}.`,
            acao: null
        };
    }

    if (
        contemAlgum(texto, [
            "qual meu nome",
            "qual e meu nome",
            "qual e o meu nome",
            "como eu me chamo",
            "quem sou eu"
        ])
    ) {
        if (memoriaLocal.nomeUsuario) {
            return {
                resposta: `Seu nome é ${memoriaLocal.nomeUsuario}.`,
                acao: null
            };
        }

        return {
            resposta: "Ainda não sei seu nome.",
            acao: null
        };
    }

    const matchNome = texto.match(
        /meu nome (?:e)?\s+(.+)/
    );

    if (matchNome) {
        const nome = matchNome[1]
            .trim()
            .split(" ")
            .map(
                p =>
                    p.charAt(0).toUpperCase() +
                    p.slice(1)
            )
            .join(" ");

        memoriaLocal.nomeUsuario = nome;
        salvarNome(nome);

        return {
            resposta: `Entendido. Vou te chamar de ${nome}.`,
            acao: null
        };
    }

    if (
        contemAlgum(texto, [
            "dormir",
            "parar"
        ])
    ) {
        return {
            resposta: "Entrando em espera.",
            acao: "sleep"
        };
    }

    if (
        contemAlgum(texto, [
            "limpar memoria",
            "apagar memoria"
        ])
    ) {
        memoriaLocal.nomeUsuario = null;
        salvarNome("");

        return {
            resposta: "Memória apagada.",
            acao: "clear"
        };
    }

    return null;
}