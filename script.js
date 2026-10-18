import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


import {
    collection,
    doc,
    setDoc,
    addDoc,
    getDoc,
    getDocs,
    serverTimestamp,
    onSnapshot,
    query,
    orderBy,
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


import { auth, db, authReady } from "./firebase.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import {
    initializeAppCheck,
    ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-check.js";

// Stage 8 App Check setup. Replace this placeholder with the reCAPTCHA v3
// SITE KEY from Firebase Console > App Check. Never use a secret key here.
const APP_CHECK_SITE_KEY = "REPLACE_WITH_RECAPTCHA_V3_SITE_KEY";
let appCheck = null;
if (APP_CHECK_SITE_KEY && !APP_CHECK_SITE_KEY.startsWith("REPLACE_WITH_")) {
    try {
        appCheck = initializeAppCheck(auth.app, {
            provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
            isTokenAutoRefreshEnabled: true
        });
    } catch (error) {
        // Avoid breaking the app during setup; fix the configuration before
        // enabling server-side App Check enforcement.
        console.error("Firebase App Check initialization failed:", error);
    }
} else {
    console.warn("Firebase App Check is not configured. Add the reCAPTCHA v3 site key before enforcing App Check.");
}

const functions = getFunctions(auth.app);
const callCreateTask = httpsCallable(functions, "createTask");
const callCreateApplication = httpsCallable(functions, "createApplication");
const callCreateSubmission = httpsCallable(functions, "createSubmission");
const callCreateReport = httpsCallable(functions, "createReport");
const callCreateTaskFundingOrder = httpsCallable(functions, "createTaskFundingOrder");

// Trust & Safety helpers: render Firestore timestamps safely.
function formatAuditTime(value) {
    if (!value) return "Not recorded";
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
const taskList = document.getElementById("taskList");
const taskModal = document.getElementById("taskModal");

const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalReward = document.getElementById("modalReward");
const modalMessage = document.getElementById("modalMessage");

const balanceElement = document.getElementById("balance");
const completedElement = document.getElementById("completedCount");
const pendingElement = document.getElementById("pendingBalance");

const createSection = document.getElementById("createSection");
const createTaskForm = document.getElementById("createTaskForm");
const createMessage = document.getElementById("createMessage");
const applicationsSection = document.getElementById("applicationsSection");

let currentTask = null;
let completedTasks = 0;
let demoBalance = 0;

const completedTaskIds = new Set();

const descriptions = {
    "Test a Website":
        "Explore a website and report usability problems with clear feedback.",

    "Write a Caption":
        "Create a useful social media caption for a business.",

    "Verify Business Details":
        "Check publicly available business information and report corrections."
};

function formatRupees(amount) {
    return "₹" + amount.toFixed(2);
}

function getTaskCards() {
    return document.querySelectorAll(".task-card");
}


function openTask(button) {
    // This is a sample task, not a Firestore task.
    currentFirebaseTask = null;

    currentTask = {
        id: button.dataset.taskId || button.dataset.task,
        title: button.dataset.task,
        description:
            button.dataset.description ||
            descriptions[button.dataset.task] ||
            "Review the task instructions.",
        reward: Number(button.dataset.reward)
    };

    modalTitle.textContent = currentTask.title;
    modalDescription.textContent = currentTask.description;

    modalReward.textContent =
        "Proposed example reward: " + formatRupees(currentTask.reward) +
        " · NOT FUNDED";

    modalMessage.textContent = "";

    const applicationActions =
        document.querySelector(".application-actions");

    applicationActions.hidden = true;

    document.getElementById("applicationMessage").textContent = "";
    document.getElementById("applicationMessageInput").value = "";

    const completeButton =
        document.getElementById("demoComplete");

    completeButton.disabled =
        completedTaskIds.has(currentTask.id);

    completeButton.textContent =
        completedTaskIds.has(currentTask.id)
            ? "Already simulated"
            : "Simulate completion";

    taskModal.hidden = false;
}


function closeTask() {
    taskModal.hidden = true;
    currentTask = null;
}

document.querySelectorAll(".task-button").forEach(button => {
    button.addEventListener("click", () => openTask(button));
});

document.getElementById("closeModal")
    .addEventListener("click", closeTask);

taskModal.addEventListener("click", event => {
    if (event.target === taskModal) {
        closeTask();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !taskModal.hidden) {
        closeTask();
    }
});

document.getElementById("demoComplete")
    .addEventListener("click", () => {
        if (!currentTask) return;

        if (completedTaskIds.has(currentTask.id)) {
            modalMessage.textContent =
                "This demonstration task was already completed.";
            return;
        }

        completedTaskIds.add(currentTask.id);
        completedTasks++;
        demoBalance += currentTask.reward;

        balanceElement.textContent = formatRupees(demoBalance);
        completedElement.textContent = completedTasks;

        modalMessage.textContent =
            "Demo complete! This test balance is not real money " +
            "and cannot be withdrawn.";

        const button = document.getElementById("demoComplete");
        button.disabled = true;
        button.textContent = "Already simulated";
    });

/* CATEGORY FILTERS */

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;

        document.querySelectorAll(".category").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        applyTaskFilter();
    });
});

/* MAIN NAVIGATION */

function showHome() {
    createSection.hidden = true;

    document.querySelector(".welcome").hidden = false;
    document.querySelector(".wallet-card").hidden = false;

    document.querySelectorAll(".section").forEach(section => {
        if (section !== createSection) {
            section.hidden = false;
        }
    });

    document.querySelector(".how-it-works").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showExplore() {
    createSection.hidden = true;

    document.querySelector(".welcome").hidden = true;
    document.querySelector(".wallet-card").hidden = true;
    document.querySelector(".how-it-works").hidden = true;

    document.querySelectorAll(".section").forEach(section => {
        if (section !== createSection) {
            section.hidden = section !== document.querySelector(".section");
        }
    });

    const exploreSection = document.querySelector(".section");

    exploreSection.hidden = false;
    exploreSection.scrollIntoView({ behavior: "smooth" });
}

function showCreate() {
    document.querySelector(".welcome").hidden = true;
    document.querySelector(".wallet-card").hidden = true;

    document.querySelectorAll(".section").forEach(section => {
        section.hidden = true;
    });

    document.querySelector(".how-it-works").hidden = true;

    createSection.hidden = false;

    createSection.scrollIntoView({ behavior: "smooth" });
}

function showWallet() {
    createSection.hidden = true;

    document.querySelector(".welcome").hidden = false;
    document.querySelector(".wallet-card").hidden = false;

    document.querySelectorAll(".section").forEach(section => {
        section.hidden = true;
    });

    document.querySelector(".how-it-works").hidden = true;

    document.querySelector(".wallet-card")
        .scrollIntoView({ behavior: "smooth" });
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.toggle("selected", item === button);
        });

        if (page === "home") showHome();
        if (page === "explore") showExplore();
        if (page === "create") showCreate();
        if (page === "wallet") showWallet();
        if (page === "applications") showApplications();
        if (page === "admin") showAdmin();
    });
});



function showApplications() {
    document.querySelector(".welcome").hidden = true;
    document.querySelector(".wallet-card").hidden = true;
    document.querySelector(".how-it-works").hidden = true;

    document.querySelectorAll(".section").forEach(section => {
        section.hidden = true;
    });

    createSection.hidden = true;
    applicationsSection.hidden = false;

    applicationsSection.scrollIntoView({
        behavior: "smooth"
    });
}



