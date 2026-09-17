/**
 * CarePoint Health - Patient Registration Dashboard Client Logic
 */

let currentPatients = [];
let selectedPatientId = null;

// Simulator default payloads
const SIM_PAYLOADS = {
  check_existing_patient: {
    phone_number: "4155552671"
  },
  create_patient: {
    first_name: "Sarah",
    last_name: "Connor",
    date_of_birth: "1984-05-15",
    sex: "Female",
    phone_number: "3105559821",
    address_line_1: "420 Grand Avenue",
    address_line_2: "Suite 100",
    city: "Los Angeles",
    state: "CA",
    zip_code: "90071",
    email: "sarah.connor@example.com",
    insurance_provider: "Kaiser Permanente",
    insurance_member_id: "KP901234",
    preferred_language: "English",
    emergency_contact_name: "John Connor",
    emergency_contact_phone: "3105551122"
  },
  update_patient: {
    patient_id: "",
    address_line_1: "500 South Grand Ave",
    zip_code: "90071"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupFilterForm();
  setupModal();
  setupSimulator();
  loadPatients();
  loadCallLogs();
});

// Setup Tab Switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const content = document.getElementById(targetId);
      if (content) content.classList.add('active');

      if (targetId === 'callsTab') {
        loadCallLogs();
      }
    });
  });
}

// Setup Filter Form
function setupFilterForm() {
  const form = document.getElementById('filterForm');
  const resetBtn = document.getElementById('resetFilterBtn');
  const refreshBtn = document.getElementById('refreshPatientsBtn');
  const refreshCallsBtn = document.getElementById('refreshCallsBtn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    loadPatients();
  });

  resetBtn.addEventListener('click', () => {
    document.getElementById('filterLastName').value = '';
    document.getElementById('filterDob').value = '';
    document.getElementById('filterPhone').value = '';
    loadPatients();
  });

  if (refreshBtn) refreshBtn.addEventListener('click', () => loadPatients());
  if (refreshCallsBtn) refreshCallsBtn.addEventListener('click', () => loadCallLogs());
}

