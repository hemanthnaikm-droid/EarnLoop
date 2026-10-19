import { auth, db, authReady } from "./firebase.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const $ = (id) => document.getElementById(id);

const panel = $("notificationPanel");
const button = $("notificationButton");
const badge = $("notificationBadge");
const list = $("notificationList");
const message = $("notificationMessage");

const functions = getFunctions(auth.app);
const markNotificationRead = httpsCallable(
    functions,
    "markNotificationRead"
);

let currentUser = null;
let stopNotifications = null;
let notifications = [];

function setMessage(text) {
    message.textContent = text;
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Just now";
    }

    return timestamp.toDate().toLocaleString();
}

function updateBadge() {
    const unread = notifications.filter((item) => !item.read).length;

    badge.textContent = unread > 99 ? "99+" : String(unread);
    badge.hidden = unread === 0;

    button.setAttribute(
        "aria-label",
        unread ? `${unread} unread notifications` : "Open notifications"
    );
}

function renderNotifications() {
    list.replaceChildren();

    if (!notifications.length) {
        const empty = document.createElement("p");
        empty.className = "notification-empty";
        empty.textContent = "You're all caught up. No notifications yet.";
        list.appendChild(empty);
        return;
    }

    for (const item of notifications) {
        const card = document.createElement("article");
        card.className =
            "notification-item" + (item.read ? "" : " unread");

        const heading = document.createElement("h3");
        heading.textContent = item.title || "EarnLoop update";

        const body = document.createElement("p");
        body.textContent = item.message || item.body || "You have a new update.";

        const date = document.createElement("small");
        date.textContent = formatDate(item.createdAt);

        card.append(heading, body, date);

        if (!item.read) {
            const readButton = document.createElement("button");
            readButton.type = "button";
            readButton.className = "task-button";
            readButton.textContent = "Mark as read";

            readButton.addEventListener("click", async () => {
    readButton.disabled = true;

    try {
        await updateDoc(
            doc(db, "users", currentUser.uid, "notifications", item.id),
            { read: true }
        );
    } catch (error) {
        console.error("Mark notification read failed:", error);
        setMessage(
            `Could not mark as read: ${error.code || error.message}`
        );
        readButton.disabled = false;
    }
});

            card.appendChild(readButton);
        }

        list.appendChild(card);
    }
}

function stopListening() {
    if (stopNotifications) {
        stopNotifications();
        stopNotifications = null;
    }

    notifications = [];
    updateBadge();
    list.replaceChildren();
}

function startListening(user) {
    stopListening();

    if (!user) {
        setMessage("Sign in to view your notifications.");
        return;
    }

    setMessage("Loading notifications...");

    const notificationsQuery = query(
    collection(db, "users", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(50)
);

    stopNotifications = onSnapshot(
        notificationsQuery,
        (snapshot) => {
            notifications = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

            updateBadge();
            renderNotifications();

            setMessage(
                notifications.length
                    ? `${notifications.length} recent notification(s).`
                    : "No notifications yet."
            );
        },
        (error) => {
            console.error("Notification listener failed:", error);
            setMessage(
                "Unable to load notifications. Check your connection and access."
            );
        }
    );
}

button.addEventListener("click", () => {
    if (!currentUser) {
        setMessage("Please sign in to view notifications.");
        panel.hidden = false;
        return;
    }

    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
});

$("closeNotifications").addEventListener("click", () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.focus();
    }
});

await authReady;

onAuthStateChanged(auth, (user) => {
    currentUser = user;

    if (!user) {
        stopListening();
        setMessage("Sign in to view your notifications.");
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        return;
    }

    startListening(user);
});