import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


import {
    collection,
    doc,
    setDoc,
    addDoc,
    getDoc,
    serverTimestamp,
    onSnapshot,
    query,
    orderBy,
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


import { auth, db, authReady } from "./firebase.js";
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
        "Example reward: " + formatRupees(currentTask.reward);

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

    firebaseTasks.forEach(task => {
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

        rewardBox.append(label, reward);

        const button = document.createElement("button");
        button.className = "task-button";
        button.textContent = "View task";

        button.addEventListener("click", () => {
            openFirebaseTask(task);
        });

        footer.append(rewardBox, button);

        card.append(top, title, description, owner, footer);

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
        "Proposed reward: ₹" + task.proposedReward;

    modalMessage.textContent =
        "This is an unfunded task proposal. " +
        "No cash payment is currently guaranteed.";

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

            await setDoc(applicationRef, {
                taskId: task.id,
                taskTitle: task.title,
                ownerId: task.ownerId,
                applicantId: user.uid,
                applicantEmail: user.email,
                message: message,
                status: "pending",
                createdAt: serverTimestamp()
            });

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
                card.className = "application-card";

                const title = document.createElement("h3");
                title.textContent = application.taskTitle;

                const applicant = document.createElement("p");
                applicant.textContent =
                    "Applicant: " + application.applicantEmail;

                const message = document.createElement("p");
                message.textContent =
                    "Message: " + application.message;

                const status = document.createElement("span");
                status.className = "application-status";
                status.textContent =
                    "Status: " + application.status;

                card.append(title, applicant, message, status);

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

        await addDoc(collection(db, "tasks"), {
            title,
            description,
            category,
            proposedReward,
            ownerId: user.uid,
            ownerEmail: user.email,
            createdAt: serverTimestamp(),
            status: "open",
            funded: false
        });

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

profileButton.addEventListener("click", async () => {
    if (authenticatedUser) {
        const shouldLogout = confirm(
            "Log out of EarnLoop?"
        );

        if (!shouldLogout) return;

        try {
            await signOut(auth);
        } catch (error) {
            alert("Unable to log out. Please try again.");
        }

        return;
    }

    authMode = "register";
    updateAuthMode();
    showAuthScreen();
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

    if (!user) {
        profileButton.textContent = "👤";
    } else {
        profileButton.textContent = "↪";
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
