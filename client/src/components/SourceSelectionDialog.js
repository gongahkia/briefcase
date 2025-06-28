import React from 'react';

export default function SourceSelectionDialog({ sources, currentSource, onSelect, onClose }) {
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