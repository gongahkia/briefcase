import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { extractTextFromPDF } from './utils/pdfParser';
import { findCaseNames } from './utils/caseMatcher';
import './styles.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// FUA to add more sources
const SEARCH_SOURCES = [
  { id: 'lawnet', name: 'LawNet API', requiresAuth: true, description: 'Official LawNet database (requires API key)' },
  { id: 'commonlii', name: 'CommonLII', requiresAuth: false, description: 'Free Singapore cases from 2006+' },
  { id: 'singapore-courts', name: 'Singapore Courts', requiresAuth: false, description: 'Recent free judgments (last 3 months)' },
  { id: 'ogp', name: 'OGP Pair Search', requiresAuth: false, description: 'Government Supreme Court judgments' }
];

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setStoredValue = (newValue) => {
    try {
      setValue(newValue);
      window.localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [value, setStoredValue];
}

function App() {
  const [cases, setCases] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSource, setSelectedSource] = useLocalStorage('selected_source', 'commonlii');
  const [apiKey, setApiKey] = useLocalStorage('lawnet_api_key', '');
  const [serverConfig, setServerConfig] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configFromStorage, setConfigFromStorage] = useLocalStorage('briefcase_config', {});

  useEffect(() => {
    checkServerConfig();
  }, []);

  const checkServerConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const configStatus = await response.json();
      setServerConfig(configStatus);

      if (configStatus.configSource === 'none' && selectedSource === 'lawnet') {
        if (Object.keys(configFromStorage).length > 0) {
          await setServerConfigFromStorage();
        } else {
          setShowConfigDialog(true);
        }
      }
    } catch (error) {
      console.error('Failed to check server config:', error);
      setError(`Failed to connect to server: ${error.message}`);
    }
  };

  const setServerConfigFromStorage = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configFromStorage)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await checkServerConfig();
    } catch (error) {
      console.error('Failed to set config from storage:', error);
      setError(`Configuration error: ${error.message}`);
    }
  };

  const handleConfigSubmit = async (config) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      setConfigFromStorage(config);
      setShowConfigDialog(false);
      await checkServerConfig();
    } catch (error) {
      setError(`Configuration error: ${error.message}`);
    }
  };

  const onDrop = async (acceptedFiles) => {
    setLoading(true);
    setError('');
    setCases([]); 
    setSearchResults([]); 
    
    const file = acceptedFiles[0];
    
    try {
      console.log('Processing file:', file.name);
      let text = '';
      
      if (file.type === 'application/pdf') {
        console.log('Extracting text from PDF...');
        text = await extractTextFromPDF(file);
      } else if (file.type === 'text/plain') {
        console.log('Reading text file...');
        text = await file.text();
      } else {
        throw new Error('Unsupported file type');
      }
      
      console.log('Text extracted. Length:', text.length);
      const foundCases = findCaseNames(text);
      console.log('Identified cases:', foundCases);
      
      setCases(foundCases);
      
    } catch (error) {
      console.error('File processing error:', error);
      setError(`Processing error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1
  });

  const searchCases = async (caseName) => {
    const currentSource = SEARCH_SOURCES.find(s => s.id === selectedSource);
    
    if (currentSource.requiresAuth && !apiKey) {
      setShowApiDialog(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: caseName,
          source: selectedSource,
          apiKey: currentSource.requiresAuth ? apiKey : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      setSearchResults(prev => [
        ...prev.filter(r => r.searchTerm !== caseName),
        { 
          searchTerm: caseName, 
          source: selectedSource,
          sourceName: currentSource.name,
          results: data.results || [] 
        }
      ]);

    } catch (error) {
      setError(`Search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = (sourceId) => {
    setSelectedSource(sourceId);
    setShowSourceDialog(false);
    setSearchResults([]); // Clear previous results when switching sources
  };

  const getCurrentSource = () => SEARCH_SOURCES.find(s => s.id === selectedSource);

  return (
    <div className="app-container">
      <header>
        <h1><i className="fas fa-briefcase"></i> Briefcase Client</h1>
        <div className="header-controls">
          <div className="source-selector">
            <button onClick={() => setShowSourceDialog(true)} className="source-btn">
              <i className="fas fa-database"></i> {getCurrentSource()?.name}
              <i className="fas fa-chevron-down"></i>
            </button>
          </div>

          {serverConfig && selectedSource === 'lawnet' && (
            <div className="config-status">
              <span className={`status-indicator ${serverConfig.configSource !== 'none' ? 'configured' : 'unconfigured'}`}>
                <i className={`fas ${serverConfig.configSource !== 'none' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                {serverConfig.configSource === 'env_file' ? 'ENV File' :
                 serverConfig.configSource === 'dynamic' ? 'Configured' : 'Not Configured'}
              </span>
              {serverConfig.configSource !== 'env_file' && (
                <button onClick={() => setShowConfigDialog(true)} className="config-btn">
                  <i className="fas fa-cog"></i> Configure
                </button>
              )}
            </div>
          )}

          {getCurrentSource()?.requiresAuth && (
            apiKey ? (
              <div className="api-status">
                <i className="fas fa-key"></i> API Connected
                <button onClick={() => setApiKey('')} className="clear-btn">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowApiDialog(true)} className="auth-btn">
                <i className="fas fa-key"></i> Configure API Key
              </button>
            )
          )}
        </div>
      </header>

      <main>
        <div className="source-info">
          <i className="fas fa-info-circle"></i>
          <span>Current source: <strong>{getCurrentSource()?.name}</strong> - {getCurrentSource()?.description}</span>
        </div>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <i className="fas fa-cloud-upload-alt fa-3x"></i>
          <p>{isDragActive ? 'Drop file here' : 'Drag PDF/TXT file or click to browse'}</p>
        </div>

        {loading && <div className="loader"><i className="fas fa-spinner fa-spin"></i> Processing...</div>}
        {error && <div className="error-message"><i className="fas fa-exclamation-triangle"></i> {error}</div>}

        {cases.length > 0 && (
          <div className="results-section">
            <h2>Identified Cases:</h2>
            <div className="cases-list">
              {cases.map((caseName, index) => (
                <div key={index} className="case-item">
                  <div className="case-name">{caseName}</div>
                  <button onClick={() => searchCases(caseName)} className="search-btn">
                    <i className="fas fa-search"></i> Search {getCurrentSource()?.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="search-results">
            <h2>Search Results:</h2>
            {searchResults.map((result, index) => (
              <div key={index} className="result-group">
                <h3>
                  Results for: {result.searchTerm} 
                  <span className="source-tag">via {result.sourceName}</span>
                </h3>
                {result.results.length > 0 ? (
                  <div className="result-items">
                    {result.results.map((item, itemIndex) => (
                      <div key={itemIndex} className="result-item">
                        <h4>{item.title}</h4>
                        <p className="citation">{item.citation}</p>
                        <p className="summary">{item.summary}</p>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="view-case">
                            <i className="fas fa-external-link-alt"></i> View Full Case
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-results">No results found for this case.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showSourceDialog && (
        <SourceSelectionDialog
          sources={SEARCH_SOURCES}
          currentSource={selectedSource}
          onSelect={handleSourceChange}
          onClose={() => setShowSourceDialog(false)}
        />
      )}

      {showConfigDialog && (
        <ConfigurationDialog
          onSubmit={handleConfigSubmit}
          onClose={() => setShowConfigDialog(false)}
          initialConfig={configFromStorage}
        />
      )}

      {showApiDialog && (
        <ApiKeyDialog
          onSubmit={(key) => {
            setApiKey(key);
            setShowApiDialog(false);
          }}
          onClose={() => setShowApiDialog(false)}
        />
      )}
    </div>
  );
}

// Source Selection Dialog Component
function SourceSelectionDialog({ sources, currentSource, onSelect, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3><i className="fas fa-database"></i> Select Search Source</h3>
          <button onClick={onClose} className="close-btn">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="source-options">
            {sources.map((source) => (
              <div 
                key={source.id} 
                className={`source-option ${currentSource === source.id ? 'selected' : ''}`}
                onClick={() => onSelect(source.id)}
              >
                <div className="source-header">
                  <h4>{source.name}</h4>
                  {source.requiresAuth && <span className="auth-badge">Requires API Key</span>}
                </div>
                <p className="source-description">{source.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Configuration Dialog Component (unchanged)
function ConfigurationDialog({ onSubmit, onClose, initialConfig = {} }) {
  const [config, setConfig] = useState({
    LAWNET_CLIENT_ID: initialConfig.LAWNET_CLIENT_ID || '',
    LAWNET_CLIENT_SECRET: initialConfig.LAWNET_CLIENT_SECRET || '',
    LAWNET_REDIRECT_URI: initialConfig.LAWNET_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    LAWNET_TOKEN_URL: initialConfig.LAWNET_TOKEN_URL || 'https://auth.lawnet.sg/oauth/token',
    LAWNET_USER_INFO_URL: initialConfig.LAWNET_USER_INFO_URL || 'https://api.lawnet.sg/user/info',
    LAWNET_API_BASE_URL: initialConfig.LAWNET_API_BASE_URL || 'https://api.lawnet.sg'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(config);
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h3><i className="fas fa-cog"></i> LawNet Configuration</h3>
          <button onClick={onClose} className="close-btn">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Client ID:</label>
              <input
                type="text"
                value={config.LAWNET_CLIENT_ID}
                onChange={(e) => handleChange('LAWNET_CLIENT_ID', e.target.value)}
                placeholder="Your LawNet Client ID"
                required
              />
            </div>

            <div className="form-group">
              <label>Client Secret:</label>
              <input
                type="password"
                value={config.LAWNET_CLIENT_SECRET}
                onChange={(e) => handleChange('LAWNET_CLIENT_SECRET', e.target.value)}
                placeholder="Your LawNet Client Secret"
                required
              />
            </div>

            <div className="form-group">
              <label>Redirect URI:</label>
              <input
                type="url"
                value={config.LAWNET_REDIRECT_URI}
                onChange={(e) => handleChange('LAWNET_REDIRECT_URI', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Token URL:</label>
              <input
                type="url"
                value={config.LAWNET_TOKEN_URL}
                onChange={(e) => handleChange('LAWNET_TOKEN_URL', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>User Info URL:</label>
              <input
                type="url"
                value={config.LAWNET_USER_INFO_URL}
                onChange={(e) => handleChange('LAWNET_USER_INFO_URL', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>API Base URL:</label>
              <input
                type="url"
                value={config.LAWNET_API_BASE_URL}
                onChange={(e) => handleChange('LAWNET_API_BASE_URL', e.target.value)}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                <i className="fas fa-save"></i> Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// API Key Dialog Component (unchanged)
function ApiKeyDialog({ onSubmit, onClose }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (key.trim()) {
      onSubmit(key.trim());
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3><i className="fas fa-key"></i> API Key Configuration</h3>
          <button onClick={onClose} className="close-btn">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="apiKey">API Key:</label>
              <input
                id="apiKey"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your API key"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                <i className="fas fa-check"></i> Connect
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
