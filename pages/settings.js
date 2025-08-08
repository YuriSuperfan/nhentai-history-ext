import {makeCover, scrapInfo, tagTypes} from "../utils.js";

const infoTypes = ["Pages", ...tagTypes.map((tagType) => tagType.pluralCap)];

const readValues = document.querySelector("#read-values");
const minPages = document.querySelector("#min-pages");
const minPercent = document.querySelector("#min-percent");
const readValuesSubmit = readValues.querySelector("button");
const pauseHistory = document.querySelector("#pause-history");
const showRecordIcon = document.querySelector("#show-record-icon");
const clearCache = document.querySelector("#clear-cache");
const coverPreview = document.querySelector("#cover-preview");
const entryCount = document.querySelector("#entry-count");
const entryCountForm = document.querySelector("#entry-count-form");
const entryCountSubmit = entryCountForm.querySelector("button");

let galleryInfo = undefined;

async function displaySettings(settings) {
    if (galleryInfo === undefined) {
        const res = await scrapInfo("526494");
        if (res.ok) {
            galleryInfo = res.data;
        } else {
            return;
        }
    }
    minPages.value = settings.minPages;
    minPercent.value = settings.minPercent;
    pauseHistory.checked = settings.pauseHistory;
    showRecordIcon.checked = settings.showRecordIcon;
    infoTypes.forEach((infoType) => {
        document.querySelector(`#hide-${infoType}`).checked = settings[`display${infoType}`]
    });
    entryCount.value = settings.searchEntryCount;

    coverPreview.innerHTML = "";
    coverPreview.appendChild(makeCover(galleryInfo, settings));
}

function setStatus(message) {
    let statusBox = document.getElementById("status-area");
    if (statusBox === null) {
        statusBox = document.createElement("div");
        statusBox.id = "status-area";
        statusBox.className = "section";
        statusBox.innerHTML = `<div class="subsetting column"><h3>Info</h3><p></p></div>`;
        document.querySelector("#content").appendChild(statusBox);
    }

    statusBox.querySelector("p").textContent = message;
}

entryCountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newValue = entryCount.value === "" ? NaN : parseInt(entryCount.value);
    if (!isNaN(newValue)) {
        entryCountSubmit.disabled = true;
        const response = await chrome.runtime.sendMessage({
            type: "updateSettings", data: {searchEntryCount: newValue}
        });

        if (response.status === "ok") {
            displaySettings(response.settings);
        }
        entryCountSubmit.disabled = false;
        setStatus("Settings updated !");
    }
});

readValues.addEventListener("submit", async (e) => {
    e.preventDefault();
    readValuesSubmit.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {
            minPages: minPages.value === "" ? undefined : parseInt(minPages.value),
            minPercent: minPercent.value === "" ? undefined : parseInt(minPercent.value)
        }
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    readValuesSubmit.disabled = false;
    setStatus("Settings updated !");
});

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

clearCache.addEventListener("click", () => {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.url && new URL(tab.url).hostname === "nhentai.net") {
                chrome.tabs.sendMessage(tab.id, {
                    type: "clearCache",
                });
            }
        }
    });
    setStatus(`Cleared reading cache !`);
})

function setupInformation() {
    const container = document.querySelector("#hide-content");
    infoTypes.forEach((infoType) => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" id="hide-${infoType}"/>${infoType}`;

        const input = label.querySelector("input");
        input.addEventListener("change", async () => {
            input.disabled = true;
            const data = {};
            data[`display${infoType}`] = input.checked;
            const response = await chrome.runtime.sendMessage({
                type: "updateSettings", data
            });

            if (response.status === "ok") {
                displaySettings(response.settings);
            }
            input.disabled = false;
            setStatus(`${infoType} will ${input.checked ? "" : "not"} be shown !`);
        });
        container.appendChild(label);
    });
}

setupInformation();

chrome.runtime.sendMessage({type: "getSettings"}).then((response) => {
    if (response.status === "ok") {
        displaySettings(response.settings);
    } else {
        console.warn("Could not get settings because of", response.reason);
    }
});