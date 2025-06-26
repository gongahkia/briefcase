const axios = require('axios');
const cheerio = require('cheerio');
const { formatResult, delay } = require('../utils/scrapeUtils');

const COMMONLII_CONFIG = {
  baseUrl: 'http://www.commonlii.org',
  searchUrl: 'http://www.commonlii.org/forms/search/',
  timeout: 30000,
  userAgent: 'Briefcase-Academic-Research/1.0 (SMU Student Project)',
  rateLimit: 2000 // 2 seconds between requests
};

/**
 * Search CommonLII for Singapore cases
 */
async function search({ query, filters = {} }) {
  try {
    console.log(`Searching CommonLII for: "${query}"`);
    
    // Construct search URL for Singapore cases
    const searchParams = new URLSearchParams({
      query: query,
      mask: 'sg/cases', // Singapore cases only
      method: 'auto',
      format: 'long'
    });

    const searchUrl = `${COMMONLII_CONFIG.searchUrl}?${searchParams.toString()}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': COMMONLII_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: COMMONLII_CONFIG.timeout
    });

    const results = parseSearchResults(response.data, query);
    
    // Rate limiting - be respectful to CommonLII
    await delay(COMMONLII_CONFIG.rateLimit);
    
    return results;

  } catch (error) {
    console.error('CommonLII search error:', error.message);
    throw new Error(`CommonLII search failed: ${error.message}`);
  }
}

/**
 * Parse CommonLII search results HTML
 */
function parseSearchResults(html, originalQuery) {
  const $ = cheerio.load(html);
  const results = [];

  // CommonLII search results are typically in <dt> and <dd> pairs
  $('dt').each((index, element) => {
    try {
      const $dt = $(element);
      const $dd = $dt.next('dd');
      
      // Extract case title and link
      const titleLink = $dt.find('a').first();
      const title = titleLink.text().trim();
      const relativeUrl = titleLink.attr('href');
      
      if (!title || !relativeUrl) return;
      
      const fullUrl = relativeUrl.startsWith('http') 
        ? relativeUrl 
        : `${COMMONLII_CONFIG.baseUrl}${relativeUrl}`;
      
      // Extract summary from description
      const summary = $dd.text().trim();
      
      // Try to extract citation from title
      const citation = extractCitation(title);
      
      // Extract court information
      const court = extractCourt(relativeUrl, title);
      
      const result = formatResult({
        id: `commonlii_${index}`,
        title: title,
        citation: citation,
        court: court,
        summary: summary,
        url: fullUrl,
        source: 'commonlii',
        relevanceScore: calculateRelevance(title, summary, originalQuery)
      });
      
      results.push(result);
      
    } catch (error) {
      console.warn('Error parsing CommonLII result:', error);
    }
  });

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Extract citation from case title
 */
function extractCitation(title) {
  // Look for patterns like [2023] SGCA 15, [2022] SGHC 123, etc.
  const citationMatch = title.match(/\[(\d{4})\]\s+(SG[A-Z]{2,4})\s+(\d+)/);
  return citationMatch ? citationMatch[0] : null;
}

/**
 * Extract court from URL or title
 */
function extractCourt(url, title) {
  if (url.includes('/SGCA/')) return 'Court of Appeal';
  if (url.includes('/SGHC/')) return 'High Court';
  if (url.includes('/SGDC/')) return 'District Court';
  if (url.includes('/SGMC/')) return 'Magistrates Court';
  
  // Try to extract from title
  if (title.includes('SGCA')) return 'Court of Appeal';
  if (title.includes('SGHC')) return 'High Court';
  if (title.includes('SGDC')) return 'District Court';
  
  return 'Singapore Courts';
}

/**
 * Calculate relevance score based on query match
 */
function calculateRelevance(title, summary, query) {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const summaryLower = summary.toLowerCase();
  
  let score = 0;
  
  // Exact match in title gets highest score
  if (titleLower.includes(queryLower)) score += 10;
  
  // Partial matches in title
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (titleLower.includes(word)) score += 3;
    if (summaryLower.includes(word)) score += 1;
  });
  
  return score;
}

/**
 * Get detailed case information
 */
async function getDetails({ caseId, source }) {
  try {
    // For CommonLII, we would need to fetch the full case page
    // This is a placeholder implementation
    console.log(`Fetching CommonLII case details for: ${caseId}`);
    
    // Implementation would involve:
    // 1. Extract case URL from caseId
    // 2. Fetch the full case page
    // 3. Parse the judgment text, parties, etc.
    
    return {
      id: caseId,
      source: 'commonlii',
      message: 'Detailed case information available on CommonLII website'
    };
    
  } catch (error) {
    throw new Error(`Failed to fetch CommonLII case details: ${error.message}`);
  }
}

module.exports = {
  search,
  getDetails
};
