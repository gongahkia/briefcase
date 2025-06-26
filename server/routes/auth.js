const express = require('express');
const axios = require('axios');
const router = express.Router();

// LawNet OAuth configuration
const LAWNET_CONFIG = {
  clientId: process.env.LAWNET_CLIENT_ID,
  clientSecret: process.env.LAWNET_CLIENT_SECRET,
  redirectUri: process.env.LAWNET_REDIRECT_URI,
  tokenUrl: process.env.LAWNET_TOKEN_URL || 'https://auth.lawnet.sg/oauth/token',
  userInfoUrl: process.env.LAWNET_USER_INFO_URL || 'https://api.lawnet.sg/user/info'
};

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

    // Validate environment variables
    if (!LAWNET_CONFIG.clientId || !LAWNET_CONFIG.clientSecret) {
      console.error('Missing LawNet OAuth credentials');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'OAuth credentials not configured'
      });
    }

    // Exchange code for token
    const tokenResponse = await axios.post(LAWNET_CONFIG.tokenUrl, {
      grant_type: 'authorization_code',
      client_id: LAWNET_CONFIG.clientId,
      client_secret: LAWNET_CONFIG.clientSecret,
      code: code,
      redirect_uri: LAWNET_CONFIG.redirectUri
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
      const userResponse = await axios.get(LAWNET_CONFIG.userInfoUrl, {
        headers: {
          'Authorization': `${token_type} ${access_token}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      userInfo = userResponse.data;
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
          message: 'Invalid client credentials'
        });
      }
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

    const tokenResponse = await axios.post(LAWNET_CONFIG.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: LAWNET_CONFIG.clientId,
      client_secret: LAWNET_CONFIG.clientSecret,
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
    
    res.status(401).json({
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

    // Validate token by making a request to user info endpoint
    const userResponse = await axios.get(LAWNET_CONFIG.userInfoUrl, {
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
    
    res.status(401).json({
      valid: false,
      error: 'Invalid token',
      message: 'Access token is invalid or expired'
    });
  }
});

module.exports = router;
