import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Download,
  FileText,
  HardDrive,
  Infinity as InfinityIcon,
  Receipt,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { PaymentDTO, StoredFileDTO } from '../types/mavi';
import {
  computeUsageSummary,
  formatFileSize,
  formatInr,
  formatStorageSafeguard,
  isSubscriptionActive,
} from '../utils/chatLogic';

interface UsageAndStorageViewProps {
  onOpenAuth: () => void;
  onGoToPricing: () => void;
}

export const UsageAndStorageView: React.FC<UsageAndStorageViewProps> = ({
  onOpenAuth,
  onGoToPricing,
}) => {
  const { firebaseUser, account, authFetch, refreshAccount } = useAuth();
  const [files, setFiles] = useState<StoredFileDTO[]>([]);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryNotes, setMemoryNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadFilesAndBilling = useCallback(async () => {
    if (!firebaseUser) return;
    const [filesRes, histRes] = await Promise.all([
      authFetch('/api/files'),
      authFetch('/api/billing/history'),
    ]);
    if (filesRes.ok) {
      const f = (await filesRes.json()) as { files?: StoredFileDTO[] };
      setFiles(f.files ?? []);
    }
    if (histRes.ok) {
      const h = (await histRes.json()) as { payments?: PaymentDTO[] };
      setPayments(h.payments ?? []);
    }
  }, [authFetch, firebaseUser]);

  useEffect(() => {
    if (account) {
      setMemoryEnabled(account.user.memoryEnabled);
      setMemoryNotes(account.user.memoryNotes || '');
    }
  }, [account]);

  useEffect(() => {
    void loadFilesAndBilling();
  }, [loadFilesAndBilling]);

  if (!firebaseUser || !account) {
    return (
      <div className="w-full max-w-[780px] mx-auto px-4 sm:px-8 py-12 text-center">
        <div className="p-8 rounded-[28px] bg-white/84 dark:bg-slate-800/70 border border-white/90 dark:border-white/10 shadow-sm">
          <HardDrive className="w-10 h-10 mx-auto text-blue-600 dark:text-sky-400" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-3">
            Workspace Storage, AI Memory & Billing
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-[460px] mx-auto">
            Sign in with your account to access persistent PDF/document storage, AI conversation memory, and your MAVI UNLIMITED billing history.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 px-6 py-2.5 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
          >
            Sign In to View Workspace
          </button>
        </div>
      </div>
    );
  }

  const safeguardMb = account.plan?.storageQuotaMb ?? 2048;
  const safeguardBytes = safeguardMb * 1024 * 1024;
  const storageUsage = computeUsageSummary(account.usage.storageUsedBytes, safeguardBytes);
  const subscribed = isSubscriptionActive(account.subscription.status);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result ?? '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const kind = file.type.startsWith('image/')
          ? 'image'
          : file.type === 'application/pdf'
            ? 'pdf'
            : 'document';
        const res = await authFetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            kind,
            dataBase64: base64,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatusMsg(data.error || 'File upload failed.');
        } else {
          setStatusMsg(`Saved "${file.name}" to persistent workspace storage.`);
          await loadFilesAndBilling();
          await refreshAccount();
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
      setStatusMsg('Could not upload file.');
    }
    e.target.value = '';
  };

  const handleDeleteFile = async (id: string) => {
    const res = await authFetch(`/api/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadFilesAndBilling();
      await refreshAccount();
    }
  };

  const handleSaveMemory = async () => {
    const res = await authFetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoryEnabled, memoryNotes }),
    });
    if (res.ok) {
      await refreshAccount();
      setStatusMsg('AI conversation memory preferences updated.');
    }
  };

  const handleCancelRenewal = async () => {
    const res = await authFetch('/api/billing/cancel', { method: 'POST' });
    if (res.ok) {
      await refreshAccount();
      setStatusMsg('Subscription cancellation scheduled for the end of your current billing period.');
    }
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-sky-400">
            {account.plan?.name || 'MAVI UNLIMITED'} ·{' '}
            {subscribed
              ? account.subscription.cancelAtPeriodEnd
                ? `Active until ${new Date(account.subscription.currentPeriodEnd).toLocaleDateString()}`
                : 'Active Subscription'
              : 'Not Subscribed'}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Workspace Storage, AI Memory & Billing
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!subscribed && (
            <button
              type="button"
              onClick={onGoToPricing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get MAVI Unlimited</span>
            </button>
          )}
          {subscribed && !account.subscription.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={handleCancelRenewal}
              className="px-3.5 py-2 rounded-full text-xs font-medium border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel Renewal
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-slate-800 border border-blue-200 dark:border-white/15 text-xs font-medium text-slate-800 dark:text-slate-100">
          {statusMsg}
        </div>
      )}

      {/* Unlimited Experience & Transparent Disk Safeguard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
        <div className="p-4 rounded-[22px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>AI Text Conversations</span>
            <InfinityIcon className="w-4 h-4 text-blue-600 dark:text-sky-400" />
          </div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            Unlimited
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {account.usage.messagesUsed.toLocaleString('en-IN')} messages this month · Local Ollama fair-use
          </p>
        </div>

        <div className="p-4 rounded-[22px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Workspace Disk Safeguard</span>
            <span className={storageUsage.exhausted ? 'text-rose-600 font-semibold' : ''}>
              {storageUsage.percent}%
            </span>
          </div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {formatFileSize(account.usage.storageUsedBytes)}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {formatStorageSafeguard(safeguardMb)} safeguard
            </span>
          </p>
          <div className="mt-2.5 h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                storageUsage.exhausted ? 'bg-rose-500' : 'bg-blue-600 dark:bg-sky-400'
              }`}
              style={{ width: `${storageUsage.percent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Max 15 MB per file · Server disk protection
          </p>
        </div>

        <div className="p-4 rounded-[22px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Included Experience</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ad-Free</span>
          </div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            All Tools Unlocked
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            English, Telugu & Tenglish · All MAVI models
          </p>
        </div>
      </div>

      {/* File Storage & AI Conversation Memory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                MAVI File Storage
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanent PDFs, images, and documents (15 MB max per upload).
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={handleUploadFile}
              />
            </label>
          </div>

          {files.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              No persistent files stored yet. Upload PDFs, images, or notes to save them here.
            </p>
          ) : (
            <div className="divide-y divide-slate-900/[0.06] dark:divide-white/10 max-h-56 overflow-y-auto mavi-scroll">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {f.fileName}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {formatFileSize(f.sizeBytes)} · {f.kind}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/api/files/${encodeURIComponent(f.id)}/download`}
                      aria-label={`Download ${f.fileName}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.id)}
                      aria-label={`Delete ${f.fileName}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Conversation Memory Settings */}
        <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                AI Conversation Memory
              </h2>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(e) => setMemoryEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Enabled</span>
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Guide how MAVI AI remembers your preferred language (English, Telugu, Tenglish), study focus, or coding stack across chats.
          </p>
          <textarea
            rows={4}
            value={memoryNotes}
            onChange={(e) => setMemoryNotes(e.target.value)}
            placeholder="e.g., I prefer answers in Tenglish or English, and work with TypeScript, React, and PostgreSQL..."
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveMemory}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
          >
            Save Memory Preferences
          </button>
        </div>
      </div>

      {/* Preserved Payment History & Invoices */}
      <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-slate-500" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Billing History & Invoices
          </h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No Razorpay transactions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-900/[0.06] dark:border-white/10 text-slate-500">
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 font-mono">{p.invoiceNumber}</td>
                    <td className="py-2 pr-4 uppercase">MAVI UNLIMITED</td>
                    <td className="py-2 pr-4 font-semibold">{formatInr(p.amountInr)}</td>
                    <td className="py-2 pr-4 capitalize">{p.status}</td>
                    <td className="py-2 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
