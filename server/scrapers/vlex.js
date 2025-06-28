const axios = require('axios');
const { formatResult } = require('../utils/scrapeUtils');

const VLEX_CONFIG = {
  apiUrl: 'https://api.vlex.com',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 1000
};

async function search({ query, apiKey }) {
  try {
    console.log(`Searching vLex Singapore for: "${query}"`);
    
    if (!apiKey) {
      throw new Error('vLex API key required');
    }

    const response = await axios.get(`${VLEX_CONFIG.apiUrl}/search`, {
      params: {
        q: query,
        jurisdiction: 'sg',
        include: 'title,citation,summary,url'
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': VLEX_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      timeout: VLEX_CONFIG.timeout
    });

    return response.data.results.map((item, index) => 
      formatResult({
        id: `vlex_${index}`,
        title: item.title,
        citation: item.citation,
        summary: item.summary,
        url: item.url,
        source: 'vlex',
        relevanceScore: item.score || 5
      })
    );
  } catch (error) {
    console.error('vLex search error:', error);
    throw new Error(`vLex search failed: ${error.message}`);
  }
}

async function getDetails({ caseId, apiKey, source }) {
  try {
    console.log(`Fetching vLex case details for: ${caseId}`);
    const response = await axios.get(`${VLEX_CONFIG.apiUrl}/cases/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch vLex case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};