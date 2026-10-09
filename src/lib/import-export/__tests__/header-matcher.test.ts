import { describe, it, expect } from 'vitest';
import { autoMapSpreadsheetHeaders, detectContactSlotCount } from '../header-matcher';

describe('header-matcher', () => {
  const baseFields = [
    { key: 'name', label: 'School Name', required: true },
    { key: 'contact_0_name', label: 'Contact Name' },
    { key: 'contact_0_email', label: 'Contact Email' },
    { key: 'contact_0_phone', label: 'Contact Phone' },
    { key: 'contact_0_role', label: 'Contact Role' },
    { key: 'status', label: 'Status' },
    { key: 'locationString', label: 'Physical Address' },
    { key: 'locationRegion', label: 'Region' },
    { key: 'locationDistrict', label: 'District' },
    { key: 'leadSource', label: 'Lead Source' },
    { key: 'workspaceTags', label: 'Tags' },
  ];

  it('matches title case headers (Email, Phone, Role, Name)', () => {
    const headers = ['Name', 'Email', 'Phone', 'Role'];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('Name');
    expect(result.mapping['contact_0_email']).toBe('Email');
    expect(result.mapping['contact_0_phone']).toBe('Phone');
    expect(result.mapping['contact_0_role']).toBe('Role');
  });

  it('matches lower case headers (email, phone, role, name)', () => {
    const headers = ['name', 'email', 'phone', 'role'];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('name');
    expect(result.mapping['contact_0_email']).toBe('email');
    expect(result.mapping['contact_0_phone']).toBe('phone');
    expect(result.mapping['contact_0_role']).toBe('role');
  });

  it('matches UPPER CASE headers (EMAIL, PHONE, ROLES, COMPANY)', () => {
    const headers = ['COMPANY', 'EMAIL', 'PHONE', 'ROLES'];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('COMPANY');
    expect(result.mapping['contact_0_email']).toBe('EMAIL');
    expect(result.mapping['contact_0_phone']).toBe('PHONE');
    expect(result.mapping['contact_0_role']).toBe('ROLES');
  });

  it('matches punctuated and hyphenated headers (E-mail, Telephone, Job Title, Contact Person)', () => {
    const headers = ['Organization Name', 'Contact Person', 'E-mail', 'Telephone', 'Job Title', 'Physical Address'];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'Organization');

    expect(result.mapping['name']).toBe('Organization Name');
    expect(result.mapping['contact_0_name']).toBe('Contact Person');
    expect(result.mapping['contact_0_email']).toBe('E-mail');
    expect(result.mapping['contact_0_phone']).toBe('Telephone');
    expect(result.mapping['contact_0_role']).toBe('Job Title');
    expect(result.mapping['locationString']).toBe('Physical Address');
  });

  it('disambiguates entity name and contact name when both exist', () => {
    const headers = ['School Name', 'Contact Name', 'Email Address', 'Mobile Number', 'Position'];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('School Name');
    expect(result.mapping['contact_0_name']).toBe('Contact Name');
    expect(result.mapping['contact_0_email']).toBe('Email Address');
    expect(result.mapping['contact_0_phone']).toBe('Mobile Number');
    expect(result.mapping['contact_0_role']).toBe('Position');
  });

  it('detects multiple contact slots when Contact 2 columns exist', () => {
    const multiContactFields = [
      ...baseFields,
      { key: 'contact_1_name', label: 'Contact 2 Name' },
      { key: 'contact_1_email', label: 'Contact 2 Email' },
      { key: 'contact_1_phone', label: 'Contact 2 Phone' },
      { key: 'contact_1_role', label: 'Contact 2 Role' },
    ];

    const headers = [
      'Institution',
      'Contact 1 Name',
      'Contact 1 Email',
      'Contact 1 Phone',
      'Contact 1 Role',
      'Contact 2 Name',
      'Contact 2 Email',
      'Contact 2 Phone',
      'Contact 2 Role',
    ];

    const slotCount = detectContactSlotCount(headers);
    expect(slotCount).toBe(2);

    const result = autoMapSpreadsheetHeaders(headers, multiContactFields, 'institution', 'Institution');
    expect(result.detectedSlotCount).toBe(2);
    expect(result.mapping['contact_0_email']).toBe('Contact 1 Email');
    expect(result.mapping['contact_0_phone']).toBe('Contact 1 Phone');
    expect(result.mapping['contact_0_role']).toBe('Contact 1 Role');
    expect(result.mapping['contact_1_email']).toBe('Contact 2 Email');
    expect(result.mapping['contact_1_phone']).toBe('Contact 2 Phone');
    expect(result.mapping['contact_1_role']).toBe('Contact 2 Role');
  });

  it('matches wild mixed case, leading/trailing whitespace, and underscores', () => {
    const headers = ['  sCHool_NAme  ', '  eMAiL  ', '  pHOnE_nUmbEr  ', '  rOLes  '];
    const result = autoMapSpreadsheetHeaders(headers, baseFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('  sCHool_NAme  ');
    expect(result.mapping['contact_0_email']).toBe('  eMAiL  ');
    expect(result.mapping['contact_0_phone']).toBe('  pHOnE_nUmbEr  ');
    expect(result.mapping['contact_0_role']).toBe('  rOLes  ');
  });

  it('matches person scope fields (First Name, Last Name, Job Title, Email, Phone)', () => {
    const personFields = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'contact_0_email', label: 'Contact Email' },
      { key: 'contact_0_phone', label: 'Contact Phone' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'company', label: 'Company' },
    ];

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Company'];
    const result = autoMapSpreadsheetHeaders(headers, personFields, 'person', 'Person');

    expect(result.mapping['firstName']).toBe('First Name');
    expect(result.mapping['lastName']).toBe('Last Name');
    expect(result.mapping['contact_0_email']).toBe('Email');
    expect(result.mapping['contact_0_phone']).toBe('Phone');
    expect(result.mapping['jobTitle']).toBe('Role');
    expect(result.mapping['company']).toBe('Company');
  });

  it('matches family scope fields (Guardian Name, Guardian Email, Relationship)', () => {
    const familyFields = [
      { key: 'name', label: 'Family Name', required: true },
      { key: 'contact_0_name', label: 'Guardian Name' },
      { key: 'contact_0_email', label: 'Contact Email' },
      { key: 'contact_0_phone', label: 'Contact Phone' },
      { key: 'contact_0_role', label: 'Guardian Relationship' },
    ];

    const headers = ['Family Name', 'Guardian Name', 'Email', 'Phone', 'Relationship'];
    const result = autoMapSpreadsheetHeaders(headers, familyFields, 'family', 'Family');

    expect(result.mapping['name']).toBe('Family Name');
    expect(result.mapping['contact_0_name']).toBe('Guardian Name');
    expect(result.mapping['contact_0_email']).toBe('Email');
    expect(result.mapping['contact_0_phone']).toBe('Phone');
    expect(result.mapping['contact_0_role']).toBe('Relationship');
  });

  it('matches contacts import institution fields (contact_name, contact_email, contact_phone, contact_role)', () => {
    const institutionFields = [
      { key: 'name', label: 'Institution Name', required: true },
      { key: 'contact_name', label: 'Primary Contact Name', required: true },
      { key: 'contact_phone', label: 'Primary Contact Phone' },
      { key: 'contact_email', label: 'Primary Contact Email' },
      { key: 'contact_role', label: 'Primary Contact Role' },
      { key: 'nominalRoll', label: 'Nominal Roll' },
      { key: 'locationString', label: 'Location' },
    ];

    const headers = ['School Name', 'Email', 'Phone', 'Role', 'Contact Person'];
    const result = autoMapSpreadsheetHeaders(headers, institutionFields, 'institution', 'School');

    expect(result.mapping['name']).toBe('School Name');
    expect(result.mapping['contact_name']).toBe('Contact Person');
    expect(result.mapping['contact_email']).toBe('Email');
    expect(result.mapping['contact_phone']).toBe('Phone');
    expect(result.mapping['contact_role']).toBe('Role');
  });

  it('matches contacts import person fields (firstName, lastName, phone, email, jobTitle)', () => {
    const personFields = [
      { key: 'firstName', label: 'First Name', required: true },
      { key: 'lastName', label: 'Last Name' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'company', label: 'Company Name' },
      { key: 'jobTitle', label: 'Job Title' },
    ];

    const headers = ['First Name', 'Last Name', 'email', 'phone', 'roles', 'company'];
    const result = autoMapSpreadsheetHeaders(headers, personFields, 'person', 'Contact');

    expect(result.mapping['firstName']).toBe('First Name');
    expect(result.mapping['lastName']).toBe('Last Name');
    expect(result.mapping['email']).toBe('email');
    expect(result.mapping['phone']).toBe('phone');
    expect(result.mapping['jobTitle']).toBe('roles');
    expect(result.mapping['company']).toBe('company');
  });

  it('matches contacts import family fields (guardian1_name, guardian1_phone, guardian1_email)', () => {
    const familyFields = [
      { key: 'familyName', label: 'Family Name', required: true },
      { key: 'guardian1_name', label: 'Guardian Name', required: true },
      { key: 'guardian1_phone', label: 'Guardian Phone' },
      { key: 'guardian1_email', label: 'Guardian Email' },
      { key: 'guardian1_relationship', label: 'Guardian Relationship' },
    ];

    const headers = ['Family Name', 'Guardian', 'Email', 'Phone', 'Relationship'];
    const result = autoMapSpreadsheetHeaders(headers, familyFields, 'family', 'Family');

    expect(result.mapping['familyName']).toBe('Family Name');
    expect(result.mapping['guardian1_name']).toBe('Guardian');
    expect(result.mapping['guardian1_email']).toBe('Email');
    expect(result.mapping['guardian1_phone']).toBe('Phone');
    expect(result.mapping['guardian1_relationship']).toBe('Relationship');
  });
});
