const express = require('express');
const cors = require('cors');
const path = require('path');
const patientRoutes = require('./routes/patientRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Security and utility middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static dashboard files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// REST API Routes
// Primary routes as requested: /patients
app.use('/patients', patientRoutes);
// Compatibility alias: /api/patients
app.use('/api/patients', patientRoutes);

// Voice Platform Webhook & Logs Routes
app.use('/api/voice', voiceRoutes);

// Dashboard SPA fallback for root if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 and Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
