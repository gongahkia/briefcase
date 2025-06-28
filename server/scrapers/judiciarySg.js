const axios = require('axios');
const cheerio = require('cheerio');
const { formatResult } = require('../utils/scrapeUtils');

const JUDICIARY_CONFIG = {
  baseUrl: 'https://www.judiciary.gov.sg',
  searchUrl: 'https://www.judiciary.gov.sg/judgments',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 3000
};

async function search({ query }) {
  try {
    console.log(`Searching Singapore Judiciary for: "${query}"`);
    
    const response = await axios.get(JUDICIARY_CONFIG.searchUrl, {
      params: { q: query },
      headers: {
        'User-Agent': JUDICIARY_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: JUDICIARY_CONFIG.timeout
    });

    return parseResults(response.data, query);
  } catch (error) {
    console.error('Judiciary SG search error:', error);
    throw new Error(`Judiciary SG search failed: ${error.message}`);
  }
}

function parseResults(html, query) {
  const $ = cheerio.load(html);
  const results = [];
  
  $('.judgments-listing-item').each((index, element) => {
    try {
      const $item = $(element);
      const title = $item.find('h2 a').text().trim();
      const url = JUDICIARY_CONFIG.baseUrl + $item.find('h2 a').attr('href');
      const date = $item.find('.date').text().trim();
      const summary = $item.find('.judgment-summary').text().trim();
      const citation = extractCitation(title);
      
      results.push(formatResult({
        id: `judiciary_sg_${index}`,
        title,
        citation,
        date,
        summary,
        url,
        source: 'judiciary-sg',
        relevanceScore: calculateRelevance(title, summary, query)
      }));
    } catch (error) {
      console.warn('Error parsing Judiciary SG result:', error);
    }
  });
  
  return results;
}

function extractCitation(title) {
  const citationMatch = title.match(/\[(\d{4})\]\s+(SG[A-Z]{2,4})\s+(\d+)/);
  return citationMatch ? citationMatch[0] : '';
}

function calculateRelevance(title, summary, query) {
  // Same implementation as SLW scraper
}

async function getDetails({ caseId, source }) {
  try {
    console.log(`Fetching Judiciary SG case details for: ${caseId}`);
    return {
      id: caseId,
      source: 'judiciary-sg',
      message: 'Detailed case information available on Singapore Judiciary website'
    };
  } catch (error) {
    throw new Error(`Failed to fetch Judiciary SG case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};