/* ===================================
   FIREBASE TASK MARKETPLACE
=================================== */

let firebaseTasks = [];
let stopTaskListener = null;
let currentFirebaseTask = null;
let stopApplicationsListener = null;
let stopApplicantApplicationsListener = null;
let stopOwnerSubmissionsListener = null;
let stopApplicantSubmissionsListener = null;
const taskIcons = {
    digital: "🌐",
    skills: "✍️",
    local: "📍"
};

function renderFirebaseTasks() {
    const oldCards = document.querySelectorAll(
        ".firebase-task-card"
    );

    oldCards.forEach(card => card.remove());

    // Public marketplace: only tasks explicitly marked open are visible.
    // Hidden/closed tasks remain in Firestore for moderation history.
    firebaseTasks
        .filter(task => task.status === "open")
        .forEach(task => {
        const card = document.createElement("article");

        card.className = "task-card firebase-task-card";
        card.dataset.category = task.category;

        const top = document.createElement("div");
        top.className = "task-top";

        const icon = document.createElement("span");
        icon.className = "task-icon";
        icon.textContent = taskIcons[task.category] || "📋";

        const type = document.createElement("span");
        type.className = "task-type";
        type.textContent = task.category.toUpperCase();

        top.append(icon, type);

        const title = document.createElement("h3");
        title.textContent = task.title;

        const description = document.createElement("p");
        description.textContent = task.description;

        const owner = document.createElement("p");
        owner.className = "demo-notice";
        owner.textContent = "Posted by " + task.ownerEmail;

        const footer = document.createElement("div");
        footer.className = "task-footer";

        const rewardBox = document.createElement("div");

        const label = document.createElement("span");
        label.className = "reward-label";
        label.textContent = "Proposed reward";

        const reward = document.createElement("strong");
        reward.className = "reward";
        reward.textContent = "₹" + task.proposedReward;

        const fundingStatus = document.createElement("span");
        fundingStatus.className = "funding-status";
        // Phase 1 has no trusted payment verification backend, so all
        // rewards remain labelled unfunded regardless of client-side data.
        fundingStatus.textContent = task.funded === true ? "FUNDED · Provider confirmed" : "NOT FUNDED · No payment guaranteed";
        fundingStatus.dataset.funded = task.funded === true ? "true" : "false";

        rewardBox.append(label, reward, fundingStatus);

        const button = document.createElement("button");
        button.className = "task-button";
        button.textContent = "View task";

        button.addEventListener("click", () => {
            openFirebaseTask(task);
        });

        footer.append(rewardBox, button);

        const reportButton = document.createElement("button");
        reportButton.type = "button";
        reportButton.className = "report-task-button";
        reportButton.textContent = "Report task";
        reportButton.addEventListener("click", async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("Please log in before reporting a task.");
                return;
            }
            const reason = prompt("Why are you reporting this task? (10–500 characters)");
            if (reason === null) return;
            const cleanReason = reason.trim();
            if (cleanReason.length < 10 || cleanReason.length > 500) {
                alert("Please enter a reason between 10 and 500 characters.");
                return;
            }
            reportButton.disabled = true;
            try {
                await callCreateReport({ taskId: task.id, reason: cleanReason });
                alert("Report submitted for review. This does not automatically remove the task.");
            } catch (error) {
                console.error("Task report failed:", error);
                alert("Could not submit the report. Check Firestore rules and try again.");
            } finally {
                reportButton.disabled = false;
            }
        });

        card.append(top, title, description, owner, footer, reportButton);

        taskList.appendChild(card);
    });

    applyTaskFilter();
}

function applyTaskFilter() {
    const activeCategory =
        document.querySelector(".category.active")
            ?.dataset.category || "all";

    document.querySelectorAll(".task-card").forEach(card => {
        card.hidden =
            activeCategory !== "all" &&
            card.dataset.category !== activeCategory;
    });
}

function openFirebaseTask(task) {
    

    currentTask = null;
    currentFirebaseTask = task;

    modalTitle.textContent = task.title;
    modalDescription.textContent =
        task.description +
        "\n\nPosted by: " + task.ownerEmail;

    modalReward.textContent =
        "Proposed reward: ₹" + task.proposedReward + " · NOT FUNDED";

    modalMessage.textContent = task.funded === true
        ? "Funding has been confirmed by the payment provider. Reward payment to workers is still subject to the platform's separate payout process."
        : "This task is not funded. The proposed reward is not guaranteed until the customer completes payment.";
    const fundButton = document.getElementById("fundTaskButton");
    const fundingMessage = document.getElementById("fundingMessage");
    if (fundButton) {
        fundButton.hidden = !authenticatedUser || authenticatedUser.uid !== task.ownerId || task.funded === true;
        fundButton.disabled = false;
        fundButton.textContent = "Fund this task securely";
    }
    if (fundingMessage) fundingMessage.textContent = "";

    const completeButton =
        document.getElementById("demoComplete");

    completeButton.disabled = true;
    completeButton.textContent = "Not available yet";

    const applicationActions =
        document.querySelector(".application-actions");

    const applyButton =
        document.getElementById("applyTaskButton");

    const applicationMessage =
        document.getElementById("applicationMessage");

    applicationMessage.textContent = "";

    document.getElementById(
        "applicationMessageInput"
    ).value = "";

    // Owners cannot apply to their own tasks.
    const isOwner =
        authenticatedUser &&
        authenticatedUser.uid === task.ownerId;

    applicationActions.hidden = !authenticatedUser || isOwner;
    applyButton.disabled = false;
    applyButton.textContent = "Apply for this task";

    taskModal.hidden = false;

}


const fundTaskButton = document.getElementById("fundTaskButton");
if (fundTaskButton) fundTaskButton.addEventListener("click", async () => {
    const task = currentFirebaseTask;
    const user = auth.currentUser;
    const message = document.getElementById("fundingMessage");
    if (!user || !task || user.uid !== task.ownerId) {
        if (message) message.textContent = "Sign in as the task owner to fund this task.";
        return;
    }
    if (task.funded === true) {
        if (message) message.textContent = "This task is already funded.";
        return;
    }
    if (typeof window.Razorpay !== "function") {
        if (message) message.textContent = "Payment checkout could not load. Refresh and try again.";
        return;
    }
    fundTaskButton.disabled = true;
    if (message) message.textContent = "Creating a secure payment order...";
    try {
        const result = await callCreateTaskFundingOrder({ taskId: task.id });
        const order = result.data;
        const checkout = new window.Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: "EarnLoop",
            description: `Fund task: ${order.taskTitle}`,
            order_id: order.orderId,
            handler: function () {
                if (message) message.textContent = "Payment response received. Waiting for verified provider confirmation; the task will show as funded only after the server confirms capture.";
                fundTaskButton.disabled = true;
            },
            modal: { ondismiss: function () { fundTaskButton.disabled = false; if (message) message.textContent = "Checkout closed. If you completed payment, wait for provider confirmation before retrying."; } },
            prefill: { email: user.email || "" },
            theme: { color: "#6d5efc" }
        });
        checkout.on("payment.failed", function (response) {
            fundTaskButton.disabled = false;
            if (message) message.textContent = "Payment failed or was cancelled. No funding was confirmed.";
            console.warn("Razorpay payment failed", response?.error?.code || "unknown");
        });
        checkout.open();
    } catch (error) {
        fundTaskButton.disabled = false;
        if (message) message.textContent = error?.message || "Could not start payment. Please try again later.";
        console.error("Task funding order failed", error);
    }
});

