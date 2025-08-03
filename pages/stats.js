import {makeCover} from "../utils.js";
import '../lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: `galleryId, *tags, artist, [artist+readCount], readCount`,
    reads: `readId, blobId, galleryId, timestamp, [galleryId+timestamp]`,
    blobs: `blobId, endTime`,
    artists: `artist, readCount`,
    tags: `tag, readCount`
});
const tagResults = document.querySelector("#tags-results");
const tagButton = document.querySelector("#tags-selection");
const artistResults = document.querySelector("#artists-results");
const artistButton = document.querySelector("#artists-selection");
const galleryResults = document.querySelector("#galleries-results");
const galleryButton = document.querySelector("#galleries-selection");
const totalStats = document.querySelector("#total-stats");

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
    if (typeof data.children === "function") {
        let currentPage = 0;
        const pageSize = 10;
        let reachedEnd = false;
        let isLoading = false;

        async function addChildren() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const res = await data.children(currentPage, pageSize);

            res.children.forEach((child) => collection.appendChild(child));
            reachedEnd = res.reachedEnd;

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

function setupStats() {
    let current = window.location.hash.split("#")[1];
    if (!["galleries", "artists", "tags"].includes(current)) {
        current = "galleries";
    }
    let totalReads = "~";
    let totalGalleries = "~";
    let totalArtists = "~";
    let totalTags = "~";

    async function displayTotal() {
        totalReads = await db.reads.count();
        switch (current) {
            case "galleries":
                if (totalGalleries === "~") {
                    totalGalleries = await db.galleries.count();
                }
                totalStats.innerHTML = `
                <span class="colored">${totalReads}</span>
                total reads across 
                <span class="colored">${totalGalleries}</span> 
                unique galler${totalGalleries === 1 ? "y" : "ies"}`;
                break;
            case "artists":
                if (totalArtists === "~") {
                    totalArtists = await db.artists.count();
                }
                totalStats.innerHTML = `
                <span class="colored">${totalReads}</span>
                total reads across the works of 
                <span class="colored">${totalArtists}</span> 
                artist${totalArtists === 1 ? "" : "s"}`;
                break;
            case "tags":
                if (totalTags === "~") {
                    totalTags = await db.tags.count();
                }
                totalStats.innerHTML = `
                <span class="colored">${totalReads}</span>
                total reads with 
                <span class="colored">${totalTags}</span> 
                unique tag${totalTags === 1 ? "" : "s"}`;
                break;
        }
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
        displayTotal();
    }

    changeCurrent(current);

    const pageSize = 10;

    function setupGalleryStats() {
        let currentPage = 0;
        let isLoading = false;
        let reachedEnd = false;

        async function loadNextGalleries() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = await db.galleries
                .orderBy("readCount")
                .reverse()
                .offset(offset)
                .limit(pageSize)
                .toArray();

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            for (const gallery of data) {
                const lastRead = await db.reads
                    .where('[galleryId+timestamp]')
                    .between([gallery.galleryId, Dexie.minKey], [gallery.galleryId, Dexie.maxKey])
                    .reverse()
                    .first();

                galleryResults.appendChild(makeResultCard({
                    title: gallery.title,
                    nbReads: gallery.readCount,
                    children: makeCover({...gallery, timestamp: lastRead.timestamp}, {lastRead: true})
                }));
            }

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

        async function loadNextArtists() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = await db.artists
                .orderBy("readCount")
                .reverse()
                .offset(offset)
                .limit(pageSize)
                .toArray();

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            for (const artistEntry of data) {
                const uniqueReads = await db.galleries
                    .where('artist')
                    .equals(artistEntry.artist)
                    .count();

                async function loadNextChildren(currentPage, pageSize) {
                    const offset = currentPage * pageSize;

                    const galleries = await db.galleries
                        .where('[artist+readCount]')
                        .between([artistEntry.artist, Dexie.minKey], [artistEntry.artist, Dexie.maxKey])
                        .reverse()
                        .offset(offset)
                        .limit(pageSize)
                        .toArray();

                    return {
                        children: galleries.map((gallery) => makeCover({
                            ...gallery
                        }, {
                            noDate: true, noOverflow: true, detailReads: true
                        })), reachedEnd: galleries.length === 0
                    };
                }

                artistResults.appendChild(makeResultCard({
                    title: artistEntry.artist,
                    nbReads: artistEntry.readCount,
                    children: loadNextChildren,
                    href: `https://nhentai.net/artist/${artistEntry.artist}/`,
                    uniqueReads
                }));
            }

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

    async function setupTagStats() {
        let currentPage = 0;
        let isLoading = false;
        let reachedEnd = false;
        let latestReads = await db.reads
            .orderBy("timestamp")
            .reverse()
            .limit(500)
            .toArray().then((readEntries) => {
                return db.galleries.bulkGet([...new Set(readEntries.map((readEntry) => readEntry.galleryId))])
            });

        async function loadNextTags() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = await db.tags
                .orderBy("readCount")
                .reverse()
                .offset(offset)
                .limit(pageSize)
                .toArray();

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            for (const tagEntry of data) {
                const uniqueReads = await db.galleries
                    .where('tags')
                    .equals(tagEntry.tag)
                    .count();

                async function loadNextChildren(currentPage, pageSize) {
                    const offset = currentPage * pageSize;

                    const galleries = latestReads
                        .filter((galleryEntry) => galleryEntry.tags.includes(tagEntry.tag))
                        .sort((a, b) => b.readCount - a.readCount)
                        .slice(offset, offset + pageSize);

                    return {
                        children: galleries.map((gallery) => makeCover({
                            ...gallery
                        }, {
                            noDate: true, noOverflow: true, detailReads: true
                        })), reachedEnd: galleries.length === 0
                    };
                }

                tagResults.appendChild(makeResultCard({
                    title: tagEntry.tag,
                    nbReads: tagEntry.readCount,
                    children: loadNextChildren,
                    href: `https://nhentai.net/tag/${tagEntry.tag.replaceAll(" ", "-")}/`,
                    uniqueReads
                }));
            }

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