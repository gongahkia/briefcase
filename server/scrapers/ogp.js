const axios = require('axios');
const { formatResult, delay } = require('../utils/scrapeUtils');

const OGP_CONFIG = {
  baseUrl: 'https://pair.gov.sg',
  searchEndpoint: '/search',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 2000
};

/**
 * Search OGP Pair Search for Supreme Court judgments
 */
async function search({ query, filters = {} }) {
  try {
    console.log(`Searching OGP Pair Search for: "${query}"`);
    
    const searchParams = {
      q: query,
      source: 'supreme-court', // Focus on Supreme Court judgments
      limit: filters.limit || 20
    };
    
    const response = await axios.get(`${OGP_CONFIG.baseUrl}${OGP_CONFIG.searchEndpoint}`, {
      params: searchParams,
      headers: {
        'User-Agent': OGP_CONFIG.userAgent,
        'Accept': 'application/json,text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: OGP_CONFIG.timeout
    });

    let results;
    
    // Handle both JSON and HTML responses
    if (response.headers['content-type']?.includes('application/json')) {
      results = parseOGPJsonResults(response.data, query);
    } else {
      results = parseOGPHtmlResults(response.data, query);
    }
    
    await delay(OGP_CONFIG.rateLimit);
    
    return results;

  } catch (error) {
    console.error('OGP search error:', error.message);
    throw new Error(`OGP search failed: ${error.message}`);
  }
}

/**
 * Parse OGP JSON response
 */
function parseOGPJsonResults(data, originalQuery) {
  const results = [];
  
  try {
    const items = data.results || data.items || [];
    
    items.forEach((item, index) => {
      try {
        const result = formatResult({
          id: `ogp_${index}`,
          title: item.title || item.name || 'Untitled',
          citation: extractCitation(item.title || ''),
          court: 'Supreme Court of Singapore',
          date: item.date || item.published_date,
          summary: item.summary || item.description || item.snippet || '',
          url: item.url || item.link,
          source: 'ogp',
          relevanceScore: calculateRelevance(item.title || '', item.summary || '', originalQuery)
        });
        
        results.push(result);
        
      } catch (error) {
        console.warn('Error parsing OGP JSON result:', error);
      }
    });
    
  } catch (error) {
    console.error('Error parsing OGP JSON response:', error);
  }
  
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Parse OGP HTML response (fallback)
 */
function parseOGPHtmlResults(html, originalQuery) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const results = [];
  
  $('.search-result, .result-item').each((index, element) => {
    try {
      const $item = $(element);
      
      const title = $item.find('.result-title, h3, h4').first().text().trim();
      const summary = $item.find('.result-summary, .summary').text().trim();
      const url = $item.find('a').first().attr('href');
      
      if (!title) return;
      
      const result = formatResult({
        id: `ogp_html_${index}`,
        title: title,
        citation: extractCitation(title),
        court: 'Supreme Court of Singapore',
        summary: summary,
        url: url && url.startsWith('http') ? url : `${OGP_CONFIG.baseUrl}${url}`,
        source: 'ogp',
        relevanceScore: calculateRelevance(title, summary, originalQuery)
      });
      
      results.push(result);
      
    } catch (error) {
      console.warn('Error parsing OGP HTML result:', error);
    }
  });
  
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Extract citation from text
 */
function extractCitation(text) {
  const citationMatch = text.match(/\[(\d{4})\]\s+(SG[A-Z]{2,4})\s+(\d+)/);
  return citationMatch ? citationMatch[0] : null;
}

/**
 * Calculate relevance score
 */
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

/**
 * Get detailed case information
 */
async function getDetails({ caseId, source }) {
  try {
    console.log(`Fetching OGP case details for: ${caseId}`);
    
    return {
      id: caseId,
      source: 'ogp',
      message: 'Detailed case information available on OGP Pair Search'
    };
    
  } catch (error) {
    throw new Error(`Failed to fetch OGP case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};
