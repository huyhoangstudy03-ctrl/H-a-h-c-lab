import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

export interface ReactionHistoryEntry {
  id: string;
  reactionId: string;
  reactantAName: string;
  reactantAFormula: string;
  reactantAMassG: number;
  reactantBName: string;
  reactantBFormula: string;
  reactantBMassG: number;
  balancedEquation: string;
  didReact: boolean;
  colorChangeSummary: string;
  stateChangeSummary: string;
  totalMassBeforeG: number;
  totalMassAfterG: number;
  notes?: string;
  createdAtIso: string;
  syncedToCloud?: boolean;
}

export interface BalancingProgressEntry {
  equationId: string;
  solved: boolean;
  attempts: number;
  updatedAtIso: string;
}

const LOCAL_HISTORY_KEY = 'hoahoc_kntt_reaction_history_v1';
const LOCAL_BALANCING_KEY = 'hoahoc_kntt_balancing_progress_v1';

export function loadLocalReactionHistory(): ReactionHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalReactionHistory(entries: ReactionHistoryEntry[]): void {
  try {
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries.slice(0, 100)));
  } catch {
    // ignore quota errors
  }
}

export async function persistReactionRecord(
  entry: Omit<ReactionHistoryEntry, 'id' | 'createdAtIso' | 'syncedToCloud'>,
): Promise<ReactionHistoryEntry> {
  const safeId = `rxn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  const localItem: ReactionHistoryEntry = {
    ...entry,
    id: safeId,
    createdAtIso: nowIso,
    syncedToCloud: false,
  };

  const currentLocal = loadLocalReactionHistory();
  saveLocalReactionHistory([localItem, ...currentLocal]);

  const user = auth.currentUser;
  if (user && user.emailVerified) {
    const path = `users/${user.uid}/reactions`;
    try {
      await setDoc(doc(db, path, safeId), {
        ownerId: user.uid,
        reactionId: entry.reactionId.slice(0, 120),
        reactantAName: entry.reactantAName.slice(0, 160),
        reactantAFormula: entry.reactantAFormula.slice(0, 80),
        reactantAMassG: Number(entry.reactantAMassG),
        reactantBName: entry.reactantBName.slice(0, 160),
        reactantBFormula: entry.reactantBFormula.slice(0, 80),
        reactantBMassG: Number(entry.reactantBMassG),
        balancedEquation: entry.balancedEquation.slice(0, 400),
        didReact: Boolean(entry.didReact),
        colorChangeSummary: entry.colorChangeSummary.slice(0, 400),
        stateChangeSummary: entry.stateChangeSummary.slice(0, 400),
        totalMassBeforeG: Number(entry.totalMassBeforeG),
        totalMassAfterG: Number(entry.totalMassAfterG),
        ...(entry.notes ? { notes: entry.notes.slice(0, 600) } : {}),
        createdAt: serverTimestamp(),
      });
      localItem.syncedToCloud = true;
      const updated = loadLocalReactionHistory().map((item) =>
        item.id === safeId ? { ...item, syncedToCloud: true } : item,
      );
      saveLocalReactionHistory(updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${path}/${safeId}`);
    }
  }

  return localItem;
}

export async function fetchReactionHistory(): Promise<ReactionHistoryEntry[]> {
  const local = loadLocalReactionHistory();
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return local;
  }

  const path = `users/${user.uid}/reactions`;
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const cloudEntries: ReactionHistoryEntry[] = snap.docs.map((d) => {
      const data = d.data();
      const ts = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      return {
        id: d.id,
        reactionId: String(data.reactionId ?? ''),
        reactantAName: String(data.reactantAName ?? ''),
        reactantAFormula: String(data.reactantAFormula ?? ''),
        reactantAMassG: Number(data.reactantAMassG ?? 0),
        reactantBName: String(data.reactantBName ?? ''),
        reactantBFormula: String(data.reactantBFormula ?? ''),
        reactantBMassG: Number(data.reactantBMassG ?? 0),
        balancedEquation: String(data.balancedEquation ?? ''),
        didReact: Boolean(data.didReact),
        colorChangeSummary: String(data.colorChangeSummary ?? ''),
        stateChangeSummary: String(data.stateChangeSummary ?? ''),
        totalMassBeforeG: Number(data.totalMassBeforeG ?? 0),
        totalMassAfterG: Number(data.totalMassAfterG ?? 0),
        notes: data.notes ? String(data.notes) : undefined,
        createdAtIso: ts,
        syncedToCloud: true,
      };
    });

    // Merge unique IDs (cloud first)
    const cloudIds = new Set(cloudEntries.map((c) => c.id));
    const merged = [...cloudEntries, ...local.filter((l) => !cloudIds.has(l.id))];
    saveLocalReactionHistory(merged);
    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteReactionRecord(id: string): Promise<void> {
  const nextLocal = loadLocalReactionHistory().filter((item) => item.id !== id);
  saveLocalReactionHistory(nextLocal);

  const user = auth.currentUser;
  if (user && user.emailVerified && /^[a-zA-Z0-9_-]+$/.test(id)) {
    const path = `users/${user.uid}/reactions/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export function loadLocalBalancingProgress(): Record<string, BalancingProgressEntry> {
  try {
    const raw = window.localStorage.getItem(LOCAL_BALANCING_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BalancingProgressEntry>;
  } catch {
    return {};
  }
}

export async function saveBalancingProgress(
  equationId: string,
  solved: boolean,
): Promise<Record<string, BalancingProgressEntry>> {
  const current = loadLocalBalancingProgress();
  const prev = current[equationId];
  const attempts = (prev?.attempts ?? 0) + 1;
  const entry: BalancingProgressEntry = {
    equationId,
    solved: solved || Boolean(prev?.solved),
    attempts,
    updatedAtIso: new Date().toISOString(),
  };
  const updated = { ...current, [equationId]: entry };
  try {
    window.localStorage.setItem(LOCAL_BALANCING_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  const user = auth.currentUser;
  if (user && user.emailVerified && /^[a-zA-Z0-9_-]+$/.test(equationId)) {
    const path = `users/${user.uid}/balancingProgress/${equationId}`;
    try {
      await setDoc(doc(db, path), {
        ownerId: user.uid,
        equationId,
        solved: entry.solved,
        attempts: entry.attempts,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  return updated;
}

export async function fetchBalancingProgress(): Promise<Record<string, BalancingProgressEntry>> {
  const local = loadLocalBalancingProgress();
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return local;

  const path = `users/${user.uid}/balancingProgress`;
  try {
    const snap = await getDocs(collection(db, path));
    const merged = { ...local };
    snap.docs.forEach((d) => {
      const data = d.data();
      merged[d.id] = {
        equationId: String(data.equationId ?? d.id),
        solved: Boolean(data.solved),
        attempts: Number(data.attempts ?? 1),
        updatedAtIso: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
    });
    window.localStorage.setItem(LOCAL_BALANCING_KEY, JSON.stringify(merged));
    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
