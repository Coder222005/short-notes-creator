# 📚 StudyNotebook — AI Short Notes Creator

An elegant, local web application designed to simplify studying. Paste study materials, lecture transcripts, or study notes into the chat; **StudyNotebook** will conversationally tutor you, explain key concepts, and **automatically compile and append** structured study notes (definitions, lists, formulas) into a persistent, side-by-side Markdown document.

Powered by a unified local key vault that supports **Google Gemini**, **Groq**, and **OpenRouter** APIs with automatic rate-limit rotation and offline fallbacks.

---

## ✨ Features

* **Sleek Gemini-Inspired UI**: Premium dark mode design with glassmorphic cards, smooth sliding transitions, skeleton loaders, and interactive sidebar states.
* **Workspace Split Layout**:
  * **Left (Study Chat)**: Paste transcripts, ask questions, and chat with your tutor.
  * **Right (Notes Compiler)**: A rendered Markdown editor that compiles your notes in real-time. Supports manual edits, clipboard copies, and markdown downloads.
* **Single-Port Simplicity**: The entire application runs on port `3000` (serving both the React client and Express backend).
* **API Keys Vault**: Save your keys locally. StudyNotebook handles rate-limiting (429) and server errors (5xx) by automatically falling back to the next available healthy key in your vault.
* **Offline Fallback Mode**: Works immediately without any API keys. Uses basic rule-based NLP to extract vocabulary and highlights locally.

---

## 🚀 Quick Start

### Prerequisites
Make sure you have [Node.js (version 20+)](https://nodejs.org/) installed.

### Start the Application
To run the setup (installing dependencies) and start the server:
```bash
./start.sh
```
Once started, open:
🔗 **[http://localhost:3000](http://localhost:3000)**

### Stop the Application
To stop all processes and release port 3000:
```bash
./stop.sh
```

### View Application Logs
```bash
tail -f app.log
```

---

## ⚙️ Keys Vault Setup (Zero-Proxy)

1. Open StudyNotebook in your browser at [http://localhost:3000](http://localhost:3000).
2. Click **Settings** (gear icon in the bottom-left corner).
3. Select the **API Keys Vault** tab.
4. Paste your free-tier keys:
   * **Google Gemini API Key** (from Google AI Studio)
   * **Groq Cloud API Key** (from Groq Console)
   * **OpenRouter API Key** (from OpenRouter Settings)
5. Under the **Session Config** tab, select **Auto-Rotate** to enable automatic failovers across your keys, or choose a specific model (e.g. Gemini 2.5 Flash).
6. Click **Save & Apply**.

---

## 📂 Project Structure

```
short-notes-creator/
├── package.json         # Root scripts (setup, build, start, dev)
├── start.sh             # Combined setup, compile, and launch script
├── stop.sh              # Cleanup and port shutdown script
├── backend/
│   ├── server.js        # Express app (API + Static Assets delivery)
│   ├── services/
│   │   ├── llmService.js# Vault router & auto failover rotater
│   │   └── noteService.js# Prompts builder & JSON parser
│   └── data/
│       ├── keys.json    # Encrypted local keys vault (git-ignored)
│       └── notebooks/   # Notebook folders containing chat.json and notes.md
└── frontend/
    ├── src/             # React source code (App.jsx, index.css, components/)
    └── dist/            # Compiled static frontend assets
```

---

## 💾 Local Storage & Persistence

* Notebooks are stored locally as text files in `backend/data/notebooks/`.
* Each notebook folder contains:
  * `meta.json`: Notebook name and metadata.
  * `chat.json`: Conversations.
  * `notes.md`: Compiled Markdown study notes.
* You can back up or share your notebooks by copying these files!
