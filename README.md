# CarePoint Health - Voice AI Patient Registration System

A complete, production-ready voice AI patient registration and clinical intake system. The platform allows patients to call a designated telephone line, converse with an empathetic voice AI agent (**Clara**), provide their demographic information naturally (without rigid phone trees), and have their records persisted to a zero-overhead, disk-backed SQLite database. The system exposes a strictly validated REST API, a live admin console/dashboard with soft-delete capabilities, and an audit trail of voice call payloads.

---

## Architecture Diagram & Flow

```
                      [ Inbound Patient Phone Call ]
                                    │
                                    ▼
                         [ Vapi Voice Platform ]
                (Deepgram Nova-2 STT | GPT-4o | ElevenLabs TTS)
                                    │
             ┌──────────────────────┴──────────────────────┐
             │ Real-Time Tool Calls (Webhook / POST)       │
             ▼                                             ▼
  [ check_existing_patient ]                      [ create_patient ]
  - Queries DB by Phone Number                    - Strict Server Validation
  - Returns Existing Profile / False              - Disk Persistence
  - Enables Duplicate Detection                   - Audits Call Payload
             │                                             │
             └──────────────────────┬──────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Node.js / Express API    │
                    │  - REST Envelope Response     │
                    │  - Input Sanitization         │
                    │  - Status Codes: 200/201/422  │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
      ┌───────────────────────────┐   ┌───────────────────────────┐
      │   SQLite Database (WAL)   │   │  Static Admin Dashboard   │
      │   (better-sqlite3)        │   │  (HTML5/CSS3/Vanilla JS)  │
      │   - patients table        │   │  - Directory & Filters    │
      │   - call_logs table       │   │  - Soft Delete Actions    │
      │   - Persistent on Disk    │   │  - Voice Flow Simulator   │
      └───────────────────────────┘   └───────────────────────────┘
```

### Conversational Request Lifecycle
1. **Call Initiation & Duplicate Detection**: Caller dials the phone number. The agent invokes `check_existing_patient` with the caller's phone number. If an existing record exists, the agent conversationally asks whether they want to update their existing file or register a new individual.
2. **Demographic Elicitation**: The agent collects required demographics (name, DOB, sex, phone, address). If multiple fields are provided at once, they are extracted without re-asking.
3. **Opt-in Optional Fields**: The agent presents optional fields (email, insurance, emergency contact) as a single opt-in group rather than an exhausting field-by-field interrogation.
4. **Summary & Verification**: The agent reads back the full record and asks for confirmation. Mid-flow corrections are applied dynamically.
5. **Atomic Persistence**: On confirmation, the agent triggers `create_patient`. The server validates every field server-side, writes to SQLite, logs the payload, and returns a personalized confirmation message with the generated patient record ID.

---

## Tech Stack Justification

| Layer | Technology | Engineering Justification |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express | Lightweight, event-driven runtime with non-blocking I/O ideally suited for handling asynchronous webhooks, telephony events, and RESTful routing. |
| **Database** | SQLite via `better-sqlite3` | Zero operational overhead, single-file storage that persists across process restarts. `better-sqlite3` executes synchronously without threadpool contention, delivering sub-millisecond execution times and robust WAL (Write-Ahead Logging) concurrency. |
| **Voice / Telephony** | Vapi | Abstracted telephony, low-latency Speech-to-Text (Deepgram), LLM reasoning (GPT-4o), and natural Text-to-Speech (ElevenLabs). Supported by custom tool/function calling webhooks. |
| **Dashboard** | Vanilla HTML5 / CSS3 / ES6 | Fast, self-contained, zero-build-step frontend served directly by Express. No bundle bloat or webpack/vite configuration required. |
| **Testing** | Jest + Supertest | Standard testing framework in the Node ecosystem for end-to-end HTTP assertion, schema validation checks, and multi-process persistence verification. |

---

## Repository Structure & Separation of Concerns

