import React from 'react';
import { 
  Shield, 
  Building2, 
  Scale, 
  Microscope, 
  ShieldCheck, 
  User 
} from 'lucide-react';

export const ROLE_ICON_MAP = {
  investigation_officer: Shield,
  police_officer: Building2,
  legal_officer: Scale,
  forensic_analyst: Microscope,
  administrator: ShieldCheck
};

export function getRoleIconComponent(roleOrId) {
  if (!roleOrId) return User;
  const roleId = typeof roleOrId === 'string' ? roleOrId : roleOrId.id;
  return ROLE_ICON_MAP[roleId] || User;
}

export default function RoleIcon({ role, className = 'w-4 h-4', ...props }) {
  const IconComponent = getRoleIconComponent(role);
  return React.createElement(IconComponent, {
    className,
    strokeWidth: 1.75,
    ...props
  });
}
