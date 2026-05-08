const path = require("path");

const {
  carregarMemoria,
  adicionarMemoria,
} = require("./memory");

const {
  lerArquivo,
} = require("./files");

const {
  salvarLog,
} = require("./logs");

const {
  gerarRespostaLocal,
} = require("./ai");

async function executarComando(comando) {

  if (comando === "/memoria") {
    return carregarMemoria();
  }

  if (comando.startsWith("/lembrar ")) {

    const texto = comando
      .replace("/lembrar ", "")
      .trim();

    adicionarMemoria(texto);

    return "Memória adicionada.";
  }

  if (comando.startsWith("/ler ")) {

    const caminho = comando
      .replace("/ler ", "")
      .trim();

    const conteudo = lerArquivo(caminho);

    return conteudo || "Arquivo não encontrado.";
  }

  if (comando.startsWith("/agente-lite ")) {

    const tarefa = comando
      .replace("/agente-lite ", "")
      .trim();

    const resposta =
      await gerarRespostaLocal(tarefa);

    const caminhoLog = path.join(
      "05 - Logs",
      "agente-lite-atlas.md"
    );

    salvarLog(
      caminhoLog,
`
# Relatório Agente Lite

## Tarefa

${tarefa}

## Resultado

${resposta}
`
    );

    return `
Relatório salvo em:

${caminhoLog}
`;
  }

  return gerarRespostaLocal(comando);
}

module.exports = {
  executarComando,
};