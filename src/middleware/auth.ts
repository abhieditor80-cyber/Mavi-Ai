import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/repository.ts';

export interface AuthUserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  memoryEnabled: boolean;
  memoryNotes: string;
}

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: AuthUserRecord;
}

async function resolveUserFromHeader(req: AuthRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return false;

  const decodedToken = await adminAuth.verifyIdToken(token);
  req.firebaseUser = decodedToken;

  const email = decodedToken.email || `${decodedToken.uid}@mavi.local`;
  const name = decodedToken.name || email.split('@')[0] || 'MAVI Member';
  const picture = decodedToken.picture || null;

  req.dbUser = await getOrCreateUser({
    uid: decodedToken.uid,
    email,
    displayName: name,
    avatarUrl: picture,
  });

  return true;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ok = await resolveUserFromHeader(req);
    if (!ok || !req.dbUser) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    await resolveUserFromHeader(req);
  } catch {
    // Allow anonymous fallback on public/guest-compatible endpoints
  }
  next();
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ok = await resolveUserFromHeader(req);
    if (!ok || !req.dbUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (req.dbUser.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Administrator role required.' });
      return;
    }
    next();
  } catch (error) {
    console.error('Admin verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};
