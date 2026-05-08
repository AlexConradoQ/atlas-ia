async function gerarRespostaLocal(prompt) {
  return `
[ATLAS - Modo Local]

Recebi o comando:

${prompt}

Modo agente-lite ativo sem API.
`;
}

module.exports = {
  gerarRespostaLocal,
};