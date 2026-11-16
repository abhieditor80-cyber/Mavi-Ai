import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  HardDrive,
  LogIn,
  LogOut,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { NavTab } from '../types/mavi';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTab) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  onClose,
  onNavigateTab,
}) => {
  const {
    firebaseUser,
    account,
    authError,
    signInWithGoogle,
    logout,
    authFetch,
  } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleDeleteAccount = async () => {
    const res = await authFetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      await logout();
      setConfirmDelete(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MAVI AI Account and Authentication"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
    >
      <div className="w-full max-w-[460px] rounded-[28px] backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/15 shadow-[0_24px_64px_rgba(15,23,42,0.28)] p-6 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-900/[0.08] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-blue-600 dark:text-sky-400" />
            <h2 className="font-display text-lg font-bold">MAVI Account</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!firebaseUser ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Sign in to sync your MAVI AI conversations, manage your MAVI UNLIMITED subscription, and access persistent workspace files.
            </p>

            {authError && (
              <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-200">
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full inline-flex items-center justify-center gap-2.5 py-3 rounded-full text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Continue with Google</span>
            </button>

            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Secured with Google Sign-In. Your chats, AI memory preferences, and uploaded workspace files stay synced across sessions.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80">
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={account?.user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {(account?.user.displayName || 'M')[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {account?.user.displayName || firebaseUser.displayName || 'MAVI User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {account?.user.email || firebaseUser.email}
                </p>
                <p className="text-[11px] font-semibold text-blue-600 dark:text-sky-400 mt-0.5 uppercase">
                  {account?.subscription.status === 'active'
                    ? 'MAVI UNLIMITED · Active'
                    : 'MAVI UNLIMITED · ₹199/mo'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('pricing');
                  onClose();
                }}
                className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span>MAVI Unlimited</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('usage');
                  onClose();
                }}
                className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Storage & Memory</span>
              </button>
            </div>

            {account?.user.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('admin');
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 text-xs font-semibold cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>Open Admin Dashboard</span>
              </button>
            )}

            <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  void logout();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-600 text-white cursor-pointer"
                >
                  Confirm Permanent Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
