```javascript
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import readline from "readline";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// region: Configurações da ATLAS

/**
 * @typedef {object} AtlasConfig
 * @property {string} geminiApiKey - Chave da API do Google Gemini.
 * @property {string} modelName - Nome do modelo Gemini a ser utilizado.
 * @property {string[]} memoryDirectories - Pastas que compõem a "memória" da ATLAS.
 * @property {string[]} ignoreDirectories - Pastas a serem ignoradas na listagem de arquivos e leitura recursiva.
 * @property {number} maxRetries - Número máximo de tentativas para chamadas à API Gemini.
 * @property {number} rateLimitWaitMultiplierMs - Multiplicador de tempo de espera (em ms) para erros de limite de taxa (429).
 * @property {number} defaultRetryWaitMs - Tempo de espera padrão (em ms) entre tentativas com erro genérico.
 * @property {string} logDirectory - Diretório para salvar logs e conversas.
 * @property {string} conversationLogFile - Nome do arquivo de log da conversa.
 * @property {string} analysisLogFile - Nome do arquivo de log de análise.
 * @property {string} roadmapLogFile - Nome do arquivo de log de roadmap.
 * @property {number} maxFileReadSizeKb - Tamanho máximo de arquivo (em KB) que pode ser lido pela ATLAS.
 * @property {number} maxContentLogLength - Comprimento máximo do conteúdo de arquivo para exibir no console antes de truncar.
 * @property {number} maxFileListLogLength - Comprimento máximo da lista de arquivos para exibir no console antes de truncar.
 * @property {number} maxMemoryLogLength - Comprimento máximo da memória para exibir no console antes de truncar.
 * @property {string} projectsDirectoryName - Nome da pasta onde os projetos Markdown estão localizados.
 */
const config = {
    geminiApiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.5-flash", // Modelo recomendado para maior velocidade e bom desempenho
    memoryDirectories: [
        "00 - Sistema",
        "01 - Memória",
        "02 - Projetos",
        "03 - Conhecimento",
        "04 - Prompts",
        "05 - Logs"
    ],
    ignoreDirectories: [
        "node_modules",
        ".git",
        ".obsidian",
        // Adicione outras pastas que devem ser ignoradas globalmente
    ],
    maxRetries: 3,
    rateLimitWaitMultiplierMs: 10000, // 10 segundos * tentativa (para 429)
    defaultRetryWaitMs: 3000, // 3 segundos (para outros erros)
    logDirectory: "05 - Logs",
    conversationLogFile: "conversa.md",
    analysisLogFile: "analise-atlas.md",
    roadmapLogFile: "roadmap-atlas.md",
    maxFileReadSizeKb: 50, // Limite de 50 KB para leitura de arquivos, para evitar sobrecarga da IA
    maxContentLogLength: 8000, // Limite de 8000 caracteres para exibição de conteúdo no console
    maxFileListLogLength: 200, // Limite de 200 itens para exibição de lista de arquivos no console
    maxMemoryLogLength: 3000, // Limite de 3000 caracteres para exibição de memória no console
    projectsDirectoryName: "02 - Projetos", // Nome explícito da pasta de projetos
};

// endregion

// region: Inicialização do Serviço Gemini

// Verifica se a chave da API está configurada
if (!config.geminiApiKey) {
    console.error("ERRO FATAL: A variável de ambiente GEMINI_API_KEY não está configurada.");
    console.error("Por favor, adicione GEMINI_API_KEY=<sua_chave_aqui> ao seu arquivo .env na raiz do projeto.");
    process.exit(1); // Encerra a aplicação se a chave da API não estiver presente
}

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const geminiModel = genAI.getGenerativeModel({
    model: config.modelName
});

// endregion

// region: Funções Utilitárias Gerais

/**
 * Espera por um determinado número de milissegundos.
 * @param {number} ms - O número de milissegundos para esperar.
 * @returns {Promise<void>} Uma promessa que resolve após o tempo especificado.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retorna um timestamp formatado para uso em logs e cabeçalhos.
 * @returns {string} Timestamp formatado (e.g., "DD/MM/YYYY HH:MM:SS").
 */
function getFormattedTimestamp() {
    return new Date().toLocaleString("pt-BR", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Centraliza e formata o log de erros da ATLAS no console.
 * @param {string} message - A mensagem de erro principal.
 * @param {Error|any} [error] - O objeto de erro associado (opcional), para detalhes adicionais.
 */
function logError(message, error) {
    console.error(`\n--- ERRO ATLAS [${getFormattedTimestamp()}] ---\n${message}`);
    if (error) {
        // Exibe o stack trace para erros mais detalhados, mas com cuidado para não poluir demais
        console.error(error instanceof Error ? error.stack : error);
    }
    console.error("----------------------------------\n");
}

/**
 * Trunca uma string se ela exceder um comprimento máximo, adicionando reticências.
 * @param {string} text - O texto a ser truncado.
 * @param {number} maxLength - O comprimento máximo permitido.
 * @param {string} [ellipsis="..."] - A string a ser adicionada no final se truncado.
 * @returns {string} O texto original ou truncado.
 */
function truncateText(text, maxLength, ellipsis = "\n... (conteúdo truncado para exibição)") {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + ellipsis;
    }
    return text;
}

// endregion

// region: Interação com Gemini

/**
 * Tenta gerar conteúdo com a IA Gemini, incluindo lógica de retry para falhas temporárias
 * e tratamento específico para erros de limite de taxa (status 429).
 * @param {string} prompt - O prompt a ser enviado para o modelo de IA.
 * @param {number} [attempts=config.maxRetries] - O número máximo de tentativas antes de falhar.
 * @returns {Promise<string>} O texto da resposta da IA ou uma mensagem de erro em caso de falha persistente.
 */
async function generateContentWithRetry(prompt, attempts = config.maxRetries) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            const status = error?.status || error?.statusCode;
            logError(`Falha na chamada à API Gemini. Tentativa ${attempt}/${attempts}.`, error);

            if (status === 429) { // HTTP 429: Too Many Requests
                const waitTime = config.rateLimitWaitMultiplierMs * attempt;
                console.log(`Limite da API atingido. Aguardando ${waitTime / 1000} segundos antes de tentar novamente...`);
                await sleep(waitTime); // Espera exponencial para limite de taxa
                continue; // Tenta novamente
            }

            if (attempt === attempts) {
                // Após todas as tentativas, retorna uma mensagem de erro final
                return `Não consegui acessar a IA agora. A API atingiu o limite ou ocorreu um erro persistente após ${attempts} tentativas. Por favor, tente novamente mais tarde.`;
            }

            console.log(`Erro genérico. Aguardando ${config.defaultRetryWaitMs / 1000} segundos antes de tentar novamente...`);
            await sleep(config.defaultRetryWaitMs); // Espera padrão para outros erros
        }
    }
    return `Ocorreu um erro inesperado e a IA não pôde ser contatada. Por favor, verifique os logs.`; // Fallback final
}

/**
 * Solicita à IA para analisar profundamente um arquivo, gerando insights sobre ele.
 * @param {string} relativeFilePath - O caminho relativo do arquivo a ser analisado.
 * @returns {Promise<string>} A análise detalhada gerada pela IA.
 */
async function analyzeFile(relativeFilePath) {
    const fileContent = readProjectFile(relativeFilePath);

    // Se a leitura do arquivo resultou em um erro, retorna a mensagem de erro diretamente
    if (fileContent.startsWith("ERRO:") || fileContent.startsWith("Caminho inválido.")) {
        return `ATLAS: ${fileContent}`;
    }

    const prompt = `
