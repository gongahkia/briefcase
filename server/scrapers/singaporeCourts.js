const axios = require('axios');
const cheerio = require('cheerio');
const { formatResult, delay } = require('../utils/scrapeUtils');

const SG_COURTS_CONFIG = {
  baseUrl: 'https://www.lawnet.sg',
  freeResourcesUrl: 'https://www.lawnet.sg/lawnet/web/lawnet/free-resources',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 3000 // 3 seconds between requests - be extra respectful
};

/**
 * Search Singapore Courts free resources
 */
async function search({ query, filters = {} }) {
  try {
    console.log(`Searching Singapore Courts for: "${query}"`);
    
    // Singapore Courts free resources typically show recent judgments
    const response = await axios.get(`${SG_COURTS_CONFIG.freeResourcesUrl}/recent-judgments`, {
      headers: {
        'User-Agent': SG_COURTS_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': SG_COURTS_CONFIG.baseUrl
      },
      timeout: SG_COURTS_CONFIG.timeout
    });

    const results = parseCourtResults(response.data, query);
    
    // Rate limiting
    await delay(SG_COURTS_CONFIG.rateLimit);
    
    return results;

  } catch (error) {
    console.error('Singapore Courts search error:', error.message);
    
    // If the main search fails, try alternative approach
    try {
      return await searchAlternativeMethod(query);
    } catch (altError) {
      throw new Error(`Singapore Courts search failed: ${error.message}`);
    }
  }
}

/**
 * Parse Singapore Courts results
 */
function parseCourtResults(html, originalQuery) {
  const $ = cheerio.load(html);
  const results = [];
  
  // Look for judgment listings (structure may vary)
  $('.judgment-item, .case-item, .result-item').each((index, element) => {
    try {
      const $item = $(element);
      
      const title = $item.find('.case-title, .judgment-title, h3, h4').first().text().trim();
      const citation = $item.find('.citation').text().trim();
      const court = $item.find('.court').text().trim();
      const date = $item.find('.date').text().trim();
      const summary = $item.find('.summary, .headnote').text().trim();
      
      const linkElement = $item.find('a').first();
      const relativeUrl = linkElement.attr('href');
      const fullUrl = relativeUrl && relativeUrl.startsWith('http') 
        ? relativeUrl 
        : `${SG_COURTS_CONFIG.baseUrl}${relativeUrl}`;
      
      if (!title) return;
      
      // Filter results based on query relevance
      const relevanceScore = calculateRelevance(title, summary, originalQuery);
      if (relevanceScore === 0) return; // Skip irrelevant results
      
      const result = formatResult({
        id: `sg_courts_${index}`,
        title: title,
        citation: citation || extractCitationFromTitle(title),
        court: court || 'Singapore Courts',
        date: date,
        summary: summary,
        url: fullUrl,
        source: 'singapore-courts',
        relevanceScore: relevanceScore
      });
      
      results.push(result);
      
    } catch (error) {
      console.warn('Error parsing Singapore Courts result:', error);
    }
  });
  
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Alternative search method if main approach fails
 */
async function searchAlternativeMethod(query) {
  try {
    // Try searching the main Singapore Courts website
    const searchUrl = `${SG_COURTS_CONFIG.baseUrl}/search?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': SG_COURTS_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: SG_COURTS_CONFIG.timeout
    });
    
    return parseCourtResults(response.data, query);
    
  } catch (error) {
    console.warn('Alternative Singapore Courts search also failed:', error.message);
    return [];
  }
}

/**
 * Extract citation from title if not found separately
 */
function extractCitationFromTitle(title) {
  const citationMatch = title.match(/\[(\d{4})\]\s+(SG[A-Z]{2,4})\s+(\d+)/);
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
  
  // Exact match in title
  if (titleLower.includes(queryLower)) score += 10;
  
  // Word matches
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (word.length > 2) { // Skip very short words
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
    console.log(`Fetching Singapore Courts case details for: ${caseId}`);
    
    return {
      id: caseId,
      source: 'singapore-courts',
      message: 'Detailed case information available on Singapore Courts website'
    };
    
  } catch (error) {
    throw new Error(`Failed to fetch Singapore Courts case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};
