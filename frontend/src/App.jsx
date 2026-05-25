import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import SettingsModal from './components/SettingsModal';

// In production, the frontend is served from the same Express server, so use relative paths.
// In dev mode (Vite on 5173/5174), point to the gateway. Supports port fallback via localStorage override.
const isDev = window.location.port === '5173' || window.location.port === '5174';
const DEV_GATEWAY_PORT = localStorage.getItem('studynotebook_gateway_port') || '3000';
const API_BASE = isDev ? `http://localhost:${DEV_GATEWAY_PORT}/api` : '/api';

export default function App() {
  const [notebooks, setNotebooks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeNotebookData, setActiveNotebookData] = useState(null);
  const [chatMode, setChatMode] = useState('compile');
  const [isNotesOpen, setIsNotesOpen] = useState(() => {
    const saved = localStorage.getItem('study_notebook_notes_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Settings state (persisted to localStorage)
  const [settings, setSettings] = useState({
    provider: 'fallback',
    apiKey: '',
    model: 'fallback'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load settings on startup
  useEffect(() => {
    const saved = localStorage.getItem('study_notebook_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    fetchNotebooks();
  }, []);

  // Fetch all notebooks
  const fetchNotebooks = async () => {
    setIsLoadingNotebooks(true);
    try {
      const res = await fetch(`${API_BASE}/notebooks`);
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data);
      }
    } catch (e) {
      console.error('Failed to fetch notebooks:', e);
    } finally {
      setIsLoadingNotebooks(false);
    }
  };

  // Select a notebook and fetch its detailed content
  const handleSelectNotebook = async (id) => {
    setActiveId(id);
    setIsLoadingNotes(true);
    try {
      const res = await fetch(`${API_BASE}/notebooks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveNotebookData(data);
      } else {
        console.error('Failed to fetch notebook data');
      }
    } catch (e) {
      console.error('Error fetching notebook detail:', e);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Create new notebook
  const handleCreateNotebook = async (name) => {
    try {
      const res = await fetch(`${API_BASE}/notebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const newNb = await res.json();
        await fetchNotebooks();
        // Automatically select the new notebook
        handleSelectNotebook(newNb.id);
      }
    } catch (e) {
      console.error('Failed to create notebook:', e);
    }
  };

  // Rename notebook
  const handleRenameNotebook = async (id, newName) => {
    try {
      const res = await fetch(`${API_BASE}/notebooks/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        await fetchNotebooks();
        // If active notebook renamed, update state meta
        if (activeId === id) {
          setActiveNotebookData(prev => ({
            ...prev,
            meta: { ...prev.meta, name: newName }
          }));
        }
      }
    } catch (e) {
      console.error('Failed to rename notebook:', e);
    }
  };

  // Delete notebook
  const handleDeleteNotebook = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/notebooks/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchNotebooks();
        if (activeId === id) {
          setActiveId(null);
          setActiveNotebookData(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete notebook:', e);
    }
  };

  // Send message to study chat
  const handleSendMessage = async (message) => {
    if (!activeId) return;
    setIsLoadingChat(true);

    // Optimistically update chat history in UI with user message
    const tempUserMsg = {
      id: `msg_temp_${Date.now()}`,
      role: 'user',
      content: message,
      mode: chatMode,
      timestamp: new Date().toISOString()
    };
    
    setActiveNotebookData(prev => {
      const field = chatMode === 'study' ? 'chatStudy' : 'chatCompile';
      return {
        ...prev,
        [field]: [...(prev[field] || []), tempUserMsg]
      };
    });

    try {
      const res = await fetch(`${API_BASE}/notebooks/${activeId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          llmConfig: settings,
          mode: chatMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Set actual server-side synced chats and notes
        setActiveNotebookData(prev => ({
          ...prev,
          chatCompile: data.chatCompile,
          chatStudy: data.chatStudy,
          notes: data.updatedNotes !== undefined ? data.updatedNotes : prev.notes
        }));
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process chat response');
      }
    } catch (e) {
      console.error('Error sending message:', e);
      alert(`Error: ${e.message}`);
      // Reload notebook to restore correct state
      handleSelectNotebook(activeId);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Save manual notes edits
  const handleSaveNotes = async (updatedNotes) => {
    if (!activeId) return;
    try {
      const res = await fetch(`${API_BASE}/notebooks/${activeId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes })
      });
      if (res.ok) {
        setActiveNotebookData(prev => ({
          ...prev,
          notes: updatedNotes
        }));
      }
    } catch (e) {
      console.error('Failed to save manual edits:', e);
    }
  };

  // Accept proposed notes draft
  const handleAcceptNotes = async (messageId, notes) => {
    if (!activeId) return;
    try {
      const res = await fetch(`${API_BASE}/notebooks/${activeId}/accept-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, notes })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveNotebookData(prev => ({
          ...prev,
          chatCompile: data.chatCompile,
          chatStudy: data.chatStudy,
          notes: data.updatedNotes
        }));
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to accept notes draft');
      }
    } catch (e) {
      console.error('Error accepting notes:', e);
      alert(`Error: ${e.message}`);
    }
  };

  // Clear active chat stream
  const handleClearChat = async () => {
    if (!activeId) return;
    const modeLabel = chatMode === 'study' ? 'Study & Quiz' : 'Compile Notes';
    if (!confirm(`Are you sure you want to clear the ${modeLabel} chat history? Your compiled notes will be kept.`)) return;

    try {
      const res = await fetch(`${API_BASE}/notebooks/${activeId}/clear-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: chatMode })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveNotebookData(prev => ({
          ...prev,
          chatCompile: data.chatCompile,
          chatStudy: data.chatStudy
        }));
      }
    } catch (e) {
      console.error('Error clearing chat history:', e);
    }
  };

  // Save settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('study_notebook_settings', JSON.stringify(newSettings));
  };

  const handleImportSuccess = (data) => {
    setActiveNotebookData(prev => ({
      ...prev,
      chatCompile: data.chatCompile,
      chatStudy: data.chatStudy,
      notes: data.updatedNotes
    }));
  };

  const activeNotebook = notebooks.find(n => n.id === activeId);

  return (
    <div className="app-container">
      <Sidebar
        notebooks={notebooks}
        activeId={activeId}
        onSelectNotebook={handleSelectNotebook}
        onCreateNotebook={handleCreateNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        onRenameNotebook={handleRenameNotebook}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="header-title-container">
            <span className="header-title">
              {activeNotebook ? activeNotebook.name : "Study Hub"}
            </span>
          </div>
          <div className="header-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeNotebook && (
              <button 
                className={`notes-toggle-btn ${isNotesOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsNotesOpen(prev => {
                    localStorage.setItem('study_notebook_notes_open', JSON.stringify(!prev));
                    return !prev;
                  });
                }}
                title={isNotesOpen ? "Hide Notes panel" : "Show Notes panel"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {isNotesOpen ? "Hide Notes" : "Show Notes"}
              </button>
            )}
            <button className="header-model-badge" onClick={() => setIsSettingsOpen(true)}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: settings.provider === 'fallback' ? '#f59e0b' : '#10b981'
              }}></span>
              {settings.provider === 'fallback' ? 'Offline Summarizer' : `${settings.provider.toUpperCase()} (${settings.model.split('/').pop()})`}
            </button>
          </div>
        </header>

        <Workspace
          activeNotebook={activeNotebook}
          chatCompile={activeNotebookData ? activeNotebookData.chatCompile : []}
          chatStudy={activeNotebookData ? activeNotebookData.chatStudy : []}
          chatMode={chatMode}
          setChatMode={setChatMode}
          onClearChat={handleClearChat}
          notesContent={activeNotebookData ? activeNotebookData.notes : ''}
          onSendMessage={handleSendMessage}
          onSaveNotes={handleSaveNotes}
          isLoadingChat={isLoadingChat}
          isLoadingNotes={isLoadingNotes}
          llmConfig={settings}
          onImportSuccess={handleImportSuccess}
          onAcceptNotes={handleAcceptNotes}
          isNotesOpen={isNotesOpen}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
