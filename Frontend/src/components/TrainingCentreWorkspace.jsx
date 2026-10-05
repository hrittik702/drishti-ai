import React from 'react';
import CaseWorkspace from './CaseWorkspace';

/**
 * TrainingCentreWorkspace - Primary domain workspace for training centre compliance,
 * attendance discrepancy analysis, infrastructure checklist, and CCTV telemetry.
 */
export default function TrainingCentreWorkspace(props) {
  return <CaseWorkspace {...props} />;
}

export { CaseWorkspace };
