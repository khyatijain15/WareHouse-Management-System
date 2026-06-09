import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, DocumentData, Query, QuerySnapshot, DocumentReference } from 'firebase/firestore';
import { db } from './firebase';
import { useEffect, useState } from 'react';

// Types
export interface Commodity {
  id: string;
  date: string;
  commodity: string;
  variety: string;
  quantity: number;
  aum: number;
  createdBy: string;
  updatedAt: string;
}

export interface AUM {
  id: string;
  date: string;
  state: string;
  commodity: string;
  quantity: number;
  aum: number;
  createdBy: string;
  updatedAt: string;
}

// Collection References
export const commoditiesRef = collection(db, 'commodities');
export const aumRef = collection(db, 'aum');

// Hooks
export function useCollection<T>(
  queryOrRef: Query<DocumentData> | null,
  transform: (doc: DocumentData) => T
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryOrRef) {
      setData([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      queryOrRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          const items = snapshot.docs.map((doc) => transform({ id: doc.id, ...doc.data() }));
          setData(items);
          setLoading(false);
        } catch (err) {
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryOrRef]);

  return { data, loading, error };
}

// Custom hooks for commodities and AUM
export function useCommodities(dateRange?: { from: Date; to: Date }) {
  const [queryRef, setQueryRef] = useState<Query<DocumentData> | null>(() => {
    if (!dateRange) return commoditiesRef;
    return query(
      commoditiesRef,
      where('date', '>=', dateRange.from.toISOString()),
      where('date', '<=', dateRange.to.toISOString())
    );
  });

  useEffect(() => {
    if (!dateRange) {
      setQueryRef(commoditiesRef);
      return;
    }
    setQueryRef(
      query(
        commoditiesRef,
        where('date', '>=', dateRange.from.toISOString()),
        where('date', '<=', dateRange.to.toISOString())
      )
    );
  }, [dateRange]);

  return useCollection<Commodity>(queryRef, (doc) => doc as Commodity);
}

export function useAUM(dateRange?: { from: Date; to: Date }) {
  const [queryRef, setQueryRef] = useState<Query<DocumentData> | null>(() => {
    if (!dateRange) return aumRef;
    return query(
      aumRef,
      where('date', '>=', dateRange.from.toISOString()),
      where('date', '<=', dateRange.to.toISOString())
    );
  });

  useEffect(() => {
    if (!dateRange) {
      setQueryRef(aumRef);
      return;
    }
    setQueryRef(
      query(
        aumRef,
        where('date', '>=', dateRange.from.toISOString()),
        where('date', '<=', dateRange.to.toISOString())
      )
    );
  }, [dateRange]);

  return useCollection<AUM>(queryRef, (doc) => doc as AUM);
}

// CRUD operations
export async function addCommodity(data: Omit<Commodity, 'id'>) {
  return addDoc(commoditiesRef, data);
}

export async function updateCommodity(id: string, data: Partial<Commodity>) {
  const docRef = doc(db, 'commodities', id);
  return updateDoc(docRef, data);
}

export async function deleteCommodity(id: string) {
  const docRef = doc(db, 'commodities', id);
  return deleteDoc(docRef);
}

export async function addAUM(data: Omit<AUM, 'id'>) {
  return addDoc(aumRef, data);
}

export async function updateAUM(id: string, data: Partial<AUM>) {
  const docRef = doc(db, 'aum', id);
  return updateDoc(docRef, data);
}

export async function deleteAUM(id: string) {
  const docRef = doc(db, 'aum', id);
  return deleteDoc(docRef);
}
