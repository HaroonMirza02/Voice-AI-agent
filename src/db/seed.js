const { randomUUID: uuidv4 } = require('crypto');
const { getDb, closeDb } = require('./database');
const { runMigrations } = require('./migrations');

function seedDatabase() {
  const db = getDb();
  runMigrations(db);

  const countResult = db.prepare('SELECT COUNT(*) as count FROM patients').get();

  if (countResult && countResult.count > 0) {
    console.log(`[Seed] Database already contains ${countResult.count} patient records. Skipping seed.`);
    return;
  }

  const now = new Date().toISOString();

  const seedPatients = [
    {
      patient_id: uuidv4(),
      first_name: 'Eleanor',
      last_name: 'Vance',
      date_of_birth: '1985-04-12',
      sex: 'Female',
      phone_number: '4155552671',
      email: 'eleanor.vance@example.com',
      address_line_1: '742 Evergreen Terrace',
      address_line_2: 'Apt 4B',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62704',
      insurance_provider: 'Blue Cross Blue Shield',
      insurance_member_id: 'BCBS9842109',
      preferred_language: 'English',
      emergency_contact_name: 'Theodora Vance',
      emergency_contact_phone: '4155558923',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      patient_id: uuidv4(),
      first_name: 'Marcus',
      last_name: 'Chen',
      date_of_birth: '1992-11-23',
      sex: 'Male',
      phone_number: '2125557819',
      email: 'marcus.chen@example.com',
      address_line_1: '120 Broadway',
      address_line_2: null,
      city: 'New York',
      state: 'NY',
      zip_code: '10271',
      insurance_provider: 'Aetna Health',
      insurance_member_id: 'AET654321',
      preferred_language: 'English',
      emergency_contact_name: 'Linda Chen',
      emergency_contact_phone: '2125559900',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  const insertStmt = db.prepare(`
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

  const insertMany = db.transaction((patients) => {
    for (const patient of patients) {
      insertStmt.run(patient);
    }
  });

  insertMany(seedPatients);

  console.log(`[Seed] Successfully inserted ${seedPatients.length} seed patient records.`);
}

if (require.main === module) {
  try {
    seedDatabase();
    closeDb();
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
}

module.exports = { seedDatabase };
