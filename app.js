const COLOR_ORDER = ['white','pink','red','purple','blue','turquoise','green','gold','brown','gray','black'];

const FINISH_LABELS = {
  glossy: 'Brillant',
  matte: 'Mat',
  satin: 'Satiné',
  crackle: 'Craquelé',
  effect: 'Effet',
};

const FORM_LABELS = {
  liquid: 'Liquide',
  powder: 'Poudre',
};

const BRAND_SHORT = {
  'Brilliant Botz': 'Botz',
  'Cigale & Fourmi': 'C&F',
  'Amaco': 'Amaco',
};

let allGlazes = [];
let filters = { brand: 'all', temp: 'all', form: 'all', color: 'all' };
let selectedTags = new Set();
let searchQuery = '';

async function init() {
  const response = await fetch('glazes.json');
  const data = await response.json();
  allGlazes = data.glazes;
  render();
  setupFilters();
  setupSearch();
  setupTagFilter();
  setupViewToggle();
}

function formatTemp(glaze) {
  if (glaze.tempCategory === 'gres' && glaze.brand === 'Amaco') {
    return `Cône 5–6 (${glaze.tempMin}–${glaze.tempMax}°C)`;
  }
  return `${glaze.tempMin}–${glaze.tempMax}°C`;
}

function buildCard(glaze) {
  const template = document.getElementById('card-template');
  const card = template.content.cloneNode(true);

  card.querySelector('.card-swatch').style.background = glaze.colorHex;

  if (glaze.imageUrl) {
    const img = card.querySelector('.card-img');
    img.src = glaze.imageUrl;
    img.alt = glaze.name;
    img.dataset.loaded = 'false';
    img.addEventListener('load', () => { img.dataset.loaded = 'true'; });
    img.addEventListener('error', () => { img.remove(); });
  } else {
    card.querySelector('.card-img').remove();
  }

  card.querySelector('.card-ref').textContent = glaze.reference;
  card.querySelector('.card-brand-badge').textContent = BRAND_SHORT[glaze.brand] ?? glaze.brand;
  card.querySelector('.card-name').textContent = glaze.name;
  card.querySelector('.tag-temp').textContent = formatTemp(glaze);
  card.querySelector('.tag-finish').textContent = FINISH_LABELS[glaze.finish] ?? glaze.finish;
  card.querySelector('.tag-form').textContent = FORM_LABELS[glaze.form] ?? glaze.form;

  const notes = card.querySelector('.card-notes');
  if (glaze.notes) {
    notes.textContent = glaze.notes;
  } else {
    notes.remove();
  }

  const link = card.querySelector('.card-link');
  if (glaze.productUrl) {
    link.href = glaze.productUrl;
  } else {
    link.remove();
  }

  return card;
}

function render() {
  const grid = document.getElementById('glaze-grid');
  const emptyState = document.getElementById('empty-state');
  grid.innerHTML = '';

  const q = searchQuery.toLowerCase().trim();

  const filtered = allGlazes.filter(g => {
    if (filters.brand !== 'all' && g.brand !== filters.brand) return false;
    if (filters.temp !== 'all' && g.tempCategory !== filters.temp) return false;
    if (filters.form !== 'all' && g.form !== filters.form) return false;
    if (filters.color !== 'all' && g.colorFamily !== filters.color) return false;
    if (selectedTags.size > 0 && !g.tags.some(t => selectedTags.has(t))) return false;
    if (q && !`${g.name} ${g.notes} ${g.reference}`.toLowerCase().includes(q)) return false;
    return true;
  });

  filtered.sort((a, b) => COLOR_ORDER.indexOf(a.colorFamily) - COLOR_ORDER.indexOf(b.colorFamily));

  document.getElementById('count-badge').textContent =
    `${filtered.length} / ${allGlazes.length} émaux`;

  emptyState.hidden = filtered.length > 0;
  filtered.forEach(g => grid.appendChild(buildCard(g)));
}

function setupFilters() {
  const filterMap = {
    'filter-brand': 'brand',
    'filter-temp': 'temp',
    'filter-form': 'form',
    'filter-color': 'color',
  };

  Object.entries(filterMap).forEach(([elId, filterKey]) => {
    document.getElementById(elId).addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const wasActive = chip.classList.contains('active');
      document.querySelectorAll(`#${elId} .chip`).forEach(c => c.classList.remove('active'));
      if (wasActive && chip.dataset.value !== 'all') {
        document.querySelector(`#${elId} [data-value="all"]`).classList.add('active');
        filters[filterKey] = 'all';
      } else {
        chip.classList.add('active');
        filters[filterKey] = chip.dataset.value;
      }
      render();
    });
  });
}

function setupTagFilter() {
  document.getElementById('filter-type').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const value = chip.dataset.value;
    if (value === 'all') {
      selectedTags.clear();
      document.querySelectorAll('#filter-type .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else {
      document.querySelector('#filter-type [data-value="all"]').classList.remove('active');
      if (chip.classList.contains('active')) {
        chip.classList.remove('active');
        selectedTags.delete(value);
        if (selectedTags.size === 0) {
          document.querySelector('#filter-type [data-value="all"]').classList.add('active');
        }
      } else {
        chip.classList.add('active');
        selectedTags.add(value);
      }
    }
    render();
  });
}

function setupSearch() {
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    render();
  });
}

function setupViewToggle() {
  document.getElementById('view-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('glaze-grid').classList.toggle('mode-picture', btn.dataset.mode === 'picture');
  });
}

init();