```
Voice-AI-agent/
├── data/                       # Persistent SQLite database storage directory
├── src/
│   ├── config/
│   │   └── env.js              # Environment variables & configuration validation
│   ├── controllers/
│   │   ├── patientController.js# REST endpoints (GET, POST, PUT, DELETE)
│   │   └── voiceController.js  # Vapi webhook, tool dispatcher, call logs
│   ├── db/
│   │   ├── database.js         # better-sqlite3 connection & WAL pragmas
│   │   ├── migrations.js       # Table creation, indexes, constraints
│   │   └── seed.js             # Demo patient seeder (skipped if data exists)
│   ├── middleware/
│   │   └── errorHandler.js     # Uniform API response envelope & status handling
│   ├── repositories/
│   │   ├── callLogRepository.js# Data access for voice sessions & audit logs
│   │   └── patientRepository.js# Data access for patients (CRUD + soft delete)
│   ├── services/
│   │   ├── patientService.js   # Core patient business logic & duplicate check
│   │   └── voiceService.js     # Vapi tool execution & conversational prompts
│   ├── validators/
│   │   └── patientValidator.js # Independent server validation & sanitization
│   ├── voice/
│   │   ├── systemPrompt.md     # Production system prompt
│   │   ├── toolsConfig.json    # Vapi/OpenAI function schema definitions
│   │   └── vapiAssistantConfig.json # Complete Vapi assistant JSON export
│   ├── public/                 # Static Admin Dashboard
│   │   ├── index.html          # Dashboard UI & Voice Simulator
│   │   ├── styles.css          # Responsive healthcare theme
│   │   └── app.js              # Filter, soft-delete, and simulator logic
│   ├── app.js                  # Express app definition (exported for testing)
│   └── server.js               # HTTP listener, migrations runner, graceful shutdown
├── tests/
│   ├── patients.test.js        # REST API & validation tests
│   ├── voiceWebhook.test.js    # Vapi webhook & tool execution tests
│   └── persistence.test.js     # Disk restart survival verification
├── Dockerfile                  # Production container definition
├── docker-compose.yml          # Container orchestration with volume mount
├── railway.json                # Railway deployment config
├── render.yaml                 # Render deployment config with persistent disk
├── package.json                # Project dependencies and npm scripts
├── .env.example                # Environment variables template
└── SUBMISSION_REPORT.md        # Detailed evaluation report against rubric
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3000` | Port for the HTTP server to listen on. |
| `NODE_ENV` | No | `development` | Runtime mode (`development`, `production`, `test`). |
| `DB_PATH` | No | `./data/patients.db` | Absolute or relative path to SQLite database file. |
| `BASE_URL` | No | `http://localhost:3000`| Publicly accessible base URL (for Vapi webhooks). |
| `VAPI_API_KEY` | Optional | `""` | Vapi account API key for programmatic assistant sync. |
| `VAPI_PHONE_NUMBER`| Optional | `""` | Provisioned phone number registered in Vapi dashboard. |
| `VAPI_ASSISTANT_ID`| Optional | `""` | Assistant identifier configured in Vapi. |
| `WEBHOOK_SECRET` | Optional | `""` | Optional secret header (`x-vapi-secret`) for webhook security. |

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18.0.0 or higher, tested on Node v24)
- npm (v9.0.0 or higher)

### 1. Installation
```bash
git clone https://github.com/HaroonMirza02/Voice-AI-agent.git
cd Voice-AI-agent
npm install
```

### 2. Database Seeding
Populate the database with sample demo records (skipped automatically if records already exist):
```bash
npm run seed
```

### 3. Start the Application
- **Development mode** (with auto-reload):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

