import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeAndValidateRegistration } from './registrationValidation';

const validRegistration = {
  firstName: '  Ada ',
  middleName: '',
  lastName: 'Lovelace',
  dob: '1990-12-10',
  gender: 'Female',
  phone: '+1 (555) 123-4567',
  email: ' ADA@EXAMPLE.COM ',
  address: ' 12 Analytical Engine Way ',
  language: 'English',
  nationality: 'British',
  emergencyName: 'William King',
  emergencyRel: 'Spouse',
  emergencyPhone: '+1 (555) 999-1111',
  religion: '',
  consentAgreed: true,
};

test('accepts and normalizes a complete registration', () => {
  const result = sanitizeAndValidateRegistration(validRegistration);

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.firstName, 'Ada');
    assert.equal(result.data.email, 'ada@example.com');
    assert.equal(result.data.address, '12 Analytical Engine Way');
  }
});

test('rejects incomplete, malformed, and non-consensual registrations', () => {
  const result = sanitizeAndValidateRegistration({
    ...validRegistration,
    firstName: '',
    dob: '2099-01-01',
    phone: '123',
    email: 'not-an-email',
    emergencyName: '',
    consentAgreed: false,
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.firstName);
    assert.ok(result.errors.dob);
    assert.ok(result.errors.phone);
    assert.ok(result.errors.email);
    assert.equal(result.errors.emergencyName, undefined);
    assert.ok(result.errors.consentAgreed);
  }
});
