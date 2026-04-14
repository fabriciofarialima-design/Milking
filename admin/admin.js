// ==============================
// CONFIGURAÇÃO
// ==============================
const SUPABASE_URL = 'https://dyjmkkyqjcvixcnoeqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5am1ra3lxamN2aXhjbm9lcWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjUyMDYsImV4cCI6MjA5MTcwMTIwNn0._8a35VmzXiOgFmkRloI5EahNIU1Loy4FGw9X0r1Yyck';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// STATE
// ==============================
let allData = [];
let filteredData = [];
let currentSort = { key: 'count', dir: 'desc' };
let activeCard = 'all';

// ==============================
// ELEMENTOS
// ==============================
const $ = id => document.getElementById(id);
const $login = $('login-screen');
const $dash = $('dashboard-screen');
const $loginForm = $('login-form');
const $loginError = $('login-error');
const $logoutBtn = $('logout-btn');
const $totalQuotes = $('total-quotes');
const $totalCnpjs = $('total-cnpjs');
const $last7days = $('last-7-days');
const $cnpjTable = $('cnpj-table-body');
const $recentTable = $('recent-table-body');
const $loading = $('loading');
const $sectionCnpj = $('section-cnpj');
const $sectionRecent = $('section-recent');
const $emptyState = $('empty-state');
const $noResults = $('no-results');
const $searchInput = $('search-input');
const $periodFilter = $('period-filter');

// ==============================
// AUTH
// ==============================
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    $login.classList.remove('hidden');
  }
}

$loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  $loginError.classList.add('hidden');
  const btn = $('login-btn');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const email = $('email').value.trim();
  const password = $('password').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    $loginError.textContent = 'Email ou senha incorretos.';
    $loginError.classList.remove('hidden');
    return;
  }
  showDashboard();
});

$logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  $dash.classList.add('hidden');
  $login.classList.remove('hidden');
  $loginError.classList.add('hidden');
});

// ==============================
// DASHBOARD
// ==============================
async function showDashboard() {
  $login.classList.add('hidden');
  $dash.classList.remove('hidden');
  $sectionCnpj.classList.add('hidden');
  $sectionRecent.classList.add('hidden');
  $emptyState.classList.add('hidden');
  $noResults.classList.add('hidden');
  $loading.classList.remove('hidden');

  // Skeleton loading for cards
  [$totalQuotes, $totalCnpjs, $last7days].forEach(el => { el.innerHTML = '<span class="skeleton"></span>'; });
  ['trend-quotes', 'trend-cnpjs', 'trend-7days'].forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });

  const { data, error } = await sb.from('quotes')
    .select('cnpj, customer_name, city, whatsapp, created_at, quote_code, item_count, items, order_url')
    .order('created_at', { ascending: false });

  $loading.classList.add('hidden');

  if (error) {
    console.error('Query error:', error);
    $emptyState.classList.remove('hidden');
    $emptyState.querySelector('h3').textContent = 'Erro ao carregar dados';
    $emptyState.querySelector('p').textContent = 'Verifique sua conexão e tente novamente.';
    return;
  }

  allData = data || [];

  if (allData.length === 0) {
    $totalQuotes.textContent = '0';
    $totalCnpjs.textContent = '0';
    $last7days.textContent = '0';
    ['trend-quotes', 'trend-cnpjs', 'trend-7days'].forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
    $emptyState.classList.remove('hidden');
    return;
  }

  $('last-update').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  applyFilters();
}

async function refreshDashboard() {
  const btn = document.querySelector('.btn-refresh');
  btn.classList.add('loading');
  await showDashboard();
  btn.classList.remove('loading');
}

// ==============================
// FILTERS
// ==============================
function applyFilters() {
  const search = ($searchInput?.value || '').toLowerCase().trim();
  const period = $periodFilter?.value || 'all';

  let data = [...allData];

  // Filter by period
  if (period !== 'all') {
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    data = data.filter(q => new Date(q.created_at) >= cutoff);
  }

  // Filter by search (CNPJ, revenda, cidade, produto)
  if (search) {
    data = data.filter(q => {
      const cnpjClean = (q.cnpj || '').replace(/\D/g, '');
      const cnpjFormatted = formatCNPJ(q.cnpj || '');
      const itemsMatch = Array.isArray(q.items) && q.items.some(i =>
        (i.name || '').toLowerCase().includes(search) ||
        (i.code || '').toLowerCase().includes(search)
      );
      return cnpjClean.includes(search.replace(/\D/g, '')) ||
        cnpjFormatted.toLowerCase().includes(search) ||
        (q.customer_name || '').toLowerCase().includes(search) ||
        (q.city || '').toLowerCase().includes(search) ||
        itemsMatch;
    });
  }

  filteredData = data;
  renderStats(allData, data);

  if (data.length === 0 && allData.length > 0) {
    $sectionCnpj.classList.add('hidden');
    $sectionRecent.classList.add('hidden');
    $noResults.classList.remove('hidden');
    $emptyState.classList.add('hidden');
    return;
  }

  $noResults.classList.add('hidden');
  $emptyState.classList.add('hidden');
  $sectionCnpj.classList.remove('hidden');
  $sectionRecent.classList.remove('hidden');
  renderCnpjTable(data);
  renderRecentTable(data);
}

