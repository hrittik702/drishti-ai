import React from 'react';
import OnboardCentreModal from './OnboardCentreModal';

/**
 * CreateCaseModal - Legacy compatibility alias for OnboardCentreModal.
 * Directly onboards a training centre into CentreRepository.
 */
export default function CreateCaseModal(props) {
  return <OnboardCentreModal {...props} />;
}

export { OnboardCentreModal };
