import React, { useState, useEffect } from 'react';

const PLATFORM_MAP = {
  google: 'Google Gemini',
  groq: 'Groq Cloud',
  cerebras: 'Cerebras Systems',
  sambanova: 'SambaNova Systems',
  nvidia: 'NVIDIA NIM',
  mistral: 'Mistral AI',
  openrouter: 'OpenRouter',
  github: 'GitHub Models',
  cohere: 'Cohere',
  cloudflare: 'Cloudflare Workers AI',
  zhipu: 'Z.ai (Zhipu)',
  huggingface: 'HuggingFace Inference',
  ollama: 'Ollama (Local)',
  kilo: 'Kilo',
  pollinations: 'Pollinations.ai',
  llm7: 'LLM7'
};

export default function SettingsModal({ isOpen, onClose, currentSettings, onSaveSettings }) {
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'keys' | 'fallback' | 'analytics' | 'unified'
  const [provider, setProvider] = useState('fallback');
  const [model, setModel] = useState('auto');

  // API Lists and States
  const [modelsList, setModelsList] = useState([]);
  const [keysList, setKeysList] = useState([]);
  const [fallbackChain, setFallbackChain] = useState([]);
  const [unifiedApiKey, setUnifiedApiKey] = useState('');
  
  // Form input states for adding a key
  const [newKeyPlatform, setNewKeyPlatform] = useState('google');
  const [newKeyVal, setNewKeyVal] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);

  // Analytics states
  const [analyticsRange, setAnalyticsRange] = useState('7d');
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsByModel, setAnalyticsByModel] = useState([]);
  const [analyticsByPlatform, setAnalyticsByPlatform] = useState([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Key testing states
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResult, setTestResult] = useState({});

  // Test Chat Playground States
  const [playgroundPlatform, setPlaygroundPlatform] = useState('auto');
  const [playgroundMessage, setPlaygroundMessage] = useState('hi');
  const [playgroundResult, setPlaygroundResult] = useState('');
  const [isSendingPlayground, setIsSendingPlayground] = useState(false);
  const [playgroundStatus, setPlaygroundStatus] = useState(''); // 'success' | 'error' | ''

  const [isLoading, setIsLoading] = useState(false);

  // Helper to resolve proxy endpoint address
  const getUrl = (subpath) => {
    const isDev = window.location.port === '5173' || window.location.port === '5174';
    const base = isDev ? 'http://localhost:3000' : '';
    return `${base}/proxy-api${subpath}`;
  };

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(currentSettings.provider || 'fallback');
      setModel(currentSettings.model || 'auto');
      fetchAllData();
    }
  }, [isOpen, currentSettings]);

  // Auto-correct model if provider is freellmapi but model is fallback or custom
  useEffect(() => {
    if (provider === 'freellmapi' && (model === 'fallback' || model === 'custom')) {
      setModel('auto');
    }
  }, [provider, model]);

  // Refetch analytics when range or tab changes
  useEffect(() => {
    if (isOpen && activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [isOpen, activeTab, analyticsRange]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchModels(),
        fetchKeys(),
        fetchFallbackChain(),
        fetchUnifiedKey()
      ]);
    } catch (e) {
      console.error('Failed to load proxy settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(getUrl('/models'));
      if (res.ok) {
        const data = await res.json();
        setModelsList(data);
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch(getUrl('/keys'));
      if (res.ok) {
        const data = await res.json();
        setKeysList(data);
      }
    } catch (e) {
      console.error('Failed to load keys:', e);
    }
  };

  const fetchFallbackChain = async () => {
    try {
      const res = await fetch(getUrl('/fallback'));
      if (res.ok) {
        const data = await res.json();
        // Sort by priority ASC
        data.sort((a, b) => a.priority - b.priority);
        setFallbackChain(data);
      }
    } catch (e) {
      console.error('Failed to load fallback chain:', e);
    }
  };

  const fetchUnifiedKey = async () => {
    try {
      const res = await fetch(getUrl('/settings/api-key'));
      if (res.ok) {
        const data = await res.json();
        setUnifiedApiKey(data.apiKey);
      }
    } catch (e) {
      console.error('Failed to load unified key:', e);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const [summaryRes, modelRes, platformRes] = await Promise.all([
        fetch(getUrl(`/analytics/summary?range=${analyticsRange}`)),
        fetch(getUrl(`/analytics/by-model?range=${analyticsRange}`)),
        fetch(getUrl(`/analytics/by-platform?range=${analyticsRange}`))
      ]);

      if (summaryRes.ok) setAnalyticsSummary(await summaryRes.json());
      if (modelRes.ok) setAnalyticsByModel(await modelRes.json());
      if (platformRes.ok) setAnalyticsByPlatform(await platformRes.json());
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Key operations
  const handleAddKey = async (e) => {
    e.preventDefault();
    if (!newKeyVal.trim()) return;

    setIsAddingKey(true);
    try {
      const res = await fetch(getUrl('/keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: newKeyPlatform,
          key: newKeyVal.trim(),
          label: newKeyLabel.trim() || undefined
        })
      });

      if (res.ok) {
        setNewKeyVal('');
        setNewKeyLabel('');
        await fetchKeys();
        await fetchModels(); // Reload key counts
      } else {
        const err = await res.json();
        alert(`Error: ${err.error?.message || 'Failed to add key'}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleToggleKey = async (keyId, currentEnabled) => {
    try {
      const res = await fetch(getUrl(`/keys/${keyId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        await fetchKeys();
        await fetchFallbackChain(); // Re-fetch since key counts update
      }
    } catch (e) {
      console.error('Failed to toggle key:', e);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const res = await fetch(getUrl(`/keys/${keyId}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchKeys();
        await fetchModels();
        await fetchFallbackChain();
      }
    } catch (e) {
      console.error('Failed to delete key:', e);
    }
  };

  const handleTestKey = async (key) => {
    setTestingKeyId(key.id);
    setTestResult(prev => ({ 
      ...prev, 
      [key.id]: { status: 'testing', message: 'Testing connection...' } 
    }));
    
    try {
      // Find a matching model for the platform to route correctly
      const matchingModel = modelsList.find(m => m.platform === key.platform);
      const testModelId = matchingModel ? matchingModel.modelId : 'auto';
      
      const isDev = window.location.port === '5173' || window.location.port === '5174';
      const base = isDev ? 'http://localhost:3000' : '';
      const chatCompletionsUrl = `${base}/v1/chat/completions`;

      const res = await fetch(chatCompletionsUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: testModelId,
          messages: [{ role: 'user', content: 'Say "OK"' }],
          max_tokens: 5
        })
      });

      if (res.ok) {
        setTestResult(prev => ({
          ...prev,
          [key.id]: { status: 'success', message: 'Success' }
        }));
      } else {
        const errText = await res.text();
        let parsedErr;
        try {
          parsedErr = JSON.parse(errText);
        } catch(e) {}
        const errMsg = parsedErr?.error?.message || errText || `Status ${res.status}`;
        setTestResult(prev => ({
          ...prev,
          [key.id]: { status: 'error', message: errMsg }
        }));
      }
    } catch (e) {
      setTestResult(prev => ({
        ...prev,
        [key.id]: { status: 'error', message: e.message }
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleSendPlaygroundMessage = async (e) => {
    e.preventDefault();
    if (!playgroundMessage.trim()) return;

    setIsSendingPlayground(true);
    setPlaygroundStatus('');
    setPlaygroundResult('Routing request and waiting for response...');

    try {
      let testModelId = 'auto';
      if (playgroundPlatform !== 'auto') {
        const matchingModel = modelsList.find(m => m.platform === playgroundPlatform);
        testModelId = matchingModel ? matchingModel.modelId : 'auto';
      }

      const isDev = window.location.port === '5173' || window.location.port === '5174';
      const base = isDev ? 'http://localhost:3000' : '';
      const chatCompletionsUrl = `${base}/v1/chat/completions`;

      const res = await fetch(chatCompletionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: testModelId,
          messages: [{ role: 'user', content: playgroundMessage.trim() }],
          temperature: 0.3
        })
      });

      const bodyText = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch (err) {}

      if (res.ok) {
        setPlaygroundStatus('success');
        if (parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
          setPlaygroundResult(parsed.choices[0].message.content);
        } else {
          setPlaygroundResult(bodyText);
        }
      } else {
        setPlaygroundStatus('error');
        const errMsg = parsed?.error?.message || bodyText || `Status ${res.status}`;
        setPlaygroundResult(`API Error (Status ${res.status}):\n${errMsg}`);
      }
    } catch (err) {
      setPlaygroundStatus('error');
      setPlaygroundResult(`Network Connection Error:\n${err.message}`);
    } finally {
      setIsSendingPlayground(false);
    }
  };

  // Fallback operations
  const handleSortFallback = async (preset) => {
    try {
      const res = await fetch(getUrl(`/fallback/sort/${preset}`), {
        method: 'POST'
      });
      if (res.ok) {
        await fetchFallbackChain();
      }
    } catch (e) {
      console.error('Failed to sort fallback chain:', e);
    }
  };

  const handleToggleFallbackModel = async (modelDbId, currentEnabled) => {
    const updated = fallbackChain.map(item => {
      if (item.modelDbId === modelDbId) {
        return { ...item, enabled: !currentEnabled };
      }
      return item;
    });

    try {
      const res = await fetch(getUrl('/fallback'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated.map(item => ({
          modelDbId: item.modelDbId,
          priority: item.priority,
          enabled: item.enabled
        })))
      });
      if (res.ok) {
        await fetchFallbackChain();
      }
    } catch (e) {
      console.error('Failed to update fallback model toggle:', e);
    }
  };

  const handleMoveFallbackItem = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fallbackChain.length) return;

    const list = [...fallbackChain];
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;

    // Recalculate priority ranking
    const updated = list.map((item, idx) => ({
      modelDbId: item.modelDbId,
      priority: idx + 1,
      enabled: item.enabled
    }));

    try {
      const res = await fetch(getUrl('/fallback'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setFallbackChain(list.map((item, idx) => ({ ...item, priority: idx + 1 })));
      }
    } catch (e) {
      console.error('Failed to update priority:', e);
    }
  };

  // Rotate Unified API Key
  const handleRegenerateUnifiedKey = async () => {
    if (!confirm('Are you sure you want to regenerate the Unified API key? All applications using it will need to be updated.')) return;
    try {
      const res = await fetch(getUrl('/settings/api-key/regenerate'), {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setUnifiedApiKey(data.apiKey);
        alert('Unified API Key rotated successfully.');
      }
    } catch (e) {
      console.error('Failed to rotate unified key:', e);
    }
  };

  // Save Config
  const handleApplyConfig = (e) => {
    e.preventDefault();
    let resolvedModel = model;
    if (provider === 'freellmapi' && (resolvedModel === 'fallback' || resolvedModel === 'custom')) {
      resolvedModel = 'auto';
    }
    onSaveSettings({
      provider,
      apiKey: '',
      model: provider === 'fallback' ? 'fallback' : resolvedModel
    });
    onClose();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '850px', maxHeight: '90vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="modal-title" style={{ fontFamily: 'Outfit', fontWeight: 600 }}>FreeLLMAPI Control Center</h3>
            <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(123, 164, 247, 0.1)', color: 'var(--accent-color)', padding: '3px 8px', borderRadius: '100px', fontWeight: 600 }}>
              v4.0 (Unified)
            </span>
          </div>
          <button className="action-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', gap: '8px', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.01)' }}>
          {[
            { id: 'session', label: 'Session Config', icon: '⚙️' },
            { id: 'keys', label: 'Proxy Keys', icon: '🔑' },
            { id: 'fallback', label: 'Fallback Chain', icon: '🔄' },
            { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'unified', label: 'Unified Key', icon: '🔐' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '14px 16px',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* TAB 1: Session Config */}
          {activeTab === 'session' && (
            <form onSubmit={handleApplyConfig}>
              <div className="form-group">
                <label className="form-label">Study LLM Provider</label>
                <select
                  className="form-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="freellmapi">FreeLLMAPI Local Proxy (Recommended)</option>
                  <option value="fallback">Offline Summarizer (Rule-Based Fallback)</option>
                </select>
              </div>

              {provider === 'freellmapi' && (
                <div className="form-group">
                  <label className="form-label">Model Endpoint</label>
                  <select
                    className="form-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="auto">Auto-Rotate (Uses Active Fallback Chain)</option>
                    {modelsList.map((m) => {
                      const hasKey = m.keyCount > 0;
                      return (
                        <option key={m.modelId} value={m.modelId}>
                          {m.displayName} ({PLATFORM_MAP[m.platform] || m.platform}) {hasKey ? `· ${m.keyCount} Key(s)` : ' · [No Keys]'}
                        </option>
                      );
                    })}
                  </select>
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    💡 Selecting a specific model targets it directly. Selecting <strong>Auto-Rotate</strong> leverages the full key fallback priority list and auto-recovers from rate limits.
                  </div>
                </div>
              )}

              {provider === 'fallback' && (
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(245, 158, 11, 0.05)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  ⚠️ Offline Summarizer mode parses text patterns on your device using basic syntax rules. To activate conversational study assistants with state-of-the-art LLMs, configure keys under the <strong>Proxy Keys</strong> tab and select the <strong>FreeLLMAPI Local Proxy</strong>.
                </div>
              )}

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Configuration</button>
              </div>
            </form>
          )}

          {/* TAB 2: Proxy Keys */}
          {activeTab === 'keys' && (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Form */}
                <form onSubmit={handleAddKey} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.01)', marginBottom: '20px' }}>
                  <h4 style={{ fontFamily: 'Outfit', fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Add New Key</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.5fr auto', gap: '12px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Platform</label>
                      <select
                        className="form-select"
                        style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                        value={newKeyPlatform}
                        onChange={(e) => setNewKeyPlatform(e.target.value)}
                      >
                        {Object.entries(PLATFORM_MAP).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>API Key</label>
                      <input
                        type="password"
                        className="form-input"
                        style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                        placeholder="Paste key here"
                        value={newKeyVal}
                        onChange={(e) => setNewKeyVal(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Label (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                        placeholder="My Gemini Key"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }} disabled={isAddingKey}>
                      {isAddingKey ? 'Adding...' : 'Add Key'}
                    </button>
                  </div>
                </form>

                {/* Table */}
                <h4 style={{ fontFamily: 'Outfit', fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>Configured API Keys ({keysList.length})</h4>
                
                {keysList.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No keys added yet. Add a key or view details in the Help Desk.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 16px' }}>Platform</th>
                          <th style={{ padding: '10px 16px' }}>Label</th>
                          <th style={{ padding: '10px 16px' }}>Key</th>
                          <th style={{ padding: '10px 16px' }}>Status</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Enabled</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Diagnostics</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keysList.map((k) => {
                          const statusColors = {
                            healthy: '#10b981',
                            rate_limited: '#f59e0b',
                            invalid: '#ef4444',
                            unknown: '#6b7280',
                            error: '#ef4444'
                          };
                          const statusColor = statusColors[k.status] || '#6b7280';
                          return (
                            <tr key={k.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 500, textTransform: 'capitalize' }}>
                                {PLATFORM_MAP[k.platform] || k.platform}
                              </td>
                              <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                                {k.label || '—'}
                              </td>
                              <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                                {k.maskedKey}
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor }} />
                                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{k.status}</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={k.enabled}
                                  onChange={() => handleToggleKey(k.id, k.enabled)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                {testResult[k.id] ? (
                                  <span style={{ 
                                    fontSize: '0.74rem', 
                                    color: testResult[k.id].status === 'success' ? '#10b981' : testResult[k.id].status === 'testing' ? 'var(--text-muted)' : '#ef4444',
                                    fontWeight: 500
                                  }}>
                                    {testResult[k.id].status === 'testing' ? '⏳ Testing...' : testResult[k.id].status === 'success' ? '✅ Working' : `❌ Error`}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.72rem', borderColor: 'rgba(123, 164, 247, 0.2)', color: 'var(--accent-color)' }}
                                    onClick={() => handleTestKey(k)}
                                    disabled={testingKeyId !== null}
                                  >
                                    ⚡ Test Key
                                  </button>
                                )}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="action-btn delete"
                                  onClick={() => handleDeleteKey(k.id)}
                                  style={{ margin: '0 auto' }}
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Test Chat Playground */}
                <div style={{ marginTop: '24px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px', backgroundColor: 'rgba(255,255,255,0.015)' }}>
                  <h4 style={{ fontFamily: 'Outfit', fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚡</span> Key Diagnostics & Test Chat Playground
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                    Type a message below to test connection health, model routing, and see response outputs in real-time.
                  </p>

                  <form onSubmit={handleSendPlaygroundMessage}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr auto', gap: '12px', alignItems: 'flex-end', marginBottom: '14px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Platform Key</label>
                        <select
                          className="form-select"
                          style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                          value={playgroundPlatform}
                          onChange={(e) => setPlaygroundPlatform(e.target.value)}
                        >
                          <option value="auto">Auto-Rotate (First Available)</option>
                          {keysList.map(k => (
                            <option key={k.id} value={k.platform}>
                              {PLATFORM_MAP[k.platform] || k.platform} ({k.label || 'no label'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Test Chat Message</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                          placeholder="e.g. hi, suggest best method"
                          value={playgroundMessage}
                          onChange={(e) => setPlaygroundMessage(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '10px 20px', fontSize: '0.85rem', minWidth: '130px' }}
                        disabled={isSendingPlayground}
                      >
                        {isSendingPlayground ? 'Sending...' : 'Send Test Chat'}
                      </button>
                    </div>
                  </form>

                  {playgroundResult && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: `1px solid ${playgroundStatus === 'success' ? 'rgba(16, 185, 129, 0.2)' : playgroundStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)'}`,
                      backgroundColor: playgroundStatus === 'success' ? 'rgba(16, 185, 129, 0.02)' : playgroundStatus === 'error' ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-tertiary)'
                    }}>
                      <div style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        color: playgroundStatus === 'success' ? '#10b981' : playgroundStatus === 'error' ? '#ef4444' : 'var(--text-muted)',
                        marginBottom: '6px'
                      }}>
                        {playgroundStatus === 'success' ? 'Response Output' : playgroundStatus === 'error' ? 'Diagnostic Error' : 'Status'}
                      </div>
                      <pre style={{ 
                        margin: 0, 
                        fontSize: '0.82rem', 
                        whiteSpace: 'pre-wrap', 
                        fontFamily: 'monospace', 
                        color: playgroundStatus === 'error' ? '#ef4444' : 'var(--text-secondary)',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        lineHeight: 1.45
                      }}>
                        {playgroundResult}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Help Desk */}
              <div style={{ width: '280px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', flexShrink: 0, overflowY: 'auto', maxHeight: '530px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontFamily: 'Outfit', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔗</span> API Key Help Desk
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Generous free-tiers are available. Click links to sign up and get keys:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'Google Gemini', url: 'https://aistudio.google.com/', desc: 'Click "Get API Key" in Google AI Studio.' },
                    { name: 'Groq Cloud', url: 'https://console.groq.com/keys', desc: 'Generate key under "API Keys" page.' },
                    { name: 'Cerebras Cloud', url: 'https://cloud.cerebras.ai/', desc: 'Ultra-fast inference (Llama/Qwen).' },
                    { name: 'SambaNova Cloud', url: 'https://cloud.sambanova.ai/', desc: 'Free high-speed DeepSeek V3.' },
                    { name: 'OpenRouter', url: 'https://openrouter.ai/keys', desc: 'Access 20+ free-tier LLM models.' },
                    { name: 'Mistral AI', url: 'https://console.mistral.ai/', desc: 'Go to API Keys (includes free trial credit).' },
                    { name: 'Cohere', url: 'https://dashboard.cohere.com/api-keys', desc: 'Generate a Trial API key.' },
                    { name: 'GitHub Models', url: 'https://github.com/settings/tokens', desc: 'Create Personal Access Token (classic, no scopes).' },
                    { name: 'Cloudflare Workers AI', url: 'https://dash.cloudflare.com/', desc: 'Generate Workers AI API Token.' },
                    { name: 'NVIDIA NIM', url: 'https://build.nvidia.com/', desc: 'Get free key on build catalog.' },
                    { name: 'Z.ai (Zhipu)', url: 'https://open.bigmodel.cn/', desc: 'Register to get keys for GLM-4.' },
                    { name: 'HuggingFace', url: 'https://huggingface.co/settings/tokens', desc: 'Create Read token for Inference API.' }
                  ].map((prov, i) => (
                    <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                      <a 
                        href={prov.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ 
                          color: 'var(--text-primary)', 
                          fontSize: '0.82rem', 
                          fontWeight: 600, 
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {prov.name} <span style={{ fontSize: '0.7rem' }}>↗</span>
                      </a>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.35 }}>
                        {prov.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Fallback Chain */}
          {activeTab === 'fallback' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  ⚙️ Sort the order of active model evaluations. FreeLLMAPI will check keys from top to bottom.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleSortFallback('intelligence')}>
                    🧠 Sort Intelligence
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleSortFallback('speed')}>
                    ⚡ Sort Speed
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleSortFallback('budget')}>
                    🪙 Sort Budget
                  </button>
                </div>
              </div>

              {fallbackChain.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading priority chain details...
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 16px', width: '60px' }}>Rank</th>
                        <th style={{ padding: '10px 16px' }}>Model Display Name</th>
                        <th style={{ padding: '10px 16px' }}>Platform</th>
                        <th style={{ padding: '10px 16px' }}>Budget</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center' }}>Provider keys</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center' }}>Enabled</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', width: '100px' }}>Priority Reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fallbackChain.map((item, index) => {
                        const hasKeys = item.keyCount > 0;
                        return (
                          <tr key={item.modelDbId} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: hasKeys ? 'transparent' : 'rgba(255,255,255,0.01)', opacity: hasKeys ? 1 : 0.6 }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                              {item.priority}
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                              {item.displayName}
                            </td>
                            <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>
                              {PLATFORM_MAP[item.platform] || item.platform}
                            </td>
                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                              {item.monthlyTokenBudget || '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', backgroundColor: hasKeys ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)', color: hasKeys ? '#10b981' : '#6b7280', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>
                                {item.keyCount} Active Key(s)
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={() => handleToggleFallbackModel(item.modelDbId, item.enabled)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => handleMoveFallbackItem(index, -1)}
                                  disabled={index === 0}
                                  style={{ opacity: index === 0 ? 0.3 : 1 }}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => handleMoveFallbackItem(index, 1)}
                                  disabled={index === fallbackChain.length - 1}
                                  style={{ opacity: index === fallbackChain.length - 1 ? 0.3 : 1 }}
                                >
                                  ▼
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Proxy Analytics */}
          {activeTab === 'analytics' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ fontFamily: 'Outfit', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Usage Breakdown</h4>
                
                <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  {['24h', '7d', '30d'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAnalyticsRange(r)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: analyticsRange === r ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                        color: analyticsRange === r ? '#000' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingAnalytics ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading analytics summary...
                </div>
              ) : (
                <div>
                  {/* Grid cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Requests</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'Outfit', marginTop: '4px' }}>
                        {analyticsSummary?.totalRequests || 0}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Success Rate</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'Outfit', marginTop: '4px', color: '#10b981' }}>
                        {analyticsSummary?.successRate ?? 100}%
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Cost Savings</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'Outfit', marginTop: '4px', color: 'var(--accent-color)' }}>
                        ${analyticsSummary?.estimatedCostSavings || '0.00'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Latency</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'Outfit', marginTop: '4px' }}>
                        {analyticsSummary?.avgLatencyMs || 0} ms
                      </div>
                    </div>

                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* Left: Models usage */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                        Requests by Model
                      </div>
                      {analyticsByModel.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No requests recorded.</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '8px 12px' }}>Model</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Requests</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Success %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsByModel.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.displayName}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.requests}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#10b981' }}>{row.successRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Right: Platforms usage */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                        Requests by Provider
                      </div>
                      {analyticsByPlatform.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No requests recorded.</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '8px 12px' }}>Provider</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Requests</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Success %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsByPlatform.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 500, textTransform: 'capitalize' }}>
                                  {PLATFORM_MAP[row.platform] || row.platform}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.requests}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#10b981' }}>{row.successRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Unified Key */}
          {activeTab === 'unified' && (
            <div>
              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(123, 164, 247, 0.03)', marginBottom: '24px' }}>
                <h4 style={{ fontFamily: 'Outfit', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Unified API Key Vault</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Clients authenticate with the local FreeLLMAPI proxy using a single, secure token. Point your custom developer applications or third-party client libraries (e.g. OpenAI SDK, Continue, Cursor) to this instance.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Unified API Key</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={unifiedApiKey}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '0.88rem', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: '0 16px' }} onClick={() => copyToClipboard(unifiedApiKey)}>
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">API Endpoint</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value="http://localhost:3000/v1"
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '0.88rem', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: '0 16px' }} onClick={() => copyToClipboard('http://localhost:3000/v1')}>
                    📋 Copy
                  </button>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  🚀 This endpoint routes requests directly through port 3000 and maps to the local proxy backend automatically.
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '30px', paddingTop: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                <button type="button" className="btn btn-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={handleRegenerateUnifiedKey}>
                  🔄 Rotate / Regenerate Key
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