function clearFilters() {
  $searchInput.value = '';
  $periodFilter.value = 'all';
  applyFilters();
}

// ==============================
// STATS
// ==============================
function renderStats(all, filtered) {
  $totalQuotes.textContent = filtered.length;
  const uniqueCnpjs = new Set(filtered.map(q => q.cnpj));
  $totalCnpjs.textContent = uniqueCnpjs.size;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const thisWeek = filtered.filter(q => new Date(q.created_at) >= sevenDaysAgo);
  const lastWeek = filtered.filter(q => {
    const d = new Date(q.created_at);
    return d >= fourteenDaysAgo && d < sevenDaysAgo;
  });

  $last7days.textContent = thisWeek.length;

  // Trend: quotes this week vs last week
  renderTrend('trend-7days', thisWeek.length, lastWeek.length);

  // Trend: unique CNPJs this week vs last week
  const cnpjsThisWeek = new Set(thisWeek.map(q => q.cnpj)).size;
  const cnpjsLastWeek = new Set(lastWeek.map(q => q.cnpj)).size;
  renderTrend('trend-cnpjs', cnpjsThisWeek, cnpjsLastWeek);

  // Trend: total quotes (split filtered period in half for comparison)
  if (filtered.length > 0) {
    const oldest = new Date(filtered[filtered.length - 1].created_at).getTime();
    const newest = now.getTime();
    const midpoint = new Date(oldest + (newest - oldest) / 2);
    const recentHalf = filtered.filter(q => new Date(q.created_at) >= midpoint).length;
    const olderHalf = filtered.filter(q => new Date(q.created_at) < midpoint).length;
    renderTrend('trend-quotes', recentHalf, olderHalf);
  }
}

function renderTrend(id, current, previous) {
  const el = $(id);
  if (!el) return;
  if (previous === 0 && current === 0) { el.classList.add('hidden'); return; }

  let pct, label;
  if (previous === 0) {
    label = '+' + current;
    el.className = 'text-[11px] font-semibold text-emerald-600';
  } else {
    pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) { el.classList.add('hidden'); return; }
    const sign = pct > 0 ? '+' : '';
    label = sign + pct + '%';
    el.className = pct > 0
      ? 'text-[11px] font-semibold text-emerald-600'
      : 'text-[11px] font-semibold text-red-500';
  }

  const arrow = (current >= previous)
    ? '<svg class="w-3 h-3 inline -mt-px" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>'
    : '<svg class="w-3 h-3 inline -mt-px" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

  el.innerHTML = arrow + ' ' + label;
  el.classList.remove('hidden');
  el.title = current >= previous
    ? 'vs. período anterior: ' + previous + ' → ' + current
    : 'vs. período anterior: ' + previous + ' → ' + current;
}

