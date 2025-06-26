import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import OAuthPopup from 'react-oauth-popup';
import { extractTextFromPDF } from './utils/pdfParser';
import { findCaseNames } from './utils/caseMatcher';
import './styles.css';

const LAWNET_CLIENT_ID = process.env.REACT_APP_LAWNET_CLIENT_ID;
const LAWNET_AUTH_URL = `https://auth.lawnet.com/oauth/authorize?client_id=${LAWNET_CLIENT_ID}&response_type=code`;

function App() {
  const [cases, setCases] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = async (acceptedFiles) => {
    setLoading(true);
    const file = acceptedFiles[0];
    
    try {
      // Extract text from file
      const text = file.type === 'application/pdf' 
        ? await extractTextFromPDF(file) 
        : await file.text();
      
      // Identify case names
      const foundCases = findCaseNames(text);
      setCases(foundCases);
      
      // TODO: Integrate with LawNet API using accessToken
    } catch (error) {
      console.error("Processing error:", error);
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

  const onCode = async (code) => {
    // Exchange code for token (to be implemented in server)
    const response = await fetch('/api/token', {
      method: 'POST',
      body: JSON.stringify({ code }),
      headers: { 'Content-Type': 'application/json' }
    });
    const { token } = await response.json();
    setAccessToken(token);
  };

  return (
    <div className="app-container">
      <header>
        <h1><i className="fas fa-briefcase"></i> Briefcase</h1>
        {!accessToken ? (
          <OAuthPopup url={LAWNET_AUTH_URL} onCode={onCode}>
            <button className="auth-btn">
              <i className="fas fa-lock"></i> Sign in with LawNet
            </button>
          </OAuthPopup>
        ) : (
          <div className="user-info">
            <i className="fas fa-user-check"></i> Authenticated
          </div>
        )}
      </header>

      <main>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <i className="fas fa-cloud-upload-alt fa-3x"></i>
          <p>{isDragActive ? 'Drop file here' : 'Drag PDF/TXT file or click to browse'}</p>
        </div>

        {loading && <div className="loader"><i className="fas fa-spinner fa-spin"></i> Processing...</div>}

        {cases.length > 0 && (
          <div className="results-section">
            <h2>Identified Cases:</h2>
            <ul>
              {cases.map((caseName, index) => (
                <li key={index}>
                  {caseName} 
                  <button onClick={() => queryLawNet(caseName, accessToken)}>
                    <i className="fas fa-search"></i> Retrieve
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

// TODO: Implement LawNet API integration
async function queryLawNet(caseName, token) {
  console.log(`Querying LawNet for: ${caseName} with token ${token ? 'present' : 'missing'}`);
}

export default App;
