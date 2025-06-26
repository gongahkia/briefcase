const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import config helper
const configRoute = require('./config');

/**
 * Get LawNet configuration with fallback
 */
function getLawNetConfig() {
  // Try to get from dynamic config first, then fallback to environment variables
  const config = configRoute.getConfig();
  
  return {
    clientId: config.LAWNET_CLIENT_ID || process.env.LAWNET_CLIENT_ID,
    clientSecret: config.LAWNET_CLIENT_SECRET || process.env.LAWNET_CLIENT_SECRET,
    redirectUri: config.LAWNET_REDIRECT_URI || process.env.LAWNET_REDIRECT_URI,
    tokenUrl: config.LAWNET_TOKEN_URL || process.env.LAWNET_TOKEN_URL || 'https://auth.lawnet.sg/oauth/token',
    userInfoUrl: config.LAWNET_USER_INFO_URL || process.env.LAWNET_USER_INFO_URL || 'https://api.lawnet.sg/user/info'
  };
}

/**
 * Exchange authorization code for access token
 * POST /api/auth/token
 */
router.post('/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
        message: 'Authorization code is required'
      });
    }

    // Get configuration from dynamic config or environment variables
    const lawnetConfig = getLawNetConfig();
    
    if (!lawnetConfig.clientId || !lawnetConfig.clientSecret) {
      console.error('Missing LawNet OAuth credentials');
      return res.status(500).json({
        error: 'Server configuration incomplete',
        message: 'LawNet OAuth credentials not configured. Please configure via environment variables or dynamic configuration.'
      });
    }

    console.log('Exchanging authorization code for access token...');

    // Exchange code for token
    const tokenResponse = await axios.post(lawnetConfig.tokenUrl, {
      grant_type: 'authorization_code',
      client_id: lawnetConfig.clientId,
      client_secret: lawnetConfig.clientSecret,
      code: code,
      redirect_uri: lawnetConfig.redirectUri
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;

    // Get user information
    let userInfo = null;
    try {
      const userResponse = await axios.get(lawnetConfig.userInfoUrl, {
        headers: {
          'Authorization': `${token_type} ${access_token}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      userInfo = userResponse.data;
      console.log('Successfully retrieved user information');
    } catch (userError) {
      console.warn('Failed to fetch user info:', userError.message);
      // Continue without user info - not critical
    }

    res.json({
      success: true,
      token: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      tokenType: token_type,
      user: userInfo
    });

  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 400) {
        return res.status(400).json({
          error: 'Invalid authorization code',
          message: errorData.error_description || 'The authorization code is invalid or expired'
        });
      }
      
      if (status === 401) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid client credentials. Please check your LawNet OAuth configuration.'
        });
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'LawNet authentication service request timed out'
      });
    }
    
    res.status(500).json({
      error: 'Token exchange failed',
      message: 'Unable to exchange authorization code for access token'
    });
  }
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required'
      });
    }

    const lawnetConfig = getLawNetConfig();
    
    if (!lawnetConfig.clientId || !lawnetConfig.clientSecret) {
      return res.status(500).json({
        error: 'Server configuration incomplete',
        message: 'LawNet OAuth credentials not configured'
      });
    }

    console.log('Refreshing access token...');

    const tokenResponse = await axios.post(lawnetConfig.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: lawnetConfig.clientId,
      client_secret: lawnetConfig.clientSecret,
      refresh_token: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;

    res.json({
      success: true,
      token: access_token,
      refreshToken: refresh_token || refreshToken, // Some APIs don't return new refresh token
      expiresIn: expires_in,
      tokenType: token_type
    });

  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token is invalid or expired. Please re-authenticate.'
      });
    }
    
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Unable to refresh access token. Please re-authenticate.'
    });
  }
});

/**
 * Validate access token
 * POST /api/auth/validate
 */
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Access token is required'
      });
    }

    const lawnetConfig = getLawNetConfig();

    // Validate token by making a request to user info endpoint
    const userResponse = await axios.get(lawnetConfig.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    res.json({
      valid: true,
      user: userResponse.data
    });

  } catch (error) {
    console.error('Token validation error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid token',
        message: 'Access token is invalid or expired'
      });
    }
    
    res.status(500).json({
      valid: false,
      error: 'Validation failed',
      message: 'Unable to validate access token'
    });
  }
});

/**
 * Get OAuth authorization URL
 * GET /api/auth/url
 */
router.get('/url', (req, res) => {
  try {
    const lawnetConfig = getLawNetConfig();
    
    if (!lawnetConfig.clientId) {
      return res.status(500).json({
        error: 'Configuration incomplete',
        message: 'LawNet Client ID not configured'
      });
    }

    const authUrl = `https://auth.lawnet.sg/oauth/authorize?` +
      `client_id=${encodeURIComponent(lawnetConfig.clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(lawnetConfig.redirectUri)}&` +
      `scope=read`;

    res.json({
      success: true,
      authUrl: authUrl,
      clientId: lawnetConfig.clientId,
      redirectUri: lawnetConfig.redirectUri
    });

  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({
      error: 'Failed to generate auth URL',
      message: 'Unable to generate LawNet authorization URL'
    });
  }
});

/**
 * Logout and revoke token
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Access token is required for logout'
      });
    }

    const lawnetConfig = getLawNetConfig();

    // Attempt to revoke the token (if LawNet supports token revocation)
    try {
      await axios.post(`${lawnetConfig.tokenUrl}/revoke`, {
        token: token,
        client_id: lawnetConfig.clientId,
        client_secret: lawnetConfig.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      console.log('Token successfully revoked');
    } catch (revokeError) {
      console.warn('Token revocation failed (may not be supported):', revokeError.message);
      // Continue with logout even if revocation fails
    }

    res.json({
      success: true,
      message: 'Successfully logged out'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Unable to complete logout process'
    });
  }
});

module.exports = router;
