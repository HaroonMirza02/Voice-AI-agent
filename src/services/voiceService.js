const patientService = require('./patientService');
const callLogRepository = require('../repositories/callLogRepository');

class VoiceService {
  /**
   * Handle incoming Vapi webhook request
   */
  async handleVapiWebhook(body) {
    const message = body.message || body;
    const messageType = message.type;

    // 1. Tool Calls Event
    if (messageType === 'tool-calls' || Array.isArray(message.toolCalls) || Array.isArray(body.toolCalls)) {
      const toolCalls = message.toolCalls || body.toolCalls || [];
      const call = message.call || body.call || {};
      const callId = call.id || body.callId || `sim_${Date.now()}`;
      const callerPhone = call.customer ? call.customer.number : (body.phoneNumber || null);

      const results = [];

      for (const toolCall of toolCalls) {
        const id = toolCall.id;
        const fn = toolCall.function || {};
        const name = fn.name || toolCall.name;
        let args = fn.arguments || toolCall.parameters || {};

        // Vapi sometimes sends arguments as a JSON string
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch (e) {
            args = {};
          }
        }

        const result = await this.executeTool(name, args, { callId, callerPhone });
        results.push({
          toolCallId: id,
          result: typeof result === 'object' ? JSON.stringify(result) : String(result),
        });

        // Update call log with tool call execution
        callLogRepository.logCall({
          call_id: callId,
          phone_number: callerPhone,
          call_status: 'in-progress',
          tool_calls: [{ name, args, result, timestamp: new Date().toISOString() }],
        });
      }

      return { results };
    }

    // 2. End of Call Report Event
    if (messageType === 'end-of-call-report' || messageType === 'status-update') {
      const call = message.call || {};
      const callId = call.id || message.callId || `call_${Date.now()}`;
      const transcript = message.transcript || message.artifact?.transcript || null;
      const durationSeconds = message.durationSeconds || message.duration || 0;
      const callerPhone = call.customer ? call.customer.number : null;

      callLogRepository.logCall({
        call_id: callId,
        phone_number: callerPhone,
        call_status: message.endedReason || 'completed',
        transcript: transcript,
        duration_seconds: durationSeconds,
      });

      console.log(`[Voice Webhook] Call ${callId} ended. Duration: ${durationSeconds}s. Status: ${message.endedReason || 'completed'}`);
      return { success: true };
    }

    // 3. Fallback for unrecognized events
    return { success: true, message: 'Event received' };
  }

  /**
   * Execute specific tool
   */
  async executeTool(toolName, args, context = {}) {
    console.log(`[Voice Tool Call] Executing '${toolName}' with arguments:`, JSON.stringify(args, null, 2));

    switch (toolName) {
      case 'check_existing_patient': {
        const phone = args.phone_number || context.callerPhone;
        const result = await patientService.checkExistingByPhone(phone);
        if (result.found) {
          return {
            found: true,
            patient: result.patient,
            speech_prompt: `I found an existing record for ${result.patient.first_name} ${result.patient.last_name} born on ${result.patient.date_of_birth}. Would you like to update this record, or are you registering a different patient?`,
          };
        } else {
          return {
            found: false,
            speech_prompt: `I don't see any prior registrations with this phone number. Let's start a new registration. What is your first name?`,
          };
        }
      }

      case 'create_patient': {
        try {
          // If phone_number was omitted, default to caller ID if available
          if (!args.phone_number && context.callerPhone) {
            args.phone_number = context.callerPhone;
          }

          const created = await patientService.createPatient(args);

          // Log collected demographic payload to stdout as required
          console.log('\n========================================');
          console.log('[PATIENT REGISTRATION COMPLETED]');
          console.log(`Patient ID : ${created.patient_id}`);
          console.log(`Name       : ${created.first_name} ${created.last_name}`);
          console.log(`DOB        : ${created.date_of_birth}`);
          console.log(`Phone      : ${created.phone_number}`);
          console.log(`Address    : ${created.address_line_1}, ${created.city}, ${created.state} ${created.zip_code}`);
          console.log('Full Payload:', JSON.stringify(created, null, 2));
          console.log('========================================\n');

          // Log final payload in call_logs table
          callLogRepository.logCall({
            call_id: context.callId,
            phone_number: created.phone_number,
            call_status: 'registered',
            collected_payload: created,
          });

          return {
            success: true,
            patient_id: created.patient_id,
            speech_prompt: `Thank you, ${created.first_name}! You are officially registered in our CarePoint Health system with record ID ${created.patient_id.slice(0, 8)}. You are all set! Have a wonderful day.`,
          };
        } catch (err) {
          console.error('[Voice Tool Call Error] create_patient failed:', err.message, err.details);

          // Build a clear conversational speech prompt for validation errors
          let speechPrompt = 'There was an issue saving your registration. ';
          if (err.details) {
            const firstKey = Object.keys(err.details)[0];
            const firstErr = err.details[firstKey];
            speechPrompt += `${firstErr} Could you please verify that information?`;
          } else {
            speechPrompt += 'Our system encountered a temporary error. Would you like me to try saving again?';
          }

          return {
            success: false,
            error: err.message,
            details: err.details || null,
            speech_prompt: speechPrompt,
          };
        }
      }

      case 'update_patient': {
        try {
          const { patient_id, ...updates } = args;
          if (!patient_id) {
            return {
              success: false,
              error: 'patient_id is required for updates.',
              speech_prompt: 'I could not update the record because the patient ID was missing.',
            };
          }

          const updated = await patientService.updatePatient(patient_id, updates);

          console.log('\n[PATIENT RECORD UPDATED]');
          console.log(`Patient ID : ${updated.patient_id}`);
          console.log(`Updated Fields:`, JSON.stringify(updates, null, 2));

          callLogRepository.logCall({
            call_id: context.callId,
            phone_number: updated.phone_number,
            call_status: 'updated',
            collected_payload: updated,
          });

          return {
            success: true,
            patient: updated,
            speech_prompt: `I have updated your record with the new information. Is there anything else I can assist you with today?`,
          };
        } catch (err) {
          console.error('[Voice Tool Call Error] update_patient failed:', err.message);
          return {
            success: false,
            error: err.message,
            details: err.details || null,
            speech_prompt: 'I encountered an error updating that information. Could you please repeat the details?',
          };
        }
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          speech_prompt: `I encountered an internal error with function ${toolName}.`,
        };
    }
  }
}

module.exports = new VoiceService();
module.exports.VoiceService = VoiceService;
