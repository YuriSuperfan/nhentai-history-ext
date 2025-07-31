chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({url: chrome.runtime.getURL("pages/history.html")});
});

import './lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    history: "id, title, artist, *tags, lastRead",
    reads: "readId, timestamp, galleryId",
    blobs: "blobId, startTime, endTime"
});

async function saveToHistory(entry) {
    const {id, title, artist, tags, timestamp, thumb} = entry;
    const existing = await db.history.get(id);

    if (existing) {
        const updatedTimestamps = [...existing.readTimestamps, timestamp];
        updatedTimestamps.sort();
        await db.history.put({
            ...existing,
            readTimestamps: updatedTimestamps,
            lastRead: timestamp
        });
    } else {
        await db.history.put({
            id,
            title,
            artist,
            tags,
            readTimestamps: [timestamp],
            lastRead: timestamp,
            thumb
        });
    }
}

async function saveToReads({id, timestamp}, readId) {
    await db.reads.add({
        readId,
        galleryId: id,
        timestamp
    });
}

async function updateOrCreateBlob(readId, timestamp) {
    const timeRange = 60 * 60 * 1000; // 1 hour

    const recentBlobs = await db.blobs
        .where('endTime')
        .aboveOrEqual(timestamp - timeRange)
        .toArray();

    if (recentBlobs.length > 0) {
        const latestBlob = recentBlobs.reduce((a, b) =>
            a.endTime > b.endTime ? a : b
        );

        latestBlob.readIds.push(readId);
        latestBlob.endTime = timestamp;

        await db.blobs.put(latestBlob);
    } else {
        await db.blobs.add({
            blobId: crypto.randomUUID(),
            startTime: timestamp,
            endTime: timestamp,
            readIds: [readId]
        });
    }
}

async function deleteReadEntry(readId) {
    const read = await db.reads.get(readId);
    if (!read) {
        console.warn("No matching read found for:", readId);
        return;
    }

    const {galleryId, timestamp} = read;
    await db.reads.delete(readId);

    const history = await db.history.get(galleryId);
    if (history) {
        const updatedTimestamps = history.readTimestamps.filter(t => t !== timestamp);
        if (updatedTimestamps.length === 0) {
            await db.history.delete(galleryId);
        } else {
            updatedTimestamps.sort();
            await db.history.put({
                ...history,
                readTimestamps: updatedTimestamps,
                lastRead: updatedTimestamps[updatedTimestamps.length - 1]
            });
        }
    } else {
        console.warn("No matching history entry for:", galleryId);
    }

    const nearbyBlobs = await db.blobs
        .where('startTime')
        .belowOrEqual(timestamp)
        .reverse()
        .limit(10)
        .toArray();

    let found = false;
    for (const blob of nearbyBlobs) {
        if (blob.readIds.includes(readId)) {
            const updatedReadIds = blob.readIds.filter(id => id !== readId);
            if (updatedReadIds.length === 0) {
                await db.blobs.delete(blob.blobId);
            } else {
                const remainingReads = await Promise.all(updatedReadIds.map(id => db.reads.get(id)));
                const timestamps = remainingReads.map(r => r.timestamp).filter(Boolean);
                timestamps.sort((a, b) => a - b);
                await db.blobs.put({
                    ...blob,
                    readIds: updatedReadIds,
                    startTime: timestamps[0],
                    endTime: timestamps[timestamps.length - 1]
                });
            }
            found = true;
            break;
        }
    }
    if (!found) {
        console.warn("No matching blob found for:", readId);
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "read") {
        const readId = crypto.randomUUID();
        saveToHistory(message).then(() => {
            saveToReads(message, readId).then(() => {
                updateOrCreateBlob(readId, message.timestamp).then(() =>
                    sendResponse("ok"));
            });
        });
    }

    if (message.type === "deleteRead") {
        deleteReadEntry(message.data).then(() => sendResponse("ok"));
    }

    return true;
});
