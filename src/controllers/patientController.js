const patientService = require('../services/patientService');

class PatientController {
  /**
   * GET /patients
   * Query filters: last_name, date_of_birth, phone_number
   */
  async getPatients(req, res, next) {
    try {
      const filters = {
        last_name: req.query.last_name,
        date_of_birth: req.query.date_of_birth,
        phone_number: req.query.phone_number,
      };

      const patients = await patientService.listPatients(filters);
      return res.status(200).json({
        data: patients,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /patients/:id
   */
  async getPatientById(req, res, next) {
    try {
      const { id } = req.params;
      const patient = await patientService.getPatientById(id);
      return res.status(200).json({
        data: patient,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /patients
   * Full server-side validation
   */
  async createPatient(req, res, next) {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          data: null,
          error: { message: 'Request body cannot be empty' },
        });
      }

      const created = await patientService.createPatient(req.body);
      return res.status(201).json({
        data: created,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /patients/:id
   * Partial updates allowed
   */
  async updatePatient(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          data: null,
          error: { message: 'Request body must contain fields to update' },
        });
      }

      const updated = await patientService.updatePatient(id, req.body);
      return res.status(200).json({
        data: updated,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /patients/:id
   * Soft delete (deleted_at), never hard-delete
   */
  async deletePatient(req, res, next) {
    try {
      const { id } = req.params;
      const result = await patientService.softDeletePatient(id);
      return res.status(200).json({
        data: {
          message: 'Patient soft-deleted successfully',
          patient_id: result.patient_id,
          deleted_at: result.deleted_at,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /patients/check-phone/:phone
   * Helper endpoint for duplicate check
   */
  async checkDuplicatePhone(req, res, next) {
    try {
      const { phone } = req.params;
      const check = await patientService.checkExistingByPhone(phone);
      return res.status(200).json({
        data: check,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PatientController();