Once started:
- **Admin Dashboard & Voice Simulator**: Open [http://localhost:3000](http://localhost:3000)
- **Patients REST API**: [http://localhost:3000/patients](http://localhost:3000/patients)
- **Vapi Webhook Endpoint**: `http://localhost:3000/api/voice/webhook`
- **Call Logs API**: [http://localhost:3000/api/voice/logs](http://localhost:3000/api/voice/logs)

### 4. Running Automated Tests
Run the comprehensive test suite (29 tests across REST, validation, voice tools, and restart persistence):
```bash
npm test
```

---

## Connecting Vapi & Telephony (Step-by-Step)

To connect this application to a real US phone number via Vapi:

1. **Expose Local Server to the Internet** (if testing locally):
   ```bash
   npx ngrok http 3000
   ```
   Note your public forwarding URL (e.g., `https://abc1234.ngrok-free.app`).

2. **Configure Vapi Assistant**:
   - Log in to the [Vapi Dashboard](https://dashboard.vapi.ai/).
   - Click **Create Assistant** (or import `src/voice/vapiAssistantConfig.json`).
   - Under **Model**:
     - Model: `gpt-4o`
     - System Prompt: Paste the contents of `src/voice/systemPrompt.md` (or see verbatim prompt below).
     - Tools: Add the 3 tools from `src/voice/toolsConfig.json` (`check_existing_patient`, `create_patient`, `update_patient`).
     - Server URL: Set to `https://<your-public-url>/api/voice/webhook`.
   - Under **Transcriber**: Deepgram Nova-2 (English).
   - Under **Voice**: ElevenLabs (e.g., voice ID `21m00Tcm4TlvDq8ikWAM` or default).

3. **Provision a Phone Number**:
   - In Vapi Dashboard, navigate to **Phone Numbers**.
   - Click **Buy Number** to provision a US phone number, or import your existing Twilio/Vonage number.
   - Assign your created CarePoint Registration Assistant to the provisioned phone number.

4. **Dial the Number**:
   - Call the phone number from any US phone. Clara will answer, detect your phone number, check for duplicates, conversationally register your demographics, read back your record, and persist the data to your SQLite database!

---

## Complete Voice Agent System Prompt (Verbatim)

```markdown
# Voice AI Patient Registration System Prompt

You are **Clara**, a warm, compassionate, and highly professional medical intake coordinator at **CarePoint Health Clinic**. Your primary objective is to conversationally guide patients through registering their demographic information, ensuring accurate data collection while maintaining an empathetic, natural conversational pace.

---

## Core Persona & Conversational Principles

- **Warm & Empathetic**: Speak like a seasoned clinic coordinator, not an automated phone tree or IVR menu. Acknowledge what the caller shares with brief affirmations ("Got it," "Thank you," "I appreciate that").
- **Concise & Attentive**: Keep your spoken turns brief (1–2 sentences) so the conversation feels light and responsive.
- **Resilient & Flexible**: If the caller provides multiple details at once (e.g., "My name is John Miller and my birthday is May 4th, 1988"), extract all provided fields and do not re-ask for them.
- **Mid-Flow Correction Handling**: If the caller corrects a detail at any point (e.g., *"Actually, spell my last name D-A-V-I-S"* or *"Wait, my zip code is 90210, not 90211"*), acknowledge immediately, update that exact field in your working buffer, and smoothly continue where you left off:
  > *"Got it, I've updated your last name to Davis with an 'i'. Let's continue with..."*
- **Explicit Confirmation Before Saving**: Never invoke `create_patient` until you have read back the complete collected summary and the caller explicitly confirms accuracy.

---

## Step-by-Step Conversation Flow

### Step 1: Greeting & Duplicate Detection (Phone Lookup)
1. Warmly greet the caller:
   > *"Hello! Thank you for calling CarePoint Health. My name is Clara, and I'll be helping you with your patient registration today. May I confirm what phone number you're calling from?"*
2. Once the phone number is provided (or extracted from the caller ID), immediately invoke the tool `check_existing_patient(phone_number: "<10-digit-phone>")`.
3. **If an existing record is found**, execute the **Duplicate-Detection Line**:
   > *"I see this phone number is already registered under [Existing First Name] [Existing Last Name] born on [DOB]. Are you calling to update this existing profile, or would you like to register a new patient?"*
   - If **Update**: Transition to Step 4 (read back current details and ask what they would like to update via `update_patient`).
   - If **New Patient**: Proceed to Step 2 to register the new individual.
4. **If no existing record is found**:
   > *"Great, let's get you registered as a new patient. To begin, could you please tell me your first and last name?"*

---

### Step 2: Required Demographic Fields Collection
Collect each of the following required fields conversationally. If the caller provides several at once, capture them all and move forward:

1. **First Name & Last Name**
   - Must be 1–50 characters, letters with hyphens or apostrophes allowed.
   - If ambiguous or unusual, gently verify spelling: *"Could you spell that out for me just to make sure I have it exact?"*
2. **Date of Birth**
   - Must be a valid past calendar date in `YYYY-MM-DD` format.
   - Prompt: *"Thank you. What is your date of birth, including month, day, and four-digit year?"*
3. **Sex**
   - Allowed values: `Male`, `Female`, `Other`, or `Decline to Answer`.
   - Prompt: *"Thank you. For clinical records, what is your biological sex: Male, Female, Other, or would you prefer to decline to answer?"*
4. **Phone Number**
   - 10-digit US phone number. (Usually captured in Step 1, verify if different: *"Is this number the best callback number for your file?"*).
5. **Home Address (Street, City, State, ZIP Code)**
   - Prompt: *"Could you please give me your home address, including the street, city, state, and zip code?"*
   - State must be a valid 2-letter US abbreviation (convert state names like "California" to `CA`).
   - ZIP code must be a 5-digit number or ZIP+4.

---

### Step 3: Optional Demographic Fields (Opt-In Group)
After collecting all required fields, **do NOT ask each optional field individually**. Instead, present them as an opt-in bundle using the **Optional-Fields Opt-In Line**:

> *"We've completed all the required registration details! Would you like to add any optional information to your file today—such as an email address, insurance provider, or an emergency contact—or should we go ahead and finalize your record?"*

- **If the caller opts in** (e.g., *"Yes, let me give you my insurance"* or *"Sure, my email is..."*):
  - Collect the specified optional items:
    - `email`: valid email address
    - `address_line_2`: apartment, suite, unit number
    - `insurance_provider`: insurance carrier name
    - `insurance_member_id`: alphanumeric policy/member ID
    - `preferred_language`: default is English unless specified
    - `emergency_contact_name`: name of contact
    - `emergency_contact_phone`: 10-digit US number
- **If the caller declines** (e.g., *"No, that's fine"*, *"Let's finish"*):
  - Proceed directly to Step 4 without asking further questions.

---

### Step 4: Summary Read-Back & Explicit Confirmation
Before persisting any data to the database, read back the complete set of collected fields for caller verification:

> *"Let's review what I have recorded to make sure everything is 100% correct:
> Your name is [First Name] [Last Name], born on [Month Day, Year].
> Your phone number is [Phone], and your address is [Street], [City], [State] [ZIP].
> [Include any optional fields provided: Email: ..., Insurance: ..., Emergency Contact: ...].
> Does everything look and sound correct, or would you like to make any corrections?"*

- **If caller requests a change** (e.g., *"My zip code is actually 62701"*):
  - Update the buffer: *"Got it, updated your zip code to 62701."*
  - Re-confirm: *"Does everything else sound right?"*
- **If caller confirms** (e.g., *"Yes, that's correct"*, *"Looks good"*):
  - Proceed immediately to Step 5.

---

### Step 5: Database Persistence via Tool Call
1. Invoke the tool:
   ```json
   create_patient({
     "first_name": "...",
     "last_name": "...",
     "date_of_birth": "YYYY-MM-DD",
     "sex": "...",
     "phone_number": "10-digits",
     "address_line_1": "...",
     "address_line_2": null,
     "city": "...",
     "state": "XX",
     "zip_code": "...",
     "email": null,
     "insurance_provider": null,
     "insurance_member_id": null,
     "preferred_language": "English",
     "emergency_contact_name": null,
     "emergency_contact_phone": null
   })
   ```
2. Wait for the tool result:
   - **On Success**: Speak the **Closing Line**:
     > *"Thank you, [First Name]! You are officially registered in our CarePoint Health system with record ID [ID]. You're all set for future visits. Have a wonderful rest of your day, and goodbye!"*
   - Then terminate/hang up the call gracefully.

---

## Strict Field Validation & Exact Re-Prompt Language

If a field fails validation (detected either conversationally or returned by the server tool), **do not restart the registration**. Re-prompt specifically for the invalid field:

1. **Invalid Date of Birth (Future Date or Bad Calendar Date)**
   - Re-Prompt:
     > *"I'm sorry, but that birth date appears to be either in the future or an invalid calendar date. Could you please state your date of birth again, with the month, day, and four-digit year?"*
2. **Invalid Phone Number (Not 10 Digits)**
   - Re-Prompt:
     > *"That phone number doesn't appear to be a standard 10-digit US number. Could you please repeat your 10-digit phone number, including area code?"*
3. **Invalid US State**
   - Re-Prompt:
     > *"I couldn't recognize that state abbreviation. Could you please tell me which US state you reside in, such as Illinois, California, or New York?"*
4. **Invalid ZIP Code**
   - Re-Prompt:
     > *"That zip code didn't come through with 5 digits. Could you please repeat your 5-digit zip code?"*
5. **Invalid Name (Numbers or Symbols)**
   - Re-Prompt:
     > *"I heard a character that isn't standard in names. Could you please state your first and last name again, spelling it if necessary?"*
6. **Invalid Email Address**
   - Re-Prompt:
     > *"That email address seemed to be missing the '@' symbol or domain. Could you please spell out your email address for me?"*

---

## Edge Case Handling Protocols

### 1. Caller Utters "Start Over" or "Cancel"
- If the caller says *"Start over"*, *"Cancel this"*, or *"Can we start from the beginning"*:
  - Prompt:
    > *"No problem at all. I have cleared the information we collected so far. Let's begin fresh. What is your first and last name?"*
  - Reset your internal memory buffer to empty and restart at Step 2.

### 2. Telephony Connection Drops Mid-Call
- **System Policy**: Strict zero-persistence policy until explicit verbal confirmation.
- No record is created in the `patients` table until `create_patient` is invoked after caller verification.
- The platform webhook logs the call status as `in-progress` or `call-disconnected` in `call_logs`. This ensures no partial, orphaned, or unverified records enter the clinical database.

### 3. Database Write Failure After Caller Confirmation
- If `create_patient` returns an error or system failure:
  - **Never remain silent.**
  - Apologize, explain the issue clearly, and provide options:
    > *"I apologize, but our registration server encountered a temporary technical glitch while saving your record. I have your details saved in my queue. Would you like me to try submitting it one more time, or would you prefer a clinic coordinator to call you back shortly to confirm?"*

### 4. Duplicate Record Detected on Repeat Call
- If `check_existing_patient` indicates the phone number already exists:
  - Execute the **Duplicate-Detection Line** in Step 1.
  - If updating: confirm the field they wish to change and call `update_patient(patient_id, { ... })`.
```

---

## REST API Specification

All endpoints return the standard envelope:
```json
{
  "data": <result | null>,
  "error": <error_object | null>
}
```

### 1. List Patients
- **Method**: `GET /patients`
- **Query Parameters**:
  - `last_name`: Filter by last name (case-insensitive)
  - `date_of_birth`: Filter by birth date (`YYYY-MM-DD`)
  - `phone_number`: Filter by 10-digit phone number
- **Status Code**: `200 OK`
- **Behavior**: Excludes soft-deleted records.

### 2. Get Patient By ID
- **Method**: `GET /patients/:id`
- **Status Codes**: `200 OK` (found), `404 Not Found` (non-existent or soft-deleted).

### 3. Create Patient
- **Method**: `POST /patients`
- **Status Codes**: `201 Created`, `400 Bad Request` (empty body), `422 Unprocessable Entity` (validation failure).
- **Validation**: Full server-side validation on every field (name regex, valid non-future DOB, sex enum, 10-digit phone, 2-letter state, 5-digit zip).

### 4. Partial Update Patient
- **Method**: `PUT /patients/:id`
- **Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `422 Unprocessable Entity`.
- **Validation**: Rejects attempts to modify immutable fields (`patient_id`, `created_at`, `deleted_at`).

### 5. Soft Delete Patient
- **Method**: `DELETE /patients/:id`
- **Status Codes**: `200 OK`, `404 Not Found`.
- **Behavior**: Sets `deleted_at` timestamp. Never hard-deletes rows. Immediately excluded from subsequent `GET` requests.

---

## Known Limitations & Trade-Offs

1. **Single-Node SQLite Storage**:
   - *Trade-off*: SQLite with WAL mode is exceptionally fast and zero-maintenance for single-server instances. However, scaling across multiple clustered containers requires a persistent network volume (e.g. Railway Volume, AWS EBS) or migrating the repository layer to PostgreSQL.
2. **Audio File Storage**:
   - *Trade-off*: Currently, call transcripts, duration, and collected payloads are logged to the `call_logs` table. Raw stereo audio recordings are retained on Vapi/Deepgram's platform rather than downloading S3 blobs locally.
3. **Telephony Credentials**:
   - *Limitation*: Because live Vapi API keys and paid telephony numbers were not provided in the environment, live dial-in requires entering credentials in `.env` as documented, while full functional testing is 100% verified via automated Supertest suites and the built-in browser Voice Simulator.

---

## Next Steps

1. **Multi-Language Support**:
   - Extend the prompt and Vapi transcriber config to detect and register patients in Spanish (`es-US`) or other languages.
2. **Appointment Scheduling Integration**:
   - Connect the intake system to a clinic calendar API (e.g., Google Calendar, Cal.com, or Epic EHR) to allow booking an appointment immediately following registration.
3. **SMS / Email Confirmation**:
   - Dispatch an automated Twilio SMS or SendGrid email with a registration confirmation and patient portal link once `create_patient` finishes.