document.getElementById("applyTaskButton")
    .addEventListener("click", async () => {
        const task = currentFirebaseTask;
        const user = auth.currentUser;

        const messageElement =
            document.getElementById("applicationMessage");

        const applyButton =
            document.getElementById("applyTaskButton");

        const messageInput =
            document.getElementById("applicationMessageInput");

        if (!user || !task) {
            messageElement.textContent =
                "Please log in and reopen this task.";
            return;
        }

        if (user.uid === task.ownerId) {
            messageElement.textContent =
                "You cannot apply to your own task.";
            return;
        }

        if (task.status !== "open") {
            messageElement.textContent =
                "This task is not open for applications.";
            return;
        }

        // Re-check Firestore so a stale page cannot apply to a task that
        // was hidden after the marketplace was loaded.
        try {
            const latestTaskSnapshot = await getDoc(doc(db, "tasks", task.id));
            if (!latestTaskSnapshot.exists() || latestTaskSnapshot.data().status !== "open") {
                task.status = latestTaskSnapshot.exists()
                    ? latestTaskSnapshot.data().status
                    : "missing";
                renderFirebaseTasks();
                messageElement.textContent =
                    "This task is no longer open for applications.";
                return;
            }
        } catch (statusCheckError) {
            console.error("Task status verification failed:", statusCheckError);
            messageElement.textContent =
                "Could not verify this task's current status. Please try again.";
            return;
        }

        const message = messageInput.value.trim();

        if (message.length < 10 || message.length > 500) {
            messageElement.textContent =
                "Your message must contain 10–500 characters.";
            return;
        }

        applyButton.disabled = true;
        messageElement.textContent = "Submitting application...";

        try {
            await authReady;

            const applicationId = task.id + "_" + user.uid;
            const applicationRef = doc(
                db,
                "applications",
                applicationId
            );

            const existing = await getDoc(applicationRef);

            if (existing.exists()) {
                messageElement.textContent =
                    "You have already applied to this task.";
                return;
            }

            await callCreateApplication({ taskId: task.id, message });

            messageElement.textContent =
                "Application submitted! The task owner can review it.";

            messageInput.value = "";
        } catch (error) {
            console.error("Application submission failed:", error);

            messageElement.textContent =
                error.code === "permission-denied"
                    ? "Application denied by Firestore rules. Check the rules and task status."
                    : "Unable to submit: " + error.message;
        } finally {
            applyButton.disabled = false;
        }
    });


    
function startApplicationsListener(user) {
    if (stopApplicationsListener) {
        stopApplicationsListener();
        stopApplicationsListener = null;
    }

    const applicationsList =
        document.getElementById("applicationsList");

    const applicationsMessage =
        document.getElementById("applicationsMessage");

    applicationsList.replaceChildren();

    if (!user) {
        applicationsMessage.textContent =
            "Log in to review applications for your tasks.";
        return;
    }

    applicationsMessage.textContent = "Loading applications...";

    const ownerQuery = query(
        collection(db, "applications"),
        where("ownerId", "==", user.uid)
    );

    stopApplicationsListener = onSnapshot(
        ownerQuery,
        snapshot => {
            applicationsList.replaceChildren();

            if (snapshot.empty) {
                applicationsMessage.textContent =
                    "No applications for your tasks yet.";
                return;
            }

            applicationsMessage.textContent =
                snapshot.size + " application(s)";

            const applications = snapshot.docs
                .map(item => ({
                    ...item.data(),
                    id: item.id
                }))
                .sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });

            applications.forEach(application => {
                const card = document.createElement("article");
                card.className = "application-card application-card-enhanced";

                const header = document.createElement("div");
                header.className = "application-card-header";
                const titleWrap = document.createElement("div");
                titleWrap.className = "application-title-wrap";
                const eyebrow = document.createElement("span");
                eyebrow.className = "application-eyebrow";
                eyebrow.textContent = "TASK APPLICATION";
                const title = document.createElement("h3");
                title.className = "application-task-title";
                title.textContent = application.taskTitle || "Untitled task";
                titleWrap.append(eyebrow, title);

                const status = document.createElement("span");
                status.className = "application-status status-" + String(application.status || "pending").toLowerCase();
                status.textContent = String(application.status || "pending").replace(/^./, ch => ch.toUpperCase());
                header.append(titleWrap, status);

                const taskPanel = document.createElement("section");
                taskPanel.className = "application-task-details";
                const taskPanelHeading = document.createElement("h4");
                taskPanelHeading.textContent = "Task details";
                const description = document.createElement("p");
                description.className = "application-task-description";
                description.textContent = "Loading task description…";
                const metaGrid = document.createElement("div");
                metaGrid.className = "application-meta-grid";

                function addMeta(labelText, valueText, extraClass = "") {
                    const item = document.createElement("div");
                    item.className = "application-meta-item" + (extraClass ? " " + extraClass : "");
                    const label = document.createElement("span");
                    label.className = "application-meta-label";
                    label.textContent = labelText;
                    const value = document.createElement("span");
                    value.className = "application-meta-value";
                    value.textContent = valueText;
                    item.append(label, value);
                    metaGrid.appendChild(item);
                }

                addMeta("Customer ID", application.ownerId || "Unavailable", "application-customer-id");
                addMeta("Task ID", application.taskId || "Unavailable");
                addMeta("Task created", "Loading…");
                addMeta("Task status", "Loading…", "application-task-status-meta");
                taskPanel.append(taskPanelHeading, description, metaGrid);

                // Application documents intentionally store a task snapshot, but not the
                // full description or task creation timestamp. Fetch the authoritative task.
                getDoc(doc(db, "tasks", application.taskId)).then(taskSnapshot => {
                    const metaItems = metaGrid.querySelectorAll(".application-meta-item");
                    if (!taskSnapshot.exists()) {
                        description.textContent = "The original task record is no longer available.";
                        if (metaItems[2]) metaItems[2].querySelector(".application-meta-value").textContent = "Unavailable";
                        if (metaItems[3]) metaItems[3].querySelector(".application-meta-value").textContent = "Unknown";
                        return;
                    }
                    const task = taskSnapshot.data();
                    description.textContent = task.description || "No description was provided for this task.";
                    if (metaItems[2]) metaItems[2].querySelector(".application-meta-value").textContent = formatAuditTime(task.createdAt);
                    if (metaItems[3]) {
                        const taskStatusValue = metaItems[3].querySelector(".application-meta-value");
                        taskStatusValue.textContent = String(task.status || "unknown").replace(/^./, ch => ch.toUpperCase());
                        taskStatusValue.dataset.status = task.status || "unknown";
                    }
                }).catch(error => {
                    console.error("Unable to load task details for application:", error);
                    description.textContent = "Task description could not be loaded. Please refresh and try again.";
                    const metaItems = metaGrid.querySelectorAll(".application-meta-item");
                    if (metaItems[2]) metaItems[2].querySelector(".application-meta-value").textContent = "Unavailable";
                    if (metaItems[3]) metaItems[3].querySelector(".application-meta-value").textContent = "Unavailable";
                });

                const applicantPanel = document.createElement("div");
                applicantPanel.className = "application-applicant-panel";
                const applicantHeading = document.createElement("h4");
                applicantHeading.textContent = "Applicant";
                const applicant = document.createElement("p");
                applicant.className = "application-applicant-email";
                applicant.textContent = application.applicantEmail || application.applicantId || "Unknown applicant";
                const applicantId = document.createElement("p");
                applicantId.className = "application-applicant-id";
                applicantId.textContent = "Applicant ID: " + (application.applicantId || "Unavailable");
                applicantPanel.append(applicantHeading, applicant, applicantId);

                const messagePanel = document.createElement("div");
                messagePanel.className = "application-message-panel";
                const messageHeading = document.createElement("h4");
                messageHeading.textContent = "Applicant message";
                const message = document.createElement("p");
                message.textContent = application.message || "No message supplied.";
                messagePanel.append(messageHeading, message);

                const timeline = document.createElement("p");
                timeline.className = "audit-timestamp application-timeline";
                timeline.textContent = "Applied: " + formatAuditTime(application.createdAt) +
                    (application.reviewedAt ? " · Reviewed: " + formatAuditTime(application.reviewedAt) : " · Awaiting decision");

                card.append(header, taskPanel, applicantPanel, messagePanel, timeline);

                if (application.status === "pending") {
                    const actions = document.createElement("div");
                    actions.className = "application-review-actions";

                    const acceptButton =
                        document.createElement("button");

                    acceptButton.type = "button";
                    acceptButton.className =
                        "application-review-button accept";
                    acceptButton.textContent = "Accept";

                    const rejectButton =
                        document.createElement("button");

                    rejectButton.type = "button";
                    rejectButton.className =
                        "application-review-button reject";
                    rejectButton.textContent = "Reject";

                    async function reviewApplication(newStatus) {
                        acceptButton.disabled = true;
                        rejectButton.disabled = true;

                        try {
                            await updateDoc(
                                doc(db, "applications", application.id),
                                {
                                    status: newStatus,
                                    reviewedAt: serverTimestamp()
                                }
                            );
                        } catch (error) {
                            console.error(
                                "Application review failed:",
                                error
                            );

                            applicationsMessage.textContent =
                                "Unable to update application: " +
                                error.message;

                            acceptButton.disabled = false;
                            rejectButton.disabled = false;
                        }
                    }

                    acceptButton.addEventListener("click", () => {
                        reviewApplication("accepted");
                    });

                    rejectButton.addEventListener("click", () => {
                        reviewApplication("rejected");
                    });

                    actions.append(acceptButton, rejectButton);
                    card.appendChild(actions);
                }

                applicationsList.appendChild(card);
            });
        },
        error => {
            console.error("Application loading failed:", error);

            applicationsMessage.textContent =
                "Unable to load applications: " + error.message;
        }
    );
}



