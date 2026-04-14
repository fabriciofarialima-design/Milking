// ==============================
// CONFIGURAÇÃO
// ==============================
const SUPABASE_URL = 'https://dyjmkkyqjcvixcnoeqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5am1ra3lxamN2aXhjbm9lcWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjUyMDYsImV4cCI6MjA5MTcwMTIwNn0._8a35VmzXiOgFmkRloI5EahNIU1Loy4FGw9X0r1Yyck';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// ELEMENTOS
// ==============================
const $login = document.getElementById('login-screen');
const $dash = document.getElementById('dashboard-screen');
const $loginForm = document.getElementById('login-form');
const $loginError = document.getElementById('login-error');
const $logoutBtn = document.getElementById('logout-btn');
const $totalQuotes = document.getElementById('total-quotes');
const $totalCnpjs = document.getElementById('total-cnpjs');
const $last7days = document.getElementById('last-7-days');
const $cnpjTable = document.getElementById('cnpj-table-body');
const $recentTable = document.getElementById('recent-table-body');
const $loading = document.getElementById('loading');

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
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
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
});

// ==============================
// DASHBOARD
// ==============================
async function showDashboard() {
  $login.classList.add('hidden');
  $dash.classList.remove('hidden');
  $loading.classList.remove('hidden');

  const { data, error } = await sb.from('quotes')
    .select('cnpj, customer_name, city, whatsapp, created_at, quote_code, item_count, items')
    .order('created_at', { ascending: false });

  $loading.classList.add('hidden');

  if (error) {
    console.error('Query error:', error);
    $cnpjTable.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    $totalQuotes.textContent = '0';
    $totalCnpjs.textContent = '0';
    $last7days.textContent = '0';
    $cnpjTable.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Nenhuma cotacao encontrada.</td></tr>';
    $recentTable.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Nenhuma cotacao encontrada.</td></tr>';
    return;
  }

  renderStats(data);
  renderCnpjTable(data);
  renderRecentTable(data);
}

// ==============================
// STATS
// ==============================
function renderStats(data) {
  $totalQuotes.textContent = data.length;
  const uniqueCnpjs = new Set(data.map(q => q.cnpj));
  $totalCnpjs.textContent = uniqueCnpjs.size;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = data.filter(q => new Date(q.created_at) >= sevenDaysAgo);
  $last7days.textContent = recent.length;
}

// ==============================
// CNPJ TABLE
// ==============================
function formatCNPJ(cnpj) {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function renderCnpjTable(data) {
  const groups = {};
  data.forEach(q => {
    const key = q.cnpj.replace(/\D/g, '');
    if (!groups[key]) {
      groups[key] = { cnpj: key, name: q.customer_name, city: q.city, count: 0, lastDate: q.created_at, quotes: [] };
    }
    groups[key].count++;
    groups[key].quotes.push(q);
  });

  const sorted = Object.values(groups).sort((a, b) => b.count - a.count);

  $cnpjTable.innerHTML = sorted.map((g, idx) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="toggleExpand(${idx})">
      <td class="px-4 py-3 font-mono text-sm">${formatCNPJ(g.cnpj)}</td>
      <td class="px-4 py-3 text-sm">${esc(g.name)}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${esc(g.city || '-')}</td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-bold text-sm">${g.count}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-500">${formatDate(g.lastDate)}</td>
    </tr>
    <tr id="expand-${idx}" class="hidden">
      <td colspan="5" class="px-4 py-2 bg-gray-50">
        <table class="w-full text-xs">
          <thead><tr class="text-gray-400"><th class="text-left py-1 px-2">Codigo</th><th class="text-left py-1 px-2">Data</th><th class="text-left py-1 px-2">Itens</th><th class="text-left py-1 px-2">Qtd Total</th></tr></thead>
          <tbody>
            ${g.quotes.map(q => `
              <tr class="border-t border-gray-100">
                <td class="py-1 px-2"><a href="../pedido.html#code=${q.quote_code}" target="_blank" class="text-brand-600 hover:underline">${esc(q.quote_code)}</a></td>
                <td class="py-1 px-2">${formatDate(q.created_at)}</td>
                <td class="py-1 px-2">${Array.isArray(q.items) ? q.items.length : '-'} produtos</td>
                <td class="py-1 px-2">${q.item_count} un</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </td>
    </tr>
  `).join('');
}

function toggleExpand(idx) {
  const row = document.getElementById(`expand-${idx}`);
  row.classList.toggle('hidden');
}

// ==============================
// RECENT TABLE
// ==============================
function renderRecentTable(data) {
  const recent = data.slice(0, 50);
  $recentTable.innerHTML = recent.map(q => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="px-4 py-3 text-sm">
        <a href="../pedido.html#code=${q.quote_code}" target="_blank" class="text-brand-600 hover:underline font-medium">${esc(q.quote_code)}</a>
      </td>
      <td class="px-4 py-3 font-mono text-sm">${formatCNPJ(q.cnpj)}</td>
      <td class="px-4 py-3 text-sm">${esc(q.customer_name)}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${formatDate(q.created_at)}</td>
      <td class="px-4 py-3 text-center text-sm">${q.item_count} un</td>
    </tr>
  `).join('');
}

// ==============================
// HELPERS
// ==============================
function formatDate(iso) {
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
