const express = require('express');
const router = express.Router();

// In-memory configuration store for dynamic config
let dynamicConfig = {};

/**
 * Get current configuration status
 * GET /api/config/status
 */
router.get('/status', (req, res) => {
  const hasEnvFile = !!process.env.LAWNET_CLIENT_ID;
  const hasDynamicConfig = Object.keys(dynamicConfig).length > 0;
  
  res.json({
    hasEnvFile,
    hasDynamicConfig,
    configSource: hasEnvFile ? 'env_file' : hasDynamicConfig ? 'dynamic' : 'none',
    requiredFields: [
      'LAWNET_CLIENT_ID',
      'LAWNET_CLIENT_SECRET', 
      'LAWNET_REDIRECT_URI',
      'LAWNET_TOKEN_URL',
      'LAWNET_USER_INFO_URL',
      'LAWNET_API_BASE_URL'
    ],
    configuredFields: hasEnvFile 
      ? getEnvConfiguredFields()
      : Object.keys(dynamicConfig)
  });
});

/**
 * Set dynamic configuration
 * POST /api/config/set
 */
router.post('/set', (req, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    const requiredFields = [
      'LAWNET_CLIENT_ID',
      'LAWNET_CLIENT_SECRET',
      'LAWNET_REDIRECT_URI', 
      'LAWNET_TOKEN_URL',
      'LAWNET_USER_INFO_URL',
      'LAWNET_API_BASE_URL'
    ];
    
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required configuration fields',
        missingFields
      });
    }
    
    // Store configuration
    dynamicConfig = { ...config };
    
    console.log('✅ Dynamic configuration updated');
    
    res.json({
      success: true,
      message: 'Configuration saved successfully',
      configuredFields: Object.keys(dynamicConfig)
    });
    
  } catch (error) {
    console.error('Configuration error:', error);
    res.status(500).json({
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

/**
 * Get configuration values (for client use)
 * GET /api/config/values
 */
router.get('/values', (req, res) => {
  const config = getConfig();
  
  // Only return non-sensitive values to client
  res.json({
    LAWNET_REDIRECT_URI: config.LAWNET_REDIRECT_URI,
    LAWNET_TOKEN_URL: config.LAWNET_TOKEN_URL,
    LAWNET_USER_INFO_URL: config.LAWNET_USER_INFO_URL,
    LAWNET_API_BASE_URL: config.LAWNET_API_BASE_URL,
    CLIENT_URL: config.CLIENT_URL || 'http://localhost:3000',
    hasClientId: !!config.LAWNET_CLIENT_ID,
    hasClientSecret: !!config.LAWNET_CLIENT_SECRET
  });
});

/**
 * Helper function to get configuration from env or dynamic config
 */
function getConfig() {
  if (process.env.LAWNET_CLIENT_ID) {
    // Use environment variables
    return {
      LAWNET_CLIENT_ID: process.env.LAWNET_CLIENT_ID,
      LAWNET_CLIENT_SECRET: process.env.LAWNET_CLIENT_SECRET,
      LAWNET_REDIRECT_URI: process.env.LAWNET_REDIRECT_URI,
      LAWNET_TOKEN_URL: process.env.LAWNET_TOKEN_URL,
      LAWNET_USER_INFO_URL: process.env.LAWNET_USER_INFO_URL,
      LAWNET_API_BASE_URL: process.env.LAWNET_API_BASE_URL,
      CLIENT_URL: process.env.CLIENT_URL
    };
  } else {
    // Use dynamic configuration
    return dynamicConfig;
  }
}

/**
 * Helper function to get configured fields from environment
 */
function getEnvConfiguredFields() {
  const fields = [
    'LAWNET_CLIENT_ID',
    'LAWNET_CLIENT_SECRET',
    'LAWNET_REDIRECT_URI',
    'LAWNET_TOKEN_URL', 
    'LAWNET_USER_INFO_URL',
    'LAWNET_API_BASE_URL'
  ];
  
  return fields.filter(field => process.env[field]);
}

// Export the getConfig function for use in other routes
router.getConfig = getConfig;

module.exports = router;
