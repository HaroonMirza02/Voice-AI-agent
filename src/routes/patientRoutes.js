const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

// GET /patients - list with filters
router.get('/', (req, res, next) => patientController.getPatients(req, res, next));

// GET /patients/check-phone/:phone - duplicate lookup helper
router.get('/check-phone/:phone', (req, res, next) => patientController.checkDuplicatePhone(req, res, next));

// GET /patients/:id - get single patient
router.get('/:id', (req, res, next) => patientController.getPatientById(req, res, next));

// POST /patients - create patient with server validation
router.post('/', (req, res, next) => patientController.createPatient(req, res, next));

// PUT /patients/:id - partial update patient
router.put('/:id', (req, res, next) => patientController.updatePatient(req, res, next));

// DELETE /patients/:id - soft delete patient
router.delete('/:id', (req, res, next) => patientController.deletePatient(req, res, next));

module.exports = router;