Você é a ATLAS.

Analise profundamente este arquivo.

Explique:
- objetivo
- arquitetura
- lógica
- melhorias
- gargalos
- automações possíveis
- qualidade do código

ARQUIVO:
${relativeFilePath}

CONTEÚDO:
${fileContent}
`;

    return await generateContentWithRetry(prompt);
}

/**
 * Solicita à IA para melhorar e refatorar o código de um arquivo.
 * @param {string} relativeFilePath - O caminho relativo do arquivo a ser editado.
 * @returns {Promise<string>} O código final melhorado pela IA.
 */
async function editFileWithAI(relativeFilePath) {
    const fileContent = readProjectFile(relativeFilePath);

    // Se a leitura do arquivo resultou em um erro, retorna a mensagem de erro diretamente
    if (fileContent.startsWith("ERRO:") || fileContent.startsWith("Caminho inválido.")) {
        return `ATLAS: ${fileContent}`;
    }

    const prompt = `
Você é a ATLAS.

Melhore este arquivo.

Objetivos:
- limpar código
- melhorar arquitetura
- adicionar comentários úteis
- melhorar organização
- evitar bugs
- manter compatibilidade

Retorne APENAS o código final. Não adicione nenhum texto introdutório ou explicativo.

ARQUIVO:
${relativeFilePath}

