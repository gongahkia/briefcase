const axios = require('axios');
const cheerio = require('cheerio');
const { formatResult } = require('../utils/scrapeUtils');

const SLW_CONFIG = {
  baseUrl: 'https://www.singaporelawwatch.sg',
  searchUrl: 'https://www.singaporelawwatch.sg/Judgments',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 3000
};

async function search({ query }) {
  try {
    console.log(`Searching Singapore Law Watch for: "${query}"`);
    
    const response = await axios.get(SLW_CONFIG.searchUrl, {
      params: { q: query },
      headers: {
        'User-Agent': SLW_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: SLW_CONFIG.timeout
    });

    return parseResults(response.data, query);
  } catch (error) {
    console.error('SLW search error:', error);
    throw new Error(`SLW search failed: ${error.message}`);
  }
}

function parseResults(html, query) {
  const $ = cheerio.load(html);
  const results = [];
  
  $('.judgment-item').each((index, element) => {
    try {
      const $item = $(element);
      const title = $item.find('.title a').text().trim();
      const url = SLW_CONFIG.baseUrl + $item.find('.title a').attr('href');
      const citation = $item.find('.citation').text().trim();
      const date = $item.find('.date').text().trim();
      const summary = $item.find('.summary').text().trim();
      
      if (!title) return;
      
      results.push(formatResult({
        id: `slw_${index}`,
        title,
        citation,
        date,
        summary,
        url,
        source: 'slw',
        relevanceScore: calculateRelevance(title, summary, query)
      }));
    } catch (error) {
      console.warn('Error parsing SLW result:', error);
    }
  });
  
  return results;
}

function calculateRelevance(title, summary, query) {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const summaryLower = summary.toLowerCase();
  
  let score = 0;
  
  if (titleLower.includes(queryLower)) score += 10;
  
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (word.length > 2) {
      if (titleLower.includes(word)) score += 3;
      if (summaryLower.includes(word)) score += 1;
    }
  });
  
  return score;
}

async function getDetails({ caseId, source }) {
  try {
    console.log(`Fetching SLW case details for: ${caseId}`);
    return {
      id: caseId,
      source: 'slw',
      message: 'Detailed case information available on Singapore Law Watch'
    };
  } catch (error) {
    throw new Error(`Failed to fetch SLW case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};