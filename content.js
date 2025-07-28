(async () => {
  const urlParts = window.location.pathname.split('/').filter(Boolean);
  if (urlParts[0] === 'g' && urlParts.length >= 2) {
    const doujinId = urlParts[1];

      let title = `${doujinId}`;
      let thumb = '';

      try {
        const galleryUrl = `https://nhentai.net/g/${doujinId}/`;
        const response = await fetch(galleryUrl);
        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Grab the cover image
          const coverEl = doc.querySelector('#cover img');
          if (coverEl) {
            thumb = coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '';
            if (thumb.startsWith('//')) {
              thumb = 'https:' + thumb;
            }
          }

          // Grab the meta title
          const metaTitle = doc.querySelector('meta[itemprop="name"]');
          if (metaTitle) {
            title = metaTitle.getAttribute('content') || title;
          }
        } else {
          console.warn(`Failed to fetch gallery page (status ${response.status})`);
        }
      } catch (e) {
        console.warn('Fetch error, falling back to first page image + generic title:', e);
      }

      // Fallback: first page image if no cover found
      if (!thumb) {
        const imgEl = document.querySelector('#image-container img');
        if (imgEl) {
          thumb = imgEl.src;
        }
      }

	  const now = new Date();
      

      const entry = {
        id: doujinId,
        title,
        thumb,
		time: now.toISOString(),
      };

      chrome.storage.local.get(['nhentaiHistory'], (result) => {
        const history = result.nhentaiHistory || {};
        history[doujinId] = entry;
        chrome.storage.local.set({ nhentaiHistory: history });
      });
    }
})();