CÓDIGO:
${fileContent}
`;

    return await generateContentWithRetry(prompt);
}

// endregion

// region: Operações de Sistema de Arquivos

/**
 * Lê recursivamente arquivos Markdown dentro de um diretório especificado
 * e concatena seus conteúdos, formatando cada um para identificação.
 * @param {string} currentPath - O caminho do diretório atual a ser explorado.
 * @param {string} baseDirectoryName - O nome da pasta raiz da memória (para paths relativos).
 * @returns {string} O conteúdo concatenado de todos os arquivos Markdown encontrados.
 */
function readMarkdownFilesRecursively(currentPath, baseDirectoryName) {
    let fullContent = "";

    if (!fs.existsSync(currentPath)) {
        logError(`Diretório não encontrado: ${currentPath}. Ignorando na leitura da memória.`);
        return fullContent;
    }

    let items;
    try {
        items = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
        logError(`Erro ao listar itens no diretório ${currentPath}.`, error);
        return fullContent;
    }

    for (const item of items) {
        // Ignora pastas na lista de exceção
        if (config.ignoreDirectories.includes(item.name)) {
            continue;
        }

        const itemPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
            fullContent += readMarkdownFilesRecursively(itemPath, baseDirectoryName);
        } else if (item.isFile() && item.name.endsWith(".md")) {
            try {
                const content = fs.readFileSync(itemPath, "utf8");
                // Calcula o caminho relativo para melhor identificação
                const relativeToMemoryBase = path.relative(path.join(process.cwd(), baseDirectoryName), itemPath);
                fullContent += `
========================
ARQUIVO: ${item.name}
PASTA: ${baseDirectoryName}${path.sep}${relativeToMemoryBase}
========================

${content}

`;
            } catch (error) {
                logError(`Erro ao ler arquivo Markdown: ${itemPath}.`, error);
            }
        }
    }

    return fullContent;
}

/**
 * Carrega todo o conteúdo da "memória" da ATLAS, agregando informações
 * de todos os diretórios de memória configurados.
 * @returns {string} O conteúdo consolidado da memória da ATLAS.
 */
function loadMemory() {
    let completeMemory = "";
    try {
        for (const directoryName of config.memoryDirectories) {
            const directoryPath = path.join(process.cwd(), directoryName);
            completeMemory += readMarkdownFilesRecursively(directoryPath, directoryName);
        }
    } catch (error) {
        logError("Erro inesperado ao carregar a memória da ATLAS.", error);
        return "";
    }
    return completeMemory;
}

/**
 * Salva um conteúdo de texto em um arquivo de log específico dentro do diretório de logs da ATLAS.
 * @param {string} fileName - O nome do arquivo a ser salvo (ex: "analise-atlas.md").
 * @param {string} content - O conteúdo de texto a ser escrito no arquivo.
 * @returns {boolean} True se o arquivo foi salvo com sucesso, False caso contrário.
 */
function saveLogFile(fileName, content) {
    try {
        const logFilePath = path.join(process.cwd(), config.logDirectory, fileName);
        const formattedContent = `
