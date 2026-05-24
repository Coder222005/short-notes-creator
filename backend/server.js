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
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Ensure directories and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(NOTEBOOKS_DIR)) {
  fs.mkdirSync(NOTEBOOKS_DIR, { recursive: true });
}
if (!fs.existsSync(KEYS_FILE)) {
  const defaultKeys = {
    priority: ['gemini', 'groq', 'openrouter'],
    keys: { gemini: '', groq: '', openrouter: '' }
  };
  fs.writeFileSync(KEYS_FILE, JSON.stringify(defaultKeys, null, 2), 'utf8');
}
if (!fs.existsSync(STATS_FILE)) {
  const defaultStats = {
    totalRequests: 0,
    geminiRequests: 0,
    groqRequests: 0,
    openrouterRequests: 0,
    fallbackRequests: 0,
    lastRoutedVia: 'None'
  };
  fs.writeFileSync(STATS_FILE, JSON.stringify(defaultStats, null, 2), 'utf8');
}

// Helpers for paths
const getNotebookPath = (id) => path.join(NOTEBOOKS_DIR, id);
const getMetaPath = (id) => path.join(getNotebookPath(id), 'meta.json');
const getChatPath = (id) => path.join(getNotebookPath(id), 'chat.json');
const getNotesPath = (id) => path.join(getNotebookPath(id), 'notes.md');

// API Routes

// 1. Keys Vault APIs
app.get('/api/keys', (req, res) => {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      res.json(keys);
    } else {
      res.json({
        priority: ['gemini', 'groq', 'openrouter'],
        keys: { gemini: '', groq: '', openrouter: '' }
      });
    }
  } catch (error) {
    console.error('Error reading keys:', error);
    res.status(500).json({ error: 'Failed to read keys vault' });
  }
});

app.post('/api/keys', (req, res) => {
  try {
    const { priority, keys } = req.body;
    
    // Validate inputs
    const updatedVault = {
      priority: priority || ['gemini', 'groq', 'openrouter'],
      keys: {
        gemini: (keys && keys.gemini) || '',
        groq: (keys && keys.groq) || '',
        openrouter: (keys && keys.openrouter) || ''
      }
    };
    
    fs.writeFileSync(KEYS_FILE, JSON.stringify(updatedVault, null, 2), 'utf8');
    res.json({ success: true, message: 'Keys vault updated successfully' });
  } catch (error) {
    console.error('Error saving keys:', error);
    res.status(500).json({ error: 'Failed to save keys' });
  }
});

// 2. Stats/Analytics API
app.get('/api/stats', (req, res) => {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      res.json(stats);
    } else {
      res.json({
        totalRequests: 0,
        geminiRequests: 0,
        groqRequests: 0,
        openrouterRequests: 0,
        fallbackRequests: 0,
        lastRoutedVia: 'None'
      });
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Reset stats
app.post('/api/stats/reset', (req, res) => {
  try {
    const defaultStats = {
      totalRequests: 0,
      geminiRequests: 0,
      groqRequests: 0,
      openrouterRequests: 0,
      fallbackRequests: 0,
      lastRoutedVia: 'None'
    };
    fs.writeFileSync(STATS_FILE, JSON.stringify(defaultStats, null, 2), 'utf8');
    res.json(defaultStats);
  } catch (error) {
    console.error('Error resetting stats:', error);
    res.status(500).json({ error: 'Failed to reset stats' });
  }
});

// 3. Get all notebooks (metadata only)
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

// 4. Create a new notebook
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

// 5. Rename a notebook
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

// 6. Get a specific notebook's data (meta, chat history, notes)
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

// 7. Delete a notebook
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

// 8. Manually save notes edits
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

// 9. Chat API - Triggers LLM call, appends notes, saves chat history
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

    // Read current chat history
    let chatHistory = JSON.parse(fs.readFileSync(chatFile, 'utf8'));

    // Append user message
    const userMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    chatHistory.push(userMessage);

    // Read current notes for context
    const currentNotes = fs.readFileSync(notesFile, 'utf8');

    // Run LLM and notes extraction processes
    const { reply, notesToAppend } = await processAndAppendNotes({
      message,
      chatHistory,
      currentNotes,
      llmConfig,
    });

    // Save model response to chat
    const assistantMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
    };
    chatHistory.push(assistantMessage);

    // If we have notes to append, write them to notes.md
    let updatedNotes = currentNotes;
    if (notesToAppend && notesToAppend.trim() !== '') {
      const cleanNotesToAppend = notesToAppend.trim();
      updatedNotes = currentNotes + '\n\n' + cleanNotesToAppend + '\n';
      fs.writeFileSync(notesFile, updatedNotes, 'utf8');
    }

    // Save updated chat history
    fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2), 'utf8');

    res.json({
      reply,
      appendedNotes: notesToAppend || '',
      updatedNotes,
      chatHistory,
    });
  } catch (error) {
    console.error('Error in chat processing:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat request' });
  }
});

// Serve frontend build static files
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Route catch-all to SPA index.html
app.get('*', (req, res) => {
  const indexHtmlFile = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexHtmlFile)) {
    res.sendFile(indexHtmlFile);
  } else {
    res.status(404).send('Static frontend not built yet. Run "npm run build" first.');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
