const { randomUUID: uuidv4 } = require('crypto');
const { getDb } = require('../db/database');

class PatientRepository {
  constructor(db) {
    this.db = db;
  }

  get database() {
    return this.db || getDb();
  }

  /**
   * Create a new patient record
   */
  create(patientData) {
    const patient_id = patientData.patient_id || uuidv4();
    const now = new Date().toISOString();

    const record = {
      patient_id,
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      date_of_birth: patientData.date_of_birth,
      sex: patientData.sex,
      phone_number: patientData.phone_number,
      email: patientData.email || null,
      address_line_1: patientData.address_line_1,
      address_line_2: patientData.address_line_2 || null,
      city: patientData.city,
      state: patientData.state,
      zip_code: patientData.zip_code,
      insurance_provider: patientData.insurance_provider || null,
      insurance_member_id: patientData.insurance_member_id || null,
      preferred_language: patientData.preferred_language || 'English',
      emergency_contact_name: patientData.emergency_contact_name || null,
      emergency_contact_phone: patientData.emergency_contact_phone || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const stmt = this.database.prepare(`
      INSERT INTO patients (
        patient_id, first_name, last_name, date_of_birth, sex,
        phone_number, email, address_line_1, address_line_2, city,
        state, zip_code, insurance_provider, insurance_member_id,
        preferred_language, emergency_contact_name, emergency_contact_phone,
        created_at, updated_at, deleted_at
      ) VALUES (
        @patient_id, @first_name, @last_name, @date_of_birth, @sex,
        @phone_number, @email, @address_line_1, @address_line_2, @city,
        @state, @zip_code, @insurance_provider, @insurance_member_id,
        @preferred_language, @emergency_contact_name, @emergency_contact_phone,
        @created_at, @updated_at, @deleted_at
      )
    `);

    stmt.run(record);
    return record;
  }

  /**
   * Find patient by ID (excluding soft-deleted)
   */
  findById(patientId) {
    const stmt = this.database.prepare(`
      SELECT * FROM patients
      WHERE patient_id = ? AND deleted_at IS NULL
    `);
    return stmt.get(patientId) || null;
  }

  /**
   * Find patient by phone number (excluding soft-deleted)
   */
  findByPhone(phoneNumber) {
    const stmt = this.database.prepare(`
      SELECT * FROM patients
      WHERE phone_number = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(phoneNumber) || null;
  }

  /**
   * List all patients excluding soft-deleted, with optional filters
   */
  findAll(filters = {}) {
    let sql = 'SELECT * FROM patients WHERE deleted_at IS NULL';
    const params = [];

    if (filters.last_name) {
      sql += ' AND LOWER(last_name) = LOWER(?)';
      params.push(filters.last_name.trim());
    }

    if (filters.date_of_birth) {
      sql += ' AND date_of_birth = ?';
      params.push(filters.date_of_birth.trim());
    }

    if (filters.phone_number) {
      sql += ' AND phone_number = ?';
      params.push(filters.phone_number.trim());
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.database.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Partial update of patient record
   */
  update(patientId, fields) {
    const existing = this.findById(patientId);
    if (!existing) {
      return null;
    }

    const updates = [];
    const params = {};
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(fields)) {
      updates.push(`${key} = @${key}`);
      params[key] = value;
    }

    updates.push('updated_at = @updated_at');
    params.updated_at = now;
    params.patient_id = patientId;

    const sql = `
      UPDATE patients
      SET ${updates.join(', ')}
      WHERE patient_id = @patient_id AND deleted_at IS NULL
    `;

    const stmt = this.database.prepare(sql);
    stmt.run(params);

    return this.findById(patientId);
  }

  /**
   * Soft-delete patient by ID
   */
  softDelete(patientId) {
    const existing = this.findById(patientId);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const stmt = this.database.prepare(`
      UPDATE patients
      SET deleted_at = ?
      WHERE patient_id = ? AND deleted_at IS NULL
    `);

    const result = stmt.run(now, patientId);
    return result.changes > 0 ? { ...existing, deleted_at: now } : null;
  }
}

module.exports = new PatientRepository();
module.exports.PatientRepository = PatientRepository;
