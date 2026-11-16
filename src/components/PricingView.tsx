import React, { useState } from 'react';
import {
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatInr, formatStorageSafeguard, isSubscriptionActive } from '../utils/chatLogic';

interface PricingViewProps {
  onOpenAuth: () => void;
}

const CAPABILITY_BREAKDOWN: Array<{
  area: string;
  included: string;
  availabilityNote: string;
}> = [
  {
    area: 'AI Text Conversations & Models',
    included: 'Unlimited text conversations with MAVI Assistant v1.0, DeepThink, and Swift',
    availabilityNote: 'Runs on connected local Ollama AI; subject to server availability & fair-use rate protection.',
  },
  {
    area: 'Research, Study & Writing',
    included: 'Deep Research, Study Guides, Flashcards, Quizzes & Writing Assistant',
    availabilityNote: 'Full access included without monthly message or credit counters.',
  },
  {
    area: 'Coding, Diagrams & Data Analysis',
    included: 'MAVI Code, Mermaid/SVG diagram generation & INR finance/data tables',
    availabilityNote: 'All coding, diagramming, and analytical workflows unlocked.',
  },
  {
    area: 'Image Studio & Voice Chat',
    included: 'SVG vector visual generation & browser voice dictation',
    availabilityNote: 'Vector studio runs via connected AI model; voice input uses supported browser speech APIs.',
  },
  {
    area: 'PDF, Documents & Workspaces',
    included: 'PDF/document analysis, Projects, Conversation History & AI Memory',
    availabilityNote: 'Persistent server file vault enforces transparent per-file (15 MB) and disk safeguards.',
  },
  {
    area: 'Web Search',
    included: 'Grounded web answers when an online search provider is enabled',
    availabilityNote: 'Offline local Ollama mode responds from local model knowledge without external web calls.',
  },
  {
    area: 'Languages & Visual Craft',
    included: 'English, Telugu (తెలుగు) & Tenglish, Light/Dark Liquid Glass & Custom Wallpapers',
    availabilityNote: 'Zero advertisements across the entire MAVI AI workspace.',
  },
];

