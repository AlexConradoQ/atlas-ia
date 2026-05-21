import fs from "fs";
import path from "path";

const caminhoPerfil = path.join(process.cwd(), "01 - Memória", "perfil-usuario.md");

function garantirPerfil() {
    const pasta = path.dirname(caminhoPerfil);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

    if (!fs.existsSync(caminhoPerfil)) {
        fs.writeFileSync(caminhoPerfil, "# Perfil do Usuário\n\n", "utf8");
    }
}

function salvarNome(nome) {
    garantirPerfil();
    fs.writeFileSync(caminhoPerfil, `# Perfil do Usuário\n\nNome: ${nome}\n`, "utf8");
}

function carregarNome() {
    try {
        garantirPerfil();
        const conteudo = fs.readFileSync(caminhoPerfil, "utf8");
        const match = conteudo.match(/Nome:\s*(.+)/i);
        return match ? match[1].trim() : null;
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
        .replace(/\s+/g, " ")
        .trim();
}

function limparAlvoFalado(texto) {
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

    if (texto.startsWith("abrir pasta ")) {
        const alvo = limparAlvoFalado(texto.replace(/^abrir pasta\s+/, ""));
        return { resposta: `Abrindo pasta ${alvo}.`, acao: "open_folder", alvo };
    }

    if (texto.startsWith("abrir ")) {
        const alvo = limparAlvoFalado(texto.replace(/^abrir\s+/, ""));
        return { resposta: `Abrindo ${alvo}.`, acao: "open_file", alvo };
    }

    if (texto.startsWith("editar ")) {
        const alvo = limparAlvoFalado(texto.replace(/^editar\s+/, ""));
        return { resposta: `Abrindo ${alvo} para edição.`, acao: "open_file", alvo };
    }

    if (texto.startsWith("ler ") || texto.startsWith("le ")) {
        const alvo = limparAlvoFalado(
            texto.replace(/^ler\s+/, "").replace(/^le\s+/, "")
        );
        return { resposta: `Lendo ${alvo}.`, acao: "read_file", alvo };
    }

    if (texto.startsWith("buscar ") || texto.startsWith("procurar ")) {
        const termo = limparAlvoFalado(
            texto.replace(/^buscar\s+/, "").replace(/^procurar\s+/, "")
        );
        return { resposta: `Buscando ${termo}.`, acao: "search_project", termo };
    }

    if (
        contemAlgum(texto, [
            "listar projeto",
            "listar projetos",
            "mostrar projeto",
            "mostrar projetos",
            "estrutura do projeto",
            "ver projeto",
            "ver projetos",
            "visitar projeto",
            "visitar projetos"
        ])
    ) {
        return { resposta: "Listando estrutura do projeto.", acao: "list_project" };
    }

    if (
        contemAlgum(texto, [
            "qual seu nome",
            "qual e seu nome",
            "qual e o seu nome",
            "quem e voce",
            "como voce se chama"
        ])
    ) {
        return { resposta: `Eu sou a ${memoriaLocal.nomeIA}.`, acao: null };
    }

    if (texto.includes("status")) {
        return { resposta: "Sistema ATLAS operacional.", acao: null };
    }

    if (
        contemAlgum(texto, [
            "qual o projeto",
            "que projeto e esse",
            "sobre o que estamos trabalhando"
        ])
    ) {
        return { resposta: `Estamos trabalhando no ${memoriaLocal.projeto}.`, acao: null };
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
        return {
            resposta: memoriaLocal.nomeUsuario
                ? `Seu nome é ${memoriaLocal.nomeUsuario}.`
                : "Ainda não sei seu nome.",
            acao: null
        };
    }

    const matchNome = texto.match(/meu nome (?:e)?\s+(.+)/);

    if (matchNome) {
        const nome = matchNome[1]
            .trim()
            .split(" ")
            .map(p => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" ");

        memoriaLocal.nomeUsuario = nome;
        salvarNome(nome);

        return { resposta: `Entendido. Vou te chamar de ${nome}.`, acao: null };
    }

    if (contemAlgum(texto, ["dormir", "parar", "encerrar"])) {
        return { resposta: "Entrando em espera.", acao: "sleep" };
    }

    if (contemAlgum(texto, ["limpar memoria", "apagar memoria"])) {
        memoriaLocal.nomeUsuario = null;
        salvarNome("");
        return { resposta: "Memória apagada.", acao: "clear" };
    }

    return null;
}