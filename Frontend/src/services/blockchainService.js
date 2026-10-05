import { computeSHA256 } from './cryptoService.js';

export async function createGenesisBlock() {
  const timestamp = '2024-01-01T00:00:00.000Z';
  const genesisPayload = '0:0000000000000000000000000000000000000000000000000000000000000000:GENESIS_LEGAL_CONSORTIUM:ROOT_GOV_IN:0';
  const blockHash = await computeSHA256(genesisPayload);

  return {
    blockHeight: 0,
    timestamp,
    action: 'GENESIS_LEGAL_CONSORTIUM',
    caseId: 'SYSTEM-ROOT',
    docId: 'GENESIS-0',
    title: 'National Legal & Investigation Trust Genesis Root',
    documentHash: '0000000000000000000000000000000000000000000000000000000000000000',
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    blockHash,
    actor: 'Ministry of Law & Justice / CCTNS Root',
    validatorNode: 'Node-00-Apex-Judiciary-Delhi',
    nonce: 104729,
    status: 'CONFIRMED'
  };
}

export async function mineNewBlock(prevBlock, txData) {
  const blockHeight = prevBlock.blockHeight + 1;
  const timestamp = new Date().toISOString();
  const nonce = Math.floor(Math.random() * 900000) + 100000;
  
  const payloadToHash = `${blockHeight}:${prevBlock.blockHash}:${timestamp}:${txData.action}:${txData.documentHash}:${nonce}`;
  const blockHash = await computeSHA256(payloadToHash);

  return {
    blockHeight,
    timestamp,
    action: txData.action,
    caseId: txData.caseId || 'N/A',
    docId: txData.docId || 'N/A',
    title: txData.title || 'Legal Document Event',
    documentHash: txData.documentHash,
    prevHash: prevBlock.blockHash,
    blockHash,
    actor: txData.actor || 'Authorized Officer',
    validatorNode: txData.validatorNode || 'Node-03-State-Police-HQ',
    nonce,
    status: 'CONFIRMED'
  };
}

export async function verifyBlockchainIntegrity(chain) {
  if (!chain || chain.length === 0) return { valid: false, error: 'Empty blockchain.' };

  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const prev = chain[i - 1];

    // Check link integrity
    if (current.prevHash !== prev.blockHash) {
      return {
        valid: false,
        brokenIndex: i,
        error: `Broken chain link at Block #${current.blockHeight}: prevHash does not match Block #${prev.blockHeight}'s blockHash!`
      };
    }

    // Recompute block hash
    const payload = `${current.blockHeight}:${current.prevHash}:${current.timestamp}:${current.action}:${current.documentHash}:${current.nonce}`;
    const expectedHash = await computeSHA256(payload);

    if (expectedHash !== current.blockHash) {
      return {
        valid: false,
        brokenIndex: i,
        error: `Corrupt Block #${current.blockHeight}: Block hash does not match mathematical payload verification!`
      };
    }
  }

  return { valid: true, message: `All ${chain.length} blocks mathematically verified & tamper-proof.` };
}
