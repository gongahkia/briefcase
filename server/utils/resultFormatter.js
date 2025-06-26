/**
 * Result formatting utilities for different sources
 */

/**
 * Normalize results from different sources into consistent format
 */
function normalizeResults(results, source) {
  return results.map(result => {
    const normalized = {
      id: result.id || generateId(source),
      title: cleanTitle(result.title),
      citation: normalizeCitation(result.citation),
      court: normalizeCourtName(result.court),
      date: normalizeDate(result.date),
      summary: cleanSummary(result.summary),
      url: result.url,
      source: source,
      relevanceScore: result.relevanceScore || 0
    };
    
    // Add source-specific metadata
    switch (source) {
      case 'lawnet':
        normalized.judges = result.judges;
        normalized.parties = result.parties;
        normalized.categories = result.categories;
        break;
      case 'commonlii':
        normalized.jurisdiction = 'Singapore';
        break;
      case 'singapore-courts':
        normalized.courtType = extractCourtType(result.court);
        break;
      case 'ogp':
        normalized.government = true;
        break;
    }
    
    return normalized;
  });
}

/**
 * Clean and standardize case titles
 */
function cleanTitle(title) {
  if (!title) return 'Untitled Case';
  
  return title
    .replace(/^\s*\d+\.\s*/, '') // Remove leading numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize citation formats
 */
function normalizeCitation(citation) {
  if (!citation) return null;
  
  // Standardize Singapore citation format
  const sgCitationMatch = citation.match(/\[(\d{4})\]\s*(SG[A-Z]{2,4})\s*(\d+)/i);
  if (sgCitationMatch) {
    return `[${sgCitationMatch[1]}] ${sgCitationMatch[2].toUpperCase()} ${sgCitationMatch[3]}`;
  }
  
  return citation.trim();
}

/**
 * Normalize court names
 */
function normalizeCourtName(court) {
  if (!court) return 'Unknown Court';
  
  const courtMappings = {
    'SGCA': 'Court of Appeal',
    'SGHC': 'High Court',
    'SGDC': 'District Court',
    'SGMC': 'Magistrates Court',
    'Court of Appeal': 'Court of Appeal',
    'High Court': 'High Court',
    'District Court': 'District Court',
    'Magistrates Court': 'Magistrates Court'
  };
  
  // Check for exact matches first
  if (courtMappings[court]) {
    return courtMappings[court];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(courtMappings)) {
    if (court.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return court;
}

/**
 * Normalize date formats
 */
function normalizeDate(date) {
  if (!date) return null;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date; // Return original if invalid
    
    return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    return date;
  }
}

/**
 * Clean and truncate summaries
 */
function cleanSummary(summary) {
  if (!summary) return '';
  
  const cleaned = summary
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  // Truncate if too long
  if (cleaned.length > 500) {
    return cleaned.substring(0, 497) + '...';
  }
  
  return cleaned;
}

/**
 * Extract court type from court name
 */
function extractCourtType(court) {
  if (!court) return 'unknown';
  
  const courtLower = court.toLowerCase();
  
  if (courtLower.includes('appeal')) return 'appellate';
  if (courtLower.includes('high')) return 'superior';
  if (courtLower.includes('district')) return 'subordinate';
  if (courtLower.includes('magistrate')) return 'subordinate';
  
  return 'general';
}

/**
 * Generate ID with source prefix
 */
function generateId(source) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6);
  return `${source}_${timestamp}_${random}`;
}

/**
 * Merge and deduplicate results from multiple sources
 */
function mergeResults(resultsArray) {
  const merged = [];
  const seen = new Set();
  
  // Sort by source priority (LawNet first, then others)
  const sourcePriority = { 'lawnet': 1, 'commonlii': 2, 'singapore-courts': 3, 'ogp': 4 };
  
  resultsArray.sort((a, b) => {
    const aPriority = sourcePriority[a.source] || 999;
    const bPriority = sourcePriority[b.source] || 999;
    return aPriority - bPriority;
  });
  
  for (const result of resultsArray) {
    const key = generateDedupeKey(result);
    
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(result);
    }
  }
  
  return merged.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Generate deduplication key for results
 */
function generateDedupeKey(result) {
  // Use citation if available, otherwise use title
  if (result.citation) {
    return result.citation.toLowerCase().replace(/\s+/g, '');
  }
  
  return result.title.toLowerCase().replace(/\s+/g, '').substring(0, 50);
}

module.exports = {
  normalizeResults,
  cleanTitle,
  normalizeCitation,
  normalizeCourtName,
  normalizeDate,
  cleanSummary,
  extractCourtType,
  generateId,
  mergeResults,
  generateDedupeKey
};
