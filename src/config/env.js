const path = require('path');
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/patients.db'),
  vapiApiKey: process.env.VAPI_API_KEY || '',
  vapiPhoneNumber: process.env.VAPI_PHONE_NUMBER || '',
  vapiAssistantId: process.env.VAPI_ASSISTANT_ID || '',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
};

module.exports = config;
