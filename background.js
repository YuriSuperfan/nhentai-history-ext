import './lib/dexie.js';
import {tagTypes} from "./utils.js";

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

const pluralTagTypes = tagTypes.map((tagType) => tagType.plural);
const infoTypes = ["Pages", ...tagTypes.map((tagType) => tagType.pluralCap)];

async function addReadEntry(data) {
    const {galleryId, title, timestamp, thumb, parodies, characters, tags, artists, languages, pages} = data;
    const readId = crypto.randomUUID();
    let blobId;

    try {
        await db.transaction('rw', db.blobs, db.reads, db.galleries, db.parodies, db.characters, db.tags, db.artists, db.languages, async () => {
            // Blob
            const recentBlobs = await db.blobs
                .where('endTime')
                .aboveOrEqual(timestamp - 60 * 60 * 1000) // 1 hour
                .toArray();
            if (recentBlobs.length > 0) {
                const latestBlob = recentBlobs.reduce((a, b) => a.endTime > b.endTime ? a : b);
                blobId = latestBlob.blobId;
                latestBlob.endTime = timestamp;
                await db.blobs.put(latestBlob);
            } else {
                blobId = crypto.randomUUID();
                await db.blobs.add({
                    blobId, startTime: timestamp, endTime: timestamp
                });
            }

            // Read
            await db.reads.add({
                readId, galleryId, blobId, timestamp
            });

            // Gallery
            const existingGallery = await db.galleries.get(galleryId);
            if (existingGallery) {
                await db.galleries.put({
                    galleryId,
                    title,
                    parodies,
                    characters,
                    tags,
                    artists,
                    languages,
                    thumb,
                    pages,
                    readCount: existingGallery.readCount + 1
                });
            } else {
                await db.galleries.put({
                    galleryId, title, parodies, characters, tags, artists, languages, thumb, pages, readCount: 1
                });
            }

            // Tags
            for (const tagType of pluralTagTypes) {
                for (const value of data[tagType]) {
                    const existingEntry = await db[tagType].get(value);
                    if (existingEntry) {
                        await db[tagType].put({
                            value, readCount: existingEntry.readCount + 1
                        });
                    } else {
                        await db[tagType].put({
                            value, readCount: 1
                        });
                    }
                }
            }
        });
        return {status: "ok"};
    } catch (e) {
        return {status: "ko", reason: e};
    }
}

async function deleteReadEntry(readId) {
    try {
        let readEntry;
        let galleryEntry;
        await db.transaction('rw', db.blobs, db.reads, db.galleries, db.parodies, db.characters, db.tags, db.artists, db.languages, async () => {
            // Read
            readEntry = await db.reads.get(readId);
            if (!readEntry) {
                throw new Error(`No read entry found for ${readId}`);
            }
            await db.reads.delete(readId);

            // Gallery
            galleryEntry = await db.galleries.get(readEntry.galleryId);
            if (galleryEntry) {
                if (galleryEntry.readCount === 1) {
                    await db.galleries.delete(readEntry.galleryId);
                } else {
                    await db.galleries.put({
                        ...galleryEntry, readCount: galleryEntry.readCount - 1
                    });
                }

                // Tags
                for (const tagType of pluralTagTypes) {
                    for (const value of galleryEntry[tagType]) {
                        const tagEntry = await db[tagType].get(value);
                        if (tagEntry) {
                            if (tagEntry.readCount === 1) {
                                await db[tagType].delete(value);
                            } else {
                                await db[tagType].put({
                                    value, readCount: tagEntry.readCount - 1
                                });
                            }
                        } else {
                            console.warn(`No '${tagType}' entry found for:`, value);
                        }
                    }
                }
            } else {
                console.warn("No gallery entry found for:", readEntry.galleryId);
            }

            // Blob
            const blobEntry = await db.blobs.get(readEntry.blobId);
            if (blobEntry) {
                const blobContents = await db.reads.where("blobId").equals(blobEntry.blobId).toArray();
                if (blobContents.length === 0) {
                    await db.blobs.delete(blobEntry.blobId);
                } else {
                    if (blobEntry.endTime === readEntry.timestamp) {
                        await db.blobs.put({...blobEntry, endTime: Math.max(...blobContents.map(obj => obj.timestamp))})
                    }
                    if (blobEntry.startTime === readEntry.timestamp) {
                        await db.blobs.put({
                            ...blobEntry, startTime: Math.min(...blobContents.map(obj => obj.timestamp))
                        })
                    }
                }
            } else {
                console.warn("No blob entry found for:", readEntry.blobId);
            }
        });
        return {status: "ok", restoreData: {readEntry, galleryEntry}};
    } catch (e) {
        return {status: "ko", reason: e};
    }
}

