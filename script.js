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
