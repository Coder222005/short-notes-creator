const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { queryLLM } = require('./services/llmService');
const { processAndAppendNotes } = require('./services/noteService');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const NOTEBOOKS_DIR = path.join(DATA_DIR, 'notebooks');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(NOTEBOOKS_DIR)) {
  fs.mkdirSync(NOTEBOOKS_DIR, { recursive: true });
}

// Helpers for paths
const getNotebookPath = (id) => path.join(NOTEBOOKS_DIR, id);
const getMetaPath = (id) => path.join(getNotebookPath(id), 'meta.json');
const getChatPath = (id) => path.join(getNotebookPath(id), 'chat.json');
const getNotesPath = (id) => path.join(getNotebookPath(id), 'notes.md');

function ensureSampleNotebook() {
  try {
    if (!fs.existsSync(NOTEBOOKS_DIR)) {
      fs.mkdirSync(NOTEBOOKS_DIR, { recursive: true });
    }
    const dirs = fs.readdirSync(NOTEBOOKS_DIR);
    if (dirs.length === 0) {
      console.log('Seeding Sample Study Notebook...');
      const sampleId = 'nb_sample_study';
      const sampleFolder = getNotebookPath(sampleId);
      fs.mkdirSync(sampleFolder, { recursive: true });

      const meta = {
        id: sampleId,
        name: '💡 Sample Study: Photosynthesis',
        createdTime: new Date().toISOString()
      };

      const notes = `# 💡 Sample Study: Photosynthesis\n\nWelcome to your study notebook! This sample notebook demonstrates how StudyNotebook compiles your study materials into structured revision notes.\n\n### 📝 Core Concepts: Light Reactions\n* **Photosynthesis** is the process used by plants to convert light energy into chemical energy (glucose).\n* **Chloroplasts** are the organelles where photosynthesis occurs, containing the pigment chlorophyll.\n* **Light-dependent reactions** occur in the thylakoid membranes, splitting water molecules ($H_2O$) to release oxygen ($O_2$) and produce ATP/NADPH.\n`;

      const chat = [
        {
          id: 'msg_sample_u1',
          role: 'user',
          content: 'Photosynthesis is how plants make food using sunlight. It takes place in chloroplasts, specifically using chlorophyll to absorb light. The first stage is the light-dependent reactions where water is split to release oxygen.',
          timestamp: new Date(Date.now() - 120000).toISOString()
        },
        {
          id: 'msg_sample_a1',
          role: 'assistant',
          content: 'That is a perfect summary of the initial stage of photosynthesis! I have extracted these points as study notes for your revision. You can review them in the proposed notes block below.',
          notesDraft: '### 📝 Core Concepts: Light Reactions\n* **Photosynthesis** is the process used by plants to convert light energy into chemical energy (glucose).\n* **Chloroplasts** are the organelles where photosynthesis occurs, containing the pigment chlorophyll.\n* **Light-dependent reactions** occur in the thylakoid membranes, splitting water molecules ($H_2O$) to release oxygen ($O_2$) and produce ATP/NADPH.',
          notesAdded: true,
          timestamp: new Date(Date.now() - 90000).toISOString()
        },
        {
          id: 'msg_sample_u2',
          role: 'user',
          content: 'What about the second stage? I think it is called the Calvin cycle or light-independent reactions. Tell me about it so I can add it to my notes.',
          timestamp: new Date(Date.now() - 60000).toISOString()
        },
        {
          id: 'msg_sample_a2',
          role: 'assistant',
          content: 'Exactly! The second stage is the **Calvin Cycle** (or light-independent reactions). It occurs in the stroma of the chloroplast and uses carbon dioxide along with ATP and NADPH from the light reactions to synthesize glucose.\n\nReview the proposed points below and click **"Add to Notes"** to merge them into your compiler!',
          notesDraft: '### 🔄 The Calvin Cycle (Light-Independent Reactions)\n* Occurs in the **stroma** of the chloroplast.\n* Uses carbon dioxide ($CO_2$) and chemical energy (ATP and NADPH) to synthesize **glucose**.\n* Does not require direct sunlight but relies on products of the light-dependent stage.',
          notesAdded: false,
          timestamp: new Date(Date.now() - 30000).toISOString()
        }
      ];

      fs.writeFileSync(getMetaPath(sampleId), JSON.stringify(meta, null, 2), 'utf8');
      fs.writeFileSync(getNotesPath(sampleId), notes, 'utf8');
      fs.writeFileSync(getChatPath(sampleId), JSON.stringify(chat, null, 2), 'utf8');
      console.log('Sample Study Notebook seeded successfully.');
    }
  } catch (error) {
    console.error('Failed to seed sample notebook:', error);
  }
}

