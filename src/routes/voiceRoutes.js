const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// POST /api/voice/webhook - Vapi tool-calling and event webhook
router.post('/webhook', (req, res, next) => voiceController.handleWebhook(req, res, next));

// GET /api/voice/logs - audit trail of voice calls
router.get('/logs', (req, res, next) => voiceController.getCallLogs(req, res, next));

// POST /api/voice/simulate - interactive simulation
router.post('/simulate', (req, res, next) => voiceController.simulateToolCall(req, res, next));

module.exports = router;