/* APPLICANT STATUS UPDATES + IN-APP POPUP */
function startApplicantApplicationsListener(user) {
    if (stopApplicantApplicationsListener) {
        stopApplicantApplicationsListener();
        stopApplicantApplicationsListener = null;
    }

    const list = document.getElementById("myApplicationsList");
    const message = document.getElementById("myApplicationsMessage");
    const toast = document.getElementById("notificationToast");
    if (!list || !message || !toast) return;

    list.replaceChildren();
    if (!user) {
        message.textContent = "Log in to see updates about your applications.";
        return;
    }

    message.textContent = "Loading your application updates...";
    const previousStatuses = new Map();
    let firstSnapshot = true;
    let toastTimer = null;

    const applicantQuery = query(
        collection(db, "applications"),
        where("applicantId", "==", user.uid)
    );

    stopApplicantApplicationsListener = onSnapshot(
        applicantQuery,
        snapshot => {
            list.replaceChildren();

            if (snapshot.empty) {
                message.textContent = "You have not applied to any tasks yet.";
                firstSnapshot = false;
                return;
            }

            message.textContent = "Your applications: " + snapshot.size;

            const applicantDocs = [...snapshot.docs].sort((a, b) => {
                const timeA = a.data().createdAt?.toMillis?.() || 0;
                const timeB = b.data().createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });

            applicantDocs.forEach(item => {
                const application = { ...item.data(), id: item.id };
                const oldStatus = previousStatuses.get(item.id);
                const status = application.status;

                if (!firstSnapshot && oldStatus === "pending" &&
                    (status === "accepted" || status === "rejected")) {
                    const decisionText = status === "accepted"
                        ? "Your application was accepted!"
                        : "Your application was rejected.";

                    toast.textContent = decisionText + " Task: " +
                        (application.taskTitle || "Untitled task");
                    toast.hidden = false;

                    if (toastTimer) clearTimeout(toastTimer);
                    toastTimer = setTimeout(() => {
                        toast.hidden = true;
                    }, 7000);
                }

                previousStatuses.set(item.id, status);

                const card = document.createElement("article");
                card.className = "application-notification-card";

                const title = document.createElement("h3");
                title.textContent = application.taskTitle || "Task application";

                const statusLine = document.createElement("p");
                statusLine.className =
                    status === "accepted" ? "decision-accepted" :
                    status === "rejected" ? "decision-rejected" : "";
                statusLine.textContent =
                    status === "accepted" ? "Decision: Accepted" :
                    status === "rejected" ? "Decision: Rejected" :
                    "Decision: Pending review";

                const detail = document.createElement("p");
                detail.textContent =
                    status === "accepted"
                        ? "The task owner accepted your application. This is not a payment confirmation."
                        : status === "rejected"
                            ? "The task owner did not accept your application."
                            : "The task owner has not made a decision yet.";

                card.append(title, statusLine, detail);

                if (status === "accepted") {
                    const workArea = document.createElement("div");
                    workArea.className = "work-submit-area";
                    const workHeading = document.createElement("h4");
                    workHeading.textContent = "Submit your completed work";
                    const workHelp = document.createElement("p");
                    workHelp.textContent = "Add a link or describe your work (10–3000 characters). Do not include passwords, OTPs, or sensitive personal information.";
                    const workForm = document.createElement("form");
                    workForm.className = "work-submit-form";
                    const evidence = document.createElement("textarea");
                    evidence.required = true;
                    evidence.minLength = 10;
                    evidence.maxLength = 3000;
                    evidence.rows = 4;
                    evidence.placeholder = "Paste a work link or describe what you completed...";
                    const submitWorkButton = document.createElement("button");
                    submitWorkButton.type = "submit";
                    submitWorkButton.className = "application-review-button accept";
                    submitWorkButton.textContent = "Submit work";
                    const workMessage = document.createElement("p");
                    workMessage.className = "work-message";
                    workMessage.setAttribute("role", "status");
                    workForm.append(evidence, submitWorkButton, workMessage);
                    workArea.append(workHeading, workHelp, workForm);
                    card.appendChild(workArea);

                    getDoc(doc(db, "submissions", application.id)).then(existing => {
                        if (existing.exists()) {
                            const data = existing.data();
                            workForm.hidden = true;
                            const existingStatus = document.createElement("p");
                            existingStatus.className = "submission-status";
                            existingStatus.textContent = "Work status: " + (data.status || "submitted") + ". This does not confirm payment.";
                            workArea.appendChild(existingStatus);
                            const evidenceText = document.createElement("p");
                            evidenceText.textContent = "Submitted work: " + (data.evidence || "");
                            workArea.appendChild(evidenceText);
                        }
                    }).catch(error => {
                        console.error("Could not check submission:", error);
                    });

                    workForm.addEventListener("submit", async event => {
                        event.preventDefault();
                        const currentUser = auth.currentUser;
                        const evidenceText = evidence.value.trim();
                        if (!currentUser || currentUser.uid !== application.applicantId) {
                            workMessage.textContent = "Please log in with the applicant account.";
                            return;
                        }
                        if (evidenceText.length < 10 || evidenceText.length > 3000) {
                            workMessage.textContent = "Work details must be 10–3000 characters.";
                            return;
                        }
                        submitWorkButton.disabled = true;
                        workMessage.textContent = "Submitting work...";
                        try {
                            const submissionRef = doc(db, "submissions", application.id);
                            const existing = await getDoc(submissionRef);
                            if (existing.exists()) {
                                workMessage.textContent = "Work has already been submitted for this application.";
                                submitWorkButton.disabled = false;
                                return;
                            }
                            await callCreateSubmission({ applicationId: application.id, evidence: evidenceText });
                            workForm.hidden = true;
                            workMessage.textContent = "Work submitted for review. This is not a payment confirmation.";
                            const submittedStatus = document.createElement("p");
                            submittedStatus.className = "submission-status";
                            submittedStatus.textContent = "Work status: submitted · Awaiting owner review.";
                            workArea.appendChild(submittedStatus);
                        } catch (error) {
                            console.error("Work submission failed:", error);
                            workMessage.textContent = "Unable to submit work: " + error.message;
                            submitWorkButton.disabled = false;
                        }
                    });
                }

                list.appendChild(card);
            });

            firstSnapshot = false;
        },
        error => {
            console.error("Applicant application updates failed:", error);
            message.textContent =
                "Could not load your application updates: " + error.message;
        }
    );
}


