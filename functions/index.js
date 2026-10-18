const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

/**
 * Records an account-deletion request for authorized review.
 * This intentionally does NOT delete Firebase Auth or Firestore data.
 * An admin must review retention obligations and resolve any dispute first.
 */
exports.requestAccountDeletion = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to request account deletion.');
  }

  const uid = request.auth.uid;
  const authTime = Number(request.auth.token.auth_time || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || nowSeconds - authTime > 5 * 60 || authTime > nowSeconds + 60) {
    throw new HttpsError('failed-precondition', 'Recent sign-in required. Sign in again and retry.');
  }

  const requestRef = db.collection('accountDeletionRequests').doc(uid);
  const existingSnap = await requestRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    if (['requested', 'needs_review', 'processing'].includes(existing.status)) {
      return { status: existing.status, alreadyRequested: true };
    }
  }

  // Current schema: submissions use ownerId/applicantId and status='disputed'.
  const [ownedDisputes, applicantDisputes] = await Promise.all([
    db.collection('submissions').where('ownerId', '==', uid).where('status', '==', 'disputed').get(),
    db.collection('submissions').where('applicantId', '==', uid).where('status', '==', 'disputed').get(),
  ]);
  const disputeIds = [...new Set([
    ...ownedDisputes.docs.map((doc) => doc.id),
    ...applicantDisputes.docs.map((doc) => doc.id),
  ])];
  const status = disputeIds.length ? 'needs_review' : 'requested';

  await requestRef.set({
    uid,
    email: request.auth.token.email || null,
    status,
    reviewRequired: true,
    holdReason: disputeIds.length ? 'open_disputes' : null,
    openDisputeCount: disputeIds.length,
    // Keep references for the authorized reviewer; do not copy evidence or private content.
    openDisputeIds: disputeIds,
    requestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    processingStartedAt: null,
    completedAt: null,
    failureCode: null,
  }, { merge: true });

  return { status, openDisputeCount: disputeIds.length, alreadyRequested: false };
});
