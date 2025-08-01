import {makeCover} from "../utils.js";
import '../lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: "galleryId, title, artist, *tags, lastRead",
    reads: "readId, timestamp, galleryId",
    blobs: "blobId, startTime, endTime"
});
const tagResults = document.querySelector("#tags-results");
const tagButton = document.querySelector("#tags-selection");
const artistResults = document.querySelector("#artists-results");
const artistButton = document.querySelector("#artists-selection");
const galleryResults = document.querySelector("#galleries-results");
const galleryButton = document.querySelector("#galleries-selection");

function makeResultCard(data) {
    let result;
    if (data.href !== undefined) {
        result = document.createElement("a");
        result.href = data.href;
        result.target = "_blank";
    } else {
        result = document.createElement("div");
    }
    result.className = "result-card";
    result.innerHTML = `
        <h2 class="title-placeholder"> e</h2>
        <h2 class="result-title" title="${data.title}">${data.title}</h2>
        <h3>
            <span class="colored">${data.nbReads}</span> read${data.nbReads === 1 ? "" : "s"}
            ${data.uniqueReads !== undefined ? `- <span class="colored">${data.uniqueReads}</span> galler${data.uniqueReads === 1 ? "y" : "ies"}` : ""}
        </h3>
        <div class="collection"></div>
    `;
    const collection = result.querySelector(".collection");
    if (Array.isArray(data.children)) {
        let currentPage = 0;
        const pageSize = 10;
        let reachedEnd = false;
        let isLoading = false;

        function addChildren() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;
            const offset = currentPage * pageSize;

            if (offset > data.children.length) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            data.children
                .slice(offset, offset + pageSize)
                .forEach((child) => collection.appendChild(child));

            currentPage++;
            isLoading = false;
        }

        collection.addEventListener('scroll', () => {
            const scrollLeft = collection.scrollLeft;
            const visibleWidth = collection.clientWidth;
            const totalWidth = collection.scrollWidth;

            if (scrollLeft + visibleWidth >= totalWidth - 100) {
                addChildren();
            }
        });
        addChildren();
    } else {
        collection.appendChild(data.children);
        collection.classList.add("single-collection");
    }
    return result;
}

async function setupStats() {
    let current = window.location.hash.split("#")[1];
    if (!["galleries", "artists", "tags"].includes(current)) {
        current = "galleries";
    }

    function changeCurrent(newCurrent) {
        if (newCurrent === "galleries") {
            galleryResults.classList.add("current-results");
            galleryButton.classList.add("selected");
        } else {
            galleryResults.classList.remove("current-results");
            galleryButton.classList.remove("selected");
        }
        if (newCurrent === "artists") {
            artistResults.classList.add("current-results");
            artistButton.classList.add("selected");
        } else {
            artistResults.classList.remove("current-results");
            artistButton.classList.remove("selected");
        }
        if (newCurrent === "tags") {
            tagResults.classList.add("current-results");
            tagButton.classList.add("selected");
        } else {
            tagResults.classList.remove("current-results");
            tagButton.classList.remove("selected");
        }
        window.location.hash = `#${newCurrent}`;
        current = newCurrent;
    }

    changeCurrent(current);

    const pageSize = 10;
    const historyData = await db.galleries.toArray();

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
                const data = [...historyData];
                data.sort((a, b) => {
                    const diff = b.readTimestamps.length - a.readTimestamps.length;
                    if (diff !== 0) {
                        return diff;
                    }
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
                    galleryResults.appendChild(makeResultCard({
                        title: gallery.title,
                        nbReads: gallery.readTimestamps.length,
                        children: makeCover({...gallery, timestamp: gallery.lastRead}, {lastRead: true})
                    }));
                });

            currentPage++;
            isLoading = false;
        }

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                if (current === "galleries") {
                    loadNextGalleries();
                }
            }
        });

        galleryButton.addEventListener("click", () => {
            changeCurrent("galleries");
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
                const data = [...historyData];

                const artistMap = {};

                for (const entry of data) {
                    if (!entry.artist) {
                        continue;
                    }
                    const artist = entry.artist;
                    const readCount = entry.readTimestamps.length;

                    if (!artistMap[artist]) {
                        artistMap[artist] = {
                            name: artist, readNb: 0, uniqueReads: 0, galleries: []
                        };
                    }

                    artistMap[artist].readNb += readCount;
                    artistMap[artist].uniqueReads += 1;
                    artistMap[artist].galleries.push(entry);
                }

                orderedData = Object.values(artistMap).sort((a, b) => b.readNb - a.readNb);

                orderedData.forEach((artist) => {
                    artist.galleries.sort((a, b) => {
                        const diff = b.readTimestamps.length - a.readTimestamps.length;
                        if (diff !== 0) {
                            return diff;
                        }
                        return b.lastRead - a.lastRead;
                    })
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
                    artistResults.appendChild(makeResultCard({
                        title: artist.name,
                        nbReads: artist.readNb,
                        children: artist.galleries.map((gallery) => makeCover({
                            ...gallery, timestamp: gallery.lastRead
                        }, {
                            noDate: true, noOverflow: true, detailReads: true
                        })),
                        href: `https://nhentai.net/artist/${artist.name}/`,
                        uniqueReads: artist.uniqueReads
                    }));
                });

            currentPage++;
            isLoading = false;
        }

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                if (current === "artists") {
                    loadNextArtists();
                }
            }
        });

        artistButton.addEventListener("click", () => {
            changeCurrent("artists");
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
                const data = [...historyData];

                const tagMap = {};

                for (const entry of data) {
                    for (const tag of entry.tags) {
                        const readCount = entry.readTimestamps.length;

                        if (!tagMap[tag]) {
                            tagMap[tag] = {
                                tag: tag, readNb: 0, uniqueReads: 0, galleries: []
                            };
                        }

                        tagMap[tag].readNb += readCount;
                        tagMap[tag].uniqueReads += 1;
                        tagMap[tag].galleries.push(entry);
                    }
                }

                orderedData = Object.values(tagMap).sort((a, b) => b.readNb - a.readNb);

                orderedData.forEach((tag) => {
                    tag.galleries.sort((a, b) => {
                        const diff = b.readTimestamps.length - a.readTimestamps.length;
                        if (diff !== 0) {
                            return diff;
                        }
                        return b.lastRead - a.lastRead;
                    })
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
                    tagResults.appendChild(makeResultCard({
                        title: tag.tag,
                        nbReads: tag.readNb,
                        children: tag.galleries.map((gallery) => makeCover({...gallery, timestamp: gallery.lastRead}, {
                            noDate: true, noOverflow: true, detailReads: true
                        })),
                        href: `https://nhentai.net/tag/${tag.tag.replaceAll(" ", "-")}/`,
                        uniqueReads: tag.uniqueReads
                    }));
                });

            currentPage++;
            isLoading = false;
        }

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                if (current === "tags") {
                    loadNextTags();
                }
            }
        });

        tagButton.addEventListener("click", () => {
            changeCurrent("tags");
        });

        loadNextTags();
    }

    setupGalleryStats();
    setupArtistStats();
    setupTagStats();
}

setupStats();