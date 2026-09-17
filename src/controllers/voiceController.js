const voiceService = require('../services/voiceService');
const callLogRepository = require('../repositories/callLogRepository');
const config = require('../config/env');

class VoiceController {
  /**
   * POST /api/voice/webhook
   * Vapi Tool Calling & Event Webhook Endpoint
   */
  async handleWebhook(req, res, next) {
    try {
      // Optional Webhook secret verification
      if (config.webhookSecret) {
        const secretHeader = req.headers['x-vapi-secret'] || req.headers['authorization'];
        if (secretHeader !== config.webhookSecret) {
          return res.status(401).json({
            data: null,
            error: { message: 'Unauthorized webhook secret' },
          });
        }
      }

      const response = await voiceService.handleVapiWebhook(req.body);
      return res.status(200).json(response);
    } catch (err) {
      console.error('[VoiceController Webhook Error]:', err);
      // Voice platforms require 200 with error info rather than 500 to keep the call alive
      return res.status(200).json({
        results: [
          {
            toolCallId: req.body?.message?.toolCalls?.[0]?.id || 'error',
            result: JSON.stringify({
              success: false,
              error: err.message,
              speech_prompt: 'I encountered an unexpected internal error. Please try again in a moment.',
            }),
          },
        ],
      });
    }
  }

  /**
   * GET /api/voice/logs
   * Retrieve recent voice call logs for dashboard audit
   */
  async getCallLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const logs = callLogRepository.findRecent(limit);
      return res.status(200).json({
        data: logs,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/voice/simulate
   * Direct tool simulation endpoint for local testing and dashboard interaction
   */
  async simulateToolCall(req, res, next) {
    try {
      const { toolName, args, callerPhone } = req.body;
      if (!toolName) {
        return res.status(400).json({
          data: null,
          error: { message: 'toolName is required' },
        });
      }

      const callId = `sim_${Date.now()}`;
      const result = await voiceService.executeTool(toolName, args || {}, { callId, callerPhone });
      return res.status(200).json({
        data: {
          callId,
          toolName,
          result,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VoiceController();
