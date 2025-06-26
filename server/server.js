const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Try to load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config();
  console.log('✅ Loaded configuration from .env file');
} else {
  console.log('⚠️  No .env file found, will use dynamic configuration');
}

const authRoutes = require('./routes/auth');
const casesRoutes = require('./routes/cases');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.lawnet.sg", "https://auth.lawnet.sg"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const lawnetLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  message: {
    error: 'LawNet API rate limit exceeded. Maximum 5 requests per second.',
    retryAfter: '1 second'
  },
  keyGenerator: (req) => {
    return req.body.apiKey || req.ip;
  }
});

app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    configSource: fs.existsSync(envPath) ? '.env file' : 'dynamic'
  });
});

// Routes
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cases', lawnetLimiter, casesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'LawNet service unavailable',
      message: 'Unable to connect to LawNet API'
    });
  }
  
  if (err.response && err.response.status) {
    return res.status(err.response.status).json({
      error: 'LawNet API Error',
      message: err.response.data?.message || 'External API error'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Briefcase server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚙️  Config source: ${fs.existsSync(envPath) ? '.env file' : 'dynamic configuration'}`);
});

module.exports = app;
