import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './ChatPanel';

export default function NotesPanel({
  notesContent,
  onSaveNotes,
  notebookName,
  isLoadingNotes
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Sync edits when raw content changes and we aren't editing
  useEffect(() => {
    if (!isEditing) {
      setEditedText(notesContent || '');
    }
  }, [notesContent, isEditing]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleSave = () => {
    onSaveNotes(editedText);
    setIsEditing(false);
    showToast("Notes saved successfully!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText);
    showToast("Copied to clipboard!");
  };

  const handleExport = () => {
    const blob = new Blob([editedText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${notebookName.toLowerCase().replace(/\s+/g, '_')}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded markdown file!");
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all notes in this notebook? This cannot be undone.")) {
      setEditedText(`# ${notebookName}\n\n`);
      onSaveNotes(`# ${notebookName}\n\n`);
      showToast("Notes cleared.");
    }
  };

  return (
    <div className="notes-panel">
      <div className="notes-header">
        <div className="notes-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="notes-header-title">Notes Compiler</span>
        </div>
        <div className="notes-header-actions">
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                Save
              </button>
            </>
          ) : (
            <>
              <button
                className="action-btn"
                onClick={() => setIsEditing(true)}
                title="Edit raw notes"
                style={{ padding: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button
                className="action-btn"
                onClick={handleCopy}
                title="Copy notes"
                style={{ padding: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button
                className="action-btn"
                onClick={handleExport}
                title="Download notes"
                style={{ padding: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                className="action-btn delete"
                onClick={handleClear}
                title="Clear notes"
                style={{ padding: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="notes-content-container">
        {isLoadingNotes ? (
          <div className="empty-state">
            <div className="loading-shimmer-container" style={{ width: '100%' }}>
              <div className="loading-shimmer-line long"></div>
              <div className="loading-shimmer-line short"></div>
              <div className="loading-shimmer-line medium"></div>
              <div className="loading-shimmer-line long"></div>
            </div>
          </div>
        ) : isEditing ? (
          <textarea
            className="notes-editor-textarea"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            placeholder="Edit your markdown notes directly here..."
          />
        ) : (!notesContent || notesContent.replace(/^#\s+.*$/m, '').trim() === '') ? (
          <div className="notes-empty-placeholder">
            <div className="notes-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Welcome to your study notebook!</h3>
            <p>Paste study materials in the chat or ask the assistant to compile notes, and they will appear here dynamically.</p>
          </div>
        ) : (
          <MarkdownRenderer text={notesContent} />
        )}
      </div>

      {toastMessage && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