# Relatório ATLAS - ${getFormattedTimestamp()}

${content}

==================================
`;
        fs.writeFileSync(logFilePath, formattedContent, "utf8");
        return true;
    } catch (error) {
        logError(`Erro ao salvar arquivo de log: ${fileName}.`, error);
        return false;
    }
}

/**
 * Anexa uma entrada de conversa (mensagem do usuário e resposta da ATLAS)
 * ao arquivo de log de conversas configurado.
 * @param {string} userMessage - A mensagem original enviada pelo usuário.
 * @param {string} atlasResponse - A resposta gerada pela ATLAS.
 */
function saveConversationLog(userMessage, atlasResponse) {
    try {
        // Garante que o diretório de logs existe
        const fullLogDirPath = path.join(process.cwd(), config.logDirectory);
        if (!fs.existsSync(fullLogDirPath)) {
            fs.mkdirSync(fullLogDirPath, { recursive: true });
        }

        const logFilePath = path.join(fullLogDirPath, config.conversationLogFile);
        const entryContent = `
# ${getFormattedTimestamp()}

## Alex:
${userMessage}

## ATLAS:
${atlasResponse}

---
`;
        fs.appendFileSync(logFilePath, entryContent, "utf8");
    } catch (error) {
        logError("Erro ao salvar o log da conversa.", error);
    }
}

/**
 * Lista recursivamente todos os arquivos e diretórios a partir de um caminho base,
 * ignorando as pastas definidas em `config.ignoreDirectories`.
 * @param {string} currentPath - O caminho absoluto atual para iniciar a listagem.
 * @param {string} [relativePathPrefix=""] - Prefixo para construir o caminho relativo de cada item.
 * @returns {string[]} Uma lista de caminhos relativos de arquivos e diretórios.
 */
function listProjectFiles(currentPath, relativePathPrefix = "") {
    let fileList = [];

    if (!fs.existsSync(currentPath)) {
        logError(`Diretório não encontrado para listagem de arquivos: ${currentPath}.`);
        return fileList;
    }

    let items;
    try {
        items = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
        logError(`Erro ao listar itens no diretório ${currentPath} para listagem de arquivos.`, error);
        return fileList;
    }

    for (const item of items) {
        if (config.ignoreDirectories.includes(item.name)) {
            continue; // Ignora pastas configuradas
        }

        const fullPath = path.join(currentPath, item.name);
        const relativePath = path.join(relativePathPrefix, item.name);

        if (item.isDirectory()) {
            fileList.push(`${relativePath}/`); // Adiciona a pasta com uma barra final
            fileList = fileList.concat(listProjectFiles(fullPath, relativePath));
        } else {
            fileList.push(relativePath); // Adiciona o arquivo
        }
    }

    return fileList;
}

/**
 * Lê o conteúdo de um arquivo de projeto, aplicando validações de segurança e tamanho máximo.
 * Previne path traversal e leitura de arquivos muito grandes.
 * @param {string} relativeFilePath - O caminho relativo do arquivo a ser lido, a partir do diretório de execução.
 * @returns {string} O conteúdo do arquivo como string ou uma mensagem de erro detalhada.
 */
function readProjectFile(relativeFilePath) {
    try {
        // Normaliza o caminho para remover "..", ".", etc. e padronizar barras.
        const normalizedPath = path.normalize(relativeFilePath);

        // Validação de segurança: Impede path traversal (acesso a diretórios fora do cwd).
        // Se o caminho normalizado começa com "..", ou contém "..\" (Windows) ou "/../" (Unix),
        // significa que tenta subir na hierarquia acima do diretório de trabalho.
        if (normalizedPath.startsWith("..") || normalizedPath.includes(path.sep + "..")) {
            return "ERRO: Caminho inválido. Tentativa de acessar diretório fora da área de trabalho do projeto detectada.";
        }

        const fullFilePath = path.join(process.cwd(), normalizedPath);

        if (!fs.existsSync(fullFilePath)) {
            return `ERRO: Arquivo não encontrado no caminho: '${relativeFilePath}'.`;
        }

        const stats = fs.statSync(fullFilePath);

        if (stats.isDirectory()) {
            return `ERRO: '${relativeFilePath}' é um diretório, não um arquivo.`;
        }

        // Valida o tamanho do arquivo para evitar leitura de arquivos excessivamente grandes
        // que poderiam consumir muita memória ou exceder limites da API da IA.
        if (stats.size > config.maxFileReadSizeKb * 1024) { // Convert KB to bytes
            const fileSizeKb = (stats.size / 1024).toFixed(2);
            return `ERRO: Arquivo muito grande (${fileSizeKb} KB). Limite de leitura: ${config.maxFileReadSizeKb} KB.`;
        }

        return fs.readFileSync(fullFilePath, "utf8");

    } catch (error) {
        logError(`Erro ao ler arquivo de projeto: ${relativeFilePath}.`, error);
        return `ERRO: Ocorreu um erro desconhecido ao tentar ler o arquivo '${relativeFilePath}'. Verifique as permissões ou o caminho.`;
    }
}

/**
 * Salva o código editado pela IA em um novo arquivo, anexando `.edited` ao nome
 * antes da extensão original. Por exemplo, `script.js` se torna `script.edited.js`.
 * @param {string} originalFilePath - O caminho relativo do arquivo original.
 * @param {string} editedContent - O conteúdo de texto editado pela IA.
 * @returns {string} O caminho relativo do novo arquivo salvo ou uma mensagem de erro.
 */
function writeEditedCode(originalFilePath, editedContent) {
    try {
        const dir = path.dirname(originalFilePath);
        const ext = path.extname(originalFilePath);
        const base = path.basename(originalFilePath, ext);
        const newFileName = path.join(dir, `${base}.edited${ext}`); // Ex: index.js -> index.edited.js
        const fullNewFilePath = path.join(process.cwd(), newFileName);

        // Garante que o diretório de destino existe
        fs.mkdirSync(path.dirname(fullNewFilePath), { recursive: true });

        fs.writeFileSync(fullNewFilePath, editedContent, "utf8");
        return newFileName; // Retorna o caminho relativo para feedback ao usuário
    } catch (error) {
        logError(`Erro ao salvar arquivo editado para: ${originalFilePath}.`, error);
        return `ERRO: Não foi possível salvar o arquivo editado. Detalhes: ${error.message}`;
    }
}

// endregion

// region: Interface de Linha de Comando (CLI)

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`
==============================
ATLAS ONLINE [Modelo: ${config.modelName}]
==============================

