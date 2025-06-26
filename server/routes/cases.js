const express = require('express');
const axios = require('axios');
const router = express.Router();

// LawNet API configuration
const LAWNET_API_CONFIG = {
  baseUrl: process.env.LAWNET_API_BASE_URL || 'https://api.lawnet.sg',
  searchEndpoint: '/v1/cases/search',
  detailsEndpoint: '/v1/cases/details',
  timeout: 30000 // 30 seconds for search operations
};

/**
 * Search for legal cases
 * POST /api/cases/search
 */
router.post('/search', async (req, res) => {
  try {
    const { query, apiKey, filters = {} } = req.body;
    
    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Missing search query',
        message: 'Query parameter is required'
      });
    }
    
    if (!apiKey) {
      return res.status(400).json({
        error: 'Missing API key',
        message: 'LawNet API key is required'
      });
    }

    // Prepare search parameters
    const searchParams = {
      q: query,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
      sort: filters.sort || 'relevance',
      jurisdiction: filters.jurisdiction || 'singapore',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      court: filters.court,
      caseType: filters.caseType
    };

    // Remove undefined parameters
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key] === undefined) {
        delete searchParams[key];
      }
    });

    console.log(`Searching LawNet for: "${query}"`);

    // Make request to LawNet API
    const response = await axios.get(`${LAWNET_API_CONFIG.baseUrl}${LAWNET_API_CONFIG.searchEndpoint}`, {
      params: searchParams,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Briefcase-Legal-Retrieval/1.0'
      },
      timeout: LAWNET_API_CONFIG.timeout
    });

    // Process and format results
    const results = response.data.results || response.data.cases || [];
    const formattedResults = results.map(formatCaseResult);

    res.json({
      success: true,
      query: query,
      totalResults: response.data.total || results.length,
      results: formattedResults,
      pagination: {
        limit: searchParams.limit,
        offset: searchParams.offset,
        hasMore: results.length === searchParams.limit
      }
    });

  } catch (error) {
    console.error('LawNet search error:', error.response?.data || error.message);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'LawNet API key is invalid or expired'
        });
      }
      
      if (status === 403) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions for LawNet API access'
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'LawNet API rate limit exceeded. Please try again later.'
        });
      }
      
      if (status >= 500) {
        return res.status(503).json({
          error: 'LawNet service unavailable',
          message: 'LawNet API is currently unavailable'
        });
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'LawNet API request timed out'
      });
    }
    
    res.status(500).json({
      error: 'Search failed',
      message: 'Unable to search LawNet database'
    });
  }
});

/**
 * Get case details by ID
 * GET /api/cases/:caseId
 */
router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({
        error: 'Missing API key',
        message: 'LawNet API key is required'
      });
    }

    console.log(`Fetching case details for: ${caseId}`);

    const response = await axios.get(`${LAWNET_API_CONFIG.baseUrl}${LAWNET_API_CONFIG.detailsEndpoint}/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Briefcase-Legal-Retrieval/1.0'
      },
      timeout: LAWNET_API_CONFIG.timeout
    });

    const caseDetails = formatCaseDetails(response.data);

    res.json({
      success: true,
      case: caseDetails
    });

  } catch (error) {
    console.error('Case details error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Case not found',
        message: 'The requested case could not be found'
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch case details',
      message: 'Unable to retrieve case information'
    });
  }
});

/**
 * Format case search result
 */
function formatCaseResult(caseData) {
  return {
    id: caseData.id || caseData.caseId,
    title: caseData.title || caseData.caseName || 'Untitled Case',
    citation: caseData.citation || caseData.neutralCitation,
    court: caseData.court || caseData.courtName,
    date: caseData.date || caseData.decisionDate,
    judges: caseData.judges || caseData.judgeNames,
    summary: caseData.summary || caseData.headnote || '',
    url: caseData.url || caseData.permalink,
    relevanceScore: caseData.score || caseData.relevance,
    categories: caseData.categories || caseData.subjects || [],
    parties: {
      plaintiff: caseData.plaintiff || caseData.applicant,
      defendant: caseData.defendant || caseData.respondent
    }
  };
}

/**
 * Format detailed case information
 */
function formatCaseDetails(caseData) {
  return {
    ...formatCaseResult(caseData),
    fullText: caseData.fullText || caseData.judgment,
    procedureHistory: caseData.procedureHistory || [],
    citedCases: caseData.citedCases || caseData.casesReferred || [],
    legislation: caseData.legislation || caseData.statutesReferred || [],
    keywords: caseData.keywords || caseData.indexTerms || [],
    catchwords: caseData.catchwords || []
  };
}

module.exports = router;
