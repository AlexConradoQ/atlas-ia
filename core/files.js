const fs = require("fs");
const path = require("path");

function arquivoExiste(caminho) {
  return fs.existsSync(caminho);
}

function lerArquivo(caminho) {
  if (!arquivoExiste(caminho)) {
    return null;
  }

  return fs.readFileSync(caminho, "utf8");
}

function salvarArquivoSeguro(caminho, conteudo) {
  const backup = `${caminho}.backup`;

  if (arquivoExiste(caminho)) {
    fs.copyFileSync(caminho, backup);
  }

  fs.writeFileSync(caminho, conteudo, "utf8");

  return {
    sucesso: true,
    arquivo: caminho,
    backup: arquivoExiste(backup)
      ? backup
      : null,
  };
}

function listarArquivos(pasta) {
  if (!fs.existsSync(pasta)) {
    return [];
  }

  return fs.readdirSync(pasta).map((item) =>
    path.join(pasta, item)
  );
}

module.exports = {
  arquivoExiste,
  lerArquivo,
  salvarArquivoSeguro,
  listarArquivos,
};