Olá, Alex! Sou a ATLAS, sua assistente de IA.
Estou pronta para ajudar com seus projetos.

Comandos disponíveis:
/analisar             - Analisa a memória completa da ATLAS e gera um relatório detalhado.
/organizar            - Gera um roadmap de organização e próximas ações baseado na memória.
/projetos             - Lista os arquivos de projeto na pasta "02 - Projetos".
/memoria              - Exibe um resumo da memória carregada pela ATLAS.
/arquivos             - Lista todos os arquivos e diretórios do projeto (limitado para exibição).
/ler <caminho>        - Lê e exibe o conteúdo de um arquivo específico do projeto.
/analisar-arquivo <caminho> - Solicita à ATLAS uma análise profunda de um arquivo.
/editar-arquivo <caminho>   - Pede à ATLAS para sugerir melhorias no código e salva o resultado.

Digite "sair" a qualquer momento para encerrar a conversa.

==============================
`);

/**
 * Inicia o loop principal de conversação da ATLAS, processando comandos
 * do usuário e interagindo com a IA.
 */
async function startConversation() {
    rl.question("Você: ", async (userInput) => {
        const message = userInput.trim(); // Limpa espaços em branco da entrada do usuário

        // Comando para encerrar a aplicação
        if (message.toLowerCase() === "sair") {
            console.log("\nATLAS encerrada. Até a próxima, Alex!\n");
            rl.close();
            return;
        }

        // --- Tratamento de Comandos Específicos ---

        // Exibe um resumo da memória carregada
        if (message === "/memoria") {
            const memoryContent = loadMemory();
            console.log(`\nATLAS:\n${truncateText(memoryContent, config.maxMemoryLogLength)}\n`);
            startConversation();
            return;
        }

        // Lista arquivos de projetos na pasta configurada
        if (message === "/projetos") {
            try {
                const projectsPath = path.join(process.cwd(), config.projectsDirectoryName);
                if (!fs.existsSync(projectsPath)) {
                    console.log(`\nATLAS:\n\nO diretório de projetos ('${config.projectsDirectoryName}') não foi encontrado.\n`);
                    startConversation();
                    return;
                }
                const projectFiles = fs.readdirSync(projectsPath)
                                       .filter(file => file.endsWith(".md"))
                                       .sort(); // Ordena para melhor legibilidade
                if (projectFiles.length > 0) {
                    console.log(`\nATLAS:\n\nProjetos encontrados na pasta "${config.projectsDirectoryName}":\n\n${projectFiles.join("\n")}\n`);
                } else {
                    console.log(`\nATLAS:\n\nNenhum arquivo de projeto (.md) encontrado na pasta "${config.projectsDirectoryName}".\n`);
                }
            } catch (error) {
                logError(`Erro ao listar projetos na pasta '${config.projectsDirectoryName}'.`, error);
                console.log("\nATLAS:\n\nNão consegui acessar a pasta de projetos. Verifique as permissões ou se ela existe.\n");
            }
            startConversation();
            return;
        }

        // Lista todos os arquivos e diretórios do projeto (truncado)
        if (message === "/arquivos") {
            const allFiles = listProjectFiles(process.cwd());
            const displayFiles = allFiles.slice(0, config.maxFileListLogLength);
            const truncatedMessage = allFiles.length > config.maxFileListLogLength ?
                `\n... (lista truncada para exibição, ${allFiles.length - config.maxFileListLogLength} itens omitidos)` : "";
            console.log(`\nATLAS:\n\nArquivos e diretórios encontrados no projeto (exibindo os primeiros ${displayFiles.length} de ${allFiles.length}):\n\n${displayFiles.join("\n")}${truncatedMessage}\n`);
            startConversation();
            return;
        }

        // Lê e exibe o conteúdo de um arquivo
        if (message.startsWith("/ler ")) {
            const filePath = message.replace("/ler ", "").trim();
            const fileContent = readProjectFile(filePath);

            console.log(`\nATLAS:\n\nARQUIVO: ${filePath}\n\n${truncateText(fileContent, config.maxContentLogLength)}\n`);
            startConversation();
            return;
        }

        // Analisa um arquivo usando a IA
        if (message.startsWith("/analisar-arquivo ")) {
            const filePath = message.replace("/analisar-arquivo ", "").trim();
            console.log(`\nATLAS:\n\nAnalisando arquivo '${filePath}'... Por favor, aguarde.\n`);
            const analysisResult = await analyzeFile(filePath);
            console.log(`\n${analysisResult}\n`);
            startConversation();
            return;
        }

        // Edita um arquivo usando a IA e salva o resultado
        if (message.startsWith("/editar-arquivo ")) {
            const filePath = message.replace("/editar-arquivo ", "").trim();
            console.log(`\nATLAS:\n\nEditando arquivo '${filePath}'... Por favor, aguarde.\n`);
            const editedCode = await editFileWithAI(filePath);

            if (editedCode.startsWith("ERRO:") || editedCode.startsWith("Não consegui acessar a IA agora.")) {
                console.log(`\nATLAS:\n\n${editedCode}\n`);
            } else {
                const newFilePath = writeEditedCode(filePath, editedCode);
                if (newFilePath.startsWith("ERRO:")) {
                    console.log(`\nATLAS:\n\n${newFilePath}\n`);
                } else {
                    console.log(`\nATLAS:\n\nArquivo editado com sucesso e salvo em: ${newFilePath}\n`);
                }
            }
            startConversation();
            return;
        }

        // Gera análise ou roadmap estratégico baseado na memória
        if (message === "/analisar" || message === "/organizar") {
            const currentMemory = loadMemory();
            console.log(`\nATLAS:\n\n${message === "/analisar" ? "Realizando uma análise completa da sua memória..." : "Gerando um roadmap de organização e próximas ações..."} Por favor, aguarde.\n`);

            const specialPrompt = `
