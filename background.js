import './lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: "galleryId, title, artist, *tags, lastRead",
    reads: "readId, timestamp, galleryId",
    blobs: "blobId, startTime, endTime"
});

async function saveToGalleries(entry) {
    const {galleryId, title, artist, tags, timestamp, thumb} = entry;
    const existing = await db.galleries.get(galleryId);

    if (existing) {
        const updatedTimestamps = [...existing.readTimestamps, timestamp];
        updatedTimestamps.sort();
        await db.galleries.put({
            galleryId,
            title,
            artist,
            tags,
            thumb,
            readTimestamps: updatedTimestamps,
            lastRead: updatedTimestamps[updatedTimestamps.length - 1]
        });
    } else {
        await db.galleries.put({
            galleryId, title, artist, tags, thumb, readTimestamps: [timestamp], lastRead: timestamp
        });
    }
}

async function saveToReads({galleryId, timestamp}, readId) {
    await db.reads.add({
        readId, galleryId, timestamp
    });
}

async function updateOrCreateBlob(readId, timestamp) {
    const timeRange = 60 * 60 * 1000; // 1 hour

    const recentBlobs = await db.blobs
        .where('endTime')
        .aboveOrEqual(timestamp - timeRange)
        .toArray();

    if (recentBlobs.length > 0) {
        const latestBlob = recentBlobs.reduce((a, b) => a.endTime > b.endTime ? a : b);

        latestBlob.readIds.push(readId);
        latestBlob.endTime = timestamp;

        await db.blobs.put(latestBlob);
    } else {
        await db.blobs.add({
            blobId: crypto.randomUUID(), startTime: timestamp, endTime: timestamp, readIds: [readId]
        });
    }
}

async function deleteReadEntry(readId) {
    let restoreData = {};

    const read = await db.reads.get(readId);
    if (!read) {
        console.warn("No matching read found for:", readId);
        return;
    }

    const {galleryId, timestamp} = read;
    await db.reads.delete(readId);
    restoreData.read = read;

    const galleryEntry = await db.galleries.get(galleryId);
    if (galleryEntry) {
        const updatedTimestamps = galleryEntry.readTimestamps.filter(t => t !== timestamp);
        if (updatedTimestamps.length === 0) {
            await db.galleries.delete(galleryId);
        } else {
            updatedTimestamps.sort();
            await db.galleries.put({
                ...galleryEntry,
                readTimestamps: updatedTimestamps,
                lastRead: updatedTimestamps[updatedTimestamps.length - 1]
            });
        }
        restoreData.gallery = galleryEntry;
    } else {
        console.warn("No matching gallery entry for:", galleryId);
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
                const timestamps = remainingReads.map(r => r.timestamp);
                timestamps.sort((a, b) => a - b);
                await db.blobs.put({
                    ...blob,
                    readIds: updatedReadIds,
                    startTime: timestamps[0],
                    endTime: timestamps[timestamps.length - 1]
                });
            }
            found = true;
            restoreData.blob = blob;
            break;
        }
    }
    if (!found) {
        console.warn("No matching blob found for:", readId);
    }

    return restoreData;
}

async function restoreReadEntry(oldData) {
    await db.reads.add(oldData.read);

    const gallery = await db.galleries.get(oldData.gallery.galleryId);
    if (gallery) {
        const updatedTimestamps = [...gallery.readTimestamps, oldData.read.timestamp];
        updatedTimestamps.sort();
        await db.galleries.put({
            galleryId: oldData.gallery.galleryId,
            title: oldData.gallery.title,
            tags: oldData.gallery.tags,
            artist: oldData.gallery.artist,
            thumb: oldData.gallery.thumb,
            readTimestamps: updatedTimestamps,
            lastRead: updatedTimestamps[updatedTimestamps.length - 1]
        });
    } else {
        await db.galleries.put({
            galleryId: oldData.gallery.galleryId,
            title: oldData.gallery.title,
            tags: oldData.gallery.tags,
            artist: oldData.gallery.artist,
            thumb: oldData.gallery.thumb,
            readTimestamps: [oldData.read.timestamp],
            lastRead: oldData.read.timestamp,
        });
    }

    const blob = await db.blobs.get(oldData.blob.blobId);
    if (blob) {
        const updatedReadIds = [...blob.readIds, oldData.read.readId];
        await db.blobs.put({
            blobId: oldData.blob.blobId,
            readIds: updatedReadIds,
            startTime: Math.min(oldData.read.timestamp, blob.startTime),
            endTime: Math.max(oldData.read.timestamp, blob.endTime)
        });
    } else {
        await db.blobs.put({
            blobId: oldData.blob.blobId,
            readIds: [oldData.read.readId],
            startTime: oldData.read.timestamp,
            endTime: oldData.read.timestamp,
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "read":
            const readId = crypto.randomUUID();
            saveToGalleries(message).then(() => {
                saveToReads(message, readId).then(() => {
                    updateOrCreateBlob(readId, message.timestamp).then(() => sendResponse({status: "ok"}));
                });
            });
            break;
        case "deleteRead":
            deleteReadEntry(message.data).then((restoreData) => {
                sendResponse({status: "ok", restoreData});
            });
            break;
        case "restoreRead":
            restoreReadEntry(message.data).then(() => sendResponse({status: "ok"}));
            break;
        case "getSettings":
            chrome.storage.local.get(['minPages', 'minPercent', 'pauseHistory'], (settings) => {
                sendResponse({
                    status: "ok",
                    minPages: settings.minPages ?? 10,
                    minPercent: settings.minPercent ?? 33,
                    pauseHistory: settings.pauseHistory ?? false
                });
            });
            break;
        case "updateSettings":
            const newSettings = {};
            ["minPages", "minPercent", "pauseHistory"].forEach((setting) => {
                if (message[setting] !== undefined) {
                    newSettings[setting] = message[setting];
                }
            });
            chrome.storage.local.set(newSettings, () => {
                chrome.storage.local.get(['minPages', 'minPercent', 'pauseHistory'], (settings) => {
                    const minPages = settings.minPages ?? 10;
                    const minPercent = settings.minPercent ?? 33;
                    const pauseHistory = settings.pauseHistory ?? false;

                    sendResponse({
                        status: "ok", minPages, minPercent, pauseHistory
                    });

                    const urlPattern = /^https:\/\/nhentai\.net\/g\/\d+\/\d+\/$/;
                    chrome.tabs.query({}, (tabs) => {
                        for (const tab of tabs) {
                            if (tab.url && urlPattern.test(tab.url)) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: "updatedSettings", minPages, minPercent, pauseHistory
                                });
                            }
                        }
                    })
                });
            });
            break;
        default:
            sendResponse({status: "unknown"});
            break;
    }

    return true;
});