async function restoreReadEntry(restoreData) {
    try {
        await db.transaction('rw', db.blobs, db.reads, db.galleries, db.parodies, db.characters, db.tags, db.artists, db.languages, async () => {
            // Read
            await db.reads.add(restoreData.readEntry);

            // Gallery
            const existingGallery = await db.galleries.get(restoreData.galleryEntry.galleryId);
            if (existingGallery) {
                await db.galleries.put({
                    ...existingGallery, readCount: existingGallery.readCount + 1
                });
            } else {
                await db.galleries.put({
                    ...restoreData.galleryEntry, readCount: 1
                });
            }

            // Blob
            const existingBlob = await db.blobs.get(restoreData.readEntry.blobId);
            if (existingBlob) {
                if (existingBlob.endTime < restoreData.readEntry.timestamp) {
                    await db.blobs.put({
                        ...existingBlob, endTime: restoreData.readEntry.timestamp
                    });
                }
                if (existingBlob.startTime > restoreData.readEntry.timestamp) {
                    await db.blobs.put({
                        ...existingBlob, startTime: restoreData.readEntry.timestamp
                    });
                }
            } else {
                await db.blobs.put({
                    blobId: restoreData.readEntry.blobId,
                    startTime: restoreData.readEntry.timestamp,
                    endTime: restoreData.readEntry.timestamp
                });
            }

            // Tags
            for (const tagType of pluralTagTypes) {
                for (const value of restoreData.galleryEntry[tagType]) {
                    const existingEntry = await db[tagType].get(value);
                    if (existingEntry) {
                        await db[tagType].put({
                            value, readCount: existingEntry.readCount + 1
                        });
                    } else {
                        await db[tagType].put({
                            value, readCount: 1
                        });
                    }
                }
            }
        });
        return {status: "ok"};
    } catch (e) {
        return {status: "ko", reason: e};
    }
}

async function getSettings() {
    const defaultSettings = {
        minPages: 10,
        minPercent: 33,
        pauseHistory: false,
        showRecordIcon: true,
        searchEntryCount: 500, ...Object.fromEntries(infoTypes.map(infoType => [`display${infoType}`, true]))
    };
    try {
        const settings = await chrome.storage.local.get(Object.keys(defaultSettings));
        return {status: "ok", settings: {...defaultSettings, ...settings}};
    } catch (e) {
        return {status: "ko", settings: {...defaultSettings}, reason: e};
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "addRead":
            addReadEntry(message.data).then((response) => sendResponse(response));
            break;
        case "deleteRead":
            deleteReadEntry(message.data).then((response) => sendResponse(response));
            break;
        case "restoreRead":
            restoreReadEntry(message.data).then((response) => sendResponse(response));
            break;
        case "getSettings":
            getSettings().then((response) => sendResponse(response));
            break;
        case "updateSettings":
            chrome.storage.local.set(message.data).then(() => {
                getSettings().then((response) => {
                    sendResponse(response);
                    const urlPattern = /^https:\/\/nhentai\.net\/g\/\d+\/\d+\/$/;
                    chrome.tabs.query({}, (tabs) => {
                        for (const tab of tabs) {
                            if (tab.url && urlPattern.test(tab.url)) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: "updatedSettings", settings: response.settings
                                });
                            }
                        }
                    });
                });
            }, () => sendResponse({status: "ko"}));
            break;
        default:
            sendResponse({status: "unknown"});
            break;
    }

    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url && tab.url.includes("nhentai.net")) {
                chrome.tabs.reload(tab.id);
            }
        });
    });
});