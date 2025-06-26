import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { extractTextFromPDF } from './utils/pdfParser';
import { findCaseNames } from './utils/caseMatcher';
import './styles.css';

function App() {
  const [cases, setCases] = useState([]);
  const [lawnetResults, setLawnetResults] = useState([]);
  const [apiKey, setApiKey] = useState(localStorage.getItem('lawnet_api_key') || '');
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (acceptedFiles) => {
    setLoading(true);
    setError('');
    const file = acceptedFiles[0];
    
    try {
      // Extract text from file
      const text = file.type === 'application/pdf' 
        ? await extractTextFromPDF(file) 
        : await file.text();
      
      // Identify case names
      const foundCases = findCaseNames(text);
      setCases(foundCases);
      setLawnetResults([]);
      
    } catch (error) {
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

  const handleApiKeySubmit = (key) => {
    setApiKey(key);
    localStorage.setItem('lawnet_api_key', key);
    setShowApiDialog(false);
  };

  const queryLawNet = async (caseName) => {
    if (!apiKey) {
      setShowApiDialog(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cases/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: caseName,
          apiKey: apiKey
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update results for this specific case
      setLawnetResults(prev => [
        ...prev.filter(r => r.searchTerm !== caseName),
        { searchTerm: caseName, results: data.results || [] }
      ]);

    } catch (error) {
      setError(`LawNet query failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('lawnet_api_key');
    setLawnetResults([]);
  };

  return (
    <div className="app-container">
      <header>
        <h1><i className="fas fa-briefcase"></i> Briefcase</h1>
        <div className="header-controls">
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

      {showApiDialog && (
        <ApiKeyDialog 
          onSubmit={handleApiKeySubmit}
          onClose={() => setShowApiDialog(false)}
        />
      )}
    </div>
  );
}

// API Key Configuration Dialog Component
function ApiKeyDialog({ onSubmit, onClose }) {
  const [key, setKey] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

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
          <h3><i className="fas fa-key"></i> LawNet API Configuration</h3>
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
              <button type="button" onClick={() => setShowInstructions(!showInstructions)} className="help-btn">
                <i className="fas fa-question-circle"></i> How to get API key?
              </button>
            </div>
          </form>

          {showInstructions && (
            <div className="instructions">
              <h4>Getting LawNet API Access:</h4>
              <ol>
                <li>Visit the Singapore Academy of Law website</li>
                <li>Fill in the API access request form</li>
                <li>Email legaltechvision@sal.org.sg for trial access</li>
                <li>Trial access includes 5 calls per second for 90 days</li>
                <li>Available datasets: Unreported judgments (2000-2016) and Singapore Law Reports (1965-2016)</li>
              </ol>
              <p><strong>Note:</strong> API access requires approval from Singapore Academy of Law.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