// 1. REVERSE PROXY TO FREELLMAPI (port 3001)
const proxyRequest = async (targetPath, req, res) => {
  try {
    const url = `http://localhost:3001${targetPath}`;
    
    // Copy headers from request
    const headers = { ...req.headers };
    delete headers.host; // Remove host header

    // Inject Unified API key dynamically for proxy requests
    if (targetPath.startsWith('/v1')) {
      try {
        const keyRes = await fetch('http://localhost:3001/api/settings/api-key');
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          headers['authorization'] = `Bearer ${keyData.apiKey}`;
        }
      } catch (e) {
        console.warn('Failed to auto-fetch FreeLLMAPI unified key:', e.message);
      }
    }

    const fetchOpts = {
      method: req.method,
      headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOpts);
    
    res.status(response.status);
    
    for (const [key, value] of response.headers.entries()) {
      // Don't forward transfer-encoding chunked directly as it's managed by Express
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    }
    
    const bodyText = await response.text();
    res.send(bodyText);
  } catch (err) {
    console.error(`[Proxy Error] failed routing to ${targetPath}:`, err.message);
    res.status(502).json({ error: `FreeLLMAPI proxy offline: ${err.message}` });
  }
};

// Route completions & models to FreeLLMAPI
app.all('/v1/*', (req, res) => {
  proxyRequest(req.originalUrl, req, res);
});

// Route settings/keys/analytics to FreeLLMAPI
app.all('/proxy-api/*', (req, res) => {
  const targetPath = req.originalUrl.replace('/proxy-api', '/api');
  proxyRequest(targetPath, req, res);
});


// 2. NOTEBOOK REST APIs (Local)

// Get all notebooks
app.get('/api/notebooks', (req, res) => {
  try {
    const notebooks = [];
    if (fs.existsSync(NOTEBOOKS_DIR)) {
      const dirs = fs.readdirSync(NOTEBOOKS_DIR);
      for (const dirName of dirs) {
        const metaFile = getMetaPath(dirName);
        if (fs.existsSync(metaFile)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
            notebooks.push(meta);
          } catch (e) {
            console.error(`Error parsing meta for ${dirName}:`, e);
          }
        }
      }
    }
    notebooks.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    res.json(notebooks);
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    res.status(500).json({ error: 'Failed to fetch notebooks' });
  }
});

