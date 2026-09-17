const patientRepository = require('../repositories/patientRepository');
const { validatePatient, validatePartialPatient, normalizePhoneNumber } = require('../validators/patientValidator');

class PatientService {
  constructor(repo = patientRepository) {
    this.repo = repo;
  }

  /**
   * Create a new patient
   */
  async createPatient(data) {
    const { isValid, errors, sanitized } = validatePatient(data);
    if (!isValid) {
      const err = new Error('Validation failed');
      err.status = 422;
      err.details = errors;
      throw err;
    }

    const created = this.repo.create(sanitized);
    return created;
  }

  /**
   * Get patient by ID
   */
  async getPatientById(patientId) {
    const patient = this.repo.findById(patientId);
    if (!patient) {
      const err = new Error('Patient not found');
      err.status = 404;
      throw err;
    }
    return patient;
  }

  /**
   * List patients with optional filters
   */
  async listPatients(filters = {}) {
    return this.repo.findAll(filters);
  }

  /**
   * Partial update patient
   */
  async updatePatient(patientId, updateData) {
    // Check if patient exists
    const existing = this.repo.findById(patientId);
    if (!existing) {
      const err = new Error('Patient not found');
      err.status = 404;
      throw err;
    }

    const { isValid, errors, sanitized } = validatePartialPatient(updateData);
    if (!isValid) {
      const err = new Error('Validation failed');
      err.status = 422;
      err.details = errors;
      throw err;
    }

    const updated = this.repo.update(patientId, sanitized);
    return updated;
  }

  /**
   * Soft delete patient
   */
  async softDeletePatient(patientId) {
    const existing = this.repo.findById(patientId);
    if (!existing) {
      const err = new Error('Patient not found');
      err.status = 404;
      throw err;
    }

    const result = this.repo.softDelete(patientId);
    return result;
  }

  /**
   * Check for existing patient by phone number (Duplicate detection)
   */
  async checkExistingByPhone(phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized || normalized.length !== 10) {
      return { found: false, patient: null };
    }

    const patient = this.repo.findByPhone(normalized);
    if (patient) {
      return {
        found: true,
        patient: {
          patient_id: patient.patient_id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          date_of_birth: patient.date_of_birth,
          phone_number: patient.phone_number,
          city: patient.city,
          state: patient.state,
        }
      };
    }

    return { found: false, patient: null };
  }
}

module.exports = new PatientService();
module.exports.PatientService = PatientService;
