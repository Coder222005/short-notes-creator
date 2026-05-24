import React from 'react';
import ChatPanel from './ChatPanel';
import NotesPanel from './NotesPanel';

export default function Workspace({
  activeNotebook,
  chatHistory,
  notesContent,
  onSendMessage,
  onSaveNotes,
  isLoadingChat,
  isLoadingNotes,
  llmConfig,
  onImportSuccess
}) {
  if (!activeNotebook) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <svg className="empty-state-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Notebook Selected
          </h2>
          <p style={{ maxWidth: '300px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Select an existing notebook from the sidebar or click "New notebook" to start compiling study material.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace">
      <ChatPanel
        chatHistory={chatHistory}
        onSendMessage={onSendMessage}
        isLoading={isLoadingChat}
        notebookName={activeNotebook.name}
        notebookId={activeNotebook.id}
        llmConfig={llmConfig}
        onImportSuccess={onImportSuccess}
      />
      <NotesPanel
        notesContent={notesContent}
        onSaveNotes={onSaveNotes}
        notebookName={activeNotebook.name}
        isLoadingNotes={isLoadingNotes}
      />
    </div>
  );
}
