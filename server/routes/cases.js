const express = require('express');
const router = express.Router();

// Import all scrapers
const lawnetScraper = require('../scrapers/lawnet');
const commonliiScraper = require('../scrapers/commonlii');
const singaporeCourtsScraper = require('../scrapers/singaporeCourts');
const ogpScraper = require('../scrapers/ogp');

// Available search sources
const SEARCH_SOURCES = {
  'lawnet': {
    name: 'LawNet API',
    scraper: lawnetScraper,
    requiresAuth: true
  },
  'commonlii': {
    name: 'CommonLII',
    scraper: commonliiScraper,
    requiresAuth: false
  },
  'singapore-courts': {
    name: 'Singapore Courts',
    scraper: singaporeCourtsScraper,
    requiresAuth: false
  },
  'ogp': {
    name: 'OGP Pair Search',
    scraper: ogpScraper,
    requiresAuth: false
  }
};

/**
 * Search for legal cases across multiple sources
 * POST /api/cases/search
 */
router.post('/search', async (req, res) => {
  try {
    const { query, source = 'commonlii', apiKey, filters = {} } = req.body;
    
    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Missing search query',
        message: 'Query parameter is required'
      });
    }

    // Validate source
    const sourceConfig = SEARCH_SOURCES[source];
    if (!sourceConfig) {
      return res.status(400).json({
        error: 'Invalid source',
        message: `Source '${source}' is not supported. Available sources: ${Object.keys(SEARCH_SOURCES).join(', ')}`
      });
    }

    // Check authentication for sources that require it
    if (sourceConfig.requiresAuth && !apiKey) {
      return res.status(400).json({
        error: 'Missing API key',
        message: `Source '${source}' requires an API key`
      });
    }

    console.log(`Searching ${sourceConfig.name} for: "${query}"`);

    // Execute search using the appropriate scraper
    const searchParams = {
      query,
      apiKey,
      filters,
      source
    };

    const results = await sourceConfig.scraper.search(searchParams);

    res.json({
      success: true,
      source: source,
      sourceName: sourceConfig.name,
      query: query,
      totalResults: results.length,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Search error for source '${req.body.source}':`, error);
    
    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key is invalid or expired'
        });
      }
      
      if (status === 403) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions for API access'
        });
      }
      
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'API rate limit exceeded. Please try again later.'
        });
      }
      
      if (status >= 500) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Search service is currently unavailable'
        });
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Search request timed out'
      });
    }
    
    res.status(500).json({
      error: 'Search failed',
      message: 'Unable to search database',
      source: req.body.source
    });
  }
});

/**
 * Get available search sources
 * GET /api/cases/sources
 */
router.get('/sources', (req, res) => {
  const sources = Object.keys(SEARCH_SOURCES).map(key => ({
    id: key,
    name: SEARCH_SOURCES[key].name,
    requiresAuth: SEARCH_SOURCES[key].requiresAuth
  }));

  res.json({
    success: true,
    sources: sources
  });
});

/**
 * Get case details by ID and source
 * GET /api/cases/:source/:caseId
 */
router.get('/:source/:caseId', async (req, res) => {
  try {
    const { source, caseId } = req.params;
    const { apiKey } = req.query;
    
    const sourceConfig = SEARCH_SOURCES[source];
    if (!sourceConfig) {
      return res.status(400).json({
        error: 'Invalid source',
        message: `Source '${source}' is not supported`
      });
    }

    if (sourceConfig.requiresAuth && !apiKey) {
      return res.status(400).json({
        error: 'Missing API key',
        message: 'API key is required for this source'
      });
    }

    console.log(`Fetching case details for: ${caseId} from ${sourceConfig.name}`);

    const caseDetails = await sourceConfig.scraper.getDetails({
      caseId,
      apiKey,
      source
    });

    res.json({
      success: true,
      source: source,
      case: caseDetails
    });

  } catch (error) {
    console.error('Case details error:', error);
    
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

module.exports = router;
