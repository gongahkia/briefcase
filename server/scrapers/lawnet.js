const axios = require('axios');
const configRoute = require('../routes/config');
const { formatResult } = require('../utils/scrapeUtils');

/**
 * Search LawNet API (original implementation)
 */
async function search({ query, apiKey, filters = {} }) {
  try {
    const config = configRoute.getConfig();
    
    if (!config.LAWNET_API_BASE_URL) {
      throw new Error('LawNet API configuration not found');
    }

    console.log(`Searching LawNet API for: "${query}"`);
    
    const searchParams = {
      q: query,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
      sort: filters.sort || 'relevance'
    };

    const response = await axios.get(`${config.LAWNET_API_BASE_URL}/v1/cases/search`, {
      params: searchParams,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Briefcase-Legal-Retrieval/1.0'
      },
      timeout: 30000
    });

    const results = response.data.results || response.data.cases || [];
    const formattedResults = results.map((item, index) => formatResult({
      id: item.id || `lawnet_${index}`,
      title: item.title || item.caseName,
      citation: item.citation || item.neutralCitation,
      court: item.court || item.courtName,
      date: item.date || item.decisionDate,
      judges: item.judges || item.judgeNames,
      summary: item.summary || item.headnote || '',
      url: item.url || item.permalink,
      source: 'lawnet',
      relevanceScore: item.score || item.relevance || 5
    }));

    return formattedResults;

  } catch (error) {
    console.error('LawNet API search error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get detailed case information from LawNet API
 */
async function getDetails({ caseId, apiKey, source }) {
  try {
    const config = configRoute.getConfig();
    
    const response = await axios.get(`${config.LAWNET_API_BASE_URL}/v1/cases/details/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Briefcase-Legal-Retrieval/1.0'
      },
      timeout: 30000
    });

    return response.data;

  } catch (error) {
    console.error('LawNet API details error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  search,
  getDetails
};
