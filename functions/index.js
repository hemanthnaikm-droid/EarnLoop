const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();

// Set ENFORCE_APP_CHECK=true only after the web app's App Check site key is
// configured and verified in Firebase Console. Default remains false so an
// unconfigured deployment does not accidentally lock out every user.
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';

// Per-user, server-enforced rate limits for callable endpoints. Uses a transaction so
// simultaneous requests cannot all pass the same counter check.
async function consumeRateLimit(uid, action, limit, windowSeconds) {
  const nowMs = Date.now();
  const ref = db.collection('_rateLimits').doc(`${uid}_${action}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const startMs = Number(data.windowStartMs || 0);
    const active = startMs > 0 && nowMs - startMs < windowSeconds * 1000;
    const count = active ? Number(data.count || 0) : 0;
    if (count >= limit) {
      throw new HttpsError('resource-exhausted', 'Too many requests. Please wait and try again later.');
    }
    tx.set(ref, {
      uid,
      action,
      windowStartMs: active ? startMs : nowMs,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + Math.max(windowSeconds * 2, 86400) * 1000),
    });
    return count + 1;
  });
}

async function writeSecurityAudit(event, actorUid, targetUid, details = {}) {
  // Never store passwords, tokens, or user-submitted free-text notes in this audit log.
  await db.collection('securityAuditLogs').add({
    event,
    actorUid: actorUid || null,
    targetUid: targetUid || null,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

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



// Server-side write endpoints: enforce per-user limits and validate relationships
// before creating task marketplace records. Client SDKs cannot bypass these limits.
function requireSignedIn(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
}
function boundedString(value, min, max, label) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${label} must be text.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new HttpsError('invalid-argument', `${label} must be ${min}–${max} characters.`);
  return result;
}

exports.createTask = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireSignedIn(request);
  const uid = request.auth.uid;
  await consumeRateLimit(uid, 'create-task', 5, 3600);
  const data = request.data || {};
  const title = boundedString(data.title, 3, 70, 'Title');
  const description = boundedString(data.description, 10, 1000, 'Description');
  const category = data.category;
  const proposedReward = Number(data.proposedReward);
  if (!['digital', 'skills', 'local'].includes(category)) throw new HttpsError('invalid-argument', 'Invalid task category.');
  if (!Number.isInteger(proposedReward) || proposedReward < 1 || proposedReward > 10000) throw new HttpsError('invalid-argument', 'Proposed reward must be an integer between 1 and 10000.');
  const ref = db.collection('tasks').doc();
  await ref.create({ title, description, category, proposedReward, ownerId: uid, ownerEmail: request.auth.token.email || '', createdAt: FieldValue.serverTimestamp(), status: 'open', funded: false });
  return { taskId: ref.id, status: 'open', funded: false };
});

exports.createApplication = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireSignedIn(request);
  const uid = request.auth.uid;
  await consumeRateLimit(uid, 'create-application', 10, 3600);
  const data = request.data || {};
  const taskId = boundedString(data.taskId, 1, 150, 'Task ID');
  const message = boundedString(data.message, 10, 500, 'Application message');
  const taskRef = db.collection('tasks').doc(taskId);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) throw new HttpsError('not-found', 'Task not found.');
  const task = taskSnap.data();
  if (task.status !== 'open') throw new HttpsError('failed-precondition', 'This task is not open for applications.');
  if (task.ownerId === uid) throw new HttpsError('permission-denied', 'You cannot apply to your own task.');
  const applicationId = `${taskId}_${uid}`;
  const ref = db.collection('applications').doc(applicationId);
  try {
    await ref.create({ taskId, taskTitle: task.title, ownerId: task.ownerId, applicantId: uid, applicantEmail: request.auth.token.email || '', message, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') throw new HttpsError('already-exists', 'You have already applied to this task.');
    throw error;
  }
  return { applicationId, status: 'pending' };
});

exports.createSubmission = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireSignedIn(request);
  const uid = request.auth.uid;
  await consumeRateLimit(uid, 'create-submission', 10, 3600);
  const data = request.data || {};
  const applicationId = boundedString(data.applicationId, 1, 300, 'Application ID');
  const evidence = boundedString(data.evidence, 10, 3000, 'Work evidence');
  const appRef = db.collection('applications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError('not-found', 'Application not found.');
  const application = appSnap.data();
  if (application.applicantId !== uid || application.status !== 'accepted') throw new HttpsError('permission-denied', 'Only the accepted applicant can submit work.');
  const ref = db.collection('submissions').doc(applicationId);
  try {
    await ref.create({ taskId: application.taskId, applicationId, taskTitle: application.taskTitle, ownerId: application.ownerId, applicantId: uid, applicantEmail: request.auth.token.email || '', evidence, status: 'submitted', createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') throw new HttpsError('already-exists', 'Work has already been submitted for this application.');
    throw error;
  }
  return { submissionId: applicationId, status: 'submitted' };
});

exports.createReport = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireSignedIn(request);
  const uid = request.auth.uid;
  await consumeRateLimit(uid, 'create-report', 5, 3600);
  const data = request.data || {};
  const taskId = boundedString(data.taskId, 1, 150, 'Task ID');
  const reason = boundedString(data.reason, 10, 500, 'Report reason');
  const taskSnap = await db.collection('tasks').doc(taskId).get();
  if (!taskSnap.exists) throw new HttpsError('not-found', 'Task not found.');
  const task = taskSnap.data();
  const ref = db.collection('reports').doc();
  await ref.create({ taskId, taskTitle: task.title, reporterId: uid, reporterEmail: request.auth.token.email || '', reason, status: 'open', createdAt: FieldValue.serverTimestamp() });
  return { reportId: ref.id, status: 'open' };
});

// Authenticated users can submit an idempotent deletion request. No client can write the request directly.
exports.requestAccountDeletion = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireRecentSignIn(request);
  const uid = request.auth.uid;
  await consumeRateLimit(uid, 'deletion-request', 3, 86400);
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
  await writeSecurityAudit('account_deletion_requested', uid, uid, { status, openDisputeCount: disputes.length });
  return { status, openDisputeCount: disputes.length, alreadyRequested: false };
});

// Admins explicitly approve or hold a request. Admin custom claim must be assigned securely by project owner.
exports.reviewAccountDeletion = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request);
  await consumeRateLimit(request.auth.uid, 'deletion-review', 60, 60);
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
  await writeSecurityAudit('account_deletion_reviewed', request.auth.uid, uid, { decision, status });
  return { uid, status };
});

// Runs only after explicit admin approval. Keeps task/application/submission history, redacts account emails,
// removes the profile document, and deletes the Firebase Auth account. Open disputes are checked again.
exports.processAccountDeletion = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  await consumeRateLimit(request.auth.uid, 'deletion-process', 10, 3600);
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
  // Claim processing transactionally so two admins cannot process the same request at once.
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data().status !== 'approved') {
      throw new HttpsError('failed-precondition', 'The request is no longer approved for processing.');
    }
    tx.update(ref, { status: 'processing', processingStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), failureCode: null });
  });
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
    await writeSecurityAudit('account_deletion_completed', request.auth.uid, uid, { redactedRecords: touched.size });
    return { uid, status: 'completed', redactedRecords: touched.size };
  } catch (error) {
    await ref.update({ status: 'failed', failureCode: String(error.code || 'processing-error').slice(0, 80), updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    await writeSecurityAudit('account_deletion_failed', request.auth.uid, uid, { errorCode: String(error.code || 'processing-error').slice(0, 80) }).catch(() => {});
    console.error('Account deletion processing failed', { uid, code: error.code || 'unknown' });
    throw new HttpsError('internal', 'Deletion processing failed. The request is marked failed for authorized retry.');
  }
});
