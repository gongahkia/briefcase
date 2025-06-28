import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { extractTextFromPDF } from './utils/pdfParser';
import { useLocalStorage } from './hooks/useLocalStorage';
import SourceSelectionDialog from './components/SourceSelectionDialog';
import ConfigurationDialog from './components/ConfigurationDialog';
import ApiKeyDialog from './components/ApiKeyDialog';
import IdentifiedCases from './components/IdentifiedCases';
import { findCaseNamesOne, findCaseNamesTwo, findCaseNamesThree } from './utils/caseMatcher';
import './styles.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const SEARCH_SOURCES = [
  { id: 'lawnet', name: 'LawNet API', requiresAuth: true, description: 'Official LawNet database (requires API key)' },
  { id: 'commonlii', name: 'CommonLII', requiresAuth: false, description: 'Free Singapore cases from 2006+' },
  { id: 'singapore-courts', name: 'Singapore Courts', requiresAuth: false, description: 'Recent free judgments (last 3 months)' },
  { id: 'ogp', name: 'OGP Pair Search', requiresAuth: false, description: 'Government Supreme Court judgments' },
  { id: 'slw', name: 'Singapore Law Watch', requiresAuth: false, description: 'Free Supreme Court judgments from 2000+' },
  { id: 'vlex', name: 'vLex Singapore', requiresAuth: true, description: 'Premium database (requires subscription)' }
];

