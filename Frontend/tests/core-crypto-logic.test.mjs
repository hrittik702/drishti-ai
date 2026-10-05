import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSHA256, generateDigitalSignature, verifySignature } from '../src/services/cryptoService.js';
import { createGenesisBlock, mineNewBlock, verifyBlockchainIntegrity } from '../src/services/blockchainService.js';
import { generateSection65BCertificate } from '../src/services/auditService.js';

test('Cryptographic SHA-256 Hashing', async () => {
  const payload = 'First Information Report (FIR No. 0412/2024)';
  const hash1 = await computeSHA256(payload);
  const hash2 = await computeSHA256(payload);
  
  assert.equal(hash1, hash2, 'SHA-256 hash must be deterministic');
  assert.equal(hash1.length, 64, 'SHA-256 must yield 64-character hex string');

  const alteredPayload = payload + ' [tampered byte]';
  const alteredHash = await computeSHA256(alteredPayload);
  assert.notEqual(hash1, alteredHash, 'Altering payload must produce distinct hash');
});

test('PKI Digital Signature Generation and Verification', async () => {
  const signer = {
    name: 'Inspector Vikram Rathore',
    badge: 'IO-DL-8492',
    designation: 'Investigating Officer',
    department: 'Delhi Police'
  };
  const docHash = await computeSHA256('Original Charge Sheet Content');
  const signature = generateDigitalSignature(signer, docHash);

  assert.equal(signature.signerName, signer.name);
  assert.equal(signature.badgeNumber, signer.badge);
  assert.equal(signature.documentHashSnapshot, docHash);

  // Verification against exact docHash
  const verification = verifySignature(signature, docHash);
  assert.equal(verification.valid, true, 'Original signature should be valid');

  // Verification against altered docHash
  const tamperedDocHash = await computeSHA256('Original Charge Sheet Content - TAMPERED');
  const tamperedVerification = verifySignature(signature, tamperedDocHash);
  assert.equal(tamperedVerification.valid, false, 'Tampered document must fail signature verification');
});

test('Blockchain Ledger Mining and Integrity Verification', async () => {
  const genesis = await createGenesisBlock();
  assert.equal(genesis.blockHeight, 0);
  assert.equal(genesis.status, 'CONFIRMED');

  const block1 = await mineNewBlock(genesis, {
    action: 'DOCUMENT_REGISTERED',
    caseId: 'CASE-2024-0412',
    docId: 'DOC-0412-FIR',
    title: 'First Information Report',
    documentHash: '9f83a48e718b2a3b098234857a26f8d3885c301c20e176b6f00122e20b3294aa',
    actor: 'Inspector Vikram Rathore'
  });

  const block2 = await mineNewBlock(block1, {
    action: 'EVIDENCE_CUSTODY_TRANSFERRED',
    caseId: 'CASE-2024-0412',
    docId: 'ASSET-EV-0412-1',
    title: 'Transfer to CFSL Lab',
    documentHash: '7a8f3b2190cde4581290384756abcefd01289456723019847562019384756201',
    actor: 'SI Harpreet Singh'
  });

  const chain = [genesis, block1, block2];
  const check = await verifyBlockchainIntegrity(chain);
  assert.equal(check.valid, true, 'Uncorrupted chain must pass verification');

  // Deliberately tamper with block 1 payload
  const tamperedChain = [
    genesis,
    { ...block1, documentHash: '000000000000000000000000000000000000000000000000000000000000dead' },
    block2
  ];
  const tamperCheck = await verifyBlockchainIntegrity(tamperedChain);
  assert.equal(tamperCheck.valid, false, 'Tampered blockchain block must be detected');
});

test('Universal computeSHA256 supports ArrayBuffer and Uint8Array', async () => {
  const text = 'Secure Case Dossier Exhibit #1';
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(text);
  const arrayBuffer = uint8.buffer;

  const hashStr = await computeSHA256(text);
  const hashArr = await computeSHA256(arrayBuffer);
  const hashView = await computeSHA256(uint8);

  assert.equal(hashStr, hashArr, 'ArrayBuffer and string hash must match');
  assert.equal(hashArr, hashView, 'Uint8Array view hash must match');
});

test('Section 65B BSA Certificate supports document.name and document.storedHash', () => {
  const cert = generateSection65BCertificate({
    document: {
      id: 'DOC-5501-EVID',
      name: 'Bank_Statement_May2024.pdf',
      storedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      classification: 'Secret'
    },
    caseItem: { caseNumber: 'INV-2026-088' },
    officer: {
      name: 'Nodal Officer',
      designation: 'Cyber Cell Inspector'
    }
  });

  assert.equal(cert.documentDetails.title, 'Bank_Statement_May2024.pdf');
  assert.equal(cert.documentDetails.sha256Hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(cert.certifyingAuthority.officerName, 'Nodal Officer');
});
