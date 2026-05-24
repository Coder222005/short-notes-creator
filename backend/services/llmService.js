const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, '..', 'data', 'keys.json');
const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');

const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  groq: 'llama-3.1-8b-instant',
  openrouter: 'google/gemini-2.5-flash:free'
};

const ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

/**
 * Main LLM Query Routing Entrypoint
 */
async function queryLLM({ provider, apiKey, model, messages, systemPrompt }) {
  // Read saved vault keys from file (for direct fallback options if needed)
  let vault = {
    priority: ['gemini', 'groq', 'openrouter'],
    keys: { gemini: '', groq: '', openrouter: '' }
  };
  try {
    if (fs.existsSync(KEYS_FILE)) {
      vault = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
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

  // 1. FREELLMAPI PROXY ROUTING
  if (provider === 'freellmapi') {
    try {
      console.log(`Routing completions query to FreeLLMAPI [model: ${model || 'auto'}]`);
      
      // Fetch the unified API key from local FreeLLMAPI server on port 3001
      let freeLlmKey = '';
      try {
        const keyRes = await fetch('http://localhost:3001/api/settings/api-key');
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          freeLlmKey = keyData.apiKey;
        }
      } catch (e) {
        console.warn('Failed to fetch unified FreeLLMAPI key:', e.message);
      }

      const response = await fetch('http://localhost:3001/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freeLlmKey}`
        },
        body: JSON.stringify({
          model: model || 'auto',
          messages: apiMessages,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`FreeLLMAPI status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error('Response did not contain chat choices.');
      }
      
      updateStats('freellmapi');
      return data.choices[0].message.content;
    } catch (err) {
      console.error('FreeLLMAPI routing failed, falling back to local summarizer:', err.message);
      updateStats('fallback');
      const fallbackResult = runFallbackProcessor(messages);
      return `⚠️ FreeLLMAPI proxy error (${err.message}). Falling back to offline summarizer.\n\n${fallbackResult}`;
    }
  }

  // 2. DIRECT PROVIDERS (GEMINI / GROQ / OPENROUTER)
  let providersToTry = [];
  
  if (provider === 'auto') {
    // Dynamic Rotation: iterate through keys in their PRIORITY order
    const priorityOrder = vault.priority || ['gemini', 'groq', 'openrouter'];
    priorityOrder.forEach((provName) => {
      const key = vault.keys && vault.keys[provName];
      if (key && key.trim() !== '') {
        providersToTry.push({ type: provName, key });
      }
    });
  } else if (provider && provider !== 'fallback') {
    // Specific provider selected: use its vault key (or fallback to passed apiKey if any)
    const key = (vault.keys && vault.keys[provider]) || apiKey;
    if (key && key.trim() !== '') {
      providersToTry.push({ type: provider, key });
    }
  }

  // If no providers are configured or selected, fall back to offline mode
  if (providersToTry.length === 0) {
    updateStats('fallback');
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
      
      // Update statistics
      updateStats(prov.type);
      return response;
    } catch (err) {
      console.warn(`Provider [${prov.type.toUpperCase()}] failed: ${err.message}. Retrying next...`);
      lastError = err;
    }
  }

  // If all providers in the chain fail, drop back to local offline mode with a warning
  console.error('All LLM providers failed. Falling back to offline mode.');
  updateStats('fallback');
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
 * Increment usage statistics counters
 */
function updateStats(providerType) {
  try {
    let stats = {
      totalRequests: 0,
      geminiRequests: 0,
      groqRequests: 0,
      openrouterRequests: 0,
      freellmapiRequests: 0,
      fallbackRequests: 0,
      lastRoutedVia: 'None'
    };

    if (fs.existsSync(STATS_FILE)) {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }

    stats.totalRequests = (stats.totalRequests || 0) + 1;
    stats.lastRoutedVia = providerType.toUpperCase();

    if (providerType === 'gemini') stats.geminiRequests = (stats.geminiRequests || 0) + 1;
    else if (providerType === 'groq') stats.groqRequests = (stats.groqRequests || 0) + 1;
    else if (providerType === 'openrouter') stats.openrouterRequests = (stats.openrouterRequests || 0) + 1;
    else if (providerType === 'freellmapi') stats.freellmapiRequests = (stats.freellmapiRequests || 0) + 1;
    else if (providerType === 'fallback') stats.fallbackRequests = (stats.fallbackRequests || 0) + 1;

    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to update stats:', err);
  }
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
