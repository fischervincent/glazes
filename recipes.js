const STORAGE_KEY = 'glaze-recipes';
const COLOR_ORDER = ['white','pink','red','purple','blue','turquoise','green','gold','brown','gray','black'];

let allGlazes = [];
let recipes = [];
let selFilters = { brand: 'all', temp: 'all', form: 'all', color: 'all' };
let selTags = new Set();
let selSearch = '';
let selectedIds = new Set();
let editingId = null;

// ── Storage ──

function loadRecipes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Init ──

async function init() {
  const res = await fetch('glazes.json');
  const data = await res.json();
  allGlazes = data.glazes.filter(g => g.owned !== false);
  recipes = loadRecipes();

  document.getElementById('new-recipe-btn').addEventListener('click', openNewEditor);
  document.getElementById('cancel-btn').addEventListener('click', closeEditor);
  document.getElementById('save-btn').addEventListener('click', saveRecipe);
  document.getElementById('recipe-name-input').addEventListener('input', e => e.target.classList.remove('input-error'));

  setupSelectorFilters();
  renderList();
}

// ── List ──

function renderList() {
  const container = document.getElementById('recipes-container');
  const empty = document.getElementById('no-recipes');
  const badge = document.getElementById('recipe-count');

  container.innerHTML = '';
  badge.textContent = `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`;
  empty.hidden = recipes.length > 0;

  const frag = document.createDocumentFragment();
  recipes.forEach(r => frag.appendChild(buildRecipeCard(r)));
  container.appendChild(frag);
}

function buildRecipeCard(recipe) {
  const glazes = (recipe.glazeIds || [])
    .map(id => allGlazes.find(g => g.id === id))
    .filter(Boolean);

  const card = document.createElement('article');
  card.className = 'recipe-card';

  // Header
  const top = document.createElement('div');
  top.className = 'recipe-card-top';
  top.innerHTML = `
    <h3 class="recipe-name">${esc(recipe.name || 'Untitled')}</h3>
    <div class="recipe-card-actions">
      <button class="btn-ghost edit-btn">Edit</button>
      <button class="btn-ghost btn-danger delete-btn">Delete</button>
    </div>`;
  card.appendChild(top);

  // Glaze strip
  if (glazes.length > 0) {
    const strip = document.createElement('div');
    strip.className = 'recipe-glaze-strip';
    glazes.forEach(g => {
      const chip = document.createElement('div');
      chip.className = 'recipe-glaze-chip';
      chip.style.background = g.colorHex;
      chip.title = g.name;
      chip.innerHTML = `<span class="recipe-glaze-label">${esc(g.name)}</span>`;
      strip.appendChild(chip);
    });
    card.appendChild(strip);
  }

  // Notes
  if (recipe.notes) {
    const notes = document.createElement('p');
    notes.className = 'recipe-notes';
    notes.textContent = recipe.notes;
    card.appendChild(notes);
  }

  // Photos
  const photos = recipe.photos || [];
  if (photos.length > 0) {
    const row = document.createElement('div');
    row.className = 'recipe-photos';
    photos.forEach((photo, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'recipe-photo-wrap';
      const badgeLabel = photo.type === 'result' ? 'Result' : 'Inspiration';
      wrap.innerHTML = `
        <img src="${photo.dataUrl}" alt="${esc(photo.caption || '')}">
        <div class="photo-overlay">
          <span class="photo-badge ${photo.type}">${badgeLabel}</span>
          ${photo.caption ? `<span class="photo-caption">${esc(photo.caption)}</span>` : ''}
          <button class="photo-delete-btn" title="Remove photo">×</button>
        </div>`;
      wrap.querySelector('.photo-delete-btn').addEventListener('click', () => removePhoto(recipe.id, idx));
      row.appendChild(wrap);
    });
    card.appendChild(row);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'recipe-footer';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-photo';
  addBtn.textContent = '+ Add photo';
  const dateEl = document.createElement('span');
  dateEl.className = 'recipe-date';
  dateEl.textContent = new Date(recipe.createdAt).toLocaleDateString('fr-FR');
  footer.appendChild(addBtn);
  footer.appendChild(dateEl);

  // Inline photo form
  const photoForm = buildPhotoForm(recipe.id);
  footer.appendChild(photoForm);
  addBtn.addEventListener('click', () => { photoForm.hidden = !photoForm.hidden; });

  card.appendChild(footer);

  top.querySelector('.edit-btn').addEventListener('click', () => openEditEditor(recipe.id));
  top.querySelector('.delete-btn').addEventListener('click', () => confirmDelete(recipe.id));

  return card;
}

// ── Photo form ──

function buildPhotoForm(recipeId) {
  const form = document.createElement('div');
  form.className = 'photo-form';
  form.hidden = true;
  const radioName = `pt-${recipeId}`;
  form.innerHTML = `
    <div class="photo-type-row">
      <label class="photo-type-opt"><input type="radio" name="${radioName}" value="inspiration" checked> Inspiration</label>
      <label class="photo-type-opt"><input type="radio" name="${radioName}" value="result"> Result</label>
    </div>
    <input type="text" class="field-input photo-caption-input" placeholder="Caption (optional)">
    <label class="photo-file-label">
      Choose image
      <input type="file" class="photo-file-input" accept="image/*">
    </label>
    <button class="btn-ghost photo-cancel-btn">Cancel</button>`;

  form.querySelector('.photo-cancel-btn').addEventListener('click', () => { form.hidden = true; });
  form.querySelector('.photo-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const type = form.querySelector(`input[name="${radioName}"]:checked`)?.value || 'inspiration';
    const caption = form.querySelector('.photo-caption-input').value.trim();
    const dataUrl = await resizeImage(file, 900);
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    if (!recipe.photos) recipe.photos = [];
    recipe.photos.push({ type, dataUrl, caption });
    persist();
    renderList();
  });

  return form;
}

