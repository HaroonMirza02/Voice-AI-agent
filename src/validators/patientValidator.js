/**
 * Validation and sanitization for Patient data model
 */

const VALID_SEX_VALUES = ['Male', 'Female', 'Other', 'Decline to Answer'];

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'MP', 'AS'
]);

// Full state name to abbreviation mapping for voice agent convenience
const STATE_NAME_TO_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR'
};

const NAME_REGEX = /^[a-zA-ZÀ-ÿ' -]{1,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Basic string sanitization to prevent injection and strip dangerous characters
 */
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  return val
    .trim()
    .replace(/[<>]/g, ''); // strip basic HTML tags
}

/**
 * Normalize phone number to 10 digits
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // If 11 digits and starts with 1, strip leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Validate Date of Birth
 * Must be a valid date, ISO format (YYYY-MM-DD), and not in the future
 */
function validateDateOfBirth(dobStr) {
  if (!dobStr || typeof dobStr !== 'string') {
    return { valid: false, error: 'Date of birth is required.' };
  }

  const trimmed = dobStr.trim();
  // Check format YYYY-MM-DD
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(isoPattern);
  if (!match) {
    return { valid: false, error: 'Date of birth must be in YYYY-MM-DD format.' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  const dateObj = new Date(year, month, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month ||
    dateObj.getDate() !== day
  ) {
    return { valid: false, error: 'Date of birth is an invalid calendar date.' };
  }

  const now = new Date();
  // Set now to end of day to avoid timezone discrepancies on today's date
  now.setHours(23, 59, 59, 999);

  if (dateObj > now) {
    return { valid: false, error: 'Date of birth cannot be in the future.' };
  }

  // Sanity check: reasonably not older than 130 years
  const minYear = now.getFullYear() - 130;
  if (year < minYear) {
    return { valid: false, error: `Date of birth cannot be earlier than year ${minYear}.` };
  }

  return { valid: true, value: trimmed };
}

/**
 * Sanitize and validate complete patient input for creation
 */
function validatePatient(data) {
  const errors = {};
  const sanitized = {};

  // First Name (Required, 1-50 chars, letters + hyphens/apostrophes)
  if (!data.first_name || typeof data.first_name !== 'string' || !data.first_name.trim()) {
    errors.first_name = 'First name is required.';
  } else {
    const cleaned = sanitizeString(data.first_name);
    if (!NAME_REGEX.test(cleaned)) {
      errors.first_name = 'First name must be 1–50 characters and contain only letters, hyphens, or apostrophes.';
    } else {
      sanitized.first_name = cleaned;
    }
  }

  // Last Name (Required, 1-50 chars, letters + hyphens/apostrophes)
  if (!data.last_name || typeof data.last_name !== 'string' || !data.last_name.trim()) {
    errors.last_name = 'Last name is required.';
  } else {
    const cleaned = sanitizeString(data.last_name);
    if (!NAME_REGEX.test(cleaned)) {
      errors.last_name = 'Last name must be 1–50 characters and contain only letters, hyphens, or apostrophes.';
    } else {
      sanitized.last_name = cleaned;
    }
  }

  // Date of Birth (Required, valid date, not future)
  const dobResult = validateDateOfBirth(data.date_of_birth);
  if (!dobResult.valid) {
    errors.date_of_birth = dobResult.error;
  } else {
    sanitized.date_of_birth = dobResult.value;
  }

  // Sex (Required enum: Male, Female, Other, Decline to Answer)
  if (!data.sex) {
    errors.sex = `Sex is required. Must be one of: ${VALID_SEX_VALUES.join(', ')}.`;
  } else {
    const cleanedSex = sanitizeString(data.sex);
    // Case-insensitive match for voice convenience
    const matchedSex = VALID_SEX_VALUES.find(s => s.toLowerCase() === cleanedSex.toLowerCase());
    if (!matchedSex) {
      errors.sex = `Invalid sex. Must be one of: ${VALID_SEX_VALUES.join(', ')}.`;
    } else {
      sanitized.sex = matchedSex;
    }
  }

  // Phone Number (Required, valid US 10-digit)
  const normalizedPhone = normalizePhoneNumber(data.phone_number);
  if (!normalizedPhone || normalizedPhone.length !== 10) {
    errors.phone_number = 'Phone number is required and must be a valid 10-digit US phone number.';
  } else {
    sanitized.phone_number = normalizedPhone;
  }

  // Email (Optional, valid format)
  if (data.email !== undefined && data.email !== null && data.email !== '') {
    const cleanedEmail = sanitizeString(data.email);
    if (!EMAIL_REGEX.test(cleanedEmail)) {
      errors.email = 'Email must be a valid email address.';
    } else {
      sanitized.email = cleanedEmail.toLowerCase();
    }
  } else {
    sanitized.email = null;
  }

  // Address Line 1 (Required)
  if (!data.address_line_1 || typeof data.address_line_1 !== 'string' || !data.address_line_1.trim()) {
    errors.address_line_1 = 'Address line 1 is required.';
  } else {
    sanitized.address_line_1 = sanitizeString(data.address_line_1);
  }

  // Address Line 2 (Optional)
  if (data.address_line_2 !== undefined && data.address_line_2 !== null && data.address_line_2 !== '') {
    sanitized.address_line_2 = sanitizeString(data.address_line_2);
  } else {
    sanitized.address_line_2 = null;
  }

  // City (Required, 1-100 chars)
  if (!data.city || typeof data.city !== 'string' || !data.city.trim()) {
    errors.city = 'City is required.';
  } else {
    const cleanedCity = sanitizeString(data.city);
    if (cleanedCity.length < 1 || cleanedCity.length > 100) {
      errors.city = 'City must be between 1 and 100 characters.';
    } else {
      sanitized.city = cleanedCity;
    }
  }

  // State (Required, valid 2-letter US state)
  if (!data.state || typeof data.state !== 'string' || !data.state.trim()) {
    errors.state = 'State is required (2-letter US abbreviation).';
  } else {
    let stateCode = sanitizeString(data.state).toUpperCase();
    if (stateCode.length > 2) {
      const mapped = STATE_NAME_TO_ABBR[stateCode.toLowerCase()];
      if (mapped) stateCode = mapped;
    }
    if (!US_STATES.has(stateCode)) {
      errors.state = 'State must be a valid 2-letter US state abbreviation (e.g., CA, NY, TX).';
    } else {
      sanitized.state = stateCode;
    }
  }

  // Zip Code (Required, 5-digit or ZIP+4)
  if (!data.zip_code || typeof data.zip_code !== 'string' || !data.zip_code.trim()) {
    errors.zip_code = 'Zip code is required (5-digit or ZIP+4).';
  } else {
    const cleanedZip = sanitizeString(data.zip_code);
    if (!ZIP_REGEX.test(cleanedZip)) {
      errors.zip_code = 'Zip code must be in 5-digit (12345) or ZIP+4 (12345-6789) format.';
    } else {
      sanitized.zip_code = cleanedZip;
    }
  }

  // Insurance Provider (Optional)
  if (data.insurance_provider !== undefined && data.insurance_provider !== null && data.insurance_provider !== '') {
    sanitized.insurance_provider = sanitizeString(data.insurance_provider);
  } else {
    sanitized.insurance_provider = null;
  }

  // Insurance Member ID (Optional, alphanumeric)
  if (data.insurance_member_id !== undefined && data.insurance_member_id !== null && data.insurance_member_id !== '') {
    const cleanedId = sanitizeString(data.insurance_member_id);
    if (!ALPHANUMERIC_REGEX.test(cleanedId)) {
      errors.insurance_member_id = 'Insurance member ID must be alphanumeric.';
    } else {
      sanitized.insurance_member_id = cleanedId;
    }
  } else {
    sanitized.insurance_member_id = null;
  }

  // Preferred Language (Optional, default 'English')
  if (data.preferred_language !== undefined && data.preferred_language !== null && data.preferred_language !== '') {
    sanitized.preferred_language = sanitizeString(data.preferred_language);
  } else {
    sanitized.preferred_language = 'English';
  }

  // Emergency Contact Name (Optional)
  if (data.emergency_contact_name !== undefined && data.emergency_contact_name !== null && data.emergency_contact_name !== '') {
    sanitized.emergency_contact_name = sanitizeString(data.emergency_contact_name);
  } else {
    sanitized.emergency_contact_name = null;
  }

  // Emergency Contact Phone (Optional, valid US 10-digit)
  if (data.emergency_contact_phone !== undefined && data.emergency_contact_phone !== null && data.emergency_contact_phone !== '') {
    const normalizedEmergencyPhone = normalizePhoneNumber(data.emergency_contact_phone);
    if (!normalizedEmergencyPhone || normalizedEmergencyPhone.length !== 10) {
      errors.emergency_contact_phone = 'Emergency contact phone must be a valid 10-digit US phone number.';
    } else {
      sanitized.emergency_contact_phone = normalizedEmergencyPhone;
    }
  } else {
    sanitized.emergency_contact_phone = null;
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors, sanitized: isValid ? sanitized : null };
}

/**
 * Validate partial update data (for PUT /patients/:id)
 */
function validatePartialPatient(data) {
  const errors = {};
  const sanitized = {};
  let fieldsProvided = 0;

  const immutableFields = ['patient_id', 'created_at', 'updated_at', 'deleted_at'];
  for (const field of immutableFields) {
    if (data[field] !== undefined) {
      errors[field] = `${field} cannot be modified via update.`;
    }
  }

  if (data.first_name !== undefined) {
    fieldsProvided++;
    const cleaned = sanitizeString(data.first_name);
    if (!cleaned || !NAME_REGEX.test(cleaned)) {
      errors.first_name = 'First name must be 1–50 characters and contain only letters, hyphens, or apostrophes.';
    } else {
      sanitized.first_name = cleaned;
    }
  }

  if (data.last_name !== undefined) {
    fieldsProvided++;
    const cleaned = sanitizeString(data.last_name);
    if (!cleaned || !NAME_REGEX.test(cleaned)) {
      errors.last_name = 'Last name must be 1–50 characters and contain only letters, hyphens, or apostrophes.';
    } else {
      sanitized.last_name = cleaned;
    }
  }

  if (data.date_of_birth !== undefined) {
    fieldsProvided++;
    const dobResult = validateDateOfBirth(data.date_of_birth);
    if (!dobResult.valid) {
      errors.date_of_birth = dobResult.error;
    } else {
      sanitized.date_of_birth = dobResult.value;
    }
  }

  if (data.sex !== undefined) {
    fieldsProvided++;
    const cleanedSex = sanitizeString(data.sex);
    const matchedSex = VALID_SEX_VALUES.find(s => s.toLowerCase() === cleanedSex.toLowerCase());
    if (!matchedSex) {
      errors.sex = `Invalid sex. Must be one of: ${VALID_SEX_VALUES.join(', ')}.`;
    } else {
      sanitized.sex = matchedSex;
    }
  }

  if (data.phone_number !== undefined) {
    fieldsProvided++;
    const normalizedPhone = normalizePhoneNumber(data.phone_number);
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      errors.phone_number = 'Phone number must be a valid 10-digit US phone number.';
    } else {
      sanitized.phone_number = normalizedPhone;
    }
  }

  if (data.email !== undefined) {
    fieldsProvided++;
    if (data.email === null || data.email === '') {
      sanitized.email = null;
    } else {
      const cleanedEmail = sanitizeString(data.email);
      if (!EMAIL_REGEX.test(cleanedEmail)) {
        errors.email = 'Email must be a valid email address.';
      } else {
        sanitized.email = cleanedEmail.toLowerCase();
      }
    }
  }

  if (data.address_line_1 !== undefined) {
    fieldsProvided++;
    const cleaned = sanitizeString(data.address_line_1);
    if (!cleaned) {
      errors.address_line_1 = 'Address line 1 cannot be empty.';
    } else {
      sanitized.address_line_1 = cleaned;
    }
  }

  if (data.address_line_2 !== undefined) {
    fieldsProvided++;
    sanitized.address_line_2 = data.address_line_2 ? sanitizeString(data.address_line_2) : null;
  }

  if (data.city !== undefined) {
    fieldsProvided++;
    const cleanedCity = sanitizeString(data.city);
    if (!cleanedCity || cleanedCity.length > 100) {
      errors.city = 'City must be between 1 and 100 characters.';
    } else {
      sanitized.city = cleanedCity;
    }
  }

  if (data.state !== undefined) {
    fieldsProvided++;
    let stateCode = sanitizeString(data.state).toUpperCase();
    if (stateCode.length > 2) {
      const mapped = STATE_NAME_TO_ABBR[stateCode.toLowerCase()];
      if (mapped) stateCode = mapped;
    }
    if (!US_STATES.has(stateCode)) {
      errors.state = 'State must be a valid 2-letter US state abbreviation.';
    } else {
      sanitized.state = stateCode;
    }
  }

  if (data.zip_code !== undefined) {
    fieldsProvided++;
    const cleanedZip = sanitizeString(data.zip_code);
    if (!ZIP_REGEX.test(cleanedZip)) {
      errors.zip_code = 'Zip code must be in 5-digit or ZIP+4 format.';
    } else {
      sanitized.zip_code = cleanedZip;
    }
  }

  if (data.insurance_provider !== undefined) {
    fieldsProvided++;
    sanitized.insurance_provider = data.insurance_provider ? sanitizeString(data.insurance_provider) : null;
  }

  if (data.insurance_member_id !== undefined) {
    fieldsProvided++;
    if (data.insurance_member_id === null || data.insurance_member_id === '') {
      sanitized.insurance_member_id = null;
    } else {
      const cleanedId = sanitizeString(data.insurance_member_id);
      if (!ALPHANUMERIC_REGEX.test(cleanedId)) {
        errors.insurance_member_id = 'Insurance member ID must be alphanumeric.';
      } else {
        sanitized.insurance_member_id = cleanedId;
      }
    }
  }

  if (data.preferred_language !== undefined) {
    fieldsProvided++;
    sanitized.preferred_language = data.preferred_language ? sanitizeString(data.preferred_language) : 'English';
  }

  if (data.emergency_contact_name !== undefined) {
    fieldsProvided++;
    sanitized.emergency_contact_name = data.emergency_contact_name ? sanitizeString(data.emergency_contact_name) : null;
  }

  if (data.emergency_contact_phone !== undefined) {
    fieldsProvided++;
    if (data.emergency_contact_phone === null || data.emergency_contact_phone === '') {
      sanitized.emergency_contact_phone = null;
    } else {
      const normalizedPhone = normalizePhoneNumber(data.emergency_contact_phone);
      if (!normalizedPhone || normalizedPhone.length !== 10) {
        errors.emergency_contact_phone = 'Emergency contact phone must be a valid 10-digit US phone number.';
      } else {
        sanitized.emergency_contact_phone = normalizedPhone;
      }
    }
  }

  if (fieldsProvided === 0) {
    errors._general = 'At least one valid field must be provided for update.';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors, sanitized: isValid ? sanitized : null };
}

module.exports = {
  validatePatient,
  validatePartialPatient,
  validateDateOfBirth,
  normalizePhoneNumber,
  sanitizeString,
  VALID_SEX_VALUES,
  US_STATES,
};
