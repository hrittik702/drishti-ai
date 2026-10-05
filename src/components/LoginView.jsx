import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  ShieldAlert, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { DEMO_USERS, authenticateDemoUser } from '../data/demoUsers';
import CaseGuardLogo from './CaseGuardLogo';
import RoleIcon from './RoleIcon';

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide account credentials and security passkey.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const result = authenticateDemoUser(email, password);
      setIsSubmitting(false);

      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || 'Authentication rejected. Verify credentials.');
      }
    }, 200);
  };

  const handleSelectAccount = (user) => {
    setSelectedAccountId(user.id);
    setEmail(user.email);
    setPassword(user.password);
    setError('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(user);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased">
      
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/95 px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <CaseGuardLogo size="md" />

          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-mono text-slate-700">Edge-AI Monitoring Online</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            
            {/* Primary Login Form */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                    Sign In
                  </h1>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-normal">
                    Secure access to training-centre monitoring, compliance events and AI verification. Authentication determines the user's role and access clearance.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Authentication Failed</span>
                      <span className="font-normal">{error}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Account Email / Officer ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="investigator@caseguard.gov"
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Password / Passkey
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-2xs disabled:opacity-50"
                    >
                      <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-normal">
                <span>Edge-AI Telemetry</span>
                <span>•</span>
                <span>Real-time Compliance Verification</span>
                <span>•</span>
                <span>Role-based Access</span>
              </div>
            </div>

            {/* Compact Available Accounts Column */}
            <div className="lg:col-span-5 p-6 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
                    Available Accounts
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select an institutional account to sign in:
                  </p>
                </div>

                <div className="space-y-2">
                  {DEMO_USERS.map((u) => {
                    const isSelected = selectedAccountId === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelectAccount(u)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                              <RoleIcon role={u.role} className="w-3.5 h-3.5 text-slate-700" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {u.name}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate font-normal">
                                {u.designation || u.role.name}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium uppercase border ${
                              u.clearance === 'Top Secret' ? 'bg-red-50 text-red-700 border-red-200' :
                              u.clearance === 'Secret' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {u.clearance}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">Access Policy: </span>
                Clearance determines assigned training centres and compliance verification actions.
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Subtle Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-400 font-normal">
        <p>COMPLIANCEGUARD — Edge-AI Training Centre Compliance Monitoring System</p>
      </footer>
    </div>
  );
}
