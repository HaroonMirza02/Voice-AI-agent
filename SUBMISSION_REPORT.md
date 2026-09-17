# Technical Assessment Completion Report: Voice AI Patient Registration System

This submission report details the architecture, implementation, verification results, and design choices of the Voice AI Patient Registration System. The report is structured directly around the assessment's five weighted evaluation criteria (20% each) for line-by-line review against the rubric, followed by an honest accounting of bonus challenges, gaps, and trade-offs.

---

## 1. Working System (20%)

### What Was Verified End-to-End
- **Full Registration Pipeline**: Verified via integration tests and the dashboard simulator. An incoming conversational payload triggers `create_patient`, undergoes rigorous server-side validation, sanitizes inputs, persists the record into the SQLite database, and returns a personalized verbal confirmation message containing the generated patient ID.
- **Data Persistence Survives Process Restarts**:
  - Verified via a dedicated multi-session automated test suite (`tests/persistence.test.js`).
  - The test writes a patient record, completely terminates and closes the SQLite database connection, physically verifies the file existence and byte size on disk, instantiates a brand new database connection from a fresh process context, and asserts that the patient record is 100% intact, retrievable by UUID, retrievable by phone number, and that soft-deleted states also survive restarts.
- **REST API Functionality**: Verified 100% pass across all endpoints (`GET /patients`, `GET /patients/:id`, `POST /patients`, `PUT /patients/:id`, `DELETE /patients/:id`, `GET /patients/check-phone/:phone`). All responses follow the `{ "data": ..., "error": ... }` envelope format and status code specifications (`200`, `201`, `400`, `404`, `422`, `500`).
- **Database Seeding**: Verified `npm run seed` inserts 2 realistic patient records when empty, and safely skips re-seeding when existing patient data is detected.
- **Admin Dashboard**: Verified static dashboard served directly from Express at `/`, featuring real-time patient listings, filter queries, a detail view modal, soft deletion with immediate UI reflection, call log audit views, and an interactive Voice Flow Simulator.
- **Automated Test Coverage**: 29 automated tests across 3 test suites passed cleanly with Jest (`npm test`).

### What Could Not Be Live-Verified in this Environment & Why
- **Live Dialable US Phone Number**: Live carrier telephony provisioning requires an active paid Vapi/Twilio account API key and payment method. Because external telephony credentials were not provided in this environment (per instructions: *"Things you must ask me for: Which voice platform account you should use and its API key... do not invent phone numbers, API keys, or a live deployment URL that doesn't actually exist"*), live PSTN carrier dialing could not be provisioned directly from within this sandbox.
- **How Live Dialing Is Prepared & Enabled**:
  - The complete Vapi assistant definition (`src/voice/vapiAssistantConfig.json`) and system prompt (`src/voice/systemPrompt.md`) are provided in ready-to-import format.
  - The webhook endpoint (`POST /api/voice/webhook`) implements the exact Vapi tool-calling payload specification.
  - Using `ngrok http 3000` or deploying the container to Railway/Render connects the live webhook to Vapi in under 2 minutes.
  - In the interim, the complete voice interaction was verified using automated Vapi webhook integration tests and the built-in browser Voice Simulator.

---

## 2. Conversational Quality (20%)

### Natural Tone vs. Rigid IVR
- Persona **Clara** is engineered as a warm, attentive medical clinic intake coordinator. Rather than presenting sterile keypad menus ("Press 1 for..."), Clara uses conversational affirmations ("Got it," "Thank you," "I appreciate that") and concise, 1–2 sentence turns to maintain natural pacing.
- Resilient multi-field extraction: If a caller supplies multiple items at once (*"Hi, I'm Sarah Connor born May 15th 1984"*), the agent extracts first name, last name, and date of birth simultaneously and does not redundantly re-ask for them.

### Handling Mid-Flow Corrections
- If a caller says *"Actually, spell my last name D-A-V-I-S"* or *"Wait, my zip code is 90210, not 90211"*, the agent acknowledges the correction immediately (*"Got it, I've updated your last name to Davis with an 'i'"*), updates that specific field in memory, and smoothly resumes where the conversation left off without restarting.

### Opt-In Group for Optional Fields
- Rather than interrogating the caller through 7 individual optional fields (email, address line 2, insurance carrier, member ID, language, emergency contact name, contact phone), the prompt consolidates them into a polite opt-in question:
  > *"We've completed all the required registration details! Would you like to add any optional information to your file today—such as an email address, insurance provider, or an emergency contact—or should we go ahead and finalize your record?"*
