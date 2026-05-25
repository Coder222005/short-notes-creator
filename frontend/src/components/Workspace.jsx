import React, { useState, useRef, useEffect } from 'react';
import ChatPanel from './ChatPanel';
import NotesPanel from './NotesPanel';

export default function Workspace({
  activeNotebook,
  chatCompile,
  chatStudy,
  chatMode,
  setChatMode,
  onClearChat,
  notesContent,
  onSendMessage,
  onSaveNotes,
  isLoadingChat,
  isLoadingNotes,
  llmConfig,
  onImportSuccess,
  onAcceptNotes,
  isNotesOpen
}) {
  const [notesWidth, setNotesWidth] = useState(40); // width in percentage
  const workspaceRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !workspaceRef.current) return;
      
      const workspaceRect = workspaceRef.current.getBoundingClientRect();
      const workspaceWidth = workspaceRect.width;
      
      // Calculate position relative to workspace right edge
      const relativeX = workspaceRect.right - e.clientX;
      let newWidthPct = (relativeX / workspaceWidth) * 100;
      
      // Enforce bounds: min 25%, max 70%
      if (newWidthPct < 25) newWidthPct = 25;
      if (newWidthPct > 70) newWidthPct = 70;
      
      setNotesWidth(newWidthPct);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.classList.remove('dragging-active');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.classList.add('dragging-active');
  };

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
    <div className="workspace" ref={workspaceRef}>
      <div className="workspace-chat-container" style={{ flex: 1, minWidth: 0, height: '100%' }}>
        <ChatPanel
          chatCompile={chatCompile}
          chatStudy={chatStudy}
          chatMode={chatMode}
          setChatMode={setChatMode}
          onClearChat={onClearChat}
          onSendMessage={onSendMessage}
          isLoading={isLoadingChat}
          notebookName={activeNotebook.name}
          notebookId={activeNotebook.id}
          llmConfig={llmConfig}
          onImportSuccess={onImportSuccess}
          onAcceptNotes={onAcceptNotes}
        />
      </div>

      {isNotesOpen && (
        <>
          <div 
            className="workspace-divider" 
            onMouseDown={handleMouseDown} 
            title="Drag to resize panels"
          />
          <div 
            className="workspace-notes-container" 
            style={{ width: `${notesWidth}%`, flexShrink: 0, minWidth: '250px', height: '100%' }}
          >
            <NotesPanel
              notesContent={notesContent}
              onSaveNotes={onSaveNotes}
              notebookName={activeNotebook.name}
              isLoadingNotes={isLoadingNotes}
            />
          </div>
        </>
      )}
    </div>
  );
}
