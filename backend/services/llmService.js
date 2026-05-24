const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, '..', 'data', 'keys.json');

// Mappings for default model names if not specified
const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  groq: 'llama-3.1-8b-instant',
  openrouter: 'google/gemini-2.5-flash:free',
  freellmapi: 'auto'
};

// Endpoints for each provider
const ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  freellmapi: 'http://localhost:3001/v1/chat/completions'
};

/**
 * Main LLM Query Routing Entrypoint
 */
async function queryLLM({ provider, apiKey, model, messages, systemPrompt }) {
  // Read saved vault keys from file
  let vaultKeys = { gemini: '', groq: '', openrouter: '', freellmapi: '' };
  try {
    if (fs.existsSync(KEYS_FILE)) {
      vaultKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read keys vault:', err);
  }

  // Prepend system prompt if provided
  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.forEach(msg => {
    const role = msg.role === 'model' ? 'assistant' : msg.role;
    apiMessages.push({ role, content: msg.content });
  });

  // Determine which providers to try
  let providersToTry = [];
  
  if (provider === 'auto') {
    // Auto mode: try any provider that has a key configured in the vault
    if (vaultKeys.gemini) providersToTry.push({ type: 'gemini', key: vaultKeys.gemini });
    if (vaultKeys.groq) providersToTry.push({ type: 'groq', key: vaultKeys.groq });
    if (vaultKeys.openrouter) providersToTry.push({ type: 'openrouter', key: vaultKeys.openrouter });
  } else if (provider && provider !== 'fallback') {
    // Specific provider selected: use its vault key (or fallback to passed apiKey if any)
    const key = vaultKeys[provider] || apiKey;
    if (key) {
      providersToTry.push({ type: provider, key });
    }
  }

  // If no providers are configured or selected, fall back to offline mode
  if (providersToTry.length === 0) {
    return runFallbackProcessor(messages);
  }

  // Try providers sequentially with failover
  let lastError = null;
  for (const prov of providersToTry) {
    try {
      console.log(`Routing study query to LLM: [${prov.type.toUpperCase()}]`);
      const response = await callProviderAPI({
        provider: prov.type,
        apiKey: prov.key,
        model: provider === 'auto' ? DEFAULT_MODELS[prov.type] : model,
        messages: apiMessages
      });
      return response;
    } catch (err) {
      console.warn(`Provider [${prov.type.toUpperCase()}] failed: ${err.message}. Retrying next in chain...`);
      lastError = err;
    }
  }

  // If all providers in the chain fail, drop back to local offline mode with a warning
  console.error('All LLM providers failed. Falling back to offline mode.');
  const fallbackResult = runFallbackProcessor(messages);
  return `⚠️ API Rotation Failed (${lastError ? lastError.message : 'No keys set'}). Falling back to offline summarizer.\n\n${fallbackResult}`;
}

/**
 * Perform actual HTTP Fetch query to chosen provider
 */
async function callProviderAPI({ provider, apiKey, model, messages }) {
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Unknown endpoint for provider: ${provider}`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  // Model override maps
  let resolvedModel = model;
  if (!resolvedModel || resolvedModel === 'auto' || resolvedModel === 'fallback') {
    resolvedModel = DEFAULT_MODELS[provider];
  }

  // Custom headers for OpenRouter
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'StudyNotebook';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages: messages,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('Response did not contain chat choices.');
  }

  return data.choices[0].message.content;
}

/**
 * Basic Rule-Based Local Text Summarizer/Fallback
 */
function runFallbackProcessor(messages) {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const text = lastUserMessage ? lastUserMessage.content : '';

  if (!text || text.trim() === '') {
    return JSON.stringify({
      chat_response: "I couldn't find any study material in your input. Please paste or type something!",
      extracted_notes: ""
    });
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const words = text.split(/\s+/);
  const potentialTerms = new Set();
  words.forEach((word) => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length > 3 && cleanWord[0] === cleanWord[0].toUpperCase() && cleanWord !== cleanWord.toUpperCase()) {
      potentialTerms.add(cleanWord);
    }
  });
  const termsList = Array.from(potentialTerms).slice(0, 5);

  let chatResponse = `### Offline Study Assistant (Fallback Mode)\n\n`;
  chatResponse += `*Note: You are currently running in Offline Fallback Mode. To activate AI chat, open **Settings** (bottom-left) and enter your API keys under the **API Keys Vault** tab.* \n\n`;
  chatResponse += `Here is a local analysis of what you studied:\n\n`;
  
  if (termsList.length > 0) {
    chatResponse += `**Identified key terms:** ${termsList.join(', ')}.\n\n`;
  }
  
  chatResponse += `I've compiled some key points below and added them to your notebook on the right panel.`;

  let extractedNotes = `### 📝 Study Points (Offline Summary)\n`;
  extractedNotes += `*Source: Study session on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n`;
  
  const bulletPoints = sentences
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .slice(0, 4);

  if (bulletPoints.length > 0) {
    bulletPoints.forEach((bp) => {
      extractedNotes += `* ${bp}\n`;
    });
  } else {
    extractedNotes += `* ${text.trim().substring(0, 150)}...\n`;
  }

  if (termsList.length > 0) {
    extractedNotes += `\n**Key Vocabulary:**\n`;
    termsList.forEach(term => {
      extractedNotes += `* **${term}**: Highlighted in source text.\n`;
    });
  }

  const finalPayload = {
    chat_response: chatResponse,
    extracted_notes: extractedNotes
  };

  return JSON.stringify(finalPayload);
}

module.exports = {
  queryLLM
};
