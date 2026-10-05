import { ROLES } from './roles.js';

export const DEMO_USERS = [
  {
    id: 'user-investigator',
    email: 'investigator@caseguard.gov',
    password: 'investigator123',
    name: 'Inspector Vikram Rathore',
    designation: 'Senior Compliance Officer (State Nodal Authority)',
    badge: 'DL-AUD-4418',
    role: ROLES.INVESTIGATION_OFFICER,
    clearance: 'Secret',
    assignedCases: ['TC-DEL-0142', 'TC-BLR-0189', 'TC-MUM-0077', 'TC-HYD-0254', 'INV-2026-0142', 'INV-2026-0189', 'INV-2026-0077'],
    assignedCentres: ['TC-DEL-0142', 'TC-BLR-0189', 'TC-MUM-0077', 'TC-HYD-0254'],
    organization: 'Directorate of Skill Development & Entrepreneurship',
    description: 'Senior Compliance Auditor across primary state training centres with full inspection & evidence verification rights.'
  },
  {
    id: 'user-officer',
    email: 'officer@caseguard.gov',
    password: 'officer123',
    name: 'Sub-Inspector Rajesh Verma',
    designation: 'District Monitoring Inspector (Sitapura Hub)',
    badge: 'RJ-MON-8832',
    role: ROLES.POLICE_OFFICER,
    clearance: 'Secret',
    assignedCases: ['TC-JAI-0310', 'INV-2026-0189'],
    assignedCentres: ['TC-JAI-0310'],
    organization: 'District Skill Development Office, Sitapura',
    description: 'District field inspector assigned strictly to regional training centre TC-JAI-0310. Access to other centres is restricted.'
  },
  {
    id: 'user-legal',
    email: 'legal@caseguard.gov',
    password: 'legal123',
    name: 'Advocate R. K. Shrivastava',
    designation: 'Regulatory & Grievance Counsel (NSDC Legal Wing)',
    badge: 'BAR-DL-9921',
    role: ROLES.LEGAL_OFFICER,
    clearance: 'Confidential',
    assignedCases: ['TC-DEL-0142', 'TC-MUM-0077', 'INV-2026-0142', 'INV-2026-0077'],
    assignedCentres: ['TC-DEL-0142', 'TC-MUM-0077'],
    organization: 'National Skill Development Corporation / Legal Affairs',
    description: 'Statutory compliance counsel handling regulatory dispute review and scheme accreditation.'
  },
  {
    id: 'user-admin',
    email: 'admin@caseguard.gov',
    password: 'admin123',
    name: 'Sh. Alok Vardhan',
    designation: 'Chief System Administrator & Compliance Director',
    badge: 'SYS-DIR-001',
    role: ROLES.ADMINISTRATOR,
    clearance: 'Top Secret',
    assignedCases: ['*'],
    assignedCentres: ['*'],
    organization: 'Ministry of Skill Development & Central Monitoring Portal',
    description: 'Unrestricted central oversight authority with full access across all training centres, hardware health diagnostics, and audit logs.'
  }
];

export function findUserByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return DEMO_USERS.find(u => u.email.toLowerCase() === clean) || null;
}

export function authenticateDemoUser(email, password) {
  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Officer identification or email not found in institutional registry.' };
  }
  if (user.password !== password) {
    return { success: false, error: 'Invalid security credentials or access key.' };
  }
  return { success: true, user };
}