/* WORK SUBMISSIONS: OWNER REVIEW AND APPLICANT STATUS */
function startSubmissionListeners(user) {
    if (stopOwnerSubmissionsListener) { stopOwnerSubmissionsListener(); stopOwnerSubmissionsListener = null; }
    if (stopApplicantSubmissionsListener) { stopApplicantSubmissionsListener(); stopApplicantSubmissionsListener = null; }

    const ownerList = document.getElementById("submissionsList");
    const ownerMessage = document.getElementById("submissionsMessage");
    if (!ownerList || !ownerMessage) return;
    ownerList.replaceChildren();

    if (!user) {
        ownerMessage.textContent = "Log in to review submitted work for your tasks.";
        return;
    }

    ownerMessage.textContent = "Loading submitted work...";
    const ownerSubmissionsQuery = query(collection(db, "submissions"), where("ownerId", "==", user.uid));
    stopOwnerSubmissionsListener = onSnapshot(ownerSubmissionsQuery, snapshot => {
        ownerList.replaceChildren();
        if (snapshot.empty) {
            ownerMessage.textContent = "No work has been submitted for your tasks yet.";
            return;
        }
        ownerMessage.textContent = snapshot.size + " submission(s)";
        const submissions = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
        submissions.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        submissions.forEach(submission => {
            const card = document.createElement("article");
            card.className = "application-card";
            const title = document.createElement("h3"); title.textContent = submission.taskTitle || "Submitted work";
            const applicant = document.createElement("p"); applicant.textContent = "Applicant: " + (submission.applicantEmail || "Unknown");
            const evidence = document.createElement("p"); evidence.className = "submission-evidence"; evidence.textContent = "Work evidence: " + (submission.evidence || "");
            const status = document.createElement("span"); status.className = "application-status submission-status"; status.textContent = "Work status: " + submission.status + " · Not a payment confirmation";
            const timeline = document.createElement("p");
            timeline.className = "audit-timestamp";
            timeline.textContent = "Submitted: " + formatAuditTime(submission.createdAt) +
                (submission.reviewedAt ? " · Last status update: " + formatAuditTime(submission.reviewedAt) : " · Awaiting review");
            card.append(title, applicant, evidence, status, timeline);

            const actions = document.createElement("div"); actions.className = "application-review-actions";
            if (submission.status === "submitted") {
                const approve = document.createElement("button"); approve.type = "button"; approve.className = "application-review-button accept"; approve.textContent = "Approve work";
                const dispute = document.createElement("button"); dispute.type = "button"; dispute.className = "application-review-button reject"; dispute.textContent = "Open dispute";
                approve.addEventListener("click", () => updateSubmissionStatus(submission, "approved", approve, dispute, ownerMessage));
                dispute.addEventListener("click", () => updateSubmissionStatus(submission, "disputed", approve, dispute, ownerMessage));
                actions.append(approve, dispute); card.appendChild(actions);
            } else if (submission.status === "disputed") {
                const resolve = document.createElement("button"); resolve.type = "button"; resolve.className = "application-review-button accept"; resolve.textContent = "Mark dispute resolved";
                resolve.addEventListener("click", () => updateSubmissionStatus(submission, "resolved", resolve, null, ownerMessage));
                actions.appendChild(resolve); card.appendChild(actions);
            }
            ownerList.appendChild(card);
        });
    }, error => {
        console.error("Submission listener failed:", error);
        ownerMessage.textContent = "Unable to load submissions: " + error.message;
    });

    const applicantList = document.getElementById("mySubmissionsList");
    const applicantMessage = document.getElementById("mySubmissionsMessage");
    const applicantQuery = query(collection(db, "submissions"), where("applicantId", "==", user.uid));
    stopApplicantSubmissionsListener = onSnapshot(applicantQuery, snapshot => {
        applicantList.replaceChildren();
        if (snapshot.empty) {
            applicantMessage.textContent = "You have not submitted work yet.";
            return;
        }
        applicantMessage.textContent = snapshot.size + " work submission(s)";
        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = document.createElement("article");
            card.className = "application-notification-card";
            const title = document.createElement("h3"); title.textContent = data.taskTitle || "Submitted work";
            const status = document.createElement("p"); status.className = "submission-status";
            status.textContent = "Work status: " + data.status + " · This is not a payment confirmation.";
            const evidence = document.createElement("p"); evidence.textContent = "Your submission: " + (data.evidence || "");
            const timeline = document.createElement("p");
            timeline.className = "audit-timestamp";
            timeline.textContent = "Submitted: " + formatAuditTime(data.createdAt) +
                (data.reviewedAt ? " · Last status update: " + formatAuditTime(data.reviewedAt) : " · Awaiting review");
            card.append(title, status, evidence, timeline);
            if (["submitted", "approved"].includes(data.status)) {
                const dispute = document.createElement("button");
                dispute.type = "button"; dispute.className = "application-review-button reject";
                dispute.textContent = "Open dispute";
                dispute.addEventListener("click", async () => {
                    dispute.disabled = true;
                    try {
                        await updateDoc(doc(db, "submissions", item.id), { status: "disputed", reviewedAt: serverTimestamp() });
                    } catch (error) {
                        console.error("Could not open dispute:", error);
                        applicantMessage.textContent = "Unable to open dispute: " + error.message;
                        dispute.disabled = false;
                    }
                });
                card.appendChild(dispute);
            }
            applicantList.appendChild(card);
        });
    }, error => {
        console.error("Applicant submission status listener failed:", error);
        applicantMessage.textContent = "Unable to load your work submissions: " + error.message;
    });
}

async function updateSubmissionStatus(submission, newStatus, primaryButton, secondaryButton, messageElement) {
    if (!auth.currentUser || auth.currentUser.uid !== submission.ownerId) {
        messageElement.textContent = "Only the task owner can review this submission.";
        return;
    }
    primaryButton.disabled = true;
    if (secondaryButton) secondaryButton.disabled = true;
    try {
        await updateDoc(doc(db, "submissions", submission.id), { status: newStatus, reviewedAt: serverTimestamp() });
    } catch (error) {
        console.error("Submission review failed:", error);
        messageElement.textContent = "Unable to update work status: " + error.message;
        primaryButton.disabled = false;
        if (secondaryButton) secondaryButton.disabled = false;
    }
}