function removePhoto(recipeId, idx) {
  if (!confirm('Remove this photo?')) return;
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  recipe.photos.splice(idx, 1);
  persist();
  renderList();
}

function confirmDelete(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!confirm(`Delete recipe "${recipe?.name || 'Untitled'}"?\nThis cannot be undone.`)) return;
  recipes = recipes.filter(r => r.id !== id);
  persist();
  renderList();
}

// ── Editor ──

function openNewEditor() {
  editingId = null;
  selectedIds = new Set();
  document.getElementById('editor-title').textContent = 'New Recipe';
  document.getElementById('recipe-name-input').value = '';
  document.getElementById('recipe-notes-input').value = '';
  showEditor();
}

function openEditEditor(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  editingId = id;
  selectedIds = new Set(recipe.glazeIds || []);
  document.getElementById('editor-title').textContent = 'Edit Recipe';
  document.getElementById('recipe-name-input').value = recipe.name || '';
  document.getElementById('recipe-notes-input').value = recipe.notes || '';
  showEditor();
}

function showEditor() {
  document.getElementById('list-view').hidden = true;
  document.getElementById('editor-view').hidden = false;
  renderSelectorGrid();
  renderSelectedPreview();
}

function closeEditor() {
  document.getElementById('editor-view').hidden = true;
  document.getElementById('list-view').hidden = false;
}

function saveRecipe() {
  const name = document.getElementById('recipe-name-input').value.trim();
  if (!name) {
    document.getElementById('recipe-name-input').classList.add('input-error');
    document.getElementById('recipe-name-input').focus();
    return;
  }
  const notes = document.getElementById('recipe-notes-input').value.trim();
  const glazeIds = [...selectedIds];
  const now = new Date().toISOString();

  if (editingId) {
    const idx = recipes.findIndex(r => r.id === editingId);
    if (idx >= 0) recipes[idx] = { ...recipes[idx], name, notes, glazeIds, updatedAt: now };
  } else {
    recipes.unshift({ id: uid(), name, notes, glazeIds, photos: [], createdAt: now, updatedAt: now });
  }

  persist();
  closeEditor();
  renderList();
}

// ── Selector grid ──

