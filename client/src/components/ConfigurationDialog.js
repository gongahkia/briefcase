import React, { useState } from 'react';

export default function ConfigurationDialog({ onSubmit, onClose, initialConfig = {} }) {
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
