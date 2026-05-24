# 📚 StudyNotebook — AI Short Notes Creator

An elegant, local web application designed to simplify studying. Paste study materials, lecture transcripts, or study notes into the chat; **StudyNotebook** will conversationally tutor you, explain key concepts, and **provide proposed study notes** (definitions, lists, formulas) inside the chat bubble. Click **Add to Notes** to instantly merge them into your side-by-side **Notes Compiler**.

Powered by a unified local key vault that supports **Google Gemini**, **Groq**, and **OpenRouter** APIs with automatic rate-limit rotation and offline fallbacks.

---

## ✨ Features

* **Interactive Study Notes drafts**: Review notes drafts proposed by the AI first before merging them, allowing you to refine the notes in chat or click "Add to Notes" to commit.
* **Sleek Gemini-Inspired UI**: Premium dark mode design with glassmorphic cards, smooth sliding transitions, skeleton loaders, and interactive sidebar states.
* **Inline Subscript & Equation Rendering**: Chemical formulas and math equations (e.g. `$CO_2$`, `$H_2O$`, `$E=mc^2$`) render automatically with proper subscript (`<sub>`) and superscript (`<sup>`) layouts, hiding raw dollar signs.
* **Onboarding Sample Notebook**: Automatically seeds a Photosynthesis tutorial notebook on startup to showcase interactive note drafts and compiler editing.
* **Single-Port Simplicity**: The entire application runs on port `3000` (serving both the React client and Express backend).
* **API Keys Vault**: Save your keys locally. StudyNotebook handles rate-limiting (429) and server errors (5xx) by automatically falling back to the next available healthy key in your vault.
* **Offline Fallback Mode**: Works immediately without any API keys. Uses basic rule-based NLP to extract vocabulary and highlights locally.

---

## 🚀 Setup & Startup Instructions

StudyNotebook is cross-platform and fully supports **macOS**, **Linux**, and **Windows**. Make sure you have [Node.js (version 20+)](https://nodejs.org/) installed before starting.

### 🍎 Option A: macOS & Linux
1. Open your terminal in the project directory.
2. Make scripts executable (if needed):
   ```bash
   chmod +x start.sh stop.sh
   ```
3. Launch the application:
   ```bash
   ./start.sh
   ```
4. Access the web app at:
   🔗 **[http://localhost:3000](http://localhost:3000)**
5. Stop the application:
   ```bash
   ./stop.sh
   ```

### 💻 Option B: Windows
1. Open Command Prompt (`cmd.exe`) or PowerShell.
2. Navigate to the project folder.
3. Launch the application with the 1-click script:
   ```cmd
   start.bat
   ```
4. Access the web app at:
   🔗 **[http://localhost:3000](http://localhost:3000)**
5. Stop the application by closing the command prompt window running the process.

---

## ⚙️ Keys Vault Setup (FreeLLMAPI)

1. Open StudyNotebook in your browser at [http://localhost:3000](http://localhost:3000).
2. Click **Settings** (gear icon in the bottom-left corner).
3. Select the **Proxy Keys** tab.
4. Add your free-tier keys (e.g., Google Gemini, Groq, Cerebras, OpenRouter, Mistral). Use the links in the **Help Desk** on the right side to get keys.
5. Go to **Session Config** tab and select **FreeLLMAPI Local Proxy** (model: **Auto-Rotate**).
6. Click **Apply Configuration**.

---

## 🛠️ GitHub Repository Push Troubleshooting

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

## 📂 Project Structure

```
short-notes-creator/
├── package.json         # Root scripts (setup, build, start, dev)
├── start.sh             # macOS/Linux setup, build, and launch script
├── start.bat            # Windows setup, build, and launch script
├── stop.sh              # macOS/Linux port cleanup script
├── backend/
│   ├── server.js        # Node Gateway (serves React files & exposes chat/notes APIs)
│   └── data/
│       └── notebooks/   # Local storage for notebook chat logs and md notes
└── freellmapi/          # SQLite database, proxy routers, and cooldown services
```