// ==============================
// CARD FILTER
// ==============================
function filterByCard(card) {
  activeCard = card;

  // Update active card styles
  document.querySelectorAll('.stat-card').forEach(el => el.classList.remove('stat-card-active'));
  const active = $('card-' + card);
  if (active) active.classList.add('stat-card-active');

  // Apply filter based on card
  if (card === '7days') {
    $periodFilter.value = '7';
  } else {
    if ($periodFilter.value === '7' && card !== '7days') {
      $periodFilter.value = '30';
    }
  }

  applyFilters();

  // Scroll to relevant section
  if (card === 'cnpjs') {
    $sectionCnpj?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    $sectionRecent?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==============================
// CNPJ TABLE
// ==============================
function formatCNPJ(cnpj) {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj || '';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function buildGroups(data) {
  const groups = {};
  data.forEach(q => {
    const key = (q.cnpj || '').replace(/\D/g, '');
    if (!groups[key]) {
      groups[key] = { cnpj: key, name: q.customer_name, city: q.city, count: 0, lastDate: q.created_at, quotes: [] };
    }
    groups[key].count++;
    groups[key].quotes.push(q);
  });
  return Object.values(groups);
}

function sortGroups(groups) {
  const { key, dir } = currentSort;
  const m = dir === 'desc' ? -1 : 1;
  return groups.sort((a, b) => {
    if (key === 'count') return (a.count - b.count) * m;
    if (key === 'date') return (new Date(a.lastDate) - new Date(b.lastDate)) * m;
    if (key === 'cnpj') return a.cnpj.localeCompare(b.cnpj) * m;
    return 0;
  });
}

function sortTable(key) {
  if (currentSort.key === key) {
    currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
  } else {
    currentSort = { key, dir: 'desc' };
  }
  applyFilters();
}

function renderCnpjTable(data) {
  const groups = sortGroups(buildGroups(data));
  $('cnpj-count').textContent = groups.length + ' CNPJ' + (groups.length !== 1 ? 's' : '');

  if (groups.length === 0) {
    $cnpjTable.innerHTML = '';
    return;
  }

  $cnpjTable.innerHTML = groups.map((g, idx) => `
    <tr class="border-b border-gray-100 hover:bg-brand-50/40 cursor-pointer transition-colors" onclick="toggleExpand(${idx})">
      <td class="px-4 py-3 w-8">
        <svg id="chevron-${idx}" class="chevron w-4 h-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </td>
      <td class="px-4 py-3 font-mono text-sm text-gray-700" data-label="CNPJ">${formatCNPJ(g.cnpj)}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900" data-label="Revenda">${esc(g.name)}</td>
      <td class="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell" data-label="Cidade">${esc(g.city || '—')}</td>
      <td class="px-4 py-3 text-center" data-label="Cotações">
        <span class="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full bg-brand-50 text-brand-700 font-bold text-sm px-2">${g.count}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-500" data-label="Última">${formatDate(g.lastDate)}</td>
    </tr>
    <tr id="expand-${idx}" class="hidden">
      <td colspan="6" class="p-0">
        <div class="expand-row bg-gray-50/70 border-t border-gray-100 px-4 sm:px-8 py-3">
          <table class="w-full text-xs">
            <thead><tr class="text-gray-400 text-[10px] uppercase tracking-wider"><th class="text-left py-1.5 px-2 font-semibold">Código</th><th class="text-left py-1.5 px-2 font-semibold">Data</th><th class="text-left py-1.5 px-2 font-semibold">Itens</th><th class="text-left py-1.5 px-2 font-semibold">Qtd Total</th></tr></thead>
            <tbody>
              ${g.quotes.map(q => `
                <tr class="border-t border-gray-200/60">
                  <td class="py-2 px-2"><a href="${q.order_url || '#'}" target="_blank" class="text-brand-600 hover:text-brand-800 hover:underline font-medium">${esc(q.quote_code)}</a></td>
                  <td class="py-2 px-2 text-gray-500">${formatDate(q.created_at)}</td>
                  <td class="py-2 px-2 text-gray-600">${Array.isArray(q.items) ? q.items.length : '—'} produtos</td>
                  <td class="py-2 px-2 text-gray-600">${q.item_count} un</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleExpand(idx) {
  const row = document.getElementById(`expand-${idx}`);
  const chevron = document.getElementById(`chevron-${idx}`);
  const isHidden = row.classList.contains('hidden');

  // Close all others
  document.querySelectorAll('[id^="expand-"]').forEach(r => r.classList.add('hidden'));
  document.querySelectorAll('.chevron').forEach(c => c.classList.remove('open'));

  if (isHidden) {
    row.classList.remove('hidden');
    chevron.classList.add('open');
  }
}

// ==============================
// RECENT TABLE
// ==============================
function renderRecentTable(data) {
  const recent = data.slice(0, 50);
  $('recent-count').textContent = recent.length + ' mais recentes';

  $recentTable.innerHTML = recent.map(q => `
    <tr class="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
      <td class="px-4 py-3 text-sm" data-label="Código">
        <a href="${q.order_url || '#'}" target="_blank" class="text-brand-600 hover:text-brand-800 hover:underline font-medium">${esc(q.quote_code)}</a>
      </td>
      <td class="px-4 py-3 font-mono text-sm text-gray-700" data-label="CNPJ">${formatCNPJ(q.cnpj)}</td>
      <td class="px-4 py-3 text-sm text-gray-900 hidden sm:table-cell" data-label="Revenda">${esc(q.customer_name)}</td>
      <td class="px-4 py-3 text-sm text-gray-500" data-label="Data">${formatDate(q.created_at)}</td>
      <td class="px-4 py-3 text-center text-sm font-medium text-gray-700" data-label="Qtd">${q.item_count} un</td>
    </tr>
  `).join('');
}

// ==============================
// EXPORT CSV
// ==============================
function exportCSV() {
  const data = filteredData.length > 0 ? filteredData : allData;
  if (data.length === 0) return;

  const headers = ['Código', 'Data', 'CNPJ', 'Revenda', 'WhatsApp', 'Cidade', 'Itens', 'Qtd Total', 'Observações'];
  const rows = data.map(q => [
    q.quote_code,
    new Date(q.created_at).toLocaleString('pt-BR'),
    formatCNPJ(q.cnpj),
    q.customer_name || '',
    q.whatsapp || '',
    q.city || '',
    Array.isArray(q.items) ? q.items.map(i => `${i.code}x${i.qty}`).join('; ') : '',
    q.item_count,
    (q.notes || '').replace(/"/g, '""')
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `milking-cotacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==============================
// HELPERS
// ==============================
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==============================
// INIT
// ==============================
init();
