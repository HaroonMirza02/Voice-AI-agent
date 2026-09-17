const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('../src/db/migrations');
const { PatientRepository } = require('../src/repositories/patientRepository');

const PERSISTENCE_DB_PATH = path.join(__dirname, '../data/test_persistence.db');

describe('Database Persistence Across Server Restarts', () => {
  beforeAll(() => {
    // Clear out any old test persistence file
    if (fs.existsSync(PERSISTENCE_DB_PATH)) {
      fs.unlinkSync(PERSISTENCE_DB_PATH);
    }
  });

  afterAll(() => {
    if (fs.existsSync(PERSISTENCE_DB_PATH)) {
      try {
        fs.unlinkSync(PERSISTENCE_DB_PATH);
      } catch (e) {}
    }
  });

  it('should persist registered patient across database restarts and process termination', () => {
    // 1. Session 1: Start "server", open DB, create record
    let dbSession1 = new Database(PERSISTENCE_DB_PATH);
    dbSession1.pragma('journal_mode = WAL');
    runMigrations(dbSession1);

    const repo1 = new PatientRepository(dbSession1);
    const createdPatient = repo1.create({
      first_name: 'Evelyn',
      last_name: 'Cross',
      date_of_birth: '1979-03-25',
      sex: 'Female',
      phone_number: '3125558900',
      address_line_1: '600 North Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      zip_code: '60611',
      insurance_provider: 'Humana',
      insurance_member_id: 'HUM334455',
      preferred_language: 'English',
    });

    const targetPatientId = createdPatient.patient_id;
    expect(targetPatientId).toBeDefined();

    // Verify record in Session 1
    const verifyBeforeShutdown = repo1.findById(targetPatientId);
    expect(verifyBeforeShutdown).not.toBeNull();
    expect(verifyBeforeShutdown.last_name).toBe('Cross');

    // 2. Simulate Server Shutdown: Close DB connection completely
    dbSession1.close();
    dbSession1 = null;

    // Verify database file physically exists on disk
    expect(fs.existsSync(PERSISTENCE_DB_PATH)).toBe(true);
    const stats = fs.statSync(PERSISTENCE_DB_PATH);
    expect(stats.size).toBeGreaterThan(0);

    // 3. Session 2: Simulate Server Restart - Connect anew to disk file
    let dbSession2 = new Database(PERSISTENCE_DB_PATH);
    dbSession2.pragma('journal_mode = WAL');
    runMigrations(dbSession2);

    const repo2 = new PatientRepository(dbSession2);

    // Assert patient survives restart completely intact
    const verifyAfterRestart = repo2.findById(targetPatientId);
    expect(verifyAfterRestart).not.toBeNull();
    expect(verifyAfterRestart.patient_id).toBe(targetPatientId);
    expect(verifyAfterRestart.first_name).toBe('Evelyn');
    expect(verifyAfterRestart.last_name).toBe('Cross');
    expect(verifyAfterRestart.date_of_birth).toBe('1979-03-25');
    expect(verifyAfterRestart.phone_number).toBe('3125558900');
    expect(verifyAfterRestart.city).toBe('Chicago');
    expect(verifyAfterRestart.state).toBe('IL');
    expect(verifyAfterRestart.zip_code).toBe('60611');
    expect(verifyAfterRestart.insurance_provider).toBe('Humana');
    expect(verifyAfterRestart.deleted_at).toBeNull();

    // Also assert phone lookup succeeds across restart
    const phoneLookup = repo2.findByPhone('3125558900');
    expect(phoneLookup).not.toBeNull();
    expect(phoneLookup.patient_id).toBe(targetPatientId);

    // 4. Test soft-delete persistence across another restart
    repo2.softDelete(targetPatientId);
    dbSession2.close();
    dbSession2 = null;

    // Session 3: Restart again, ensure soft-delete status is preserved
    let dbSession3 = new Database(PERSISTENCE_DB_PATH);
    const repo3 = new PatientRepository(dbSession3);

    expect(repo3.findById(targetPatientId)).toBeNull(); // Excluded from active queries
    const rawRecord = dbSession3.prepare('SELECT * FROM patients WHERE patient_id = ?').get(targetPatientId);
    expect(rawRecord).not.toBeNull();
    expect(rawRecord.deleted_at).not.toBeNull();

    dbSession3.close();
  });
});