function renderSelectorGrid() {
  const grid = document.getElementById('selector-grid');
  grid.innerHTML = '';
  const q = selSearch.toLowerCase().trim();
  const filtered = allGlazes.filter(g => {
    if (selFilters.brand !== 'all' && g.brand !== selFilters.brand) return false;
    if (selFilters.temp !== 'all' && g.tempCategory !== selFilters.temp) return false;
    if (selFilters.form !== 'all' && g.form !== selFilters.form) return false;
    if (selFilters.color !== 'all' && g.colorFamily !== selFilters.color) return false;
    if (selTags.size > 0 && !g.tags.some(t => selTags.has(t))) return false;
    if (q && !`${g.name} ${g.notes} ${g.reference} ${g.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => COLOR_ORDER.indexOf(a.colorFamily) - COLOR_ORDER.indexOf(b.colorFamily));

  const frag = document.createDocumentFragment();
  filtered.forEach(g => frag.appendChild(buildSelectorCard(g)));
  grid.appendChild(frag);
}

function buildSelectorCard(glaze) {
  const selected = selectedIds.has(glaze.id);
  const card = document.createElement('div');
  card.className = `selector-card${selected ? ' selected' : ''}`;

  const swatch = document.createElement('div');
  swatch.className = 'card-swatch';
  swatch.style.background = glaze.colorHex;

  if (glaze.imageUrl) {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = glaze.imageUrl;
    img.alt = glaze.name;
    img.dataset.loaded = 'false';
    img.addEventListener('load', () => { img.dataset.loaded = 'true'; });
    img.addEventListener('error', () => img.remove());
    swatch.appendChild(img);
  }

  const check = document.createElement('div');
  check.className = 'selector-check';
  check.textContent = '✓';
  swatch.appendChild(check);

  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = `<h2 class="card-name">${esc(glaze.name)}</h2>`;

  card.appendChild(swatch);
  card.appendChild(body);

  card.addEventListener('click', () => {
    if (selectedIds.has(glaze.id)) {
      selectedIds.delete(glaze.id);
      card.classList.remove('selected');
    } else {
      selectedIds.add(glaze.id);
      card.classList.add('selected');
    }
    renderSelectedPreview();
  });

  return card;
}

function renderSelectedPreview() {
  const preview = document.getElementById('selected-preview');
  const glazes = [...selectedIds].map(id => allGlazes.find(g => g.id === id)).filter(Boolean);
  preview.innerHTML = '';

  if (glazes.length === 0) {
    preview.innerHTML = '<p class="preview-hint">Click glazes on the right to add them</p>';
    return;
  }

  glazes.forEach(g => {
    const chip = document.createElement('div');
    chip.className = 'selected-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${g.colorHex}"></span>
      <span class="chip-name">${esc(g.name)}</span>
      <button class="chip-remove" data-id="${g.id}" title="Remove">×</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => {
      selectedIds.delete(g.id);
      renderSelectorGrid();
      renderSelectedPreview();
    });
    preview.appendChild(chip);
  });
}

function setupSelectorFilters() {
  const map = { 'sel-filter-brand': 'brand', 'sel-filter-temp': 'temp', 'sel-filter-form': 'form', 'sel-filter-color': 'color' };

  Object.entries(map).forEach(([elId, key]) => {
    document.getElementById(elId).addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const wasActive = chip.classList.contains('active');
      document.querySelectorAll(`#${elId} .chip`).forEach(c => c.classList.remove('active'));
      if (wasActive && chip.dataset.value !== 'all') {
        document.querySelector(`#${elId} [data-value="all"]`).classList.add('active');
        selFilters[key] = 'all';
      } else {
        chip.classList.add('active');
        selFilters[key] = chip.dataset.value;
      }
      renderSelectorGrid();
    });
  });

  document.getElementById('sel-filter-type').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const value = chip.dataset.value;
    if (value === 'all') {
      selTags.clear();
      document.querySelectorAll('#sel-filter-type .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else {
      document.querySelector('#sel-filter-type [data-value="all"]').classList.remove('active');
      chip.classList.toggle('active');
      if (chip.classList.contains('active')) selTags.add(value);
      else selTags.delete(value);
      if (selTags.size === 0) document.querySelector('#sel-filter-type [data-value="all"]').classList.add('active');
    }
    renderSelectorGrid();
  });

  document.getElementById('sel-search').addEventListener('input', e => {
    selSearch = e.target.value;
    renderSelectorGrid();
  });
}

// ── Image resize ──

function resizeImage(file, maxPx) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Utils ──

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