function App() {
  const [cases, setCases] = useState([]);
  const [directTextInput, setDirectTextInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSource, setSelectedSource] = useLocalStorage('selected_source', 'commonlii');
  const [apiKey, setApiKey] = useLocalStorage('lawnet_api_key', '');
  const [serverConfig, setServerConfig] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [configFromStorage, setConfigFromStorage] = useLocalStorage('briefcase_config', {});
  const [fileProcessed, setFileProcessed] = useState(false);
  const [fileType, setFileType] = useState('');

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

  const processTextContent = (text) => {
    console.log('Processing text content:', text.substring(0, 100) + '...');
    setInfo('Identifying legal cases...');
    
    const foundCases = findCaseNamesThree(text);
    console.log('Found raw cases:', foundCases);
    
    // Always format as objects with {name, selected} structure
    const formattedCases = foundCases.map(name => ({ name, selected: true }));
    console.log('Formatted cases:', formattedCases);
    
    if (formattedCases.length === 0) {
      setInfo('No legal case citations found');
    } else {
      setInfo(`Found ${formattedCases.length} case citation(s)`);
    }
    
    setCases(formattedCases);
    setFileProcessed(true);
  };

  const handleCaseSelect = (index, isSelected) => {
    setCases(prev => prev.map((caseItem, i) => 
      i === index ? { ...caseItem, selected: isSelected } : caseItem
    ));
  };

  const handleSelectAll = () => {
    const allSelected = cases.every(c => c.selected);
    setCases(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const handleSearchCases = (caseNames) => {
    caseNames.forEach(caseName => {
      const currentSource = SEARCH_SOURCES.find(s => s.id === selectedSource);
      
      if (currentSource.requiresAuth && !apiKey) {
        setShowApiDialog(true);
        return;
      }
      
      searchCases(caseName);
    });
  };

  const handleDirectTextSubmit = () => {
    console.log('Direct text submit clicked');
    console.log('Input text:', directTextInput);
    
    if (!directTextInput.trim()) {
      setError('Please enter text to analyze');
      return;
    }
    
    setLoading(true);
    setError('');
    setInfo('Processing text...');
    setCases([]); // Clear previous cases
    setSearchResults([]); // Clear previous results
    
    try {
      processTextContent(directTextInput);
    } catch (error) {
      console.error('Text processing error:', error);
      setError(`Text processing error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeySubmit = (key) => {
    setApiKey(key);
    setShowApiDialog(false);
    if (selectedSource === 'vlex') {
      setInfo('vLex API key configured. Note: Requires valid subscription.');
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
    setInfo('');
    setCases([]);
    setSearchResults([]);
    setFileProcessed(false);
    
    if (acceptedFiles.length === 0) {
      setLoading(false);
      return;
    }

    const file = acceptedFiles[0];
    
    try {
      if (!file) {
        throw new Error('No valid file selected');
      }
      
      console.log('Processing file:', file.name);
      setInfo(`Processing ${file.name}...`);
      setFileType(file.type);
      
      let text = '';
      
      if (file.type === 'application/pdf') {
        setInfo('Extracting text from PDF...');
        text = await extractTextFromPDF(file);
      } else if (file.type === 'text/plain') {
        setInfo('Reading text file...');
        text = await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload PDF or TXT files.');
      }
      
      // Use the same processing function for consistency
      processTextContent(text);
      
    } catch (error) {
      console.error('File processing error:', error);
      setError(`Processing error: ${error.message}`);
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      if (fileRejections.length > 0) {
        const firstRejection = fileRejections[0];
        const { file, errors } = firstRejection;
        const fileTooLarge = errors.some(e => e.code === 'file-too-large');
        if (fileTooLarge) {
          setError('File is too large. Maximum size is 10MB');
          return;
        }
        const invalidType = errors.some(e => e.code === 'file-invalid-type');
        if (invalidType) {
          const fileExtension = file.name ? file.name.split('.').pop() : 'unknown';
          setError(`Unsupported file type: ${fileExtension}`);
          return;
        }
        setError(`File rejected: ${errors[0]?.message || 'Unknown error'}`);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, 
  });

  const searchCases = async (caseName) => {
    const currentSource = SEARCH_SOURCES.find(s => s.id === selectedSource);
    
    if (currentSource.requiresAuth && !apiKey) {
      setShowApiDialog(true);
      return;
    }

    setLoading(true);
    setError('');
    setInfo(`Searching ${currentSource.name} for: ${caseName}`);

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
      const resultCount = data.results?.length || 0;
      
      if (resultCount === 0) {
        setInfo(`No results found for "${caseName}" in ${currentSource.name}`);
      } else {
        setInfo(`Found ${resultCount} result(s) for "${caseName}" in ${currentSource.name}`);
      }

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
    setSearchResults([]);
    setInfo(`Search source changed to: ${SEARCH_SOURCES.find(s => s.id === sourceId)?.name}`);
  };

  const getCurrentSource = () => SEARCH_SOURCES.find(s => s.id === selectedSource);

  return (
    <div className="app-container">
      <header>
        <h1><i className="fas fa-briefcase"></i> Briefcase</h1>
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

        <div className="text-input-section">
          <h3>Or paste text directly:</h3>
          <textarea
            value={directTextInput}
            onChange={(e) => setDirectTextInput(e.target.value)}
            placeholder="Paste legal text here..."
            rows={4}
          />
          <button 
            onClick={handleDirectTextSubmit} 
            className="text-submit-btn"
          >
            <i className="fas fa-paragraph"></i> Analyze Text
          </button>
        </div>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <i className="fas fa-cloud-upload-alt fa-3x"></i>
          <p>{isDragActive ? 'Drop file here' : 'Drag PDF/TXT file or click to browse'}</p>
          <p className="file-requirements">Max size: 10MB • Supported: PDF, TXT</p>
        </div>

        {loading && <div className="loader"><i className="fas fa-spinner fa-spin"></i> Processing...</div>}
        
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}
        
        {info && !error && (
          <div className="info-message">
            <i className="fas fa-info-circle"></i> {info}
          </div>
        )}

        {fileProcessed && cases.length === 0 && !loading && (
          <div className="no-cases-message">
            <i className="fas fa-search-minus"></i> No legal case citations found in the document.
          </div>
        )}

        {cases.length > 0 && (
          <IdentifiedCases
            cases={cases}
            onSearch={handleSearchCases}
            onSelect={handleCaseSelect}
            onSelectAll={handleSelectAll}
          />
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
                  <p className="no-results">
                    <i className="fas fa-exclamation-circle"></i> No results found for this case
                  </p>
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
          onSubmit={handleApiKeySubmit}
          onClose={() => setShowApiDialog(false)}
        />
      )}
    </div>
  );
}

export default App;