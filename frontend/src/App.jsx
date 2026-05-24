import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import SettingsModal from './components/SettingsModal';

const API_BASE = window.location.port === '5174' ? 'http://localhost:3000/api' : '/api';

export default function App() {
  const [notebooks, setNotebooks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeNotebookData, setActiveNotebookData] = useState(null);
  
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
      timestamp: new Date().toISOString()
    };
    
    setActiveNotebookData(prev => ({
      ...prev,
      chat: [...(prev.chat || []), tempUserMsg]
    }));

    try {
      const res = await fetch(`${API_BASE}/notebooks/${activeId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          llmConfig: settings
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Set actual server-side synced chat and notes
        setActiveNotebookData(prev => ({
          ...prev,
          chat: data.chatHistory,
          notes: data.updatedNotes
        }));
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process chat response');
      }
    } catch (e) {
      console.error('Error sending message:', e);
      // Remove optimistic message and show alert, or add error indicator
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

  // Save settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('study_notebook_settings', JSON.stringify(newSettings));
  };

  const handleImportSuccess = (data) => {
    setActiveNotebookData(prev => ({
      ...prev,
      chat: data.chatHistory,
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
          <button className="header-model-badge" onClick={() => setIsSettingsOpen(true)}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: settings.provider === 'fallback' ? '#f59e0b' : '#10b981'
            }}></span>
            {settings.provider === 'fallback' ? 'Offline Summarizer' : `${settings.provider.toUpperCase()} (${settings.model.split('/').pop()})`}
          </button>
        </header>

        <Workspace
          activeNotebook={activeNotebook}
          chatHistory={activeNotebookData ? activeNotebookData.chat : []}
          notesContent={activeNotebookData ? activeNotebookData.notes : ''}
          onSendMessage={handleSendMessage}
          onSaveNotes={handleSaveNotes}
          isLoadingChat={isLoadingChat}
          isLoadingNotes={isLoadingNotes}
          llmConfig={settings}
          onImportSuccess={handleImportSuccess}
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
