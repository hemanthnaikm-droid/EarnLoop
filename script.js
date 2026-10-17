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
        "Proposed reward: " + formatRupees(currentTask.reward);

    modalMessage.textContent = "";

    const completeButton = document.getElementById("demoComplete");

    completeButton.disabled = completedTaskIds.has(currentTask.id);

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

        getTaskCards().forEach(card => {
            card.hidden =
                category !== "all" &&
                card.dataset.category !== category;
        });
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
    });
});

/* CREATE AND PUBLISH DEMO TASKS */

createTaskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = document.getElementById("taskTitle")
        .value.trim();

    const description = document.getElementById("taskDescription")
        .value.trim();

    const category = document.getElementById("taskCategory").value;

    const reward = Number(
        document.getElementById("taskReward").value
    );

    if (!title || !description) {
        createMessage.textContent =
            "Enter both a task title and description.";
        return;
    }

    if (!Number.isSafeInteger(reward) || reward < 1 || reward > 10000) {
        createMessage.textContent =
            "Enter a whole-number reward between ₹1 and ₹10,000.";
        return;
    }

    const taskId =
        "demo-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 8);

    const card = document.createElement("article");
    card.className = "task-card";
    card.dataset.category = category;

    const top = document.createElement("div");
    top.className = "task-top";

    const icon = document.createElement("span");
    icon.className = "task-icon";
    icon.textContent =
        category === "digital" ? "🌐" :
        category === "skills" ? "✍️" : "📍";

    const type = document.createElement("span");
    type.className = "task-type";
    type.textContent = category.toUpperCase();

    top.append(icon, type);

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    const footer = document.createElement("div");
    footer.className = "task-footer";

    const rewardContainer = document.createElement("div");

    const label = document.createElement("span");
    label.className = "reward-label";
    label.textContent = "Proposed reward";

    const amount = document.createElement("strong");
    amount.className = "reward";
    amount.textContent = "₹" + reward;

    rewardContainer.append(label, amount);

    const viewButton = document.createElement("button");
    viewButton.className = "task-button";
    viewButton.textContent = "View task";

    viewButton.dataset.taskId = taskId;
    viewButton.dataset.task = title;
    viewButton.dataset.description = description;
    viewButton.dataset.reward = String(reward);

    viewButton.addEventListener("click", () => {
        openTask(viewButton);
    });

    footer.append(rewardContainer, viewButton);

    card.append(top, heading, paragraph, footer);

    taskList.prepend(card);

    createTaskForm.reset();

    createMessage.textContent =
        "Demo task published! It is visible in Explore. " +
        "No customer funding or real payment is attached.";

    document.querySelectorAll(".category").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.category === "all"
        );
    });

    getTaskCards().forEach(item => {
        item.hidden = false;
    });

    showExplore();
});

pendingElement.textContent = formatRupees(0);


/* ===================================
   EARNLOOP AUTHENTICATION
=================================== */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { auth, db, authReady } from "./firebase.js";

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