// Format Phone Number for Display
function formatPhone(phone) {
  if (!phone || phone.length !== 10) return phone || '—';
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

// Load Patients from GET /patients
async function loadPatients() {
  const tbody = document.getElementById('patientsTableBody');
  const lastName = document.getElementById('filterLastName').value.trim();
  const dob = document.getElementById('filterDob').value.trim();
  const phone = document.getElementById('filterPhone').value.trim();

  const params = new URLSearchParams();
  if (lastName) params.append('last_name', lastName);
  if (dob) params.append('date_of_birth', dob);
  if (phone) params.append('phone_number', phone);

  try {
    const url = `/patients${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to fetch patients');
    }

    currentPatients = json.data || [];
    renderPatientsTable(currentPatients);
    document.getElementById('activePatientsCount').textContent = currentPatients.length;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--danger)">Error loading patients: ${err.message}</td></tr>`;
  }
}

// Render Patients Table
function renderPatientsTable(patients) {
  const tbody = document.getElementById('patientsTableBody');
  if (!patients || patients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No patient records found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = patients.map(p => {
    const createdDate = new Date(p.created_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    return `
      <tr>
        <td><strong>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</strong></td>
        <td>${escapeHtml(p.date_of_birth)}</td>
        <td><span class="badge badge-gray">${escapeHtml(p.sex)}</span></td>
        <td>${escapeHtml(formatPhone(p.phone_number))}</td>
        <td>${escapeHtml(p.city)}, ${escapeHtml(p.state)}</td>
        <td>${p.insurance_provider ? escapeHtml(p.insurance_provider) : '<span class="text-muted">None</span>'}</td>
        <td>${createdDate}</td>
        <td>
          <div style="display:flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="viewPatient('${p.patient_id}')">View</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--border);" onclick="confirmSoftDelete('${p.patient_id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Load Call Logs
async function loadCallLogs() {
  const tbody = document.getElementById('callLogsTableBody');
  try {
    const res = await fetch('/api/voice/logs?limit=50');
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to load call logs');
    }

    const logs = json.data || [];
    document.getElementById('totalCallsCount').textContent = logs.length;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No voice call logs recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleString();
      let statusBadge = '<span class="badge badge-green">Completed</span>';
      if (log.call_status === 'registered') statusBadge = '<span class="badge badge-green">Registered</span>';
      else if (log.call_status === 'in-progress') statusBadge = '<span class="badge badge-blue">In Progress</span>';
      else if (log.call_status === 'updated') statusBadge = '<span class="badge badge-blue">Updated</span>';
      else if (log.call_status === 'failed') statusBadge = '<span class="badge badge-red">Failed</span>';

      return `
        <tr>
          <td><code style="font-size:0.75rem;">${escapeHtml((log.call_id || '').slice(0, 16))}</code></td>
          <td>${escapeHtml(formatPhone(log.phone_number))}</td>
          <td>${statusBadge}</td>
          <td>${log.duration_seconds ? log.duration_seconds + 's' : '—'}</td>
          <td>${time}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="alert(JSON.stringify(${escapeJsonForAttr(log.collected_payload || log.tool_calls || {})}, null, 2))">
              View Payload
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color:var(--danger)">Error loading call logs: ${err.message}</td></tr>`;
  }
}

// View Patient Details in Modal
window.viewPatient = function(patientId) {
  const patient = currentPatients.find(p => p.patient_id === patientId);
  if (!patient) return;

  selectedPatientId = patientId;
  document.getElementById('modalPatientName').textContent = `${patient.first_name} ${patient.last_name}`;

  const content = document.getElementById('modalPatientContent');
  content.innerHTML = `
    <div class="profile-section">
      <div class="profile-section-title">Required Demographics</div>
      <div class="profile-grid">
        <div class="profile-field">
          <label>Full Name</label>
          <span>${escapeHtml(patient.first_name)} ${escapeHtml(patient.last_name)}</span>
        </div>
        <div class="profile-field">
          <label>Date of Birth</label>
          <span>${escapeHtml(patient.date_of_birth)}</span>
        </div>
        <div class="profile-field">
          <label>Sex</label>
          <span>${escapeHtml(patient.sex)}</span>
        </div>
        <div class="profile-field">
          <label>Phone Number</label>
          <span>${escapeHtml(formatPhone(patient.phone_number))}</span>
        </div>
        <div class="profile-field" style="grid-column: span 2;">
          <label>Address</label>
          <span>${escapeHtml(patient.address_line_1)}${patient.address_line_2 ? ', ' + escapeHtml(patient.address_line_2) : ''}, ${escapeHtml(patient.city)}, ${escapeHtml(patient.state)} ${escapeHtml(patient.zip_code)}</span>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Optional Demographics (Opt-in Group)</div>
      <div class="profile-grid">
        <div class="profile-field">
          <label>Email Address</label>
          <span>${patient.email ? escapeHtml(patient.email) : '<em class="text-muted">Not provided</em>'}</span>
        </div>
        <div class="profile-field">
          <label>Preferred Language</label>
          <span>${escapeHtml(patient.preferred_language || 'English')}</span>
        </div>
        <div class="profile-field">
          <label>Insurance Provider</label>
          <span>${patient.insurance_provider ? escapeHtml(patient.insurance_provider) : '<em class="text-muted">Not provided</em>'}</span>
        </div>
        <div class="profile-field">
          <label>Insurance Member ID</label>
          <span>${patient.insurance_member_id ? escapeHtml(patient.insurance_member_id) : '<em class="text-muted">Not provided</em>'}</span>
        </div>
        <div class="profile-field">
          <label>Emergency Contact</label>
          <span>${patient.emergency_contact_name ? escapeHtml(patient.emergency_contact_name) : '<em class="text-muted">Not provided</em>'}</span>
        </div>
        <div class="profile-field">
          <label>Emergency Contact Phone</label>
          <span>${patient.emergency_contact_phone ? escapeHtml(formatPhone(patient.emergency_contact_phone)) : '<em class="text-muted">Not provided</em>'}</span>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">System & Audit Metadata</div>
      <div class="profile-grid">
        <div class="profile-field" style="grid-column: span 2;">
          <label>Patient UUID</label>
          <code style="font-size:0.8125rem;">${patient.patient_id}</code>
        </div>
        <div class="profile-field">
          <label>Registered (UTC)</label>
          <span style="font-size:0.8125rem;">${patient.created_at}</span>
        </div>
        <div class="profile-field">
          <label>Last Updated (UTC)</label>
          <span style="font-size:0.8125rem;">${patient.updated_at}</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('patientModal').classList.add('open');
};

// Confirm & Execute Soft Delete
window.confirmSoftDelete = async function(patientId) {
  if (!confirm('Are you sure you want to soft-delete this patient record? This record will be excluded from directory searches but retained in disk audit logs.')) {
    return;
  }

  try {
    const res = await fetch(`/patients/${patientId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to soft delete');
    }

    closeModal();
    loadPatients();
  } catch (err) {
    alert('Error deleting patient: ' + err.message);
  }
};

// Setup Modal Interactions
function setupModal() {
  const modal = document.getElementById('patientModal');
  const backdrop = document.getElementById('modalBackdrop');
  const closeBtn = document.getElementById('closeModalBtn');
  const closeBottomBtn = document.getElementById('closeModalBottomBtn');
  const deleteBtn = document.getElementById('modalDeleteBtn');

  function closeModal() {
    modal.classList.remove('open');
    selectedPatientId = null;
  }
  window.closeModal = closeModal;

  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  closeBottomBtn.addEventListener('click', closeModal);

  deleteBtn.addEventListener('click', () => {
    if (selectedPatientId) {
      confirmSoftDelete(selectedPatientId);
    }
  });
}

// Setup Voice Simulator
function setupSimulator() {
  const modal = document.getElementById('simulatorModal');
  const backdrop = document.getElementById('simBackdrop');
  const openBtn = document.getElementById('openSimulatorBtn');
  const closeBtn = document.getElementById('closeSimBtn');
  const toolSelect = document.getElementById('simToolSelect');
  const payloadArea = document.getElementById('simPayload');
  const runBtn = document.getElementById('runSimToolBtn');
  const speechOutput = document.getElementById('simSpeechOutput');
  const rawOutput = document.getElementById('simRawOutput');

  function openSim() {
    modal.classList.add('open');
    updatePayloadTemplate();
  }

  function closeSim() {
    modal.classList.remove('open');
  }

  function updatePayloadTemplate() {
    const tool = toolSelect.value;
    const template = { ...SIM_PAYLOADS[tool] };
    if (tool === 'update_patient' && currentPatients.length > 0) {
      template.patient_id = currentPatients[0].patient_id;
    }
    payloadArea.value = JSON.stringify(template, null, 2);
  }

  openBtn.addEventListener('click', openSim);
  backdrop.addEventListener('click', closeSim);
  closeBtn.addEventListener('click', closeSim);
  toolSelect.addEventListener('change', updatePayloadTemplate);

  runBtn.addEventListener('click', async () => {
    try {
      const toolName = toolSelect.value;
      const parsedArgs = JSON.parse(payloadArea.value);

      runBtn.disabled = true;
      runBtn.textContent = 'Executing...';
      speechOutput.textContent = 'Contacting voice webhook dispatcher...';

      const res = await fetch('/api/voice/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          args: parsedArgs,
          callerPhone: parsedArgs.phone_number || '4155552671'
        })
      });

      const json = await res.json();
      rawOutput.textContent = JSON.stringify(json, null, 2);

      const result = json.data?.result;
      if (result && result.speech_prompt) {
        speechOutput.textContent = `"${result.speech_prompt}"`;
      } else if (result && result.error) {
        speechOutput.textContent = `Error: ${result.error}`;
      } else {
        speechOutput.textContent = JSON.stringify(result);
      }

      loadPatients();
    } catch (err) {
      speechOutput.textContent = `Simulation Error: ${err.message}`;
      rawOutput.textContent = err.stack || err.message;
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Execute Voice Tool';
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsonForAttr(obj) {
  return JSON.stringify(JSON.stringify(obj));
}
