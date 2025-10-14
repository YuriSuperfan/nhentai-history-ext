const pauseHistory = document.querySelector("#pause-history");
const showRecordIcon = document.querySelector("#show-record-icon");
const clearCache = document.querySelector("#clear-cache");

function displaySettings(settings) {
    pauseHistory.checked = settings.pauseHistory;
    showRecordIcon.checked = settings.showRecordIcon;
}

function displayLatest(latest) {
    const latestArea = document.querySelector("#latest-area");
    latest.forEach((entry) => {
        const el = document.createElement("div");
        el.className = "latest-entry";
        el.innerHTML = `
            <span title="${entry.title}">${entry.title}</span>
            <button>Remove</button>`;

        const button = el.querySelector("button");
        const span = el.querySelector("span");
        let loading = false;
        let deleted = false;
        let restoreData = undefined;

        button.addEventListener("click", async (e) => {
            if (loading) {
                return;
            }
            loading = true;
            e.preventDefault();
            e.stopPropagation();
            if (!deleted) {
                const response = await chrome.runtime.sendMessage({
                    type: "deleteRead", data: entry.readId
                });
                if (response.status === "ok") {
                    button.innerText = "Restore";
                    restoreData = response.restoreData;
                    deleted = true;
                    span.classList.add("deleted");
                }
            } else {
                const response = await chrome.runtime.sendMessage({
                    type: "restoreRead", data: restoreData
                });
                if (response.status === "ok") {
                    button.innerText = "Remove";
                    restoreData = undefined;
                    deleted = false;
                    span.classList.remove("deleted");
                }
            }
            loading = false;
        });

        latestArea.appendChild(el);
    })
}

function setStatus(message) {
    let statusBox = document.getElementById("status-area");
    if (statusBox === null) {
        statusBox = document.createElement("div");
        statusBox.id = "status-area";
        statusBox.className = "subsection";
        statusBox.innerHTML = `<h3>Info</h3><p></p>`;
        document.body.appendChild(statusBox);
    }

    statusBox.querySelector("p").textContent = message;
}

pauseHistory.addEventListener("change", async (e) => {
    e.preventDefault();
    pauseHistory.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {pauseHistory: pauseHistory.checked}
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    pauseHistory.disabled = false;
    setStatus(`History recording ${pauseHistory.checked ? "paused" : "resumed"} !`);
});

showRecordIcon.addEventListener("change", async (e) => {
    e.preventDefault();
    showRecordIcon.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {showRecordIcon: showRecordIcon.checked}
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    showRecordIcon.disabled = false;
    setStatus(`Record icon will ${showRecordIcon.checked ? "" : "not"} be shown !`);
});

clearCache.addEventListener("click", async () => {
    const {clearCache} = await import(chrome.runtime.getURL("utils.js"))
    await clearCache();
    setStatus(`Cleared reading cache !`);
})

chrome.runtime.sendMessage({type: "getSettings"}).then((response) => {
    if (response.status === "ok") {
        displaySettings(response.settings);
    }
});

chrome.runtime.sendMessage({type: "getLatest"}).then((response) => {
    if (response.status === "ok") {
        displayLatest(response.latest);
    }
});