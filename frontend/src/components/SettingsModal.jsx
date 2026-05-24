import React, { useState, useEffect } from 'react';

const PROVIDER_DEFAULT_MODELS = {
  fallback: 'Offline Summary (No Key Required)',
  auto: 'Auto-Rotate Across Keys',
  openrouter: 'google/gemini-2.5-flash:free',
  gemini: 'gemini-1.5-flash',
  groq: 'llama-3.1-8b-instant'
};

const MODEL_OPTIONS = {
  auto: [
    { value: 'auto', label: 'Dynamic Rotation (Key Priority Chain)' }
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
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'vault' | 'analytics'
  const [provider, setProvider] = useState('fallback');
  const [model, setModel] = useState('fallback');

  // Vault state
  const [priority, setPriority] = useState(['gemini', 'groq', 'openrouter']);
  const [vaultKeys, setVaultKeys] = useState({
    gemini: '',
    groq: '',
    openrouter: ''
  });
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);

  // Analytics state
  const [stats, setStats] = useState({
    totalRequests: 0,
    geminiRequests: 0,
    groqRequests: 0,
    openrouterRequests: 0,
    fallbackRequests: 0,
    lastRoutedVia: 'None'
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(currentSettings.provider || 'fallback');
      setModel(currentSettings.model || 'fallback');
      fetchVaultKeys();
      if (activeTab === 'analytics') {
        fetchStats();
      }
    }
  }, [currentSettings, isOpen, activeTab]);

  const fetchVaultKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const keysApiUrl = window.location.port === '5174' ? 'http://localhost:3000/api/keys' : '/api/keys';
      const res = await fetch(keysApiUrl);
      if (res.ok) {
        const data = await res.json();
        setVaultKeys(data.keys || { gemini: '', groq: '', openrouter: '' });
        setPriority(data.priority || ['gemini', 'groq', 'openrouter']);
      }
    } catch (e) {
      console.error('Failed to load keys vault:', e);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const statsApiUrl = window.location.port === '5174' ? 'http://localhost:3000/api/stats' : '/api/stats';
      const res = await fetch(statsApiUrl);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleResetStats = async () => {
    if (confirm('Are you sure you want to reset all usage analytics?')) {
      try {
        const statsResetUrl = window.location.port === '5174' ? 'http://localhost:3000/api/stats/reset' : '/api/stats/reset';
        const res = await fetch(statsResetUrl, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Failed to reset stats:', e);
      }
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setModel(PROVIDER_DEFAULT_MODELS[newProvider]);
  };

  const handleKeyChange = (field, val) => {
    setVaultKeys(prev => ({ ...prev, [field]: val }));
  };

  // Shift priority ordering
  const movePriority = (index, direction) => {
    const newPriority = [...priority];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newPriority.length) {
      const temp = newPriority[index];
      newPriority[index] = newPriority[targetIndex];
      newPriority[targetIndex] = temp;
      setPriority(newPriority);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 1. Save session config to client-side localStorage
      onSaveSettings({
        provider,
        apiKey: '',
        model
      });

      // 2. Save vault priority and keys to backend
      const keysApiUrl = window.location.port === '5174' ? 'http://localhost:3000/api/keys' : '/api/keys';
      const res = await fetch(keysApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority,
          keys: vaultKeys
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save keys vault to server');
      }

      onClose();
    } catch (err) {
      alert(`Error saving settings: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '580px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Settings Manager</h3>
          <button className="action-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', gap: '16px' }}>
          {['session', 'vault', 'analytics'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'session' ? 'Session Config' : tab === 'vault' ? 'API Keys Vault' : 'Usage Analytics'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {activeTab === 'session' && (
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
                  🔄 <strong>Auto-Rotate Mode</strong> will query keys in your Vault in priority order. If one fails or hits rate limits, it automatically rotates to the next available healthy key. Configure vault order in the next tab!
                </div>
              )}

              {provider === 'fallback' && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(123, 164, 247, 0.05)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  💡 <strong>Offline Mode</strong> compiles notes locally using syntax rules. Save API keys in the Vault tab to enable full conversational study features.
                </div>
              )}
            </div>
          )}

          {activeTab === 'vault' && (
            <div>
              {isLoadingKeys ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>Loading Vault keys...</div>
              ) : (
                <div>
                  <div style={{ marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    🔑 Keys are saved locally on your computer in `backend/data/keys.json`. They are never sent to third-party endpoints.
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Google Gemini API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={vaultKeys.gemini || ''}
                      onChange={(e) => handleKeyChange('gemini', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Groq Cloud API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="gsk_..."
                      value={vaultKeys.groq || ''}
                      onChange={(e) => handleKeyChange('groq', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">OpenRouter API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="sk-or-..."
                      value={vaultKeys.openrouter || ''}
                      onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                    />
                  </div>

                  {/* Priority Chain Manager */}
                  <div style={{ marginTop: '24px' }}>
                    <label className="form-label">Key Priority Chain (Auto-Rotate Order)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {priority.map((prov, index) => {
                        const hasKey = vaultKeys[prov] && vaultKeys[prov].trim() !== '';
                        return (
                          <div
                            key={prov}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'var(--bg-tertiary)',
                              padding: '10px 16px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: hasKey ? '#10b981' : '#6b7280'
                              }} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 500, textTransform: 'capitalize' }}>
                                {prov === 'openrouter' ? 'OpenRouter' : prov === 'gemini' ? 'Google Gemini' : 'Groq API'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {hasKey ? '(Ready)' : '(Not Configured)'}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => movePriority(index, -1)}
                                disabled={index === 0}
                                style={{ opacity: index === 0 ? 0.3 : 1 }}
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => movePriority(index, 1)}
                                disabled={index === priority.length - 1}
                                style={{ opacity: index === priority.length - 1 ? 0.3 : 1 }}
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              {isLoadingStats ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>Loading Analytics stats...</div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total API Requests
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: '4px', fontFamily: 'Outfit' }}>
                        {stats.totalRequests || 0}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Last Active Provider
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '12px', color: 'var(--accent-color)' }}>
                        {stats.lastRoutedVia || 'None'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 className="form-label" style={{ marginBottom: '4px' }}>Query distribution</h4>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <span>Google Gemini Requests</span>
                      <strong>{stats.geminiRequests || 0}</strong>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <span>Groq API Requests</span>
                      <strong>{stats.groqRequests || 0}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <span>OpenRouter Requests</span>
                      <strong>{stats.openrouterRequests || 0}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <span>Offline Fallback Requests</span>
                      <strong>{stats.fallbackRequests || 0}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleResetStats}
                    style={{ marginTop: '24px', width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                  >
                    Reset Analytics Data
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {activeTab !== 'analytics' && (
              <button type="submit" className="btn btn-primary" disabled={isLoadingKeys}>
                Save & Apply
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
