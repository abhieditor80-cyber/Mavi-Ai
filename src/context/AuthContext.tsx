import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type {
  AccountSnapshotDTO,
  AdvertisementDTO,
  SubscriptionPlanDTO,
} from '../types/mavi';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  account: AccountSnapshotDTO | null;
  plans: SubscriptionPlanDTO[];
  ads: AdvertisementDTO[];
  adsEnabled: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  refreshPlansAndAds: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [account, setAccount] = useState<AccountSnapshotDTO | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDTO[]>([]);
  const [ads, setAds] = useState<AdvertisementDTO[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      let activeToken = idToken;
      if (auth.currentUser) {
        try {
          activeToken = await auth.currentUser.getIdToken();
        } catch {
          // Keep last in-memory token if refresh fails
        }
      }
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      return fetch(input, { ...init, headers });
    },
    [idToken],
  );

  const refreshPlansAndAds = useCallback(async () => {
    try {
      const [plansRes, adsRes] = await Promise.all([
        fetch('/api/plans'),
        authFetch('/api/ads'),
      ]);
      if (plansRes.ok) {
        const pData = (await plansRes.json()) as { plans?: SubscriptionPlanDTO[] };
        if (Array.isArray(pData.plans)) setPlans(pData.plans);
      }
      if (adsRes.ok) {
        const aData = (await adsRes.json()) as {
          adsEnabled?: boolean;
          ads?: AdvertisementDTO[];
        };
        setAdsEnabled(Boolean(aData.adsEnabled));
        setAds(Array.isArray(aData.ads) ? aData.ads : []);
      }
    } catch {
      // Non-blocking fallback
    }
  }, [authFetch]);

  const refreshAccount = useCallback(async () => {
    if (!auth.currentUser) {
      setAccount(null);
      return;
    }
    try {
      const res = await authFetch('/api/account');
      if (res.ok) {
        const data = (await res.json()) as AccountSnapshotDTO;
        setAccount(data);
      }
    } catch {
      // Keep previous account snapshot
    }
  }, [authFetch]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
        setAccount(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    void refreshPlansAndAds();
    if (firebaseUser && idToken) {
      void refreshAccount();
    }
  }, [firebaseUser, idToken, refreshAccount, refreshPlansAndAds]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setIdToken(null);
    setAccount(null);
    void refreshPlansAndAds();
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authLoading,
        account,
        plans,
        ads,
        adsEnabled,
        authError,
        signInWithGoogle,
        logout,
        refreshAccount,
        refreshPlansAndAds,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