- If the caller declines (*"No, let's just finish"*), the agent immediately proceeds to read-back without friction.

### Explicit Confirmation Before Persistence
- The agent is strictly instructed never to invoke `create_patient` until reading back the complete summary:
  > *"Let's review what I have recorded to make sure everything is 100% correct: Your name is [First Name] [Last Name], born on [Month Day, Year]... Does everything look and sound correct, or would you like to make any corrections?"*
- Only upon explicit caller confirmation does the tool call execute.

---

## 3. Technical Architecture (20%)

### Separation of Concerns
The codebase strictly decouples responsibilities across distinct architectural layers:
- **Telephony & Webhook Layer** (`src/controllers/voiceController.js`, `src/services/voiceService.js`): Translates Vapi webhook payloads, unpacks function arguments, executes tool handlers, formats speech prompts, and handles asynchronous call lifecycle reports.
- **Prompt Engineering Layer** (`src/voice/systemPrompt.md`, `src/voice/toolsConfig.json`, `src/voice/vapiAssistantConfig.json`): Isolated, versioned conversational prompt markdown and tool JSON schemas.
- **Service Layer** (`src/services/patientService.js`): Coordinates business workflows, duplicate checking, and orchestration.
- **Validation & Sanitization Layer** (`src/validators/patientValidator.js`): Completely decoupled from Express; independently testable sanitization and schema assertion rules.
- **Data & Repository Layer** (`src/repositories/patientRepository.js`, `src/repositories/callLogRepository.js`, `src/db/`): Encapsulates raw SQL queries, transaction boundaries, and SQLite connection management.
- **HTTP & Controller Layer** (`src/controllers/patientController.js`, `src/routes/`): Manages request parsing, HTTP status codes, and the standardized response envelope.

### Schema Design & Indexing Rationale
- Primary Table `patients`:
  - `patient_id`: UUID v4 primary key for distributed safety.
  - Column constraints: Required vs. nullable constraints mirror real-world clinical intake standards.
  - `deleted_at`: ISO timestamp for soft deletion. Records are never destroyed by default, preserving historical healthcare auditability.
  - Indexes:
    - `idx_patients_phone_number`: Optimizes duplicate detection queries on inbound calls (`WHERE phone_number = ? AND deleted_at IS NULL`).
    - `idx_patients_last_name`: Speeds up directory searches by surname.
    - `idx_patients_date_of_birth`: Supports clinic birthday lookup filters.
    - `idx_patients_deleted_at`: Optimizes filtering of active records.
- Secondary Table `call_logs`:
  - Stores `call_id`, `phone_number`, `call_status`, `collected_payload` (JSON), `tool_calls` (JSON), and `duration_seconds` to provide compliance and audit trails.

### REST Design Choices & Envelope Standard
- Every API endpoint strictly adheres to the standard JSON envelope:
  ```json
  {
    "data": <object | array | null>,
    "error": <object | string | null>
  }
  ```
- Strict status code semantics:
  - `200 OK`: Successful retrieval, partial update, or soft delete.
  - `201 Created`: Successful patient creation.
  - `400 Bad Request`: Empty or malformed payload.
  - `404 Not Found`: Non-existent or soft-deleted ID.
  - `422 Unprocessable Entity`: Field validation failures (bad DOB, invalid state, bad phone).
  - `500 Internal Server Error`: Unhandled server faults.

---

## 4. Code Quality & Documentation (20%)

### Repository Structure & Hygiene
- Clean, intuitive folder layout separating `src/`, `tests/`, `data/`, and deployment manifests.
- Zero clutter: native `crypto.randomUUID()` used in place of external dependencies; `.gitignore` configured to prevent committing `.env`, local `.db` files, or OS artifacts.
- Package scripts configured for standard developer ergonomics: `npm start`, `npm run dev`, `npm test`, `npm run seed`.

### Documentation Completeness
- `README.md` includes complete setup instructions, architecture diagrams, tech stack justifications, environment variable reference, verbatim system prompt, and deployment guides.
- Ready-to-use production deployment manifests provided: `Dockerfile`, `docker-compose.yml`, `render.yaml`, and `railway.json`.

---

## 5. Edge Cases & Resilience (20%)

### 1. Invalid Date of Birth (Future Date or Malformed Calendar Date)
- **How It's Handled**: Evaluated in `src/validators/patientValidator.js` (lines 53–94). The validator verifies format (`YYYY-MM-DD`), checks actual calendar validity (rejecting dates like Feb 31st), and enforces `dateObj <= new Date()`.
- **Speech Prompt**: Returns a specific, non-generic re-prompt:
  > *"That date appears to be in the future or invalid. Could you please share your birth date again with the month, day, and four-digit year?"* (`src/voice/systemPrompt.md`, lines 145–148).