Você é a ATLAS, a mente estratégica e organizadora para Alex.
Sua função é ser proativa, identificar necessidades e propor soluções.

Analise toda a memória abaixo e as suas capacidades de:
- Memória contínua e persistente;
- Foco em gestão e execução de projetos;
- Organização e estruturação de informações;
- Automação de tarefas repetitivas;
- Integração e auxílio no ambiente VS Code;
- Apoio estratégico e proativo para Alex.

Baseado na memória fornecida e em suas capacidades, gere um relatório detalhado contendo:
- **Prioridades Claras:** Liste as tarefas/projetos mais importantes e urgentes.
- **Projetos Ativos:** Identifique projetos em andamento, seu status e próximos passos chave.
- **Riscos e Desafios Potenciais:** Sinalize obstáculos ou problemas que podem surgir.
- **Próximos Passos Detalhados e Acionáveis:** Sugira ações concretas a serem tomadas.
- **Sugestões de Melhorias:** Proponha aperfeiçoamentos no fluxo de trabalho de Alex, na organização do projeto ou na sua própria arquitetura (ATLAS).
- **Organização Necessária:** Recomendações específicas para estruturar pastas, arquivos, e informações.
- **Automações Possíveis:** Idéias para automatizar tarefas repetitivas ou complexas.