export const PricingView: React.FC<PricingViewProps> = ({ onOpenAuth }) => {
  const { plans, account, firebaseUser, authFetch, refreshAccount, refreshPlansAndAds } =
    useAuth();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(
    null,
  );

  const plan = plans[0] ?? {
    id: 'unlimited' as const,
    name: 'MAVI UNLIMITED',
    tagline: 'One Plan. All Features. Unlimited Possibilities.',
    priceInr: 199,
    storageQuotaMb: 2048,
    adsEnabled: false,
    allowedModelTier: 'pro' as const,
    priorityProcessing: true,
    isHighlighted: true,
    description:
      'Everything you need in one affordable AI subscription. No confusing tiers, no separate feature packages.',
    featuresJson: [
      'Unlimited AI text conversations & messages',
      'Access to available advanced AI models',
      'AI image & vector visual generation',
      'Voice chat dictation & audio input',
      'AI Deep Research & synthesis',
      'Web search grounding (when provider supports it)',
      'PDF and document analysis',
      'AI coding assistant',
      'AI study assistant (guides, flashcards, quizzes)',
      'AI diagram generation',
      'AI writing assistant',
      'Data analysis tools',
      'Projects and workspaces',
      'Conversation history & persistent sync',
      'AI memory across sessions',
      'File uploads & persistent storage',
      'English, Telugu and Tenglish support',
      'Light Liquid Glass & Dark Liquid Glass themes',
      'Custom wallpapers',
      'No advertisements',
    ],
    featureFlagsJson: undefined,
  };

  const isSubscribed = Boolean(
    account && isSubscriptionActive(account.subscription.status),
  );
  const cancelScheduled = Boolean(account?.subscription.cancelAtPeriodEnd);
  const safeguardLabel = formatStorageSafeguard(plan.storageQuotaMb || 2048);

  const handleSubscribe = async () => {
    setNotice(null);
    if (!firebaseUser) {
      onOpenAuth();
      return;
    }

    setBusy(true);
    try {
      const res = await authFetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'unlimited' }),
      });
      const data = await res.json();

      if (!res.ok || !data.configured) {
        setNotice({
          type: 'info',
          text:
            data.message ||
            'Online payment checkout is not enabled on this server yet.',
        });
        return;
      }

      const rzpCtor = (window as unknown as { Razorpay?: new (opts: unknown) => { open: () => void } })
        .Razorpay;
      if (!rzpCtor) {
        setNotice({
          type: 'info',
          text: `Razorpay order ${data.orderId} initialized (${formatInr(data.plan.priceInr)}/mo). Load Razorpay checkout.js in production to complete signature-verified payment.`,
        });
        return;
      }

      const rzp = new rzpCtor({
        key: data.keyId,
        amount: data.amountPaise,
        currency: data.currency,
        name: 'MAVI AI',
        description: `${data.plan.name} Monthly Subscription`,
        order_id: data.orderId,
        prefill: {
          email: account?.user.email || firebaseUser.email || '',
          name: account?.user.displayName || '',
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await authFetch('/api/billing/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok) {
            setNotice({ type: 'error', text: verifyJson.error || 'Verification failed.' });
            return;
          }
          await refreshAccount();
          await refreshPlansAndAds();
          setNotice({
            type: 'success',
            text: `Payment verified! ${data.plan.name} is now active (Invoice ${verifyJson.invoiceNumber}).`,
          });
        },
      });
      rzp.open();
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to start Razorpay checkout.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelRenewal = async () => {
    setNotice(null);
    setCancelling(true);
    try {
      const res = await authFetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed.');
      await refreshAccount();
      setNotice({
        type: 'success',
        text: 'Auto-renewal cancellation scheduled for the end of your current billing period.',
      });
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to cancel renewal.',
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 sm:px-8 py-5 sm:py-6 space-y-7">
      {/* Header */}
      <div className="text-center max-w-[660px] mx-auto space-y-1.5">
        <p className="text-xs font-semibold text-blue-600 dark:text-sky-400">
          MAVI AI · Simple Monthly Subscription (INR)
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
          {plan.tagline || 'One Plan. All Features. Unlimited Possibilities.'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {plan.description}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs sm:text-[13px] font-medium flex items-start gap-2.5 ${
            notice.type === 'error'
              ? 'bg-rose-50/90 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200'
              : notice.type === 'success'
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-200'
                : 'bg-blue-50/85 border-blue-200 text-slate-800 dark:bg-slate-800/80 dark:border-white/15 dark:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-sky-400" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* Single Premium Liquid Glass Subscription Card */}
      <section
        aria-label="MAVI UNLIMITED subscription card"
        className="max-w-[820px] mx-auto rounded-[28px] p-5 sm:p-7 backdrop-blur-2xl bg-white/92 dark:bg-slate-800/85 border border-blue-500/30 dark:border-sky-400/30 shadow-[0_22px_60px_rgba(37,99,235,0.12)] dark:shadow-[0_22px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-900/[0.07] dark:border-white/10">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-sky-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>One subscription. Everything included.</span>
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
              {plan.name}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-[420px]">
              No confusing tiers · No advertisements · All AI models & workspace tools unlocked
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2.5 shrink-0 tabular-nums">
            <div className="flex sm:justify-end items-baseline gap-1.5">
              <span className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                {formatInr(plan.priceInr)}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                / month
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isSubscribed && !cancelScheduled && (
                <button
                  type="button"
                  onClick={handleCancelRenewal}
                  disabled={cancelling}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                >
                  {cancelling ? 'Scheduling...' : 'Cancel Renewal'}
                </button>
              )}
              <button
                type="button"
                disabled={busy || isSubscribed}
                onClick={handleSubscribe}
                className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer disabled:cursor-default ${
                  isSubscribed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:-translate-y-0.5 dark:bg-sky-400 dark:hover:bg-sky-300 dark:text-slate-950'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isSubscribed
                    ? 'MAVI Unlimited Active'
                    : busy
                      ? 'Connecting Razorpay...'
                      : 'Get MAVI Unlimited'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* All Included Features */}
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Everything Included in {plan.name}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {isSubscribed
                ? cancelScheduled
                  ? `Active until ${new Date(account!.subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews ${new Date(account!.subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Includes ${safeguardLabel} workspace disk safeguard`}
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {plan.featuresJson.map((feat) => (
              <li
                key={feat}
                className="flex items-start gap-2 text-[12.5px] sm:text-[13px] text-slate-700 dark:text-slate-200"
              >
                <Check className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Single-Plan Feature & Infrastructure Transparency Matrix */}
      <section className="rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-900/[0.06] dark:border-white/10">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Included Capabilities & Honest Infrastructure Safeguards
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-900/[0.06] dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-3 px-5 font-semibold">Workspace Area</th>
                <th className="py-3 px-4 font-semibold">Included in MAVI UNLIMITED</th>
                <th className="py-3 px-5 font-semibold">Infrastructure & Fair-Use Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/[0.05] dark:divide-white/[0.06] text-slate-700 dark:text-slate-200">
              {CAPABILITY_BREAKDOWN.map((row) => (
                <tr key={row.area} className="hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-3 px-5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.area}
                  </td>
                  <td className="py-3 px-4">{row.included}</td>
                  <td className="py-3 px-5 text-xs text-slate-500 dark:text-slate-400">
                    {row.availabilityNote}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
