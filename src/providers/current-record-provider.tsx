import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Type of record currently being viewed. Drives the Copilot Studio agent's
 * record-aware grounding (see {@link CurrentRecord}).
 */
export type CurrentRecordType = 'vendor' | 'supplier' | 'contract' | 'review';

/** Scalar values are sufficient for agent grounding — keep `summary` flat. */
export type RecordSummaryValue = string | number | boolean | null;

export interface CurrentRecord {
  type: CurrentRecordType;
  /** Dataverse id of the record (or assignment id for reviews). */
  id: string;
  /** Human-readable name to surface in agent replies. */
  displayName?: string;
  /** Flat key/value bag of headline fields the agent can reference. */
  summary?: Record<string, RecordSummaryValue>;
  /** Optional hash-route path (e.g. `/vendors/abc-123`) — lets the agent deep-link. */
  routePath?: string;
}

interface CurrentRecordContextValue {
  currentRecord: CurrentRecord | null;
  /** Stable ref for non-reactive consumers (e.g. mutation callbacks). */
  currentRecordRef: { readonly current: CurrentRecord | null };
  setCurrentRecord: (record: CurrentRecord | null) => void;
}

const CurrentRecordContext = createContext<CurrentRecordContextValue | undefined>(undefined);

export function CurrentRecordProvider({ children }: { children: ReactNode }) {
  const [currentRecord, setCurrentRecordState] = useState<CurrentRecord | null>(null);
  const currentRecordRef = useRef<CurrentRecord | null>(null);

  const setCurrentRecord = useCallback((record: CurrentRecord | null) => {
    currentRecordRef.current = record;
    setCurrentRecordState(record);
  }, []);

  const value = useMemo<CurrentRecordContextValue>(
    () => ({ currentRecord, currentRecordRef, setCurrentRecord }),
    [currentRecord, setCurrentRecord],
  );

  return <CurrentRecordContext.Provider value={value}>{children}</CurrentRecordContext.Provider>;
}

export function useCurrentRecord(): CurrentRecordContextValue {
  const ctx = useContext(CurrentRecordContext);
  if (!ctx) {
    throw new Error('useCurrentRecord must be used within a CurrentRecordProvider');
  }
  return ctx;
}

/**
 * Register the current record for the lifetime of the calling component.
 *
 * - Call with a fully-populated `CurrentRecord` once the record has loaded.
 * - Call with `null` (or simply skip) while loading — context stays cleared.
 * - On unmount, the context is automatically cleared so non-record pages have
 *   `currentRecord === null`.
 *
 * @example
 * useSetCurrentRecord(
 *   vendor ? { type: 'vendor', id: vendor.id, displayName: vendor.name } : null,
 *   [vendor],
 * );
 */
export function useSetCurrentRecord(record: CurrentRecord | null): void {
  const { setCurrentRecord } = useCurrentRecord();
  // JSON-serialize for a cheap deep-equality dependency — the record objects
  // are small and produced fresh on each render of the consuming page.
  const serialized = record ? JSON.stringify(record) : null;
  useEffect(() => {
    setCurrentRecord(record);
    return () => {
      setCurrentRecord(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, setCurrentRecord]);
}
