const { randomUUID: uuidv4 } = require('crypto');
const { getDb } = require('../db/database');

class CallLogRepository {
  constructor(db) {
    this.db = db;
  }

  get database() {
    return this.db || getDb();
  }

  logCall(data) {
    const call_id = data.call_id || uuidv4();
    const now = new Date().toISOString();

    const record = {
      call_id,
      phone_number: data.phone_number || null,
      call_status: data.call_status || 'completed',
      transcript: typeof data.transcript === 'object' ? JSON.stringify(data.transcript) : (data.transcript || null),
      collected_payload: typeof data.collected_payload === 'object' ? JSON.stringify(data.collected_payload) : (data.collected_payload || null),
      tool_calls: typeof data.tool_calls === 'object' ? JSON.stringify(data.tool_calls) : (data.tool_calls || null),
      duration_seconds: data.duration_seconds || 0,
      created_at: data.created_at || now,
      updated_at: now,
    };

    const stmt = this.database.prepare(`
      INSERT INTO call_logs (
        call_id, phone_number, call_status, transcript,
        collected_payload, tool_calls, duration_seconds,
        created_at, updated_at
      ) VALUES (
        @call_id, @phone_number, @call_status, @transcript,
        @collected_payload, @tool_calls, @duration_seconds,
        @created_at, @updated_at
      )
      ON CONFLICT(call_id) DO UPDATE SET
        phone_number = COALESCE(excluded.phone_number, call_logs.phone_number),
        call_status = excluded.call_status,
        transcript = COALESCE(excluded.transcript, call_logs.transcript),
        collected_payload = COALESCE(excluded.collected_payload, call_logs.collected_payload),
        tool_calls = COALESCE(excluded.tool_calls, call_logs.tool_calls),
        duration_seconds = CASE WHEN excluded.duration_seconds > 0 THEN excluded.duration_seconds ELSE call_logs.duration_seconds END,
        updated_at = excluded.updated_at
    `);

    stmt.run(record);
    return record;
  }

  findRecent(limit = 50) {
    const stmt = this.database.prepare(`
      SELECT * FROM call_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    return rows.map(row => {
      try {
        return {
          ...row,
          collected_payload: row.collected_payload ? JSON.parse(row.collected_payload) : null,
          tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
        };
      } catch (e) {
        return row;
      }
    });
  }
}

module.exports = new CallLogRepository();
module.exports.CallLogRepository = CallLogRepository;
