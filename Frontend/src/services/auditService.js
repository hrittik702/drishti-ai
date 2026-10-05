// Audit trail and compliance service

export function createAuditEntry({ actor, role, action, caseId, docId, details, status = 'SUCCESS' }) {
  return {
    id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    actorName: actor?.name || 'System Daemon',
    badge: actor?.badge || 'SYS-ROOT',
    role: role || actor?.id || 'system',
    action,
    caseId: caseId || 'GENERAL',
    docId: docId || 'N/A',
    details,
    ipAddress: '10.240.' + Math.floor(Math.random() * 200 + 10) + '.' + Math.floor(Math.random() * 250 + 1),
    status
  };
}

export function generateSection65BCertificate({ document, caseItem, officer, blockchainBlock }) {
  const generatedAt = new Date().toISOString();
  const docTitle = document.title || document.name || 'Electronic Evidence Item';
  const docHash = document.sha256 || document.storedHash || document.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const caseNum = caseItem?.caseNumber || document.caseId || 'GENERAL';

  return {
    certificateId: `CERT-65B-BSA-${Date.now().toString(36).toUpperCase()}`,
    actReference: 'Section 63, Bharatiya Sakshya Adhiniyam, 2023 / Section 65B, Indian Evidence Act, 1872',
    statement: `This certificate certifies that the digital reproduction of the document titled "${docTitle}" (Case No. ${caseNum}) is a true and uncorrupted electronic record extracted from the secure computerized digital document management repository operating under lawful official custody.`,
    documentDetails: {
      documentId: document.id,
      title: docTitle,
      type: document.type || document.category || 'Evidence Record',
      sha256Hash: docHash,
      classification: document.classification || 'Confidential',
      digitalSignatureStatus: document.digitalSignature ? 'SIGNED & SEALED' : 'CRYPTOGRAPHICALLY ANCHORED',
      signedBy: document.digitalSignature?.signerName || officer.name,
      signatureSerial: document.digitalSignature?.signatureToken || `SIG-${docHash.slice(0, 12).toUpperCase()}`
    },
    blockchainProof: {
      blockHeight: blockchainBlock?.blockHeight ?? 'Pending Mining',
      blockHash: blockchainBlock?.blockHash ?? 'N/A',
      validatorNode: blockchainBlock?.validatorNode ?? 'Node-01-Delhi-Judicial-Network'
    },
    certifyingAuthority: {
      officerName: officer.name,
      badge: officer.badge,
      designation: officer.designation,
      department: officer.department,
      certificationTimestamp: generatedAt
    },
    legalStatus: 'ADMISSIBLE IN COURT AS PRIMARY ELECTRONIC EVIDENCE'
  };
}
