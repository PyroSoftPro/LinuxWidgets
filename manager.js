const COLORS = {
  weather: '#fbbf24', system: '#a78bfa', network: '#34d399',
  sticky: '#fbbf24', calendar: '#f472b6', clock: '#fb923c',
};

// Spawn widgets on card click
document.getElementById('widget-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.widget-card');
  if (!card) return;
  window.api.spawnWidget(card.dataset.type);
});

// Window controls
document.getElementById('btn-min').addEventListener('click', () => window.api.minimizeManager());
document.getElementById('btn-close').addEventListener('click', () => window.api.closeManager());

// Render active widgets
function renderActiveList(widgets) {
  const list = document.getElementById('active-list');
  const count = document.getElementById('active-count');
  count.textContent = widgets.length;

  if (widgets.length === 0) {
    list.innerHTML = '<div class="empty-state">No active widgets. Click a card above to add one.</div>';
    return;
  }

  list.innerHTML = widgets.map(w => `
    <div class="active-item" data-id="${w.id}">
      <div class="dot" style="background:${COLORS[w.type] || '#60a5fa'}"></div>
      <div class="info">
        <div class="name">${w.type}</div>
        <div class="id">${w.id}</div>
      </div>
      <button class="remove-btn" data-id="${w.id}" title="Remove">&times;</button>
    </div>
  `).join('');

  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.api.removeWidget(btn.dataset.id);
    });
  });
}

// Load on start
window.api.getWidgets().then(renderActiveList);
window.api.onWidgetsUpdated(renderActiveList);
