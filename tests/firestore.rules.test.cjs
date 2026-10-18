const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } = require('firebase/firestore');

const PROJECT_ID = 'earnloop-rules-test';
let testEnv;

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

function taskFixture(overrides = {}) {
  return {
    title: 'Test a website',
    description: 'Review this demo website and report usability problems.',
    category: 'digital',
    proposedReward: 100,
    ownerId: 'customer1',
    ownerEmail: 'customer1@example.test',
    createdAt: new Date(),
    status: 'open',
    funded: false,
    ...overrides,
  };
}

describe('EarnLoop Firestore security rules', function () {
  before(async function () {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });
  });

  beforeEach(async function () {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'tasks/task1'), taskFixture());
      await setDoc(doc(db, 'users/customer1'), {
        email: 'customer1@example.test', role: 'user', createdAt: new Date(),
      });
      await setDoc(doc(db, 'accountDeletionRequests/applicant1'), {
        status: 'requested', uid: 'applicant1',
      });
      await setDoc(doc(db, 'securityAuditLogs/audit1'), {
        event: 'test', actorUid: 'admin1', createdAt: new Date(),
      });
    });
  });

  after(async function () {
    if (testEnv) await testEnv.cleanup();
  });

  it('allows a signed-in user to read marketplace tasks', async function () {
    const db = testEnv.authenticatedContext('applicant1').firestore();
    await assertSucceeds(getDoc(doc(db, 'tasks/task1')));
  });

  it('denies unauthenticated reads of tasks', async function () {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'tasks/task1')));
  });

  it('allows users to read only their own profile', async function () {
    const ownDb = testEnv.authenticatedContext('customer1').firestore();
    const otherDb = testEnv.authenticatedContext('applicant1').firestore();
    await assertSucceeds(getDoc(doc(ownDb, 'users/customer1')));
    await assertFails(getDoc(doc(otherDb, 'users/customer1')));
  });

  it('denies client-side profile updates and deletes', async function () {
    const db = testEnv.authenticatedContext('customer1').firestore();
    await assertFails(updateDoc(doc(db, 'users/customer1'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'users/customer1')));
  });

  it('denies direct client creation of tasks (callable function required)', async function () {
    const db = testEnv.authenticatedContext('customer2', { email: 'customer2@example.test' }).firestore();
    await assertFails(setDoc(doc(db, 'tasks/task2'), taskFixture({ ownerId: 'customer2', ownerEmail: 'customer2@example.test' })));
  });

  it('denies client writes to account deletion requests', async function () {
    const db = testEnv.authenticatedContext('applicant1').firestore();
    await assertFails(setDoc(doc(db, 'accountDeletionRequests/applicant1'), { status: 'requested', uid: 'applicant1' }));
    await assertFails(deleteDoc(doc(db, 'accountDeletionRequests/applicant1')));
  });

  it('allows a user to read their own deletion request, but not another user\'s', async function () {
    const ownDb = testEnv.authenticatedContext('applicant1').firestore();
    const otherDb = testEnv.authenticatedContext('customer1').firestore();
    await assertSucceeds(getDoc(doc(ownDb, 'accountDeletionRequests/applicant1')));
    await assertFails(getDoc(doc(otherDb, 'accountDeletionRequests/applicant1')));
  });

  it('denies non-admin access to security audit logs', async function () {
    const db = testEnv.authenticatedContext('applicant1').firestore();
    await assertFails(getDoc(doc(db, 'securityAuditLogs/audit1')));
    await assertFails(getDocs(collection(db, 'securityAuditLogs')));
  });

  it('allows an admin to read security audit logs', async function () {
    const db = testEnv.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'securityAuditLogs/audit1')));
  });
});
