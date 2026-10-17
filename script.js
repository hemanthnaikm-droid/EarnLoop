const taskList = document.getElementById("taskList");
const taskModal = document.getElementById("taskModal");

const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalReward = document.getElementById("modalReward");
const modalMessage = document.getElementById("modalMessage");

const balanceElement = document.getElementById("balance");
const completedElement = document.getElementById("completedCount");
const pendingElement = document.getElementById("pendingBalance");

let currentTask = null;
let completedTasks = 0;
let demoBalance = 0;

const completedTaskIds = new Set();

const descriptions = {
    "Test a Website":
        "Explore a website and report usability problems. A real task would include the customer’s website, acceptance criteria, deadline, and funded reward.",

    "Write a Caption":
        "Create a useful social media caption for a business. A real task would include the content brief, word limit, and approval criteria.",

    "Verify Business Details":
        "Check publicly available business information. A real task would specify which details need verification and what evidence is acceptable."
};

function formatRupees(amount) {
    return "₹" + amount.toFixed(2);
}

function openTask(button) {
    currentTask = {
        id: button.dataset.task,
        reward: Number(button.dataset.reward)
    };

    modalTitle.textContent = currentTask.id;

    modalDescription.textContent =
        descriptions[currentTask.id] || "Sample task details.";

    modalReward.textContent =
        "Example reward: " + formatRupees(currentTask.reward);

    modalMessage.textContent = "";

    document.getElementById("demoComplete").disabled =
        completedTaskIds.has(currentTask.id);

    document.getElementById("demoComplete").textContent =
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
            "Demo complete! The test balance has increased. " +
            "This is not real money and cannot be withdrawn.";

        document.getElementById("demoComplete").disabled = true;

        document.getElementById("demoComplete").textContent =
            "Already simulated";
    });

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;

        document.querySelectorAll(".category").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        document.querySelectorAll(".task-card").forEach(card => {
            const matches =
                category === "all" ||
                card.dataset.category === category;

            card.hidden = !matches;
        });
    });
});

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.toggle("selected", item === button);
        });

        if (page === "home") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (page === "explore") {
            document.querySelector(".section").scrollIntoView({
                behavior: "smooth"
            });
        } else if (page === "create") {
            alert("Create Tasks will be implemented in Part 2.");
        } else if (page === "wallet") {
            document.querySelector(".wallet-card").scrollIntoView({
                behavior: "smooth"
            });
        }
    });
});

pendingElement.textContent = formatRupees(0);
