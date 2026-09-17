/**
 * Database migrations and schema initialization
 */

function runMigrations(db) {
  // Create patients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      patient_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      sex TEXT NOT NULL CHECK(sex IN ('Male', 'Female', 'Other', 'Decline to Answer')),
      phone_number TEXT NOT NULL,
      email TEXT,
      address_line_1 TEXT NOT NULL,
      address_line_2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      insurance_provider TEXT,
      insurance_member_id TEXT,
      preferred_language TEXT DEFAULT 'English',
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_patients_phone_number ON patients(phone_number);
    CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
    CREATE INDEX IF NOT EXISTS idx_patients_date_of_birth ON patients(date_of_birth);
    CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients(deleted_at);

    CREATE TABLE IF NOT EXISTS call_logs (
      call_id TEXT PRIMARY KEY,
      phone_number TEXT,
      call_status TEXT DEFAULT 'in-progress',
      transcript TEXT,
      collected_payload TEXT,
      tool_calls TEXT,
      duration_seconds INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs(phone_number);
    CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);
  `);
}

module.exports = {
  runMigrations,
};
