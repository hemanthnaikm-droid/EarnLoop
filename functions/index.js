const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
}
function requireRecentSignIn(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
  const authTime = Number(request.auth.token.auth_time || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authTime || now - authTime > 300 || authTime > now + 60) {
    throw new HttpsError('failed-precondition', 'Recent sign-in required. Sign in again and retry.');
  }
}
async function findOpenDisputes(uid) {
  const [owned, applicant] = await Promise.all([
    db.collection('submissions').where('ownerId', '==', uid).where('status', '==', 'disputed').get(),
    db.collection('submissions').where('applicantId', '==', uid).where('status', '==', 'disputed').get(),
  ]);
  return [...new Set([...owned.docs.map(d => d.id), ...applicant.docs.map(d => d.id)])];
}

// Authenticated users can submit an idempotent deletion request. No client can write the request directly.
exports.requestAccountDeletion = onCall({ enforceAppCheck: false }, async (request) => {
  requireRecentSignIn(request);
  const uid = request.auth.uid;
  const requestRef = db.collection('accountDeletionRequests').doc(uid);
  const existingSnap = await requestRef.get();
  if (existingSnap.exists && ['requested', 'needs_review', 'approved', 'processing'].includes(existingSnap.data().status)) {
    return { status: existingSnap.data().status, alreadyRequested: true };
  }
  const disputes = await findOpenDisputes(uid);
  const status = disputes.length ? 'needs_review' : 'requested';
  await requestRef.set({
    uid, email: request.auth.token.email || null, status, reviewRequired: true,
    holdReason: disputes.length ? 'open_disputes' : null,
    openDisputeCount: disputes.length, openDisputeIds: disputes,
    requestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    reviewedAt: null, reviewedBy: null, processingStartedAt: null, completedAt: null,
    failureCode: null,
  });
  return { status, openDisputeCount: disputes.length, alreadyRequested: false };
});

// Admins explicitly approve or hold a request. Admin custom claim must be assigned securely by project owner.
exports.reviewAccountDeletion = onCall({ enforceAppCheck: false }, async (request) => {
  requireAdmin(request);
  const { uid, decision, note } = request.data || {};
  if (typeof uid !== 'string' || !uid || !['approve', 'hold', 'reject'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Provide uid and decision: approve, hold, or reject.');
  }
  const ref = db.collection('accountDeletionRequests').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Deletion request not found.');
  const current = snap.data();
  if (!['requested', 'needs_review', 'failed'].includes(current.status)) {
    throw new HttpsError('failed-precondition', `Cannot review a request in status ${current.status}.`);
  }
  const disputes = await findOpenDisputes(uid);
  if (decision === 'approve' && disputes.length) {
    await ref.update({ status: 'needs_review', holdReason: 'open_disputes', openDisputeCount: disputes.length, openDisputeIds: disputes, updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError('failed-precondition', 'Open disputes must be resolved before approval.');
  }
  const status = decision === 'approve' ? 'approved' : decision === 'hold' ? 'needs_review' : 'rejected';
  await ref.update({ status, holdReason: decision === 'hold' ? 'admin_review' : null, reviewNote: typeof note === 'string' ? note.slice(0, 500) : null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: request.auth.uid, updatedAt: FieldValue.serverTimestamp(), openDisputeCount: disputes.length, openDisputeIds: disputes });
  return { uid, status };
});

// Runs only after explicit admin approval. Keeps task/application/submission history, redacts account emails,
// removes the profile document, and deletes the Firebase Auth account. Open disputes are checked again.
exports.processAccountDeletion = onCall({ enforceAppCheck: false, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  const { uid } = request.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Provide a user UID.');
  const ref = db.collection('accountDeletionRequests').doc(uid);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status !== 'approved') throw new HttpsError('failed-precondition', 'An approved deletion request is required.');
  const disputes = await findOpenDisputes(uid);
  if (disputes.length) {
    await ref.update({ status: 'needs_review', holdReason: 'open_disputes', openDisputeCount: disputes.length, openDisputeIds: disputes, updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError('failed-precondition', 'Open disputes block deletion. Resolve them and review again.');
  }
  await ref.update({ status: 'processing', processingStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), failureCode: null });
  const redactedEmail = `deleted-${uid.slice(0, 8)}@redacted.invalid`;
  const collections = [
    { name: 'tasks', field: 'ownerId', emailField: 'ownerEmail' },
    { name: 'applications', field: 'applicantId', emailField: 'applicantEmail' },
    { name: 'applications', field: 'ownerId', emailField: 'ownerEmail' },
    { name: 'submissions', field: 'applicantId', emailField: 'applicantEmail' },
    { name: 'submissions', field: 'ownerId', emailField: 'ownerEmail' },
    { name: 'reports', field: 'reporterId', emailField: 'reporterEmail' },
  ];
  try {
    const touched = new Map();
    for (const item of collections) {
      const result = await db.collection(item.name).where(item.field, '==', uid).get();
      for (const doc of result.docs) {
        const key = `${item.name}/${doc.id}`;
        const prior = touched.get(key) || { ref: doc.ref, patch: {} };
        prior.patch[item.emailField] = redactedEmail;
        touched.set(key, prior);
      }
    }
    let batch = db.batch(); let writes = 0;
    for (const entry of touched.values()) {
      batch.update(entry.ref, { ...entry.patch, accountDeleted: true, accountDataRedactedAt: FieldValue.serverTimestamp() });
      writes++;
      if (writes === 400) { await batch.commit(); batch = db.batch(); writes = 0; }
    }
    if (writes) await batch.commit();
    await db.collection('users').doc(uid).delete().catch(() => {});
    await authAdmin.deleteUser(uid);
    await ref.update({ status: 'completed', email: null, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), openDisputeIds: [], openDisputeCount: 0 });
    return { uid, status: 'completed', redactedRecords: touched.size };
  } catch (error) {
    await ref.update({ status: 'failed', failureCode: String(error.code || 'processing-error').slice(0, 80), updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    console.error('Account deletion processing failed', { uid, code: error.code || 'unknown' });
    throw new HttpsError('internal', 'Deletion processing failed. The request is marked failed for authorized retry.');
  }
});