Seja concisa, mas completa. Use Markdown para formatar o relatório.

MEMÓRIA:
${currentMemory}
`;

            const aiResponse = await generateContentWithRetry(specialPrompt);
            console.log(`\nATLAS:\n\n${aiResponse}\n`);

            const logFileName = message === "/analisar" ? config.analysisLogFile : config.roadmapLogFile;
            if (saveLogFile(logFileName, aiResponse)) {
                console.log(`Relatório salvo em: ${path.join(config.logDirectory, logFileName)}\n`);
            }
            startConversation();
            return;
        }

        // --- Tratamento de Mensagens Gerais (Conversa com a IA) ---
        try {
            const currentMemory = loadMemory();

            const generalPrompt = `
Você é a ATLAS, a mente estratégica e organizadora para Alex.
Sua função é ser uma assistente de IA útil, concisa e focada em resultados.

Suas capacidades e foco são:
- Memória contínua e persistente;
- Foco em gestão e execução de projetos;
- Organização e estruturação de informações;
- Automação de tarefas repetitivas;
- Integração e auxílio no ambiente VS Code;
- Apoio estratégico e proativo para Alex.

Use sua memória para contextualizar, compreender a intenção de Alex e gerar respostas relevantes e úteis.
Evite ser excessivamente prolixa.

MEMÓRIA ATUAL:
${currentMemory}

MENSAGEM DE ALEX:
${message}
`;

            const aiResponse = await generateContentWithRetry(generalPrompt);
            console.log(`\nATLAS:\n\n${aiResponse}\n`);
            saveConversationLog(message, aiResponse); // Salva a conversa para manter o histórico

        } catch (error) {
            logError("Erro geral no processamento da mensagem do usuário.", error);
            console.log("\nATLAS:\n\nDesculpe, Alex. Tive um problema inesperado ao processar sua solicitação. Por favor, tente novamente.\n");
        }

        startConversation(); // Continua o loop de conversação
    });
}

// Inicia a interação com a ATLAS
startConversation();

// endregion
```