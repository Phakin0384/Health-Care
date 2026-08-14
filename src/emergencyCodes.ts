// The clinic's emergency broadcast vocabulary, shared by the staff modal that
// offers the options and the server that validates them. An alert broadcast to
// every connected client must not be free text supplied by whoever can reach
// the API — it is announced verbatim on every screen in the building.

export const EMERGENCY_CODES = [
  { value: 'Code Blue - Medical Emergency', label: 'Code Blue - Immediate Medical Assistance' },
  { value: 'Code Red - Fire / Evacuation', label: 'Code Red - Fire / Facility Hazard' },
  { value: 'Code Yellow - Triage Capacity Surge', label: 'Code Yellow - Triage Capacity Surge' },
  { value: 'Code Amber - Security Assistance', label: 'Code Amber - Security Assistance Required' },
] as const;

export const EMERGENCY_LOCATIONS = [
  { value: 'Triage Room 1', label: 'Triage Room 1' },
  { value: 'Triage Room 2', label: 'Triage Room 2' },
  { value: 'Waiting Room', label: 'Main Waiting Room' },
  { value: 'Reception Counter', label: 'Reception / Front Desk' },
  { value: 'Observation Bay A', label: 'Observation Bay A' },
] as const;

export type EmergencyCode = (typeof EMERGENCY_CODES)[number]['value'];
export type EmergencyLocation = (typeof EMERGENCY_LOCATIONS)[number]['value'];

export function isEmergencyCode(value: unknown): value is EmergencyCode {
  return EMERGENCY_CODES.some((code) => code.value === value);
}

export function isEmergencyLocation(value: unknown): value is EmergencyLocation {
  return EMERGENCY_LOCATIONS.some((location) => location.value === value);
}
