import { ClaimCompletenessSchema, type ClaimCompleteness, type ClaimIntake } from '@aven/contracts';

const REQUIRED: (keyof ClaimIntake)[] = [
  'patientName',
  'patientDateOfBirth',
  'patientGender',
  'patientContact',
  'admissionType',
  'expectedAdmissionDate',
  'provisionalDiagnosis',
  'proposedTreatment',
  'doctorName',
  'doctorRegistrationId',
  'estimatedAmount',
  'attestationConfirmed',
  'consentConfirmed',
];

// The emergency exception still needs an identifiable patient and a basic clinical reason.
const EMERGENCY_ESSENTIALS: (keyof ClaimIntake)[] = [
  'patientName',
  'expectedAdmissionDate',
  'provisionalDiagnosis',
  'attestationConfirmed',
  'consentConfirmed',
];

function isMissing(intake: ClaimIntake, field: keyof ClaimIntake): boolean {
  const value = intake[field];
  if (field === 'estimatedAmount') return typeof value !== 'number' || value <= 0;
  if (field === 'attestationConfirmed' || field === 'consentConfirmed') return value !== true;
  return value === undefined || value === '' || value === 'UNKNOWN';
}

export function evaluateClaimCompleteness(intake: ClaimIntake): ClaimCompleteness {
  const fields = [
    ...REQUIRED,
    ...(intake.admissionType === 'PLANNED' ? ['roomCategory' as const] : []),
  ];
  const missingFields = fields.filter((field) => isMissing(intake, field));
  const missingEmergencyFields = EMERGENCY_ESSENTIALS.filter((field) => isMissing(intake, field));

  return ClaimCompletenessSchema.parse({
    ruleVersion: 'intake-v1',
    complete: missingFields.length === 0,
    missingFields,
    canSubmitAsEmergency:
      intake.admissionType === 'EMERGENCY' && missingEmergencyFields.length === 0,
    missingEmergencyFields,
  });
}
