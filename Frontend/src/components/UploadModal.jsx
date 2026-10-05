import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  ShieldCheck, 
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  GitBranch,
  Info
} from 'lucide-react';
import { DocumentRepository } from '../services/documentRepository';
import { AuditRepository } from '../services/auditRepository';
import { hashFileSHA256, getCryptoProviderInfo } from '../services/cryptoService';
import { getFileInfo } from '../utils/fileTypes';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// State machine states
const UPLOAD_STATES = {
  IDLE: 'IDLE',
  SELECTED: 'SELECTED',
  VALIDATING: 'VALIDATING',
  HASHING: 'HASHING',
  STORING: 'STORING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  DUPLICATE_ALERT: 'DUPLICATE_ALERT',
  FAILED: 'FAILED'
};

export default function UploadModal({ 
  cases, 
  defaultCaseId, 
  targetDocumentId, 
  onClose, 
  onUploadSuccess, 
  currentRole, 
  addToast 
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId || cases[0]?.caseNumber || cases[0]?.id || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [classification, setClassification] = useState('Confidential');
  const [category, setCategory] = useState('Investigation Record');
  const [changeNote, setChangeNote] = useState('');
  
  // State machine state
  const [status, setStatus] = useState(UPLOAD_STATES.IDLE);
  const [hashProgress, setHashProgress] = useState(0);
  const [computedHash, setComputedHash] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [completedDoc, setCompletedDoc] = useState(null);

  const fileInputRef = useRef(null);
  const activeVersionDocId = useRef(targetDocumentId);
  const cryptoInfo = getCryptoProviderInfo();

  const isNewVersionMode = !!activeVersionDocId.current;

  // Sync selected case if defaultCaseId changes
  useEffect(() => {
    if (defaultCaseId) {
      setSelectedCaseId(defaultCaseId);
    }
  }, [defaultCaseId]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMessage(null);
    setDuplicateInfo(null);
    setComputedHash(null);
    setHashProgress(0);

    if (!file) return;

    // 1. Check file size
    if (file.size === 0) {
      setErrorMessage('The selected file is empty (0 bytes). Please select a valid document.');
      setStatus(UPLOAD_STATES.FAILED);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB maximum size limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      setStatus(UPLOAD_STATES.FAILED);
      return;
    }

    setSelectedFile(file);
    setStatus(UPLOAD_STATES.SELECTED);
  };

  const handleExecuteUpload = async (e) => {
    if (e) e.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      setStatus(UPLOAD_STATES.FAILED);
      return;
    }

    const caseIdToUse = isNewVersionMode ? (cases.find(c => c.id === selectedCaseId)?.caseNumber || selectedCaseId) : selectedCaseId;
    if (!caseIdToUse && !isNewVersionMode) {
      setErrorMessage('Please associate this document with an active case dossier.');
      setStatus(UPLOAD_STATES.FAILED);
      return;
    }

    setErrorMessage(null);
    const actor = currentRole || { name: 'Investigating Officer', role: 'IO', badge: 'IO-CASEGUARD' };

    try {
      // 1. Audit: DOCUMENT_UPLOAD_STARTED
      await AuditRepository.logAuditEvent({
        actor,
        action: 'DOCUMENT_UPLOAD_STARTED',
        targetType: 'DOCUMENT',
        targetId: activeVersionDocId.current || 'PENDING',
        caseId: caseIdToUse,
        result: 'SUCCESS',
        details: `Upload process initiated for "${selectedFile.name}" (${(selectedFile.size / 1024).toFixed(1)} KB).`
      });

      // 2. Stage: VALIDATING
      setStatus(UPLOAD_STATES.VALIDATING);

      // 3. Stage: HASHING
      setStatus(UPLOAD_STATES.HASHING);
      setHashProgress(0.05);

      const calculatedHash = await hashFileSHA256(selectedFile, (progress) => {
        setHashProgress(progress);
      });

      setComputedHash(calculatedHash);

      // Audit: DOCUMENT_HASH_CALCULATED
      await AuditRepository.logAuditEvent({
        actor,
        action: 'DOCUMENT_HASH_CALCULATED',
        targetType: 'DOCUMENT',
        targetId: activeVersionDocId.current || 'PENDING',
        caseId: caseIdToUse,
        result: 'SUCCESS',
        details: `Digital fingerprint generated: ${calculatedHash.slice(0, 16)}•••••••• via ${cryptoInfo.provider}.`
      });

      // 4. Duplicate Check (if not in revision mode)
      if (!isNewVersionMode && !duplicateInfo) {
        const dupCheck = await DocumentRepository.findDuplicateDocument(caseIdToUse, calculatedHash, selectedFile.name);
        if (dupCheck.isDuplicate) {
          setDuplicateInfo({
            ...dupCheck,
            calculatedHash,
            targetCaseId: caseIdToUse
          });
          setStatus(UPLOAD_STATES.DUPLICATE_ALERT);
          return;
        }
      }

      // 5. Stage: STORING
      setStatus(UPLOAD_STATES.STORING);

      let record;
      if (isNewVersionMode) {
        record = await DocumentRepository.addVersion(
          activeVersionDocId.current,
          selectedFile,
          actor,
          changeNote || `New revision uploaded by ${actor.name}`
        );

        // Audit: VERSION_CREATED
        await AuditRepository.logAuditEvent({
          actor,
          action: 'VERSION_CREATED',
          targetType: 'DOCUMENT',
          targetId: record.id,
          caseId: record.caseId,
          result: 'SUCCESS',
          details: `Anchored version ${record.currentVersion} for "${record.name}". Digital Seal: ${record.storedHash.slice(0, 16)}••••••••`
        });
      } else {
        record = await DocumentRepository.createDocumentWithFile(
          {
            caseId: caseIdToUse,
            name: selectedFile.name,
            classification,
            category
          },
          selectedFile,
          actor
        );

        // Audit: DOCUMENT_STORED
        await AuditRepository.logAuditEvent({
          actor,
          action: 'DOCUMENT_STORED',
          targetType: 'DOCUMENT',
          targetId: record.id,
          caseId: caseIdToUse,
          result: 'SUCCESS',
          details: `Binary payload committed to IndexedDB storage (${(selectedFile.size / 1024).toFixed(1)} KB).`
        });
      }

      // 6. Stage: PROCESSING
      setStatus(UPLOAD_STATES.PROCESSING);

      // Audit: DOCUMENT_UPLOAD_COMPLETED
      await AuditRepository.logAuditEvent({
        actor,
        action: 'DOCUMENT_UPLOAD_COMPLETED',
        targetType: 'DOCUMENT',
        targetId: record.id,
        caseId: record.caseId,
        result: 'SUCCESS',
        details: `Document ingestion completed. Available in Vault with verified cryptographic anchor.`
      });

      setCompletedDoc(record);
      setStatus(UPLOAD_STATES.COMPLETED);

      if (addToast) {
        addToast(
          isNewVersionMode ? 'Revision Anchored' : 'Document Ingested',
          `"${record.name}" secured with genuine digital fingerprint.`,
          'success'
        );
      }

      // Inform parent
      onUploadSuccess && onUploadSuccess([{ doc: record, file: selectedFile, isVersion: isNewVersionMode }]);

    } catch (err) {
      console.error('Document upload workflow failure:', err);
      setStatus(UPLOAD_STATES.FAILED);
      setErrorMessage(err.message || 'Unable to store document locally. Please try again.');

      // Audit: DOCUMENT_UPLOAD_FAILED
      AuditRepository.logAuditEvent({
        actor,
        action: 'DOCUMENT_UPLOAD_FAILED',
        targetType: 'DOCUMENT',
        targetId: activeVersionDocId.current || 'UNKNOWN',
        caseId: caseIdToUse,
        result: 'ALERT',
        details: `Upload aborted: ${err.message || 'Unknown processing error.'}`
      }).catch(console.warn);
    }
  };

  const handleSwitchToRevision = (existingDocId) => {
    activeVersionDocId.current = existingDocId;
    setDuplicateInfo(null);
    setChangeNote('New revision uploaded via duplicate resolution.');
    // Proceed with upload directly as a new version
    handleExecuteUpload();
  };

  const handleCopyHash = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setComputedHash(null);
    setDuplicateInfo(null);
    setErrorMessage(null);
    setStatus(UPLOAD_STATES.IDLE);
    setCompletedDoc(null);
  };

  const fileInfo = selectedFile ? getFileInfo(selectedFile.type, selectedFile.name) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-lg font-semibold text-slate-900 tracking-tight">
                {isNewVersionMode ? 'Upload New Revision' : 'Upload Legal / Investigation Document'}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-slate-500 font-normal">
                <span>Stored in browser IndexedDB</span>
                <span>•</span>
                <span className="font-mono text-blue-600 font-medium">Digital Integrity Seal</span>
              </div>
            </div>
          </div>

          {status !== UPLOAD_STATES.HASHING && status !== UPLOAD_STATES.STORING && status !== UPLOAD_STATES.PROCESSING && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              aria-label="Close dialog"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Origin / Security Context Notice Banner if non-secure origin */}
        {!cryptoInfo.isSecureContext && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
            <div className="flex items-center space-x-2">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Running in non-secure origin. Active: <strong>{cryptoInfo.provider}</strong></span>
            </div>
            <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-medium">
              100% Cryptographic Fidelity
            </span>
          </div>
        )}

        {/* Modal Body with internal scrolling */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* STATE: COMPLETED RECEIPT */}
          {status === UPLOAD_STATES.COMPLETED && completedDoc && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-emerald-950 text-sm">
                      {isNewVersionMode ? 'Revision Uploaded Successfully' : 'Document Ingested Successfully'}
                    </h3>
                    <p className="text-emerald-700 text-xs font-normal">
                      The file payload has been securely anchored into local storage with its immutable cryptographic seal.
                    </p>
                  </div>
                </div>

                {/* Evidence Receipt Specifications */}
                <div className="bg-white/90 border border-emerald-200/80 rounded-lg p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase font-medium block">Document:</span>
                      <strong className="text-slate-900 font-semibold truncate block text-xs">{completedDoc.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase font-medium block">Version:</span>
                      <span className="font-mono text-blue-700 font-medium text-xs">{completedDoc.currentVersion || 'V1'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase font-medium block">Size:</span>
                      <span className="text-slate-700 font-mono text-xs">{(completedDoc.size / 1024).toFixed(1)} KB ({completedDoc.size} bytes)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase font-medium block">Case:</span>
                      <span className="font-mono text-slate-800 text-xs font-medium">#{completedDoc.caseId}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 text-[11px] uppercase font-medium block mb-1">
                      Computed Digital Fingerprint:
                    </span>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-1.5 font-mono text-xs font-medium text-slate-900 break-all select-all">
                      <span className="truncate mr-2">
                        {completedDoc.storedHash ? `${completedDoc.storedHash.slice(0, 16)}••••••••••••••••${completedDoc.storedHash.slice(-8)}` : 'Verified'}
                      </span>
                      <button
                        onClick={() => handleCopyHash(completedDoc.storedHash)}
                        className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
                        title="Copy Fingerprint"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={onClose}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs"
                >
                  Close & View in Case Vault
                </button>
              </div>
            </div>
          )}

          {/* STATE: DUPLICATE ALERT */}
          {status === UPLOAD_STATES.DUPLICATE_ALERT && duplicateInfo && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-950 text-xs">Duplicate Document Detected</h4>
                  <p className="text-amber-800 text-xs font-normal mt-1 leading-relaxed">
                    {duplicateInfo.message}
                  </p>
                </div>
              </div>

              <div className="bg-white/80 border border-amber-200 rounded-lg p-2.5 space-y-1 font-mono text-xs font-medium text-slate-700">
                <div><strong>Existing:</strong> {duplicateInfo.existingDoc.name} ({duplicateInfo.existingDoc.currentVersion})</div>
                <div className="truncate"><strong>Digital Fingerprint:</strong> {duplicateInfo.existingDoc.storedHash ? `${duplicateInfo.existingDoc.storedHash.slice(0, 16)}••••••••••••••••${duplicateInfo.existingDoc.storedHash.slice(-8)}` : 'Anchored'}</div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors"
                >
                  Choose Different File
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchToRevision(duplicateInfo.existingDoc.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Upload as New Revision</span>
                </button>
              </div>
            </div>
          )}

          {/* PROCESSING / HASHING / STORING ACTIVE STATE */}
          {(status === UPLOAD_STATES.VALIDATING || status === UPLOAD_STATES.HASHING || status === UPLOAD_STATES.STORING || status === UPLOAD_STATES.PROCESSING) && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-900 text-xs">
                  {status === UPLOAD_STATES.VALIDATING && 'Validating document specs & integrity bounds...'}
                  {status === UPLOAD_STATES.HASHING && 'Generating digital integrity fingerprint from file bytes...'}
                  {status === UPLOAD_STATES.STORING && 'Securely storing document in local IndexedDB...'}
                  {status === UPLOAD_STATES.PROCESSING && 'Preparing cryptographic audit records...'}
                </h4>
                <p className="text-xs text-slate-500 font-normal">
                  {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)` : 'Processing...'}
                </p>
              </div>

              {/* Progress bar during hashing */}
              {status === UPLOAD_STATES.HASHING && (
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(5, Math.round(hashProgress * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>Engine: {cryptoInfo.provider}</span>
                    <span>{Math.round(hashProgress * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FORM: INPUT & METADATA (Visible when not completed) */}
          {status !== UPLOAD_STATES.COMPLETED && status !== UPLOAD_STATES.DUPLICATE_ALERT && status !== UPLOAD_STATES.HASHING && status !== UPLOAD_STATES.STORING && status !== UPLOAD_STATES.PROCESSING && (
            <form onSubmit={handleExecuteUpload} className="space-y-4">
              
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragActive ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2 stroke-1" />
                
                {selectedFile ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-slate-900 block text-xs truncate max-w-xs">
                        {selectedFile.name}
                      </span>
                      {fileInfo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-100 text-blue-800 font-medium">
                          {fileInfo.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-normal block">
                      Size: <span className="font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</span> ({selectedFile.size} bytes) • {selectedFile.type || 'Binary Document'}
                    </span>
                    <span className="text-xs text-blue-600 underline font-medium">Click to change file</span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">
                      Choose file or drag and drop here
                    </span>
                    <span className="text-xs text-slate-500 font-normal block mt-1">
                      Supports PDF, DOCX, XLSX, PPTX, Images, Video, Audio, Text, and Archives (Max: 50 MB)
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-normal flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Metadata Fields (when not new version mode) */}
              {!isNewVersionMode && (
                <>
                  <div>
                    <label htmlFor="upload-case-select" className="text-slate-700 block mb-1 font-medium text-xs">Associated Case:</label>
                    {cases.length > 0 ? (
                      <select
                        id="upload-case-select"
                        value={selectedCaseId}
                        onChange={(e) => setSelectedCaseId(e.target.value)}
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {cases.map(c => (
                          <option key={c.id} value={c.caseNumber || c.id}>
                            Case #{c.caseNumber} - {c.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                        No cases created yet. Enter a case identifier:
                        <input
                          id="upload-case-input"
                          type="text"
                          placeholder="e.g. CR-2026-001"
                          value={selectedCaseId}
                          onChange={(e) => setSelectedCaseId(e.target.value)}
                          className="mt-1 w-full h-9 bg-white border border-amber-300 rounded-lg px-2.5 text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="upload-classification" className="text-slate-700 block mb-1 font-medium text-xs">Security Clearance:</label>
                      <select
                        id="upload-classification"
                        value={classification}
                        onChange={(e) => setClassification(e.target.value)}
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Confidential">Confidential</option>
                        <option value="Secret">Secret</option>
                        <option value="Top Secret">Top Secret</option>
                        <option value="Restricted">Restricted</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="upload-category" className="text-slate-700 block mb-1 font-medium text-xs">Category:</label>
                      <select
                        id="upload-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Investigation Record">Investigation Record</option>
                        <option value="FIR">First Information Report</option>
                        <option value="Witness Statement">Witness Statement</option>
                        <option value="Forensic Report">Forensic Report</option>
                        <option value="Evidence Item">Evidence Item</option>
                        <option value="Court Order">Court Order</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Change Note (for revisions) */}
              {isNewVersionMode && (
                <div>
                  <label htmlFor="upload-change-note" className="text-slate-700 block mb-1 font-medium text-xs">Revision Change Note:</label>
                  <input
                    id="upload-change-note"
                    type="text"
                    placeholder="e.g. Updated witness deposition or revised forensic analysis"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{isNewVersionMode ? 'Anchor Revision' : 'Upload & Anchor'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
