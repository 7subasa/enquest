import { doc, getDoc, setDoc, collection, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { db } from './firebase';

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'admin' | 'participant';
  shortCode?: string;
  createdAt: string;
}

// Event types
export interface Event {
  id: string;
  eventName: string;
  eventDate: string;
  isActive: boolean;
  createdAt: string;
}

// Event Participant types
export interface EventParticipant {
  userId: string;
  userName: string;
  answers: Record<string, string>;
  bingoBoard: string[];
  bingoCompleted: boolean[];
  createdAt: string;
}

// User operations
export const createUser = async (userId: string, userData: Omit<User, 'id'>) => {
  await setDoc(doc(db, 'users', userId), userData);
};

export const getUser = async (userId: string): Promise<User | null> => {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
};

// Event operations
export const createEvent = async (eventData: Omit<Event, 'id'>) => {
  const docRef = await addDoc(collection(db, 'events'), eventData);
  return docRef.id;
};

export const getActiveEvent = async (): Promise<Event | null> => {
  const querySnapshot = await getDocs(collection(db, 'events'));
  const activeEvent = querySnapshot.docs.find(doc => doc.data().isActive);
  return activeEvent ? { id: activeEvent.id, ...activeEvent.data() } as Event : null;
};

// Event Participant operations
export const joinEvent = async (eventId: string, userId: string, participantData: EventParticipant) => {
  await setDoc(doc(db, 'events', eventId, 'event_participants', userId), participantData);
};

export const getEventParticipant = async (eventId: string, userId: string): Promise<EventParticipant | null> => {
  const docSnap = await getDoc(doc(db, 'events', eventId, 'event_participants', userId));
  return docSnap.exists() ? docSnap.data() as EventParticipant : null;
};

export const updateBingo = async (eventId: string, userId: string, bingoCompleted: boolean[]) => {
  await updateDoc(doc(db, 'events', eventId, 'event_participants', userId), {
    bingoCompleted
  });
};

// Generate short code
export const generateShortCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Get user by short code
export const getUserByShortCode = async (shortCode: string): Promise<User | null> => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  const userDoc = querySnapshot.docs.find(doc => doc.data().shortCode === shortCode);
  return userDoc ? { id: userDoc.id, ...userDoc.data() } as User : null;
};