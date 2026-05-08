const path = require("path");
const { lerArquivo, salvarArquivoSeguro } = require("./files");

const CAMINHO_MEMORIA = path.join(
  "01 - Memória",
  "memoria-atlas.md"
);

function carregarMemoria() {
  const memoria = lerArquivo(CAMINHO_MEMORIA);

  if (!memoria) {
    return "Nenhuma memória registrada ainda.";
  }

  return memoria;
}

function salvarMemoria(conteudo) {
  return salvarArquivoSeguro(
    CAMINHO_MEMORIA,
    conteudo
  );
}

function adicionarMemoria(novaInformacao) {
  const memoriaAtual = carregarMemoria();

  const novaMemoria = `
${memoriaAtual}

## Nova memória

${novaInformacao}
`;

  return salvarMemoria(novaMemoria);
}

module.exports = {
  carregarMemoria,
  salvarMemoria,
  adicionarMemoria,
};