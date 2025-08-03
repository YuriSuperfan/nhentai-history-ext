import '../lib/dexie.js';
import {makeCover} from "../utils.js";

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

async function makeBlob(data) {
    function formatBlobTitle(startEpoch, endEpoch) {
        const start = new Date(startEpoch);

        const dateOptions = {year: 'numeric', month: 'long', day: 'numeric'};
        const dateStr = start.toLocaleDateString(undefined, dateOptions);

        const durationMs = endEpoch - startEpoch;
        const totalMinutes = Math.floor(durationMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        let durationStr = "";

        if (hours > 0) {
            durationStr += `${hours}h`;
        }
        if (minutes > 0) {
            durationStr += ` ${minutes}m`;
        }

        return `<span class="colored">${durationStr}</span>` + ` ${durationStr === "" ? "S" : "s"}ession on ` + `<span class="colored">${dateStr}</span>`;
    }

    const blob = document.createElement("div");
    blob.className = "blob";
    blob.innerHTML = `
        <div class="blob-title">
            <h2>${formatBlobTitle(data.startTime, data.endTime)}</h2>
        </div>
        <div class="content"></div>
    `;

    const content = blob.querySelector(".content");

    const blobContent = await db.reads.where("blobId").equals(data.blobId).toArray();

    const coverPromises = blobContent.map(async (readEntry) => {
        const galleryEntry = await db.galleries.get(readEntry.galleryId);
        if (!galleryEntry) {
            console.warn("No history found for galleryId:", readEntry.galleryId);
            return;
        }

        return {
            cover: makeCover({
                ...galleryEntry, timestamp: readEntry.timestamp
            }, {
                deleteId: readEntry.readId
            }), endTime: readEntry.timestamp
        };
    });

    const covers = await Promise.all(coverPromises);
    covers
        .sort((a, b) => {
            return b.endTime - a.endTime;
        })
        .forEach(({cover}) => {
            content.appendChild(cover);
        });

    return blob;
}

function setupBlobLoader() {
    let currentPage = 0;
    const pageSize = 10;
    let isLoading = false;
    let reachedEnd = false;

    async function loadNextBlobs() {
        if (isLoading || reachedEnd) {
            return;
        }
        isLoading = true;

        const offset = currentPage * pageSize;

        const data = await db.blobs
            .orderBy("endTime")
            .reverse()
            .offset(offset)
            .limit(pageSize)
            .toArray();

        if (data.length === 0) {
            reachedEnd = true;
            isLoading = false;
            return;
        }

        const newBlobElements = await Promise.all(data.map(blob => makeBlob(blob)));
        const container = document.getElementById('content');

        newBlobElements.forEach((blob) => container.appendChild(blob));

        currentPage++;
        isLoading = false;
    }

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const fullHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= fullHeight - 300) {
            loadNextBlobs();
        }
    });

    loadNextBlobs();
}

setupBlobLoader();