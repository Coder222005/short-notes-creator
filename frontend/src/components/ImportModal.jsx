import React, { useState } from 'react';

export default function ImportModal({ isOpen, onClose, notebookId, onImportSuccess, llmConfig }) {
  const [format, setFormat] = useState('raw_text'); // 'raw_text' | 'chatgpt_json' | 'gemini_json'
  const [textData, setTextData] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage('Uploading and parsing chat history...');

    try {
      let rawData = '';

      if (format === 'raw_text') {
        if (!textData.trim()) {
          alert('Please paste some conversation text first.');
          setIsLoading(false);
          return;
        }
        rawData = textData;
      } else {
        if (!selectedFile) {
          alert('Please select a JSON export file.');
          setIsLoading(false);
          return;
        }
        
        // Read file contents as text
        rawData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(selectedFile);
        });
      }

      setStatusMessage('Extracting study points in chunks... (This may take a moment to avoid context overflow)');

      const isDev = window.location.port === '5173' || window.location.port === '5174';
      const devPort = localStorage.getItem('studynotebook_gateway_port') || '3000';
      const base = isDev ? `http://localhost:${devPort}` : '';
      const importApiUrl = `${base}/api/notebooks/${notebookId}/import-chat`;

      const res = await fetch(importApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawData,
          format,
          llmConfig
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully imported ${data.importedCount} messages! Review the compiled notes in the chat panel and click "Add to Notes" to save them.`);
        onImportSuccess(data);
        onClose();
      } else {
        const err = await res.json();
        alert(`Import failed: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ fontFamily: 'Outfit', fontWeight: 600 }}>Import External Chat History</h3>
          <button className="action-btn" onClick={onClose} disabled={isLoading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleImport} style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Chat Source Format</label>
            <select
              className="form-select"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={isLoading}
            >
              <option value="raw_text">Raw Copy-Pasted Text (ChatGPT/Gemini)</option>
              <option value="chatgpt_json">ChatGPT Export (conversations.json file)</option>
              <option value="gemini_json">Gemini Export (Google Takeout JSON file)</option>
            </select>
          </div>

          {format === 'raw_text' ? (
            <div className="form-group">
              <label className="form-label">Paste Conversation Transcript</label>
              <textarea
                className="form-input"
                style={{ height: '240px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical', lineHeight: '1.4' }}
                placeholder={`Paste copy-pasted conversation here, e.g.:\n\nYou: Mitosis is cell division.\nGemini: Mitosis has 4 phases...\nYou: What is meiosis?`}
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="form-group" style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '24px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <input
                type="file"
                accept=".json"
                id="file-import-input"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isLoading}
              />
              <label htmlFor="file-import-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '2rem' }}>📁</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 500 }}>
                  {selectedFile ? selectedFile.name : 'Select JSON Export File'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Only .json files are supported
                </span>
              </label>
            </div>
          )}

          <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            ⚡ <strong>Chunked Context Guard:</strong> Long histories are processed in blocks of 8 messages. Notes are extracted sequentially so you don't hit the context window limit or lose critical points.
          </div>

          {isLoading && (
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(123, 164, 247, 0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="loading-shimmer-container" style={{ width: '20px', height: '20px' }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 500 }}>
                {statusMessage}
              </span>
            </div>
          )}

          <div className="modal-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Import & Extract Notes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
