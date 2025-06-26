import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { extractTextFromPDF } from './utils/pdfParser';
import { findCaseNames } from './utils/caseMatcher';
import './styles.css';

// Add this constant at the top - THIS IS THE KEY FIX
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Custom hook for localStorage with fallback
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
  const [lawnetResults, setLawnetResults] = useState([]);
  const [apiKey, setApiKey] = useLocalStorage('lawnet_api_key', '');
  const [serverConfig, setServerConfig] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configFromStorage, setConfigFromStorage] = useLocalStorage('briefcase_config', {});

  // Check server configuration on mount
  useEffect(() => {
    checkServerConfig();
  }, []);

  // FIXED: Use absolute URL with proper error handling
  const checkServerConfig = async () => {
    try {
      console.log('Checking server config at:', `${API_BASE_URL}/api/config/status`);
      
      const response = await fetch(`${API_BASE_URL}/api/config/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const configStatus = await response.json();
      setServerConfig(configStatus);

      // If no configuration exists, check localStorage or prompt user
      if (configStatus.configSource === 'none') {
        if (Object.keys(configFromStorage).length > 0) {
          // Try to use localStorage config
          await setServerConfigFromStorage();
        } else {
          // Prompt user for configuration
          setShowConfigDialog(true);
        }
      }
    } catch (error) {
      console.error('Failed to check server config:', error);
      setError(`Failed to connect to server: ${error.message}`);
    }
  };

  // FIXED: Use absolute URL
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

      console.log('✅ Configuration loaded from localStorage');
      await checkServerConfig();
    } catch (error) {
      console.error('Failed to set config from storage:', error);
      setError(`Configuration error: ${error.message}`);
    }
  };

  // FIXED: Use absolute URL with better error handling
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
      console.error('Configuration submit error:', error);
      setError(`Configuration error: ${error.message}`);
    }
  };

  const onDrop = async (acceptedFiles) => {
    setLoading(true);
    setError('');
    const file = acceptedFiles[0];

    try {
      const text = file.type === 'application/pdf'
        ? await extractTextFromPDF(file)
        : await file.text();

      const foundCases = findCaseNames(text);
      setCases(foundCases);
      setLawnetResults([]);

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

  // FIXED: Use absolute URL
  const queryLawNet = async (caseName) => {
    if (!apiKey) {
      setShowApiDialog(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Querying LawNet at:', `${API_BASE_URL}/api/cases/search`);
      
      const response = await fetch(`${API_BASE_URL}/api/cases/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: caseName,
          apiKey: apiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      setLawnetResults(prev => [
        ...prev.filter(r => r.searchTerm !== caseName),
        { searchTerm: caseName, results: data.results || [] }
      ]);

    } catch (error) {
      console.error('LawNet query error:', error);
      setError(`LawNet query failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearApiKey = () => {
    setApiKey('');
    setLawnetResults([]);
  };

  const clearConfiguration = async () => {
    setConfigFromStorage({});
    setShowConfigDialog(true);
  };

  return (
    <div className="app-container">
      <header>
        <h1><i className="fas fa-briefcase"></i> Briefcase</h1>
        <div className="header-controls">
          {serverConfig && (
            <div className="config-status">
              <span className={`status-indicator ${serverConfig.configSource !== 'none' ? 'configured' : 'unconfigured'}`}>
                <i className={`fas ${serverConfig.configSource !== 'none' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                {serverConfig.configSource === 'env_file' ? 'ENV File' :
                 serverConfig.configSource === 'dynamic' ? 'Configured' : 'Not Configured'}
              </span>
              {serverConfig.configSource !== 'env_file' && (
                <button onClick={clearConfiguration} className="config-btn">
                  <i className="fas fa-cog"></i> Configure
                </button>
              )}
            </div>
          )}

          {apiKey ? (
            <div className="api-status">
              <i className="fas fa-key"></i> API Connected
              <button onClick={clearApiKey} className="clear-btn">
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowApiDialog(true)} className="auth-btn">
              <i className="fas fa-key"></i> Configure LawNet API
            </button>
          )}
        </div>
      </header>

      <main>
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
                  <button onClick={() => queryLawNet(caseName)} className="search-btn">
                    <i className="fas fa-search"></i> Search LawNet
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {lawnetResults.length > 0 && (
          <div className="lawnet-results">
            <h2>LawNet Search Results:</h2>
            {lawnetResults.map((result, index) => (
              <div key={index} className="result-group">
                <h3>Results for: {result.searchTerm}</h3>
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

// Configuration Dialog Component
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

// API Key Dialog Component
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
          <h3><i className="fas fa-key"></i> LawNet API Key</h3>
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
                placeholder="Enter your LawNet API key"
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