// Create a new notebook
app.post('/api/notebooks', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Notebook name is required' });
    }

    const id = `nb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const notebookFolder = getNotebookPath(id);
    fs.mkdirSync(notebookFolder, { recursive: true });

    const meta = {
      id,
      name: name.trim(),
      createdTime: new Date().toISOString(),
    };

    fs.writeFileSync(getMetaPath(id), JSON.stringify(meta, null, 2), 'utf8');
    fs.writeFileSync(getChatPath(id), JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(getNotesPath(id), '# ' + name.trim() + '\n\nWelcome to your study notebook! Paste study materials in the chat to extract important notes here.\n\n', 'utf8');

    res.status(201).json(meta);
  } catch (error) {
    console.error('Error creating notebook:', error);
    res.status(500).json({ error: 'Failed to create notebook' });
  }
});

// Rename notebook
app.put('/api/notebooks/:id/rename', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Notebook name is required' });
    }

    const metaFile = getMetaPath(id);
    if (!fs.existsSync(metaFile)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    meta.name = name.trim();
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    res.json(meta);
  } catch (error) {
    console.error('Error renaming notebook:', error);
    res.status(500).json({ error: 'Failed to rename notebook' });
  }
});

// Get detailed notebook content
app.get('/api/notebooks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const notebookFolder = getNotebookPath(id);

    if (!fs.existsSync(notebookFolder)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const meta = JSON.parse(fs.readFileSync(getMetaPath(id), 'utf8'));
    const chat = JSON.parse(fs.readFileSync(getChatPath(id), 'utf8'));
    const notes = fs.readFileSync(getNotesPath(id), 'utf8');

    res.json({
      meta,
      chat,
      notes,
    });
  } catch (error) {
    console.error('Error fetching notebook data:', error);
    res.status(500).json({ error: 'Failed to fetch notebook details' });
  }
});

// Delete notebook
app.delete('/api/notebooks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const notebookFolder = getNotebookPath(id);

    if (!fs.existsSync(notebookFolder)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    fs.rmSync(notebookFolder, { recursive: true, force: true });
    res.json({ success: true, message: 'Notebook deleted' });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    res.status(500).json({ error: 'Failed to delete notebook' });
  }
});

// Save notes edits
app.put('/api/notebooks/:id/notes', (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const notesFile = getNotesPath(id);

    if (!fs.existsSync(getNotebookPath(id))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    fs.writeFileSync(notesFile, notes, 'utf8');
    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Chat API
app.post('/api/notebooks/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, llmConfig } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const notebookFolder = getNotebookPath(id);
    if (!fs.existsSync(notebookFolder)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const chatFile = getChatPath(id);
    const notesFile = getNotesPath(id);

    let chatHistory = JSON.parse(fs.readFileSync(chatFile, 'utf8'));

    const userMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    chatHistory.push(userMessage);

    const currentNotes = fs.readFileSync(notesFile, 'utf8');

    const { reply, notesToAppend } = await processAndAppendNotes({
      message,
      chatHistory,
      currentNotes,
      llmConfig,
    });

    const assistantMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: reply,
      notesDraft: notesToAppend || '',
      notesAdded: false,
      timestamp: new Date().toISOString(),
    };
    chatHistory.push(assistantMessage);

    fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2), 'utf8');

    res.json({
      reply,
      notesDraft: notesToAppend || '',
      notesAdded: false,
      chatHistory,
    });
  } catch (error) {
    console.error('Error in chat processing:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat request' });
  }
});

// Accept proposed notes draft
app.post('/api/notebooks/:id/accept-notes', (req, res) => {
  try {
    const { id } = req.params;
    const { messageId, notes } = req.body;

    const notebookFolder = getNotebookPath(id);
    if (!fs.existsSync(notebookFolder)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const chatFile = getChatPath(id);
    const notesFile = getNotesPath(id);

    if (!fs.existsSync(chatFile) || !fs.existsSync(notesFile)) {
      return res.status(400).json({ error: 'Notebook files missing' });
    }

    let chatHistory = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
    let currentNotes = fs.readFileSync(notesFile, 'utf8');

    // Mark the draft as added in history
    let found = false;
    chatHistory = chatHistory.map(msg => {
      if (msg.id === messageId) {
        msg.notesAdded = true;
        found = true;
      }
      return msg;
    });

    if (!found) {
      return res.status(404).json({ error: 'Target message not found' });
    }

    // Append notes
    let updatedNotes = currentNotes;
    if (notes && notes.trim() !== '') {
      updatedNotes = currentNotes.trim() + '\n\n' + notes.trim() + '\n';
      fs.writeFileSync(notesFile, updatedNotes, 'utf8');
    }

    fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2), 'utf8');

    res.json({
      success: true,
      updatedNotes,
      chatHistory
    });
  } catch (error) {
    console.error('Error accepting notes draft:', error);
    res.status(500).json({ error: error.message || 'Failed to accept notes draft' });
  }
});

// ChatGPT JSON Export Parser
function parseChatGPTExport(json) {
  const messages = [];
  const conversations = Array.isArray(json) ? json : [json];
  
  for (const conv of conversations) {
    if (!conv.mapping) continue;
    const nodes = Object.values(conv.mapping);
    const validMessages = nodes
      .filter(node => node.message && node.message.content && node.message.content.parts)
      .map(node => {
        const msg = node.message;
        const role = msg.author.role === 'user' ? 'user' : 'assistant';
        const content = msg.content.parts.filter(p => typeof p === 'string').join('\n');
        const createTime = msg.create_time ? new Date(msg.create_time * 1000).toISOString() : new Date().toISOString();
        return { role, content, timestamp: createTime };
      })
      .filter(m => m.content.trim() !== '');
      
    validMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    messages.push(...validMessages);
  }
  return messages;
}

// Gemini JSON Export Parser
function parseGeminiExport(json) {
  const messages = [];
  if (Array.isArray(json)) {
    for (const item of json) {
      const role = (item.role === 'model' || item.role === 'assistant') ? 'assistant' : 'user';
      const content = item.content || (item.parts && item.parts[0]?.text) || '';
      if (content.trim()) {
        messages.push({ role, content, timestamp: new Date().toISOString() });
      }
    }
  } else if (json.conversations) {
    const convs = Array.isArray(json.conversations) ? json.conversations : [json.conversations];
    for (const conv of convs) {
      if (conv.parts) {
        for (const part of conv.parts) {
          const role = (part.role === 'model' || part.role === 'assistant') ? 'assistant' : 'user';
          const content = part.text || (part.parts && part.parts[0]?.text) || '';
          if (content.trim()) {
            messages.push({ role, content, timestamp: new Date().toISOString() });
          }
        }
      }
    }
  }
  return messages;
}

// Raw Copy-Pasted Text Parser
function parseRawTextExport(text) {
  const lines = text.split('\n');
  const messages = [];
  let currentRole = null;
  let currentContent = [];
  
  const detectRole = (line) => {
    const clean = line.trim().toLowerCase();
    if (clean === 'you' || clean === 'user' || clean.startsWith('user:') || clean.startsWith('you:')) return 'user';
    if (clean === 'gemini' || clean === 'chatgpt' || clean === 'assistant' || clean.startsWith('assistant:') || clean.startsWith('gemini:') || clean.startsWith('chatgpt:')) return 'assistant';
    
    const userPatterns = [/^(you|user)\s*:\s*/i, /^\[(you|user)\]/i];
    const aiPatterns = [/^(gemini|chatgpt|assistant|ai|bot)\s*:\s*/i, /^\[(gemini|chatgpt|assistant|ai|bot)\]/i];
    
    for (const p of userPatterns) {
      if (p.test(line)) return 'user';
    }
    for (const p of aiPatterns) {
      if (p.test(line)) return 'assistant';
    }
    return null;
  };
  
  const cleanLinePrefix = (line) => {
    return line.replace(/^(you|user|gemini|chatgpt|assistant|ai|bot)\s*:\s*/i, '')
               .replace(/^\[(you|user|gemini|chatgpt|assistant|ai|bot)\]\s*/i, '');
  };

  for (let line of lines) {
    const role = detectRole(line);
    if (role) {
      if (currentRole && currentContent.join('\n').trim() !== '') {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim(),
          timestamp: new Date().toISOString()
        });
      }
      currentRole = role;
      currentContent = [cleanLinePrefix(line)];
    } else {
      if (currentRole) {
        currentContent.push(line);
      } else if (line.trim() !== '') {
        currentRole = 'user';
        currentContent = [line];
      }
    }
  }
  
  if (currentRole && currentContent.join('\n').trim() !== '') {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
      timestamp: new Date().toISOString()
    });
  }
  return messages;
}

// Chat Import API Route
app.post('/api/notebooks/:id/import-chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { rawData, format, llmConfig } = req.body;

    const notebookFolder = getNotebookPath(id);
    if (!fs.existsSync(notebookFolder)) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    let parsedMessages = [];
    if (format === 'chatgpt_json') {
      let jsonParsed;
      try {
        jsonParsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload for ChatGPT export.' });
      }
      parsedMessages = parseChatGPTExport(jsonParsed);
    } else if (format === 'gemini_json') {
      let jsonParsed;
      try {
        jsonParsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload for Gemini export.' });
      }
      parsedMessages = parseGeminiExport(jsonParsed);
    } else {
      parsedMessages = parseRawTextExport(rawData || '');
    }

    if (parsedMessages.length === 0) {
      return res.status(400).json({ error: 'No valid messages found in the input.' });
    }

    const chatFile = getChatPath(id);
    const notesFile = getNotesPath(id);

    let chatHistory = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
    let currentNotes = fs.readFileSync(notesFile, 'utf8');

    const stampedMessages = parsedMessages.map((m, idx) => ({
      id: `msg_imported_${Date.now()}_${idx}`,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || new Date().toISOString()
    }));

    // Process in chunks of 8 messages to prevent context window overflow
    const CHUNK_SIZE = 8;
    let updatedNotes = currentNotes;
    let newAppendedNotes = '';

    console.log(`Processing imported chat of ${stampedMessages.length} messages in chunks of ${CHUNK_SIZE}...`);

    for (let i = 0; i < stampedMessages.length; i += CHUNK_SIZE) {
      const chunk = stampedMessages.slice(i, i + CHUNK_SIZE);
      
      try {
        const { notesToAppend } = await processAndAppendNotes({
          message: 'Process this segment of imported chat log and extract key points.',
          chatHistory: chunk,
          currentNotes: updatedNotes,
          llmConfig
        });

        if (notesToAppend && notesToAppend.trim() !== '') {
          updatedNotes = updatedNotes.trim() + '\n\n' + notesToAppend.trim() + '\n';
          newAppendedNotes = newAppendedNotes.trim() + '\n\n' + notesToAppend.trim() + '\n';
        }
      } catch (err) {
        console.error(`Error processing import chunk starting at index ${i}:`, err.message);
      }
    }

    chatHistory.push(...stampedMessages);

    fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2), 'utf8');
    fs.writeFileSync(notesFile, updatedNotes, 'utf8');

    res.json({
      success: true,
      importedCount: stampedMessages.length,
      appendedNotes: newAppendedNotes,
      updatedNotes,
      chatHistory
    });

  } catch (error) {
    console.error('Error importing chat history:', error);
    res.status(500).json({ error: error.message || 'Failed to import chat history' });
  }
});


// Serve frontend build static files
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  const indexHtmlFile = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexHtmlFile)) {
    res.sendFile(indexHtmlFile);
  } else {
    res.status(404).send('Static frontend not built yet. Run "npm run build" first.');
  }
});

// Start Server
ensureSampleNotebook();
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
