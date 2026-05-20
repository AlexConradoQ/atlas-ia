const historicoSessao = [];

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