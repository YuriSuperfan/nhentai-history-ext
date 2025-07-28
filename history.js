function renderHistory(history, filter = '') {
  const container = document.getElementById('history');
  container.innerHTML = '';

  const lowerFilter = filter.toLowerCase();
  const entries = Object.values(history)
    .filter(entry => {
		const t = new Date(entry.time);
		const formattedTime = `${t.getFullYear()}-${(t.getMonth() + 1).toString().padStart(2, '0')}-${t.getDate().toString().padStart(2, '0')}`;
      return entry.title.toLowerCase().includes(lowerFilter) ||
             formattedTime.includes(lowerFilter);
    })
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'entry';
	
		const t = new Date(entry.time);
		const formattedTime = `${t.getFullYear()}-${(t.getMonth() + 1).toString().padStart(2, '0')}-${t.getDate().toString().padStart(2, '0')} ${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;


    item.innerHTML = `
      <a href="https://nhentai.net/g/${entry.id}/" target="_blank">
        <img src="${entry.thumb}" alt="${entry.title}" />
      </a>
      <div class="info">
        <a href="https://nhentai.net/g/${entry.id}/" target="_blank">${entry.title}</a>
        <div class="date">Last read : ${formattedTime}</div>
        <button class="delete" data-id="${entry.id}">🗑 Remove</button>
      </div>
    `;
    container.appendChild(item);
  }

  // Set up delete handlers
  document.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      chrome.storage.local.get(['nhentaiHistory'], (result) => {
        const history = result.nhentaiHistory || {};
        delete history[id];
        chrome.storage.local.set({ nhentaiHistory: history }, () => renderHistory(history, document.getElementById('search').value));
      });
    });
  });
}

chrome.storage.local.get(['nhentaiHistory'], (result) => {
  renderHistory(result.nhentaiHistory || {});
});

document.getElementById('search').addEventListener('input', e => {
  chrome.storage.local.get(['nhentaiHistory'], (result) => {
    renderHistory(result.nhentaiHistory || {}, e.target.value);
  });
});
