import './lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: `galleryId, *tags, artist, [artist+readCount], readCount`,
    reads: `readId, blobId, galleryId, timestamp, [galleryId+timestamp]`,
    blobs: `blobId, endTime`,
    artists: `artist, readCount`,
    tags: `tag, readCount`
});

async function addReadEntry({galleryId, title, artist, tags, timestamp, thumb}) {
    const readId = crypto.randomUUID();
    let blobId;

    try {
        await db.transaction('rw', db.blobs, db.reads, db.galleries, db.artists, db.tags, async () => {
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
                    galleryId, title, artist, tags, thumb, readCount: existingGallery.readCount + 1
                });
            } else {
                await db.galleries.put({
                    galleryId, title, artist, tags, thumb, readCount: 1
                });
            }

            // Artist
            const existingArtist = await db.artists.get(artist);
            if (existingArtist) {
                await db.artists.put({
                    artist, readCount: existingArtist.readCount + 1
                });
            } else {
                await db.artists.put({
                    artist, readCount: 1
                });
            }

            // Tags
            for (const tag of tags) {
                const existingTag = await db.tags.get(tag);
                if (existingTag) {
                    await db.tags.put({
                        tag, readCount: existingTag.readCount + 1
                    });
                } else {
                    await db.tags.put({
                        tag, readCount: 1
                    });
                }
            }
        });
        return {status: "ok"};
    } catch {
        return {status: "ko"};
    }
}

async function deleteReadEntry(readId) {
    try {
        let readEntry;
        let galleryEntry;
        await db.transaction('rw', db.reads, db.galleries, db.blobs, db.artists, db.tags, async () => {
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

                // Artist
                const artistEntry = await db.artists.get(galleryEntry.artist);
                if (artistEntry) {
                    if (artistEntry.readCount === 1) {
                        await db.artists.delete(galleryEntry.artist);
                    } else {
                        await db.artists.put({
                            ...artistEntry, readCount: artistEntry.readCount - 1
                        });
                    }
                } else {
                    console.warn("No artist entry found for:", galleryEntry.artist);
                }

                // Tags
                for (const tag of galleryEntry.tags) {
                    const tagEntry = await db.tags.get(tag);
                    if (tagEntry) {
                        if (tagEntry.readCount === 1) {
                            await db.tags.delete(tag);
                        } else {
                            await db.tags.put({
                                ...tagEntry, readCount: tagEntry.readCount - 1
                            });
                        }
                    } else {
                        console.warn("No tag entry found for:", tag);
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
    } catch {
        return {status: "ko"};
    }
}

async function restoreReadEntry(restoreData) {
    try {
        await db.transaction('rw', db.reads, db.galleries, db.blobs, db.artists, db.tags, async () => {
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

            // Artist
            const existingArtist = await db.artists.get(restoreData.galleryEntry.artist);
            if (existingArtist) {
                await db.artists.put({
                    artist: restoreData.galleryEntry.artist, readCount: existingArtist.readCount + 1
                });
            } else {
                await db.artists.put({
                    artist: restoreData.galleryEntry.artist, readCount: 1
                });
            }

            // Tags
            for (const tag of restoreData.galleryEntry.tags) {
                const existingTag = await db.tags.get(tag);
                if (existingTag) {
                    await db.tags.put({
                        tag, readCount: existingTag.readCount + 1
                    });
                } else {
                    await db.tags.put({
                        tag, readCount: 1
                    });
                }
            }
        });
        return {status: "ok"};
    } catch {
        return {status: "ko"};
    }
}

async function getSettings() {
    const settings = await chrome.storage.local.get(['minPages', 'minPercent', 'pauseHistory']);
    return {
        minPages: settings.minPages ?? 10,
        minPercent: settings.minPercent ?? 33,
        pauseHistory: settings.pauseHistory ?? false
    };
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
            getSettings().then((settings) => sendResponse({
                settings, status: "ok",
            }));
            break;
        case "updateSettings":
            chrome.storage.local.set(message.data).then(() => {
                getSettings().then((settings) => {
                    sendResponse({
                        status: "ok", settings
                    });
                    const urlPattern = /^https:\/\/nhentai\.net\/g\/\d+\/\d+\/$/;
                    chrome.tabs.query({}, (tabs) => {
                        for (const tab of tabs) {
                            if (tab.url && urlPattern.test(tab.url)) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: "updatedSettings", settings
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
