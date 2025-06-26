/**
 * Utility functions for web scraping
 */

/**
 * Add delay between requests to be respectful to servers
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format search result into consistent structure
 */
function formatResult(data) {
  return {
    id: data.id || generateId(),
    title: data.title || 'Untitled Case',
    citation: data.citation || null,
    court: data.court || 'Unknown Court',
    date: data.date || null,
    judges: data.judges || null,
    summary: data.summary || '',
    url: data.url || null,
    source: data.source || 'unknown',
    relevanceScore: data.relevanceScore || 0,
    parties: data.parties || null,
    categories: data.categories || []
  };
}

/**
 * Generate unique ID for results without IDs
 */
function generateId() {
  return `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clean and normalize text content
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n+/g, ' ') // Replace newlines with space
    .trim();
}

/**
 * Extract domain from URL for source identification
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Validate URL format
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Rate limiting helper
 */
class RateLimiter {
  constructor(requestsPerSecond = 1) {
    this.requestsPerSecond = requestsPerSecond;
    this.lastRequestTime = 0;
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.requestsPerSecond;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }
}

module.exports = {
  delay,
  formatResult,
  generateId,
  cleanText,
  extractDomain,
  isValidUrl,
  RateLimiter
};