- **Code Pointer**: [`src/validators/patientValidator.js:53-94`](file:///d:/Voice%20AI%20Agent/src/validators/patientValidator.js#L53-L94) and [`src/services/voiceService.js:139-147`](file:///d:/Voice%20AI%20Agent/src/services/voiceService.js#L139-L147).

### 2. Telephony Connection Drops Mid-Call
- **How It's Handled**: The system enforces a strict zero-persistence policy for partial records. No patient record is written to the `patients` table until the caller explicitly verifies the read-back and the `create_patient` tool executes.
- **Why It's the Safe Default**: Clinical and demographic databases must never store incomplete or unverified records. In the event of a disconnect, Vapi sends an `end-of-call-report` webhook which is recorded in `call_logs` with status `call-disconnected` or `in-progress`, preserving audit logs without polluting the clinical registry.
- **Code Pointer**: [`src/voice/systemPrompt.md:175-180`](file:///d:/Voice%20AI%20Agent/src/voice/systemPrompt.md#L175-L180) and [`src/services/voiceService.js:57-73`](file:///d:/Voice%20AI%20Agent/src/services/voiceService.js#L57-L73).

### 3. Database Write Fails After Caller Has Confirmed
- **How It's Handled**: If a disk or database error occurs during `create_patient`, the exception is caught in `voiceService.js`. The webhook intercepts the error and returns a friendly conversational fallback message rather than disconnecting or staying silent.
- **Speech Prompt**:
  > *"I apologize, but our registration server encountered a temporary technical glitch while saving your record. I have your details saved in my queue. Would you like me to try submitting it one more time, or would you prefer a clinic coordinator to call you back shortly to confirm?"*
- **Code Pointer**: [`src/services/voiceService.js:135-155`](file:///d:/Voice%20AI%20Agent/src/services/voiceService.js#L135-L155) and [`src/voice/systemPrompt.md:182-187`](file:///d:/Voice%20AI%20Agent/src/voice/systemPrompt.md#L182-L187).

### 4. Caller Wants to Start Over Mid-Conversation
- **How It's Handled**: The prompt explicitly listens for utterances such as *"start over"*, *"cancel"*, or *"restart"*.
- **Speech Prompt**:
  > *"No problem at all. I have cleared the information we collected so far. Let's begin fresh. What is your first and last name?"*
- The agent clears its working memory buffer and returns to the initial demographic step without hanging up.
- **Code Pointer**: [`src/voice/systemPrompt.md:167-173`](file:///d:/Voice%20AI%20Agent/src/voice/systemPrompt.md#L167-L173).

---

## 6. Bonus Challenges Status

| Bonus Challenge | Status | Implementation Details / Reason if Skipped |
| :--- | :---: | :--- |
| **Duplicate Detection** | **Implemented** | `check_existing_patient` queries database on call start. If found, agent greets caller with name/DOB and offers an update path. |
| **Dashboard** | **Implemented** | Responsive UI at `/` with patient table, filter inputs, detail modal, soft-delete action, call logs audit, and interactive Voice Simulator. |
| **Automated Tests** | **Implemented** | 29 Jest + Supertest unit, integration, and persistence test cases (`npm test`). |
| **Call Transcript & Payload Storage** | **Implemented** | `call_logs` table logs every session's collected payload, executed tools, duration, and status. |
| **Multi-Language Support** | *Skipped* | Skipped to focus on flawless English conversational quality, edge cases, and zero-loss persistence within the 3-hour window. |
| **Appointment Scheduling** | *Skipped* | Skipped as EHR/calendar integration (e.g. Cal.com/Epic) was secondary to core patient demographic registration and persistence. |

---

## 7. Known Gaps & Things to Improve with More Time

1. **Audio Recording Storage**: Call metadata and transcripts are saved to SQLite, but raw stereo audio is stored on Vapi's platform. With more time, a webhook listener would stream recordings directly to an S3/GCS bucket.
2. **Multi-Factor Caller Authentication**: Currently, returning patients are identified by phone number + DOB confirmation. Adding an SMS one-time passcode (OTP) would enhance HIPAA/security compliance.
3. **Multi-Region Database Synchronization**: SQLite with WAL mode is ideal for single-instance applications; for horizontal auto-scaling across multiple cloud zones, integrating LiteFS or PostgreSQL would enable distributed write replication.
