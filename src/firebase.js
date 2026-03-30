import { initializeApp } from 'firebase/app'
import { initializeFirestore, memoryLocalCache, collection, addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA48d0Nz7tRHADnH3fMtzSG7i2ZL2vF-yo",
  authDomain: "website-reviews-16f40.firebaseapp.com",
  projectId: "website-reviews-16f40",
  storageBucket: "website-reviews-16f40.firebasestorage.app",
  messagingSenderId: "1059724893621",
  appId: "1:1059724893621:web:f9897231f49b9917430dfc"
}

const app = initializeApp(firebaseConfig)
// Use memory-only cache — no IndexedDB persistence (prevents addDoc from hanging)
const db = initializeFirestore(app, { localCache: memoryLocalCache() })

// Helper: race a promise against a timeout
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
  ])
}

// Submit a new review
export async function submitReview({ name, practice, location, review, stars }) {
  try {
    await withTimeout(
      addDoc(collection(db, 'reviews'), {
        name,
        practice,
        location,
        review,
        stars,
        createdAt: serverTimestamp()
      }),
      10000
    )
    return { success: true }
  } catch (error) {
    console.error('Error submitting review:', error)
    return { success: false, error }
  }
}

// Load all reviews
export async function loadReviews() {
  try {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))
    const snapshot = await withTimeout(getDocs(q), 10000)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error loading reviews:', error)
    return []
  }
}
