import React from 'react';
import CasesView from './CasesView';

/**
 * TrainingCentresView - Primary domain view for the Training Centres Directory,
 * compliance status filtering, and quick-inspection drawer.
 */
export default function TrainingCentresView(props) {
  return <CasesView {...props} />;
}

export { CasesView };
