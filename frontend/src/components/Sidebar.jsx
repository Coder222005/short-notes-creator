import React, { useState } from 'react';

export default function Sidebar({
  notebooks,
  activeId,
  onSelectNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  onRenameNotebook,
  onOpenSettings,
  isCollapsed,
  setIsCollapsed
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleCreate = () => {
    const name = prompt("Enter notebook name:");
    if (name && name.trim() !== "") {
      onCreateNotebook(name.trim());
    }
  };

  const handleStartRename = (e, nb) => {
    e.stopPropagation();
    setEditingId(nb.id);
    setEditName(nb.name);
  };

  const handleSaveRename = (e, id) => {
    e.stopPropagation();
    if (editName.trim() !== '') {
      onRenameNotebook(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e, id, name) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}"? This will delete all chat history and notes.`)) {
      onDeleteNotebook(id);
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          {/* Warm book/notebook icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isCollapsed ? 0 : '8px', flexShrink: 0, color: 'var(--accent-color)' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {!isCollapsed && <span>StudyNotebook</span>}
        </div>
        <button className="toggle-sidebar-btn" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      <button className="new-notebook-btn" onClick={handleCreate}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New notebook</span>
      </button>

      <div className="notebooks-list-container">
        <h4 className="list-title">Recent</h4>
        {notebooks.length === 0 ? (
          <div className="sidebar-empty" style={{ padding: '12px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {!isCollapsed && "No notebooks yet"}
          </div>
        ) : (
          notebooks.map((nb) => {
            const isActive = nb.id === activeId;
            const isEditing = nb.id === editingId;

            return (
              <div
                key={nb.id}
                className={`notebook-item ${isActive ? 'active' : ''}`}
                onClick={() => !isEditing && onSelectNotebook(nb.id)}
              >
                <div className="notebook-item-left">
                  <svg className="notebook-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  {isEditing ? (
                    <input
                      type="text"
                      className="rename-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(e, nb.id);
                        if (e.key === 'Escape') handleCancelRename(e);
                      }}
                      autoFocus
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.85rem',
                        width: '100%',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span className="notebook-name">{nb.name}</span>
                  )}
                </div>

                {!isEditing && (
                  <div className="notebook-actions">
                    <button className="action-btn" onClick={(e) => handleStartRename(e, nb)} title="Rename">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button className="action-btn delete" onClick={(e) => handleDelete(e, nb.id, nb.name)} title="Delete">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="notebook-actions" style={{ opacity: 1 }}>
                    <button className="action-btn" onClick={(e) => handleSaveRename(e, nb.id)} title="Save">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button className="action-btn" onClick={handleCancelRename} title="Cancel">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <button className="footer-btn" onClick={onOpenSettings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
