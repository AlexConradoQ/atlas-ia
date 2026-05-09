export const comandos = {

    "/help": true,
    "/status": true,
    "/tree": true,
    "/agente-lite": true,
    "/analisar": true,
    "/organizar": true,
    "/agente": true,
    "/memoria": true,
    "/projetos": true,
    "/arquivos": true,

    "/ler": true,
    "/analisar-arquivo": true,
    "/editar-arquivo": true
};

export function comandoExiste(comando) {

    return Object.keys(comandos)
        .some(cmd =>
            comando === cmd ||
            comando.startsWith(cmd + " ")
        );
}

export function listarComandos() {

    return Object.keys(comandos);
}