# StudyNotebook -- AI Short Notes Creator

An elegant, local web application designed to simplify studying. Paste study materials, lecture transcripts, or study notes into the chat; **StudyNotebook** will conversationally tutor you, explain key concepts, and **provide proposed study notes** (definitions, lists, formulas) inside the chat bubble. Click **Add to Notes** to instantly merge them into your side-by-side **Notes Compiler**.

Powered by a unified local key vault that supports **Google Gemini**, **Groq**, and **OpenRouter** APIs with automatic rate-limit rotation and offline fallbacks.

---

## Features

* **Interactive Study Notes drafts**: Review notes drafts proposed by the AI first before merging them, allowing you to refine the notes in chat or click "Add to Notes" to commit.
* **Sleek Gemini-Inspired UI**: Premium dark mode design with glassmorphic cards, smooth sliding transitions, skeleton loaders, and interactive sidebar states.
* **Inline Subscript & Equation Rendering**: Chemical formulas and math equations (e.g. `$CO_2$`, `$H_2O$`, `$E=mc^2$`) render automatically with proper subscript and superscript layouts.
* **Onboarding Sample Notebook**: Automatically seeds a Photosynthesis tutorial notebook on startup to showcase interactive note drafts and compiler editing.
* **Auto Port Fallback**: The gateway server automatically detects busy ports and falls back to the next available one (tries 3000, 3002, 3003, 3004).
* **API Keys Vault**: Save your keys locally. StudyNotebook handles rate-limiting (429) and server errors (5xx) by automatically falling back to the next available healthy key in your vault.
* **Offline Fallback Mode**: Works immediately without any API keys. Uses basic rule-based NLP to extract vocabulary and highlights locally.
* **Chat History Import**: Import conversations from ChatGPT (JSON export), Gemini (Google Takeout), or raw copy-pasted text. Notes are extracted in chunks to avoid context overflow.

---

## Setup & Startup Instructions

StudyNotebook is cross-platform and fully supports **macOS**, **Linux**, and **Windows**. Make sure you have [Node.js (version 20+)](https://nodejs.org/) installed before starting.

### Option A: macOS & Linux
1. Open your terminal in the project directory.
2. Make scripts executable (if needed):
   ```bash
   chmod +x start.sh stop.sh
   ```
3. Launch the application:
   ```bash
   ./start.sh
   ```
4. Access the web app at: **http://localhost:3000**
   > If port 3000 was busy, check the terminal output — it will display the actual port.
5. Stop the application:
   ```bash
   ./stop.sh
   ```

### Option B: Windows
1. Open Command Prompt (`cmd.exe`) or PowerShell.
2. Navigate to the project folder.
3. Launch the application with the 1-click script:
   ```cmd
   start.bat
   ```
4. Access the web app at: **http://localhost:3000**
   > If port 3000 was busy, the server automatically falls back to 3002, 3003, or 3004. Check the console output for the actual port.
5. Stop the application:
   ```cmd
   stop.bat
   ```
   Or simply close the command prompt window.

---

## Port Fallback Behavior

If port 3000 is already used by another application, StudyNotebook will automatically try the next available port in this order:

| Priority | Gateway Port | Description |
|----------|-------------|-------------|
| 1st      | 3000        | Default gateway port |
| 2nd      | 3002        | First fallback |
| 3rd      | 3003        | Second fallback |
| 4th      | 3004        | Third fallback |

The FreeLLMAPI proxy server uses port 3001 by default (falls back to 3005 or 3006 if busy).

The actual port is always displayed in the console when the server starts:
```
[OK] StudyNotebook Gateway running on http://localhost:3000
```

---

## Keys Vault Setup (FreeLLMAPI)

1. Open StudyNotebook in your browser at http://localhost:3000.
2. Click **Settings** (gear icon in the bottom-left corner).
3. Select the **Proxy Keys** tab.
4. Add your free-tier keys (e.g., Google Gemini, Groq, Cerebras, OpenRouter, Mistral). Use the links in the **Help Desk** on the right side to get keys.
5. Go to **Session Config** tab and select **FreeLLMAPI Local Proxy** (model: **Auto-Rotate**).
6. Click **Apply Configuration**.

### How to Get Free API Keys

| Provider | Where to Get Key | Free Tier |
|----------|-----------------|-----------|
| Google Gemini | https://aistudio.google.com/apikey | 15 RPM free |
| Groq | https://console.groq.com/keys | 30 RPM free |
| OpenRouter | https://openrouter.ai/keys | Free models available |
| Cerebras | https://cloud.cerebras.ai/ | Free tier available |
| Mistral | https://console.mistral.ai/api-keys | Free tier available |

---

## Testing Your API Connection

After adding keys, use the built-in **Test Chat Playground** to verify:

1. Go to **Settings** > **Proxy Keys** tab.
2. Click **Test Key** next to any saved key to run a quick health check.
3. Or go to **Settings** > **Test Chat** tab to send a test message and confirm full end-to-end functionality.

---

## GitHub Repository Push Troubleshooting

If you attempt to push the repository to GitHub and receive a `remote: Repository not found` or `fatal: repository not found` error, please follow these steps:

1. **Create the Repo on GitHub**:
   Log into your GitHub account (e.g., `Coder222005`) and create a **new public or private repository** named exactly `short-notes-creator`. Do *not* initialize it with a README or LICENSE.
2. **Push from your Terminal**:
   Once the repository exists on GitHub, run the following commands to authenticate and push:
   ```bash
   # If you use HTTPS credentials:
   git push -u origin main

   # If you use SSH keys:
   git remote set-url origin git@github.com:Coder222005/short-notes-creator.git
   git push -u origin main
   ```

---

## Project Structure

```
short-notes-creator/
├── package.json         # Root scripts (setup, build, start, dev)
├── start.sh             # macOS/Linux setup, build, and launch script
├── start.bat            # Windows setup, build, and launch script
├── stop.sh              # macOS/Linux port cleanup and stop script
├── stop.bat             # Windows port cleanup and stop script
├── README.md            # This file
├── backend/
│   ├── server.js        # Node Gateway (serves React + APIs, auto port fallback)
│   ├── services/
│   │   ├── llmService.js    # LLM routing (FreeLLMAPI proxy + offline fallback)
│   │   └── noteService.js   # Notes extraction and processing
│   └── data/
│       └── notebooks/   # Local storage for notebook chat logs and md notes
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React app with dynamic port detection
│   │   └── components/      # UI components (Sidebar, Workspace, ChatPanel, etc.)
│   └── dist/            # Production build (auto-generated)
└── freellmapi/          # SQLite key vault, proxy routers, and cooldown services
```
