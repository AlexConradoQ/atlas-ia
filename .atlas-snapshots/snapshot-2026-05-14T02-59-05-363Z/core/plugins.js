import { devPlugin } from "../plugins/dev/dev-plugin.js";
import { obsidianPlugin } from "../plugins/obsidian/obsidian-plugin.js";
import { systemPlugin } from "../plugins/system/system-plugin.js";

export const plugins = [
    devPlugin,
    obsidianPlugin,
    systemPlugin
];

export function listarPlugins() {
    return plugins.map(plugin => ({
        nome: plugin.nome,
        descricao: plugin.descricao,
        comandos: plugin.comandos
    }));
}

export function gerarResumoPlugins() {
    return plugins.map(plugin => {
        return `
PLUGIN: ${plugin.nome}
DESCRIÇÃO: ${plugin.descricao}
COMANDOS:
${plugin.comandos.map(cmd => `- ${cmd}`).join("\n")}
`;
    }).join("\n");
}