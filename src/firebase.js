import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBjrawfRiGoyYpCbCmhaFnZqFJlDBH2Huo",
  authDomain: "website-reviews-4e498.firebaseapp.com",
  projectId: "website-reviews-4e498",
  storageBucket: "website-reviews-4e498.firebasestorage.app",
  messagingSenderId: "754891650",
  appId: "1:754891650:web:fc0d3c7870d72ae7e1f1a4"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Submit a new review
export async function submitReview({ name, practice, location, review, stars }) {
  try {
    await addDoc(collection(db, 'reviews'), {
      name,
      practice,
      location,
      review,
      stars,
      createdAt: serverTimestamp()
    })
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
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error loading reviews:', error)
    return []
  }
}
