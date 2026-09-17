const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getDb, closeDb } = require('../src/db/database');
const { runMigrations } = require('../src/db/migrations');

// Setup test database
const TEST_DB_PATH = path.join(__dirname, '../data/test_patients.db');
process.env.DB_PATH = TEST_DB_PATH;

let app;

beforeAll(() => {
  // Ensure fresh database for test suite
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

describe('Patient REST API (/patients)', () => {
  let createdPatientId;
  const samplePatient = {
    first_name: 'Alexander',
    last_name: 'Hamilton',
    date_of_birth: '1980-01-11',
    sex: 'Male',
    phone_number: '2125551776',
    email: 'alexander@example.com',
    address_line_1: '57 Maiden Lane',
    address_line_2: 'Suite 3',
    city: 'New York',
    state: 'NY',
    zip_code: '10038',
    insurance_provider: 'Empire Health',
    insurance_member_id: 'EMP177689',
    preferred_language: 'English',
    emergency_contact_name: 'Elizabeth Hamilton',
    emergency_contact_phone: '2125551777',
  };

  describe('POST /patients (Registration)', () => {
    it('should successfully register a new patient with complete valid data', async () => {
      const res = await request(app)
        .post('/patients')
        .send(samplePatient);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.error).toBeNull();
      expect(res.body.data.patient_id).toBeDefined();
      expect(res.body.data.first_name).toBe('Alexander');
      expect(res.body.data.last_name).toBe('Hamilton');
      expect(res.body.data.phone_number).toBe('2125551776');
      expect(res.body.data.deleted_at).toBeNull();

      createdPatientId = res.body.data.patient_id;
    });

    it('should reject registration if required fields are missing', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          first_name: 'Incomplete',
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(res.body.error).toBeDefined();
      expect(res.body.error.details).toHaveProperty('last_name');
      expect(res.body.error.details).toHaveProperty('date_of_birth');
      expect(res.body.error.details).toHaveProperty('phone_number');
      expect(res.body.error.details).toHaveProperty('address_line_1');
      expect(res.body.error.details).toHaveProperty('city');
      expect(res.body.error.details).toHaveProperty('state');
      expect(res.body.error.details).toHaveProperty('zip_code');
    });

    it('should reject invalid future date of birth', async () => {
      const futureDate = '2099-12-31';
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '2125559991',
          date_of_birth: futureDate,
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(res.body.error.details.date_of_birth).toContain('future');
    });

    it('should reject malformed calendar date of birth', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '2125559992',
          date_of_birth: '1990-02-31', // Feb 31 does not exist
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(res.body.error.details.date_of_birth).toContain('invalid calendar date');
    });

    it('should reject invalid US phone number format', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '12345', // Too short
        });

      expect(res.status).toBe(422);
      expect(res.body.error.details.phone_number).toContain('10-digit');
    });

    it('should reject invalid biological sex enum', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '2125559993',
          sex: 'InvalidSexOption',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.details.sex).toContain('Invalid sex');
    });

    it('should reject invalid 2-letter US state abbreviation', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '2125559994',
          state: 'ZZ',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.details.state).toContain('valid 2-letter');
    });

    it('should normalize formatted phone number (+1 (555) 000-1122)', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          ...samplePatient,
          phone_number: '+1 (555) 000-1122',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.phone_number).toBe('5550001122');
    });
  });

  describe('GET /patients (Listing & Filtering)', () => {
    beforeAll(async () => {
      // Add a second patient for filtering verification
      await request(app)
        .post('/patients')
        .send({
          first_name: 'Elizabeth',
          last_name: 'Schuyler',
          date_of_birth: '1982-08-09',
          sex: 'Female',
          phone_number: '2125551780',
          address_line_1: '10 Wall Street',
          city: 'Albany',
          state: 'NY',
          zip_code: '12207',
        });
    });

    it('should list all active patients', async () => {
      const res = await request(app).get('/patients');
      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by ?last_name=', async () => {
      const res = await request(app).get('/patients?last_name=Hamilton');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every(p => p.last_name.toLowerCase() === 'hamilton')).toBe(true);

      const resSchuyler = await request(app).get('/patients?last_name=Schuyler');
      expect(resSchuyler.status).toBe(200);
      expect(resSchuyler.body.data.length).toBe(1);
      expect(resSchuyler.body.data[0].last_name).toBe('Schuyler');
    });

    it('should filter by ?date_of_birth=', async () => {
      const res = await request(app).get('/patients?date_of_birth=1982-08-09');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].first_name).toBe('Elizabeth');
    });

    it('should filter by ?phone_number=', async () => {
      const res = await request(app).get('/patients?phone_number=2125551780');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].last_name).toBe('Schuyler');
    });
  });

  describe('GET /patients/:id', () => {
    it('should return 200 and patient record for valid ID', async () => {
      const res = await request(app).get(`/patients/${createdPatientId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.patient_id).toBe(createdPatientId);
      expect(res.body.data.first_name).toBe('Alexander');
    });

    it('should return 404 for non-existent patient ID', async () => {
      const res = await request(app).get('/patients/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
      expect(res.body.error.message).toContain('not found');
    });
  });

  describe('PUT /patients/:id (Partial Update)', () => {
    it('should partially update specific fields and touch updated_at', async () => {
      const res = await request(app)
        .put(`/patients/${createdPatientId}`)
        .send({
          address_line_1: '100 Broadway',
          city: 'Brooklyn',
          zip_code: '11201',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.address_line_1).toBe('100 Broadway');
      expect(res.body.data.city).toBe('Brooklyn');
      expect(res.body.data.zip_code).toBe('11201');
      expect(res.body.data.first_name).toBe('Alexander'); // unchanged
    });

    it('should reject modifications to immutable fields like patient_id', async () => {
      const res = await request(app)
        .put(`/patients/${createdPatientId}`)
        .send({
          patient_id: 'new-id-attempt',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.details).toHaveProperty('patient_id');
    });

    it('should return 404 when updating non-existent patient', async () => {
      const res = await request(app)
        .put('/patients/00000000-0000-0000-0000-000000000000')
        .send({ city: 'Nowhere' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /patients/:id (Soft Delete)', () => {
    it('should soft delete patient, retaining record in DB but setting deleted_at', async () => {
      const res = await request(app).delete(`/patients/${createdPatientId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.patient_id).toBe(createdPatientId);
      expect(res.body.data.deleted_at).toBeDefined();

      // Ensure excluded from GET /patients list
      const listRes = await request(app).get('/patients');
      const foundInList = listRes.body.data.some(p => p.patient_id === createdPatientId);
      expect(foundInList).toBe(false);

      // Subsequent GET /patients/:id should return 404
      const getRes = await request(app).get(`/patients/${createdPatientId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting an already soft-deleted patient', async () => {
      const res = await request(app).delete(`/patients/${createdPatientId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Duplicate Phone Detection', () => {
    it('should find existing patient by phone number', async () => {
      const res = await request(app).get('/patients/check-phone/2125551780');
      expect(res.status).toBe(200);
      expect(res.body.data.found).toBe(true);
      expect(res.body.data.patient.last_name).toBe('Schuyler');
    });

    it('should return found: false for unregistered phone number', async () => {
      const res = await request(app).get('/patients/check-phone/9998887777');
      expect(res.status).toBe(200);
      expect(res.body.data.found).toBe(false);
      expect(res.body.data.patient).toBeNull();
    });
  });
});
