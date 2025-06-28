import React from 'react';

const IdentifiedCases = ({ cases, onSearch, onSelect, onSelectAll }) => {
  const allSelected = cases.length > 0 && cases.every(caseItem => caseItem.selected);
  
  return (
    <div className="results-section">
      <div className="cases-header">
        <h2>Identified Cases:</h2>
        <div className="case-actions">
          <button onClick={onSelectAll} className="select-all-btn">
            <i className={`fas ${allSelected ? 'fa-check-square' : 'fa-square'}`}></i>
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button 
            onClick={() => onSearch(cases.filter(c => c.selected).map(c => c.name))} 
            className="search-selected-btn"
          >
            <i className="fas fa-search"></i> Search Selected
          </button>
        </div>
      </div>
      
      <div className="cases-list">
        {cases.map((caseItem, index) => (
          <div key={index} className="case-item">
            <label className="case-select">
              <input
                type="checkbox"
                checked={caseItem.selected}
                onChange={(e) => onSelect(index, e.target.checked)}
              />
              <span className="checkmark"></span>
            </label>
            <div className="case-name">{caseItem.name}</div>
            <button 
              onClick={() => onSearch([caseItem.name])} 
              className="search-btn"
            >
              <i className="fas fa-search"></i> Search
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IdentifiedCases;