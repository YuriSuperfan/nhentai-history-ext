import {makeCover, debounce, makeEndCard, tagTypes} from "../utils.js";
import "../lib/dexie.js";

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

const pluralCapTagTypes = tagTypes.map((tagType) => tagType.pluralCap);

function fuzzySearch(needle, haystack) {
    if (!needle) return true;
    if (!haystack) return false;

    needle = needle.toLowerCase();
    haystack = haystack.toLowerCase();

    let needleIndex = 0;

    for (let char of haystack) {
        if (char === needle[needleIndex]) {
            needleIndex++;
        }
        if (needleIndex === needle.length) {
            return true;
        }
    }

    return false;
}

async function setupSearch(settings) {
    let latestReads = [];
    let galleryNb = await db.galleries.count();

    const entryCountInfo = document.querySelector("#entry-count-info");

    async function updateEntries(nbEntries) {
        latestReads = [];
        entryCountInfo.innerText = "Loading";

        latestReads = await db.reads
            .orderBy("timestamp")
            .reverse()
            .limit(nbEntries)
            .toArray().then(async (readEntries) => {
                const galleryData = await db.galleries.bulkGet([...new Set(readEntries.map((readEntry) => readEntry.galleryId))]);

                for (const readEntry of readEntries) {
                    const matchingGallery = galleryData.find((galleryEntry) => galleryEntry.galleryId === readEntry.galleryId);
                    if (matchingGallery.timestamp === undefined) {
                        matchingGallery.timestamp = readEntry.timestamp;
                    }
                }

                return galleryData;
            });
        entryCountInfo.innerText = `${nbEntries} entries`;
        debouncedSearch();
    }

    const searchFilters = {};

    const titleInput = document.querySelector("#title-input");
    const results = document.querySelector('#results');

    async function search() {
        results.innerHTML = "";

        const filtered = latestReads.filter((entry) => {
            if (searchFilters.titleValue) {
                if (!searchFilters.titleValue.split(" ").every((word) => fuzzySearch(word, entry.title))) {
                    return false;
                }
            }
            for (const tagType of pluralCapTagTypes) {
                if (searchFilters[tagType]) {
                    if (searchFilters[tagType].isAnd) {
                        if (!searchFilters[tagType].values.every((value) => {
                            return entry[tagType.toLowerCase()].includes(value);
                        })) {
                            return false;
                        }
                    } else {
                        if (searchFilters[tagType].values.length !== 0 && !searchFilters[tagType].values.some((value) => {
                            return entry[tagType.toLowerCase()].includes(value);
                        })) {
                            return false;
                        }
                    }
                }
            }
            if (searchFilters.pagesLower) {
                if (entry.pages < searchFilters.pagesLower) {
                    return false;
                }
            }
            if (searchFilters.pagesUpper) {
                if (entry.pages > searchFilters.pagesUpper) {
                    return false;
                }
            }
            if (searchFilters.readCountLower) {
                if (entry.readCount < searchFilters.readCountLower) {
                    return false;
                }
            }
            if (searchFilters.readCountUpper) {
                if (entry.pages > searchFilters.readCountUpper) {
                    return false;
                }
            }
            return true;
        });

        filtered.sort((a, b) => b.timestamp - a.timestamp)
            .forEach((entry) => {
                results.appendChild(makeCover({
                    ...entry
                }, {
                    ...settings, lastRead: true, detailReads: true
                }));
            });
        if (filtered.length === 0) {
            results.appendChild(makeEndCard({
                nothing: true, showTip: galleryNb > latestReads.length, isSearch: true
            }));
        } else {
            if (galleryNb > latestReads.length) {
                results.appendChild(makeEndCard({nothing: false, isSearch: true, showTip: true}));
            }
        }
    }

    const debouncedSearch = debounce(search, 300);

    const filters = document.querySelector("#filters");
    pluralCapTagTypes.forEach((tagType) => {
        searchFilters[tagType] = {values: [], isAnd: true}

        const filter = document.createElement("form");
        filter.className = "filter";
        filter.innerHTML = `
<datalist id="${tagType}-data"></datalist>
<label>${tagType}
<input type="text" list="${tagType}-data">
</label>
<button type="submit">Add</button>
<label>
    <input type="radio" name="choice" value="and" checked style="display: inline; width: fit-content">
    And
  </label>
  <label>
    <input type="radio" name="choice" value="or" style="display: inline; width: fit-content">
    Or
  </label>
<div class="current-elements"></div>`;

        const input = filter.querySelector("input");
        const currentElements = filter.querySelector(".current-elements");
        const orButton = filter.querySelector(`[value="or"]`);
        const andButton = filter.querySelector(`[value="and"]`);

        orButton.addEventListener("change", (e) => {
            e.preventDefault();
            searchFilters[tagType].isAnd = false;
            debouncedSearch();
        })

        andButton.addEventListener("change", (e) => {
            e.preventDefault();
            searchFilters[tagType].isAnd = true;
            debouncedSearch();
        })

        filter.addEventListener("submit", (e) => {
            const currentValue = input.value;
            e.preventDefault();
            if (currentValue !== "") {
                input.value = "";
                const newElement = document.createElement("p");
                newElement.innerText = currentValue;
                searchFilters[tagType].values.push(currentValue);
                newElement.addEventListener("click", (e) => {
                    e.preventDefault();
                    const index = searchFilters[tagType].values.indexOf(currentValue);
                    if (index !== -1) {
                        searchFilters[tagType].values.splice(index, 1);
                        newElement.remove();
                        debouncedSearch();
                    }
                });
                currentElements.appendChild(newElement);
                debouncedSearch();
            }
        });

        filters.appendChild(filter);
    });

    const entryCountForm = document.querySelector("#entry-count-form");
    const entryCount = document.querySelector("#entry-count");
    entryCountForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nbEntries = entryCount.value === "" ? NaN : parseInt(entryCount.value);
        console.log(nbEntries, entryCount.value)
        if (!isNaN(nbEntries)) {
            updateEntries(nbEntries);
        }
    })

    titleInput.addEventListener("input", () => {
        searchFilters.titleValue = titleInput.value;
        debouncedSearch();
    });

    const pagesLower = document.querySelector("#pages-lower");
    pagesLower.addEventListener("input", () => {
        const asInt = parseInt(pagesLower.value);
        searchFilters.pagesLower = isNaN(asInt) ? undefined : asInt;
        debouncedSearch();
    });

    const pagesUpper = document.querySelector("#pages-upper");
    pagesUpper.addEventListener("input", () => {
        const asInt = parseInt(pagesUpper.value);
        searchFilters.pagesUpper = isNaN(asInt) ? undefined : asInt;
        debouncedSearch();
    });

    const readCountLower = document.querySelector("#read-count-lower");
    readCountLower.addEventListener("input", () => {
        const asInt = parseInt(readCountLower.value);
        searchFilters.readCountLower = isNaN(asInt) ? undefined : asInt;
        debouncedSearch();
    });

    const readCountUpper = document.querySelector("#read-count-upper");
    readCountUpper.addEventListener("input", () => {
        const asInt = parseInt(readCountUpper.value);
        searchFilters.readCountUpper = isNaN(asInt) ? undefined : asInt;
        debouncedSearch();
    });

    updateEntries(settings.searchEntryCount);
}

chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status !== "ok") {
        console.warn("Could not get settings because of ", result.reason, ", using defaults");
    }
    setupSearch(result.settings);
});