function startTaskListener() {
    if (stopTaskListener) {
        stopTaskListener();
        stopTaskListener = null;
    }

    const tasksQuery = query(
        collection(db, "tasks"),
        orderBy("createdAt", "desc")
    );

    stopTaskListener = onSnapshot(
        tasksQuery,
        snapshot => {
            firebaseTasks = snapshot.docs.map(document => ({
                ...document.data(),
                id: document.id
            }));

            renderFirebaseTasks();
            // Re-render reward amounts if task data arrives after submissions.
            renderRewardLedger(latestRewardSubmissionDocs);
        },
        error => {
            console.error("Task loading error:", error);

            createMessage.textContent =
                "Unable to load tasks. Please check your " +
                "login status and Firestore rules.";
        }
    );
}

createTaskForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!authenticatedUser) {
        createMessage.textContent =
            "Please log in before publishing a task.";
        return;
    }

    if (createTaskForm.dataset.submitting === "true") {
        return;
    }

    const title = document
        .getElementById("taskTitle")
        .value.trim();

    const description = document
        .getElementById("taskDescription")
        .value.trim();

    const category = document
        .getElementById("taskCategory")
        .value;

    const proposedReward = Number(
        document.getElementById("taskReward").value
    );

    if (title.length < 3 || title.length > 70) {
        createMessage.textContent =
            "The title must contain 3–70 characters.";
        return;
    }

    if (description.length < 10 || description.length > 1000) {
        createMessage.textContent =
            "The description must contain 10–1000 characters.";
        return;
    }

    if (!["digital", "skills", "local"].includes(category)) {
        createMessage.textContent = "Choose a valid category.";
        return;
    }

    if (
        !Number.isSafeInteger(proposedReward) ||
        proposedReward < 1 ||
        proposedReward > 10000
    ) {
        createMessage.textContent =
            "Enter a whole-number reward between ₹1 and ₹10,000.";
        return;
    }

    createTaskForm.dataset.submitting = "true";

    const submitButton = createTaskForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    createMessage.textContent = "Publishing task...";

    try {
        await authReady;

        const user = auth.currentUser;

        if (!user) {
            throw new Error("Please log in again.");
        }

        await callCreateTask({ title, description, category, proposedReward });

        createTaskForm.reset();

        createMessage.textContent =
            "Task proposal published successfully! " +
            "It is not funded and does not guarantee payment.";

        showExplore();

        }  catch (error) {
    console.error("Publishing task failed:", error);

    createMessage.textContent =
        "Error: " +
        (error.code || error.name || "unknown") +
        " — " +
        (error.message || "Unknown error");

    } finally {
        createTaskForm.dataset.submitting = "false";
        submitButton.disabled = false;
    }
});


/* START AND STOP REAL-TIME LISTENING */

onAuthStateChanged(auth, user => {
    startApplicationsListener(user);
    startApplicantApplicationsListener(user);
    startSubmissionListeners(user);


    if (user) {
        startTaskListener();
    } else {
        if (stopTaskListener) {
            stopTaskListener();
            stopTaskListener = null;
        }

        firebaseTasks = [];
        renderFirebaseTasks();
    }
});

/* ===================================
   EARNLOOP AUTHENTICATION
=================================== */






// ===================================
// PHASE 5: ADMIN & PLATFORM MANAGEMENT
// ===================================
const adminSection = document.getElementById("adminSection");
const adminNavButton = document.querySelector('[data-page="admin"]');
const adminMessage = document.getElementById("adminMessage");
const adminReportsList = document.getElementById("adminReportsList");
// Task moderation list is created in JS so the existing HTML file need not change.
let adminTaskModerationList = document.getElementById("adminTaskModerationList");
if (!adminTaskModerationList) {
  const moderationPanel = document.createElement("section");
  moderationPanel.className = "admin-task-moderation";
  moderationPanel.innerHTML = '<h3>Task moderation</h3><p class="muted">Hide open tasks or reopen hidden tasks.</p><div id="adminTaskModerationList"></div>';
  adminTaskModerationList = moderationPanel.querySelector("#adminTaskModerationList");
  const reportsHeading = adminReportsList.closest("section") || adminReportsList.parentElement;
  if (reportsHeading && reportsHeading.parentElement === adminSection) {
    adminSection.insertBefore(moderationPanel, reportsHeading);
  } else {
    adminSection.appendChild(moderationPanel);
  }
}
const adminStats = {
  tasks: document.getElementById("adminOpenTasks"),
  applications: document.getElementById("adminApplications"),
  submissions: document.getElementById("adminSubmissions"),
  reports: document.getElementById("adminOpenReports")
};
let currentUserIsAdmin = false;

function showAdmin() {
  if (!currentUserIsAdmin) {
    alert("Admin access is restricted.");
    return;
  }
  document.querySelector(".welcome").hidden = true;
  document.querySelector(".wallet-card").hidden = true;
  document.querySelector(".how-it-works").hidden = true;
  document.querySelectorAll(".section").forEach(section => { section.hidden = true; });
  createSection.hidden = true;
  applicationsSection.hidden = true;
  adminSection.hidden = false;
  adminSection.scrollIntoView({ behavior: "smooth" });
  loadAdminDashboard();
}

async function loadAdminDashboard() {
  if (!auth.currentUser || !currentUserIsAdmin) return;
  adminMessage.textContent = "Loading platform data…";
  adminReportsList.replaceChildren();
  try {
    const [tasksSnap, applicationsSnap, submissionsSnap, reportsSnap] = await Promise.all([
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "applications")),
      getDocs(collection(db, "submissions")),
      getDocs(query(collection(db, "reports"), where("status", "==", "open")))
    ]);
    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    adminStats.tasks.textContent = String(allTasks.filter(task => task.status === "open").length);
    renderAdminTaskModeration(allTasks);
    adminStats.applications.textContent = String(applicationsSnap.size);
    adminStats.submissions.textContent = String(submissionsSnap.size);
    adminStats.reports.textContent = String(reportsSnap.size);

    if (reportsSnap.empty) {
      adminMessage.textContent = "Task moderation list refreshed. No open task reports.";
      return;
    }
    const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    reports.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    reports.forEach(report => {
      const card = document.createElement("article");
      card.className = "admin-report-card";
      const heading = document.createElement("h4");
      heading.textContent = report.taskTitle || "Reported task";
      const details = document.createElement("p");
      details.textContent = `Task ID: ${report.taskId || "unknown"} · Reported ${formatAuditTime(report.createdAt)}`;
      const reporter = document.createElement("p");
      reporter.textContent = `Reporter: ${report.reporterEmail || report.reporterId || "unknown"}`;
      const reason = document.createElement("p");
      reason.textContent = `Reason: ${report.reason || "No reason supplied"}`;
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      const reviewButton = document.createElement("button");
      reviewButton.type = "button";
      reviewButton.className = "task-button";
      reviewButton.textContent = "Mark reviewed";
      reviewButton.addEventListener("click", () => updateReportStatus(report, "reviewed", reviewButton));
      const hideButton = document.createElement("button");
      hideButton.type = "button";
      hideButton.className = "task-button danger-button";
      hideButton.textContent = "Hide reported task";
      hideButton.addEventListener("click", async () => {
        if (!confirm("Hide this task from the open-task feed? This is a moderation action, not a finding that the report is proven.")) return;
        hideButton.disabled = true;
        try {
          await updateDoc(doc(db, "tasks", report.taskId), {
            status: "hidden",
            moderatedAt: serverTimestamp(),
            moderatedBy: auth.currentUser.uid
          });
          await updateReportStatus(report, "reviewed", reviewButton, false);
          adminMessage.textContent = "Task hidden from the open-task feed and report marked reviewed.";
          await loadAdminDashboard();
        } catch (error) {
          console.error("Task moderation failed:", error);
          adminMessage.textContent = "Moderation failed. Check custom claims and Firestore rules.";
          hideButton.disabled = false;
        }
      });
      actions.append(reviewButton, hideButton);
      card.append(heading, details, reporter, reason, actions);
      adminReportsList.appendChild(card);
    });
    adminMessage.textContent = `Loaded ${reports.length} open report(s). Review each report fairly.`;
  } catch (error) {
    console.error("Admin dashboard load failed:", error);
    adminMessage.textContent = "Unable to load admin data. Verify admin custom claim and Phase 5 Firestore rules.";
  }
}

