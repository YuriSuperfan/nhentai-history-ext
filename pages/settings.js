import {fetchInfo, formatEpoch, makeCover, tagTypes} from "../utils.js";

import '../lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: `galleryId, *parodies, *characters, *tags, *artists, *languages, readCount`,
    reads: `readId, blobId, galleryId, timestamp, [galleryId+timestamp]`,
    blobs: `blobId, endTime`,
    parodies: `value, readCount`,
    characters: `value, readCount`,
    tags: `value, readCount`,
    artists: `value, readCount`,
    languages: `value, readCount`,
});

const infoTypes = [...tagTypes.map((tagType) => tagType.pluralCap), "Pages"];

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
        const res = await fetchInfo("526494");
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
        document.querySelector(`#hide-${infoType}`).checked = settings[`display${infoType}`];
    });
    entryCount.value = settings.searchEntryCount;

    coverPreview.innerHTML = "";
    coverPreview.appendChild(makeCover(galleryInfo, settings));
}

let statusTimeout = undefined;

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

    if (statusTimeout !== undefined) {
        clearTimeout(statusTimeout);
    }
    statusTimeout = setTimeout(() => {
        document.querySelector("#status-area").remove();
        statusTimeout = undefined;
    }, 5 * 1000);
}

entryCountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newValue = entryCount.value === "" ? NaN : parseInt(entryCount.value);
    if (!isNaN(newValue)) {
        entryCountSubmit.disabled = true;
        const response = await chrome.runtime.sendMessage({
            type: "updateSettings", data: {searchEntryCount: newValue},
        });

        if (response.status === "ok") {
            displaySettings(response.settings);
        }
        entryCountSubmit.disabled = false;
        setStatus("Default search count updated !");
    }
});

readValues.addEventListener("submit", async (e) => {
    e.preventDefault();
    readValuesSubmit.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {
            minPages: minPages.value === "" ? undefined : parseInt(minPages.value),
            minPercent: minPercent.value === "" ? undefined : parseInt(minPercent.value),
        },
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    readValuesSubmit.disabled = false;
    setStatus("Recording settings updated !");
});

pauseHistory.addEventListener("change", async (e) => {
    e.preventDefault();
    pauseHistory.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {pauseHistory: pauseHistory.checked},
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
        type: "updateSettings", data: {showRecordIcon: showRecordIcon.checked},
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    showRecordIcon.disabled = false;
    setStatus(`Record icon will ${showRecordIcon.checked ? "" : "not"} be shown !`);
});

clearCache.addEventListener("click", async () => {
    const {clearCache} = await import(chrome.runtime.getURL("utils.js"));
    await clearCache();
    setStatus(`Cleared reading cache !`);
});

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
                type: "updateSettings", data,
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


function download(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

document.querySelector("#export-btn").addEventListener("click", async () => {
    const galleries = await db.table("galleries").toArray();
    const reads = await db.table("reads").toArray();
    const blobs = await db.table("blobs").toArray();

    download(`nhentai-history-backup-${formatEpoch(Date.now()).replace(" ", "_").replace(":", "-")}`, JSON.stringify({
        galleries,
        reads,
        blobs,
    }));
});

async function insert(data, tableName) {
    try {
        await db.transaction('rw', db[tableName], async () => {
            await db[tableName].bulkPut(data);
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

const importInput = document.querySelector("#import-input");
importInput.addEventListener('change', (event) => {
    const reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(event.target.files[0]);

    async function onReaderLoad(event) {
        const obj = JSON.parse(event.target.result);
        await db.transaction('rw', db.blobs, db.reads, db.galleries, async () => {
            if (!(await insert(obj.galleries, "galleries"))) {
                importInput.value = "";
                setStatus("Failed to upload galleries");
                return;
            }
            if (!(await insert(obj.reads, "reads"))) {
                importInput.value = "";
                setStatus("Failed to upload reads");
                return;
            }
            if (!(await insert(obj.blobs, "blobs"))) {
                importInput.value = "";
                setStatus("Failed to upload blobs");
                return;
            }
            setStatus("Backup data uploaded successfully ! You may want to recalculate your stats.");
            importInput.value = "";
        });
    }
});

document.querySelector("#clear-btn").addEventListener("click", () => {
    if (window.confirm("This will delete all your history ! You may want to back it up first.")) {
        db.delete({disableAutoOpen: false});
        setStatus("All data has been cleared !");
    } else {
        setStatus("Your data is safe !");
    }
});

document.querySelector("#recalculate-btn").addEventListener("click", async () => {
    for (let tagType of tagTypes.map(e => e.plural)) {
        await db[tagType].clear();
    }

    const galleries = await db.galleries.toArray();
    const obj = {
        parodies: {},
        characters: {},
        tags: {},
        artists: {},
        languages: {},
    };

    for (let gal of galleries) {
        for (let tagType of tagTypes.map(e => e.plural)) {
            for (let value of gal[tagType]) {
                if (obj[tagType][value] === undefined) {
                    obj[tagType][value] = gal.readCount;
                } else {
                    obj[tagType][value] += gal.readCount;
                }
            }
        }
    }

    function format(data) {
        const res = [];
        for (const [key, value] of Object.entries(data)) {
            res.push({value: key, readCount: value});
        }
        return res;
    }

    for (let tagType of tagTypes.map(e => e.plural)) {
        db[tagType].bulkPut(format(obj[tagType]));
    }

    setStatus("Stats recalculated !");
});