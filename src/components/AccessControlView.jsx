import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  LogOut, 
  ArrowLeftRight, 
  ChevronDown,
  Check,
  Minus
} from 'lucide-react';
import { ROLES } from '../data/roles';
import { DEMO_USERS } from '../data/demoUsers';
import RoleIcon from './RoleIcon';

export default function AccessControlView({ 
  currentUser,
  currentRole, 
  setCurrentRole, 
  onSwitchUser,
  onLogout,
  onTriggerUnauthorizedAccess 
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  const rolesList = Object.values(ROLES);

  const permissionMatrix = [
    { permission: 'View FIR & Police Reports', io: true, legal: true, fsl: true, admin: true },
    { permission: 'Upload New Evidence & Reports', io: true, legal: false, fsl: true, admin: true },
    { permission: 'Cryptographic Hash Verification', io: true, legal: true, fsl: true, admin: true },
    { permission: 'View Forensic Bitstream Images', io: true, legal: false, fsl: true, admin: true },
    { permission: 'Access Top Secret Informant Registry', io: false, legal: false, fsl: false, admin: true },
    { permission: 'Redact PII for Public Court Record', io: false, legal: true, fsl: false, admin: true },
    { permission: 'Manage Access Permissions (ABAC)', io: false, legal: false, fsl: false, admin: true },
    { permission: 'Export Certified Sec 63 BSA Stamp', io: true, legal: true, fsl: true, admin: true }
  ];

  const activeUser = currentUser || DEMO_USERS[0];
  const activeRole = currentRole || activeUser.role;

  const mapRoleIdToMatrixKey = (roleId) => {
    if (roleId === 'investigation_officer' || roleId === 'police_officer') return 'io';
    if (roleId === 'legal_officer') return 'legal';
    if (roleId === 'forensic_analyst') return 'fsl';
    if (roleId === 'administrator') return 'admin';
    return 'io';
  };

  const [selectedMobileRole, setSelectedMobileRole] = useState(() => mapRoleIdToMatrixKey(activeRole?.id));

  useEffect(() => {
    setSelectedMobileRole(mapRoleIdToMatrixKey(activeRole?.id));
  }, [activeRole?.id]);

  // Click outside listener for Change Account menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [accountMenuOpen]);

  const getClearanceBadgeClass = (clearance) => {
    if (clearance === 'Top Secret') return 'bg-red-50 text-red-700 border-red-200';
    if (clearance === 'Secret') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header: Clean & Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Access Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage accounts, roles, clearance, and authorization policies.
          </p>
        </div>

        {/* Secondary Policy Verification Action */}
        <button
          onClick={onTriggerUnauthorizedAccess}
          title="Verify policy enforcement against classified resource"
          className="h-9 sm:h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <ShieldCheck className="w-4 h-4 text-slate-600" />
          <span>Verify Access Policy</span>
        </button>
      </div>

      {/* Primary Identity: Current Account Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider mb-4">
          CURRENT ACCOUNT
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Identity info */}
          <div className="flex items-start space-x-3.5 min-w-[260px]">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <RoleIcon role={activeRole} className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 leading-tight">
                  {activeUser.name}
                </h2>
                <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium border ${getClearanceBadgeClass(activeUser.clearance)}`}>
                  {activeUser.clearance}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {activeUser.designation}
              </p>
            </div>
          </div>

          {/* Compact 2-column metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs border-y lg:border-y-0 lg:border-x border-slate-100 py-3 lg:py-0 lg:px-6 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Badge:</span>
              <span className="font-mono text-slate-800 font-medium">{activeUser.badge || 'SYS-AUTH'}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400">Organization:</span>
              <span className="text-slate-700 truncate" title={activeUser.organization}>
                {activeUser.organization || 'Central Evidence Repository'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400">Email:</span>
              <span className="font-mono text-slate-700 truncate">{activeUser.email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Session:</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            </div>
          </div>

          {/* Account Actions: Change Account & Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            {/* Change Account Dropdown */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="h-9 sm:h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Account</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[11px] font-mono uppercase text-slate-400 font-medium">
                    Change Account
                  </div>
                  {DEMO_USERS.map(u => {
                    const isSelected = u.email === activeUser.email;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          if (onSwitchUser) {
                            onSwitchUser(u);
                          } else if (setCurrentRole) {
                            setCurrentRole(u.role);
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center justify-between hover:bg-slate-50 text-xs transition-colors ${
                          isSelected ? 'bg-blue-50/50 font-semibold text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{u.role.name}</div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border shrink-0 ${getClearanceBadgeClass(u.clearance)}`}>
                          {u.clearance}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sign Out Action */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign out of current active session"
                className="h-9 sm:h-8 px-3 rounded-lg border border-slate-300 hover:border-red-200 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Roles Table */}
      <div>
        <div className="mb-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
            SYSTEM ROLES
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Security profiles and access parameters defined by the authorization model.
          </p>
        </div>

        {/* Desktop System Roles Table */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Clearance</th>
                  <th className="py-2.5 px-4">Permissions</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rolesList.map(r => {
                  const isActive = activeRole.id === r.id;

                  return (
                    <tr 
                      key={r.id} 
                      className={`transition-colors ${
                        isActive ? 'bg-blue-50/40 border-l-2 border-l-blue-600' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                            <RoleIcon role={r} className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs sm:text-[13px]">
                              {r.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {r.designation}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${getClearanceBadgeClass(r.clearance)}`}>
                          {r.clearance}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {r.permissions.length} permissions
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">
                            Authorized
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile System Roles Stacked Cards */}
        <div className="md:hidden space-y-3">
          {rolesList.map(r => {
            const isActive = activeRole.id === r.id;
            return (
              <div 
                key={r.id}
                className={`bg-white border rounded-xl p-3.5 space-y-2.5 shadow-2xs transition-colors ${
                  isActive ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <RoleIcon role={r} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs sm:text-[13px]">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.designation}
                      </div>
                    </div>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-normal shrink-0">
                      Authorized
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Clearance:</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${getClearanceBadgeClass(r.clearance)}`}>
                      {r.clearance}
                    </span>
                  </div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    {r.permissions.length} permissions
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permission Matrix Table */}
      <div>
        <div className="mb-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
            PERMISSION MATRIX
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Effective permissions by role.
          </p>
        </div>

        {/* Desktop Permission Matrix Table */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-4">Permission</th>
                  <th className="py-2.5 px-3 text-center">Investigation Officer</th>
                  <th className="py-2.5 px-3 text-center">Legal Officer</th>
                  <th className="py-2.5 px-3 text-center">Forensic Analyst</th>
                  <th className="py-2.5 px-3 text-center">System Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissionMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-normal text-slate-800 text-xs sm:text-[13px]">
                      {row.permission}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.io ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-normal text-xs">
                          <Minus className="w-3.5 h-3.5 text-slate-300" />
                          <span>Denied</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.legal ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-normal text-xs">
                          <Minus className="w-3.5 h-3.5 text-slate-300" />
                          <span>Denied</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.fsl ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-normal text-xs">
                          <Minus className="w-3.5 h-3.5 text-slate-300" />
                          <span>Denied</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.admin ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-normal text-xs">
                          <Minus className="w-3.5 h-3.5 text-slate-300" />
                          <span>Denied</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Permission Matrix with Role Selector */}
        <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <label htmlFor="mobile-role-select" className="text-xs font-medium text-slate-700">
              Role:
            </label>
            <select
              id="mobile-role-select"
              value={selectedMobileRole}
              onChange={(e) => setSelectedMobileRole(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg py-1 px-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="io">Investigation Officer</option>
              <option value="legal">Legal Officer</option>
              <option value="fsl">Forensic Analyst</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>
          <div className="divide-y divide-slate-100">
            {permissionMatrix.map((row, idx) => {
              const isAllowed = row[selectedMobileRole];
              return (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-800 font-medium leading-relaxed">{row.permission}</span>
                  {isAllowed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Allowed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400 font-normal shrink-0">
                      <Minus className="w-3.5 h-3.5 text-slate-300" />
                      <span>Denied</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