function renderAdminTaskModeration(tasks) {
  if (!adminTaskModerationList) return;
  adminTaskModerationList.replaceChildren();
  tasks.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.textContent = "No tasks have been created yet.";
    adminTaskModerationList.appendChild(empty);
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement("article");
    card.className = "admin-report-card";
    const heading = document.createElement("h4");
    heading.textContent = task.title || "Untitled task";
    const details = document.createElement("p");
    details.textContent = `Task ID: ${task.id} · Status: ${task.status || "unknown"} · Created ${formatAuditTime(task.createdAt)}`;
    const actions = document.createElement("div");
    actions.className = "admin-actions";
    const status = task.status;

    if (status === "open" || status === "hidden") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = status === "open" ? "task-button danger-button" : "task-button";
      button.textContent = status === "open" ? "Hide task" : "Reopen task";
      button.addEventListener("click", async () => {
        const nextStatus = status === "open" ? "hidden" : "open";
        const verb = nextStatus === "hidden" ? "hide" : "reopen";
        if (!confirm(`Are you sure you want to ${verb} “${task.title || "this task"}”?`)) return;
        button.disabled = true;
        try {
          await updateDoc(doc(db, "tasks", task.id), {
            status: nextStatus,
            moderatedAt: serverTimestamp(),
            moderatedBy: auth.currentUser.uid
          });
          adminMessage.textContent = nextStatus === "open"
            ? "Task reopened and returned to the public marketplace."
            : "Task hidden from the public marketplace.";
          await loadAdminDashboard();
        } catch (error) {
          console.error(`Could not ${verb} task:`, error);
          adminMessage.textContent = `Could not ${verb} task. Confirm the latest Firestore rules are published and this account has the admin custom claim.`;
          button.disabled = false;
        }
      });
      actions.appendChild(button);
    } else {
      const note = document.createElement("span");
      note.textContent = "No moderation action for this status";
      actions.appendChild(note);
    }
    card.append(heading, details, actions);
    adminTaskModerationList.appendChild(card);
  });
}

async function updateReportStatus(report, status, button, refresh = true) {
  if (!currentUserIsAdmin || !auth.currentUser) return;
  if (button) button.disabled = true;
  try {
    await updateDoc(doc(db, "reports", report.id), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser.uid
    });
    adminMessage.textContent = `Report marked ${status}.`;
    if (refresh) await loadAdminDashboard();
  } catch (error) {
    console.error("Report review failed:", error);
    adminMessage.textContent = "Could not update report. Verify the Phase 5 rules are published.";
    if (button) button.disabled = false;
  }
}

document.getElementById("refreshAdminButton").addEventListener("click", loadAdminDashboard);

async function configureAdminAccess(user) {
  currentUserIsAdmin = false;
  adminNavButton.hidden = true;
  adminSection.hidden = true;
  if (!user) return;
  try {
    const tokenResult = await user.getIdTokenResult(true);
    currentUserIsAdmin = tokenResult.claims.admin === true;
    adminNavButton.hidden = !currentUserIsAdmin;
    if (currentUserIsAdmin) adminMessage.textContent = "Admin access verified by Firebase custom claim.";
  } catch (error) {
    console.error("Unable to verify admin claim:", error);
  }
}

const authSection = document.getElementById("authSection");
const authForm = document.getElementById("authForm");
const authHeading = document.getElementById("authHeading");
const authDescription = document.getElementById("authDescription");
const authSubmit = document.getElementById("authSubmit");
const authSwitch = document.getElementById("authSwitch");
const authMessage = document.getElementById("authMessage");
const profileButton = document.getElementById("profileButton");

let authMode = "register";
let authenticatedUser = null;
let authInitialized = false;

function showAuthScreen() {
    authSection.hidden = false;

    document.querySelector(".welcome").hidden = true;
    document.querySelector(".wallet-card").hidden = true;
    document.querySelector(".how-it-works").hidden = true;

    document.querySelectorAll(".section").forEach(section => {
        section.hidden = true;
    });

    authSection.scrollIntoView({ behavior: "smooth" });
}

function hideAuthScreen() {
    authSection.hidden = true;
}

function updateAuthMode() {
    const registering = authMode === "register";

    authHeading.textContent = registering
        ? "Create your account"
        : "Welcome back";

    authDescription.textContent = registering
        ? "Join EarnLoop to explore opportunities."
        : "Log in to access your EarnLoop account.";

    authSubmit.textContent = registering
        ? "Create account"
        : "Log in";

    authSwitch.textContent = registering
        ? "Already have an account? Log in"
        : "New to EarnLoop? Create an account";

    document.getElementById("authPassword").autocomplete =
        registering ? "new-password" : "current-password";

    authMessage.textContent = "";
}

authSwitch.addEventListener("click", () => {
    authMode = authMode === "register"
        ? "login"
        : "register";

    updateAuthMode();
});

const accountMenu = document.getElementById("accountMenu");
const accountMenuMessage = document.getElementById("accountMenuMessage");

profileButton.setAttribute("aria-haspopup", "menu");
profileButton.setAttribute("aria-expanded", "false");

profileButton.addEventListener("click", () => {
    accountMenu.hidden = !accountMenu.hidden;
    profileButton.setAttribute("aria-expanded", String(!accountMenu.hidden));
    accountMenuMessage.textContent = "";
});

document.addEventListener("click", event => {
    if (!accountMenu.hidden && !accountMenu.contains(event.target) && event.target !== profileButton) {
        accountMenu.hidden = true;
        profileButton.setAttribute("aria-expanded", "false");
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        accountMenu.hidden = true;
        profileButton.setAttribute("aria-expanded", "false");
    }
});

