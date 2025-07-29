import '../lib/dexie.js';
import {makeCover, formatEpoch} from "../utils.js";

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    history: "id, title, artist, *tags, lastRead",
    reads: "readId, timestamp, doujinId",
    blobs: "blobId, startTime, endTime"
});
db.blobs.toArray().then((data) => renderHistory(data));

function makeBlob(data) {
    const blob = document.createElement("div");
    blob.className = "blob";
    blob.innerHTML = `
        <div class="blob-title">
            <h2>${formatEpoch(data.startTime)} - ${formatEpoch(data.endTime)}</h2>
        </div>
        <div class="content"></div>
    `;

    const content = blob.querySelector(".content");
    data.readIds
        .reverse()
        .forEach(async (readID) => {
            const readEntry = await db.reads.get(readID);
            if (!readEntry) {
                console.warn("No read found for readId:", readID);
                return;
            }
            const doujinEntry = await db.history.get(readEntry.doujinId);
            if (!doujinEntry) {
                console.warn("No history found for doujinId:", readEntry.doujinId);
                return;
            }

            content.appendChild(makeCover(doujinEntry, {}));
        });

    return blob;
}

function renderHistory(blobList) {
    const container = document.getElementById('history');
    container.innerHTML = '';

    blobList.sort((a, b) => b.endTime - a.endTime).forEach((blob) => {
        container.appendChild(makeBlob(blob));
    });
}
