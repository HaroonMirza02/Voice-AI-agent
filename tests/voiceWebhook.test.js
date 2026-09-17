const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getDb, closeDb } = require('../src/db/database');
const { runMigrations } = require('../src/db/migrations');

const TEST_DB_PATH = path.join(__dirname, '../data/test_voice_webhook.db');
process.env.DB_PATH = TEST_DB_PATH;

let app;

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const db = getDb(TEST_DB_PATH);
  runMigrations(db);
  app = require('../src/app');
});

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (e) {}
  }
});

describe('Voice Platform Webhook & Tools (/api/voice)', () => {
  let createdPatientId;

  describe('POST /api/voice/webhook - tool-calls', () => {
    it('should process check_existing_patient and return not found when empty', async () => {
      const vapiPayload = {
        message: {
          type: 'tool-calls',
          toolCalls: [
            {
              id: 'call_check_01',
              type: 'function',
              function: {
                name: 'check_existing_patient',
                arguments: { phone_number: '4155550099' }
              }
            }
          ],
          call: {
            id: 'vapi_test_call_01',
            customer: { number: '+14155550099' }
          }
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(vapiPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].toolCallId).toBe('call_check_01');

      const result = JSON.parse(res.body.results[0].result);
      expect(result.found).toBe(false);
      expect(result.speech_prompt).toContain("I don't see any prior registrations");
    });

    it('should process create_patient and return confirmation speech prompt', async () => {
      const vapiPayload = {
        message: {
          type: 'tool-calls',
          toolCalls: [
            {
              id: 'call_create_02',
              type: 'function',
              function: {
                name: 'create_patient',
                arguments: {
                  first_name: 'David',
                  last_name: 'Miller',
                  date_of_birth: '1975-06-18',
                  sex: 'Male',
                  phone_number: '4155550099',
                  address_line_1: '100 Market St',
                  city: 'San Francisco',
                  state: 'CA',
                  zip_code: '94105',
                  insurance_provider: 'UnitedHealthcare',
                  insurance_member_id: 'UH987654'
                }
              }
            }
          ],
          call: {
            id: 'vapi_test_call_02',
            customer: { number: '+14155550099' }
          }
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(vapiPayload);

      expect(res.status).toBe(200);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.patient_id).toBeDefined();
      expect(result.speech_prompt).toContain('Thank you, David!');
      expect(result.speech_prompt).toContain('officially registered');

      createdPatientId = result.patient_id;
    });

    it('should detect existing patient on subsequent call to check_existing_patient', async () => {
      const vapiPayload = {
        message: {
          type: 'tool-calls',
          toolCalls: [
            {
              id: 'call_check_03',
              type: 'function',
              function: {
                name: 'check_existing_patient',
                arguments: { phone_number: '4155550099' }
              }
            }
          ],
          call: {
            id: 'vapi_test_call_03',
            customer: { number: '+14155550099' }
          }
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(vapiPayload);

      expect(res.status).toBe(200);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.found).toBe(true);
      expect(result.patient.first_name).toBe('David');
      expect(result.speech_prompt).toContain('David Miller');
      expect(result.speech_prompt).toContain('update this record');
    });

    it('should return helpful speech_prompt when create_patient fails validation', async () => {
      const vapiPayload = {
        message: {
          type: 'tool-calls',
          toolCalls: [
            {
              id: 'call_create_err',
              type: 'function',
              function: {
                name: 'create_patient',
                arguments: {
                  first_name: 'Invalid',
                  last_name: 'Patient',
                  date_of_birth: '2099-01-01', // Future date
                  sex: 'Male',
                  phone_number: '4155551122',
                  address_line_1: '123 Main St',
                  city: 'San Francisco',
                  state: 'CA',
                  zip_code: '94105'
                }
              }
            }
          ],
          call: { id: 'vapi_test_err' }
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(vapiPayload);

      expect(res.status).toBe(200);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.speech_prompt).toContain('future');
    });

    it('should execute update_patient to modify existing record', async () => {
      const vapiPayload = {
        message: {
          type: 'tool-calls',
          toolCalls: [
            {
              id: 'call_update_01',
              type: 'function',
              function: {
                name: 'update_patient',
                arguments: {
                  patient_id: createdPatientId,
                  address_line_1: '200 Mission St'
                }
              }
            }
          ],
          call: { id: 'vapi_test_call_update' }
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(vapiPayload);

      expect(res.status).toBe(200);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.speech_prompt).toContain('updated your record');
    });
  });

  describe('POST /api/voice/webhook - end-of-call-report', () => {
    it('should record call metrics and transcripts', async () => {
      const reportPayload = {
        message: {
          type: 'end-of-call-report',
          call: {
            id: 'vapi_call_completed_99',
            customer: { number: '+14155550099' }
          },
          transcript: 'Caller registered successfully as David Miller.',
          durationSeconds: 145,
          endedReason: 'customer-ended-call'
        }
      };

      const res = await request(app)
        .post('/api/voice/webhook')
        .send(reportPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/voice/logs', () => {
    it('should return logged voice calls', async () => {
      const res = await request(app).get('/api/voice/logs?limit=10');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
