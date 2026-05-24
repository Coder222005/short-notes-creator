import React, { useState, useEffect } from 'react';

const PROVIDER_DEFAULT_MODELS = {
  fallback: 'Offline Summary (No Key Required)',
  auto: 'Auto-Rotate Across Keys',
  freellmapi: 'auto',
  openrouter: 'google/gemini-2.5-flash:free',
  gemini: 'gemini-1.5-flash',
  groq: 'llama-3.1-8b-instant'
};

const MODEL_OPTIONS = {
  auto: [
    { value: 'auto', label: 'Dynamic Rotation (Key Priority Chain)' }
  ],
  freellmapi: [
    { value: 'auto', label: 'Auto (Let FreeLLMAPI decide)' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' }
  ],
  openrouter: [
    { value: 'google/gemini-2.5-flash:free', label: 'Gemini 2.5 Flash (Free)' },
    { value: 'meta-llama/llama-3-8b-instruct:free', label: 'Llama 3 8B Instruct (Free)' },
    { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Instruct (Free)' },
    { value: 'openchat/openchat-7b:free', label: 'OpenChat 7B (Free)' }
  ],
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ],
  groq: [
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast, Free Tier)' },
    { value: 'llama3-70b-8192', label: 'Llama 3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }
  ],
  fallback: [
    { value: 'fallback', label: 'Rule-Based Local Synthesizer' }
  ]
};

export default function SettingsModal({ isOpen, onClose, currentSettings, onSaveSettings }) {
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'vault'
  const [provider, setProvider] = useState('fallback');
  const [model, setModel] = useState('fallback');

  // Vault keys loaded from server
  const [vaultKeys, setVaultKeys] = useState({
    gemini: '',
    groq: '',
    openrouter: '',
    freellmapi: ''
  });
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(currentSettings.provider || 'fallback');
      setModel(currentSettings.model || 'fallback');
      fetchVaultKeys();
    }
  }, [currentSettings, isOpen]);

  const fetchVaultKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const keysApiUrl = window.location.port === '5174' ? 'http://localhost:3000/api/keys' : '/api/keys';
      const res = await fetch(keysApiUrl);
      if (res.ok) {
        const data = await res.json();
        setVaultKeys(data);
      }
    } catch (e) {
      console.error('Failed to load keys vault:', e);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setModel(PROVIDER_DEFAULT_MODELS[newProvider]);
  };

  const handleKeyChange = (field, val) => {
    setVaultKeys(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 1. Save session config to client-side localStorage
      onSaveSettings({
        provider,
        apiKey: '', // Api keys are loaded server-side now!
        model
      });

      // 2. Save vault keys to backend
      const keysApiUrl = window.location.port === '5174' ? 'http://localhost:3000/api/keys' : '/api/keys';
      const res = await fetch(keysApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vaultKeys)
      });

      if (!res.ok) {
        throw new Error('Failed to save keys to server');
      }

      onClose();
    } catch (err) {
      alert(`Error saving settings: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '560px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Settings Manager</h3>
          <button className="action-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Custom Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', gap: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('session')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'session' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'session' ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Session Config
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'vault' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'vault' ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            API Keys Vault
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {activeTab === 'session' ? (
            <div>
              <div className="form-group">
                <label className="form-label">Study LLM Provider</label>
                <select
                  className="form-select"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  <option value="fallback">Offline (Fallback Mode - No Keys)</option>
                  <option value="auto">Auto-Rotate (Uses Keys Vault)</option>
                  <option value="freellmapi">FreeLLMAPI (Local proxy on port 3001)</option>
                  <option value="gemini">Google Gemini API (Direct)</option>
                  <option value="groq">Groq Cloud API (Direct)</option>
                  <option value="openrouter">OpenRouter (Direct)</option>
                </select>
              </div>

              {provider !== 'fallback' && (
                <div className="form-group">
                  <label className="form-label">Model Target</label>
                  <select
                    className="form-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {MODEL_OPTIONS[provider]?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value="custom">Custom Model Name...</option>
                  </select>

                  {model === 'custom' || !MODEL_OPTIONS[provider]?.find(m => m.value === model) ? (
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginTop: '8px' }}
                      placeholder="Enter custom model string (e.g. meta-llama/llama-3-8b)"
                      value={model === 'custom' ? '' : model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                    />
                  ) : null}
                </div>
              )}

              {provider === 'auto' && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(123, 164, 247, 0.05)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  🔄 <strong>Auto-Rotate Mode</strong> will attempt to call your vault keys sequentially. If one fails (e.g. rate limit), it seamlessly queries the next healthy key, ensuring uninterrupted study. Make sure you set your keys in the <strong>API Keys Vault</strong>.
                </div>
              )}

              {provider === 'fallback' && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(123, 164, 247, 0.05)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  💡 <strong>Offline Mode</strong> extracts key facts and vocabulary directly in the local backend using syntax heuristics. Add api keys in the vault tab to enable intelligent conversational tutoring.
                </div>
              )}
            </div>
          ) : (
            <div>
              {isLoadingKeys ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>Loading Vault keys...</div>
              ) : (
                <div>
                  <div style={{ marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    🔑 These keys are stored locally on your machine in `backend/data/keys.json`. They are never sent to external proxies.
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Google Gemini API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={vaultKeys.gemini}
                      onChange={(e) => handleKeyChange('gemini', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Groq Cloud API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="gsk_..."
                      value={vaultKeys.groq}
                      onChange={(e) => handleKeyChange('groq', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">OpenRouter API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="sk-or-..."
                      value={vaultKeys.openrouter}
                      onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">FreeLLMAPI Unified Key (Port 3001)</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="freellmapi-..."
                      value={vaultKeys.freellmapi || ''}
                      onChange={(e) => handleKeyChange('freellmapi', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoadingKeys}>
              Save & Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
