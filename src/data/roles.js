export const ROLES = {
  INVESTIGATION_OFFICER: {
    id: 'investigation_officer',
    name: 'Investigation Officer',
    complianceTitle: 'Senior Compliance Officer',
    designation: 'Senior Compliance Officer / Nodal Auditor',
    clearance: 'Secret',
    iconName: 'Shield',
    permissions: ['view', 'upload', 'download', 'verify', 'create_case', 'create_version']
  },
  POLICE_OFFICER: {
    id: 'police_officer',
    name: 'Police Station Officer',
    complianceTitle: 'District Monitoring Officer',
    designation: 'District Monitoring Inspector',
    clearance: 'Secret',
    iconName: 'Building2',
    permissions: ['view', 'upload', 'download', 'verify']
  },
  LEGAL_OFFICER: {
    id: 'legal_officer',
    name: 'Legal Officer',
    complianceTitle: 'Regulatory Counsel',
    designation: 'Regulatory & Grievance Counsel',
    clearance: 'Confidential',
    iconName: 'Scale',
    permissions: ['view', 'download', 'verify', 'edit_metadata']
  },
  FORENSIC_ANALYST: {
    id: 'forensic_analyst',
    name: 'Forensic Analyst',
    complianceTitle: 'Technical Systems Auditor',
    designation: 'Edge AI & Systems Auditor',
    clearance: 'Top Secret',
    iconName: 'Microscope',
    permissions: ['view', 'upload', 'download', 'verify', 'forensic_analysis']
  },
  ADMINISTRATOR: {
    id: 'administrator',
    name: 'System Administrator',
    complianceTitle: 'National Compliance Director',
    designation: 'National Compliance Administrator & Auditor',
    clearance: 'Top Secret',
    iconName: 'ShieldCheck',
    permissions: ['view', 'upload', 'download', 'edit_metadata', 'delete', 'verify', 'manage_access']
  }
};
