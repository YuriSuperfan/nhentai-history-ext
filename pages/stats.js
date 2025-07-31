import {makeCover} from "../utils.js";
import '../lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    history: "id, title, artist, *tags, lastRead",
    reads: "readId, timestamp, doujinId",
    blobs: "blobId, startTime, endTime"
});
const tagResults = document.querySelector("#tag-results");
const tagButton = document.querySelector("#tag-selection");
const artistResults = document.querySelector("#artist-results");
const artistButton = document.querySelector("#artist-selection");
const galleryResults = document.querySelector("#gallery-results");
const galleryButton = document.querySelector("#gallery-selection");

function makeResultCard(title, nbReads, children, href) {
    let result;
    if (href !== undefined) {
        result = document.createElement("a");
        result.href = href;
        result.target = "_blank";
    }
    else {
        result = document.createElement("div");
    }
    result.className = "result-card";
    result.innerHTML = `
        <h2 class="title-placeholder"> e</h2>
        <h2 class="result-title" title="${title}">${title}</h2>
        <h3><span class="colored">${nbReads}</span> read${nbReads === 1 ? "" : "s"}</h3>
        <div class="collection"></div>
    `;
    const collection = result.querySelector(".collection");
    if (Array.isArray(children)) {
        children.forEach((child) => collection.appendChild(child));
    } else {
        collection.appendChild(children);
        collection.classList.add("single-collection");
    }
    return result;
}

let current = "gallery";
const pageSize = 10;

function setupGalleryStats() {
    let currentPage = 0;
    let isLoading = false;
    let reachedEnd = false;
    let orderedData = undefined;

    async function loadNextGalleries() {
        if (isLoading || reachedEnd) {
            return;
        }
        isLoading = true;

        if (orderedData === undefined) {
            const data = await db.history.toArray();
            data.sort((a, b) => {
                const diff = b.readTimestamps.length - a.readTimestamps.length;
                if (diff !== 0) return diff;
                return b.lastRead - a.lastRead;
            });

            orderedData = data;
        }

        const offset = currentPage * pageSize;

        if (offset > orderedData.length) {
            reachedEnd = true;
            isLoading = false;
            return;
        }

        orderedData
            .slice(offset, offset + pageSize)
            .forEach((gallery) => {
                galleryResults.appendChild(makeResultCard(gallery.title, gallery.readTimestamps.length, makeCover(gallery, {lastRead: true})));
            });

        currentPage++;
        isLoading = false;
    }

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const fullHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= fullHeight - 300) {
            if (current === "gallery") {
                loadNextGalleries();
            }
        }
    });

    galleryButton.addEventListener("click", () => {
        galleryResults.classList.add("current-results");
        artistResults.classList.remove("current-results");
        tagResults.classList.remove("current-results");
        galleryButton.classList.add("selected");
        artistButton.classList.remove("selected");
        tagButton.classList.remove("selected");
        current = "gallery";
    });

    loadNextGalleries();
}

function setupArtistStats() {
    let currentPage = 0;
    let isLoading = false;
    let reachedEnd = false;
    let orderedData = undefined;

    async function loadNextArtists() {
        if (isLoading || reachedEnd) {
            return;
        }
        isLoading = true;

        if (orderedData === undefined) {
            const data = await db.history.toArray();

            const artistMap = {};

            for (const entry of data) {
                if (!entry.artist ) {
                    continue;
                }
                const artist = entry.artist;
                const readCount = entry.readTimestamps.length;

                if (!artistMap[artist]) {
                    artistMap[artist] = {
                        name: artist,
                        readNb: 0,
                        galleries: []
                    };
                }

                artistMap[artist].readNb += readCount;
                artistMap[artist].galleries.push(entry);
            }

            orderedData = Object.values(artistMap).sort(
                (a, b) => b.readNb - a.readNb
            );

            orderedData.forEach((artist) => {
                artist.galleries.sort((a, b) => b.readTimestamps.length - a.readTimestamps.length)
            });
        }

        const offset = currentPage * pageSize;

        if (offset > orderedData.length) {
            reachedEnd = true;
            isLoading = false;
            return;
        }

        orderedData
            .slice(offset, offset + pageSize)
            .forEach((artist) => {
                artistResults.appendChild(makeResultCard(artist.name, artist.readNb, artist.galleries.map((gallery) => {
                    return makeCover(gallery, {noDate: true, noOverflow: true, detailReads: true});
                }), `https://nhentai.net/artist/${artist.name}/`));
            });

        currentPage++;
        isLoading = false;
    }

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const fullHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= fullHeight - 300) {
            if (current === "artist") {
                loadNextArtists();
            }
        }
    });

    artistButton.addEventListener("click", () => {
        galleryResults.classList.remove("current-results");
        artistResults.classList.add("current-results");
        tagResults.classList.remove("current-results");
        galleryButton.classList.remove("selected");
        artistButton.classList.add("selected");
        tagButton.classList.remove("selected");
        current = "artist";
    });

    loadNextArtists();
}

function setupTagStats() {
    let currentPage = 0;
    let isLoading = false;
    let reachedEnd = false;
    let orderedData = undefined;

    async function loadNextTags() {
        if (isLoading || reachedEnd) {
            return;
        }
        isLoading = true;

        if (orderedData === undefined) {
            const data = await db.history.toArray();

            const tagMap = {};

            for (const entry of data) {
                for (const tag of entry.tags) {
                    const readCount = entry.readTimestamps.length;

                    if (!tagMap[tag]) {
                        tagMap[tag] = {
                            tag: tag,
                            readNb: 0,
                            galleries: []
                        };
                    }

                    tagMap[tag].readNb += readCount;
                    tagMap[tag].galleries.push(entry);
                }
            }

            orderedData = Object.values(tagMap).sort(
                (a, b) => b.readNb - a.readNb
            );

            orderedData.forEach((tag) => {
                tag.galleries.sort((a, b) => b.readTimestamps.length - a.readTimestamps.length)
            });
        }

        const offset = currentPage * pageSize;

        if (offset > orderedData.length) {
            reachedEnd = true;
            isLoading = false;
            return;
        }

        orderedData
            .slice(offset, offset + pageSize)
            .forEach((tag) => {
                tagResults.appendChild(makeResultCard(tag.tag, tag.readNb, tag.galleries.map((gallery) => {
                    return makeCover(gallery, {noDate: true, noOverflow: true, detailReads: true});
                }), `https://nhentai.net/tag/${tag.tag.replaceAll(" ", "-")}/`));
            });

        currentPage++;
        isLoading = false;
    }

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const fullHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= fullHeight - 300) {
            if (current === "tag") {
                loadNextTags();
            }
        }
    });

    tagButton.addEventListener("click", () => {
        galleryResults.classList.remove("current-results");
        artistResults.classList.remove("current-results");
        tagResults.classList.add("current-results");
        galleryButton.classList.remove("selected");
        artistButton.classList.remove("selected");
        tagButton.classList.add("selected");
        current = "tag";
    });

    loadNextTags();
}

setupGalleryStats();
setupArtistStats();
setupTagStats();