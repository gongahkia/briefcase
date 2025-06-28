import React, { useState } from 'react';

export default function ApiKeyDialog({ onSubmit, onClose }) {
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