accountMenu.querySelectorAll("[data-account-action]").forEach(button => {
    button.addEventListener("click", async () => {
        const action = button.dataset.accountAction;
        const user = auth.currentUser;
        if (action === "signout") {
            if (!user) {
                authMode = "login"; updateAuthMode(); showAuthScreen(); return;
            }
            if (!confirm("Sign out of EarnLoop on this device?")) return;
            try { await signOut(auth); accountMenu.hidden = true; }
            catch (error) { accountMenuMessage.textContent = "Unable to sign out. Please try again."; }
            return;
        }
        if (!user) {
            accountMenuMessage.textContent = "Log in first to manage account settings.";
            authMode = "login"; updateAuthMode(); showAuthScreen(); return;
        }
        if (action === "settings") {
            accountMenuMessage.textContent = `Signed in as ${user.email || "your account"}. User ID: ${user.uid}.`;
            return;
        }
        if (action === "privacy") {
            accountMenuMessage.textContent = "Use a unique password, keep your email secure, and never share verification codes. Deletion requests are reviewed before any account/data removal.";
            return;
        }
        if (action === "deletion-status") {
            try {
                accountMenuMessage.textContent = "Checking your deletion request status...";
                const getStatus = httpsCallable(functions, "getAccountDeletionStatus");
                const result = await getStatus({});
                const data = result.data || {};
                if (!data.exists || data.status === "not_requested") {
                    accountMenuMessage.textContent = "Status: No deletion request found for this account.";
                    return;
                }
                const labels = {
                    requested: "REQUESTED — waiting for authorized review.",
                    needs_review: "NEEDS REVIEW — the request is on hold. Open disputes must be resolved or an administrator must review it.",
                    approved: "APPROVED — waiting for secure processing.",
                    processing: "PROCESSING — deletion is in progress.",
                    completed: "COMPLETED — the deletion processor reported completion.",
                    failed: "FAILED — an administrator must inspect the failure and retry safely if appropriate.",
                    rejected: "REJECTED — the deletion request was not approved."
                };
                const label = labels[data.status] || `STATUS: ${String(data.status || "unknown").toUpperCase()}.`;
                const updated = data.updatedAt ? ` Last updated: ${new Date(data.updatedAt).toLocaleString()}.` : "";
                const disputes = data.openDisputeCount ? ` Open disputes: ${data.openDisputeCount}.` : "";
                accountMenuMessage.textContent = `Deletion request: ${label}${disputes}${updated}`;
            } catch (error) {
                console.error("Could not load deletion request status:", error);
                accountMenuMessage.textContent = error.code === "functions/not-found" || error.code === "functions/unavailable"
                    ? "Status service is not deployed yet. Your existing request has not been changed."
                    : "Could not load request status. Check Cloud Functions deployment and try again.";
            }
            return;
        }
        if (action === "recovery") {
            if (!user.email) { accountMenuMessage.textContent = "This account has no email address for password recovery. Sign in again using your original provider."; return; }
            try {
                await sendPasswordResetEmail(auth, user.email);
                accountMenuMessage.textContent = `Password reset email sent to ${user.email}. Your account is still active.`;
            } catch (error) {
                console.error("Password recovery email failed:", error);
                accountMenuMessage.textContent = error.code === "auth/too-many-requests" ? "Too many attempts. Please wait and try again." : "Could not send a recovery email. Check Firebase Authentication email/password settings.";
            }
            return;
        }
        if (action === "delete") {
            const confirmed = confirm("Request deletion of your EarnLoop account? This will NOT delete your account immediately. Open disputes may place the request on hold, and an authorized review is required. You will need to re-authenticate.");
            if (!confirmed) return;
            const passwordProvider = user.providerData.some(provider => provider.providerId === "password");
            if (passwordProvider) {
                const password = prompt("For security, enter your current password to re-authenticate. Your password is not saved.");
                if (password === null) return;
                try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password)); }
                catch (error) { accountMenuMessage.textContent = error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" ? "Password did not match. No deletion request was sent." : "Re-authentication failed. No deletion request was sent."; return; }
            } else {
                accountMenuMessage.textContent = "For accounts using Google or another provider, sign out and sign in again before requesting deletion. Then reopen this menu.";
                return;
            }
            try {
                const functions = getFunctions(auth.app);
                const requestDeletion = httpsCallable(functions, "requestAccountDeletion");
                accountMenuMessage.textContent = "Submitting your request securely...";
                const result = await requestDeletion({});
                const status = result.data?.status || "requested";
                const statusLabels = {
                    requested: "REQUESTED — waiting for authorized review.",
                    needs_review: "NEEDS REVIEW — placed on hold because an open dispute needs review.",
                    approved: "APPROVED — waiting for secure processing.",
                    processing: "PROCESSING — deletion is in progress.",
                    completed: "COMPLETED — the processor reported completion.",
                    failed: "FAILED — an administrator must review and retry safely if appropriate.",
                    rejected: "REJECTED — the request was not approved."
                };
                accountMenuMessage.textContent = `Deletion request status: ${statusLabels[status] || String(status).toUpperCase()}. Your account remains active unless the authorized deletion workflow completes.`;
            } catch (error) {
                console.error("Account deletion request failed:", error);
                accountMenuMessage.textContent = error.code === "functions/not-found" || error.code === "functions/unavailable"
                    ? "Deletion request service is not deployed/configured yet. No account data was deleted."
                    : error.code === "functions/failed-precondition"
                        ? "Please sign in again, then retry the request. No account data was deleted."
                        : "Could not submit the request. No account data was deleted. Check Cloud Functions deployment and logs.";
            }
        }
    });
});

authForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (authSubmit.disabled) return;

    const email = document.getElementById("authEmail")
        .value.trim();

    const password = document.getElementById("authPassword")
        .value;

    if (password.length < 8) {
        authMessage.textContent =
            "Use a password containing at least 8 characters.";
        return;
    }

    authSubmit.disabled = true;
    authMessage.textContent = "Please wait...";

    try {
        await authReady;

        if (authMode === "register") {
            const credential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            /*
             * The profile write is attempted after account creation.
             * If Firestore denies this write, authentication may still
             * succeed. We report that separately.
             */
            try {
                await setDoc(
                    doc(db, "users", credential.user.uid),
                    {
                        email: credential.user.email,
                        createdAt: serverTimestamp(),
                        role: "user"
                    }
                );
            } catch (profileError) {
                console.error(
                    "Profile creation failed:",
                    profileError
                );

                authMessage.textContent =
                    "Your account was created, but the profile " +
                    "could not be saved. Check Firestore rules.";
                return;
            }

            authMessage.textContent =
                "Account created successfully.";
        } else {
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            authMessage.textContent =
                "Logged in successfully.";
        }
    } catch (error) {
        console.error("Authentication error:", error);

        const messages = {
            "auth/email-already-in-use":
                "This email already has an account. Please log in.",

            "auth/invalid-email":
                "Enter a valid email address.",

            "auth/invalid-credential":
                "Email or password is incorrect.",

            "auth/weak-password":
                "Choose a stronger password.",

            "auth/network-request-failed":
                "Network error. Check your internet connection.",

            "permission-denied":
                "Firestore access was denied. Rules need configuration."
        };

        authMessage.textContent =
            messages[error.code] ||
            "Unable to complete the request. Please try again.";
    } finally {
        authSubmit.disabled = false;
    }
});

onAuthStateChanged(auth, async user => {
    authenticatedUser = user;
    await configureAdminAccess(user);

    if (!user) {
        profileButton.textContent = "👤";
    } else {
        profileButton.textContent = "☰";
    }

    if (!authInitialized) {
        authInitialized = true;
    }

    if (user) {
        hideAuthScreen();

        document.querySelector(".welcome").hidden = false;
        document.querySelector(".wallet-card").hidden = false;

        document.querySelectorAll(".section").forEach(section => {
            section.hidden = false;
        });

        document.querySelector(".how-it-works").hidden = false;
    }
});

updateAuthMode();
