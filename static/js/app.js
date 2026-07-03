/* ═══════════════════════════════════════════════════════════════
   NutriBot — Frontend Application Logic
   app.js
════════════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────
const State = {
  chatHistory:   [],
  userProfile:   {},
  familyMembers: [],
  theme:         localStorage.getItem('nb-theme') || 'light',
};

// ── DOM Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);

function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

// ── Markdown Renderer ──────────────────────────────────────────
function renderMd(text) {
  if (typeof marked !== 'undefined') {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  // Fallback: basic newline → <br>
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = $('toastMsg');
  t.textContent = msg;
  show(t);
  clearTimeout(t._timer);
  t._timer = setTimeout(() => hide(t), duration);
}

// ── Loading Overlay ────────────────────────────────────────────
function showLoading(text = 'NutriBot is thinking...') {
  $('loadingText').textContent = text;
  show($('loadingOverlay'));
}

function hideLoading() { hide($('loadingOverlay')); }

// ── Theme ──────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('themeIcon');
  if (icon) {
    icon.className = theme === 'dark'
      ? 'bi bi-sun-fill'
      : 'bi bi-moon-stars-fill';
  }
  localStorage.setItem('nb-theme', theme);
  State.theme = theme;
}

// ── Tab Navigation ─────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.nb-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nb-nav-btn, .nb-mobile-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  const tab = $(`tab-${tabName}`);
  if (tab) tab.classList.add('active');
}

// ── Profile Helpers ────────────────────────────────────────────
function getProfile() {
  return {
    name:             $('p-name')?.value?.trim()  || '',
    age:              $('p-age')?.value           || '',
    gender:           $('p-gender')?.value        || '',
    weight:           $('p-weight')?.value        || '',
    height:           $('p-height')?.value        || '',
    goal:             $('p-goal')?.value          || '',
    diet_type:        $('p-diet')?.value          || '',
    health_conditions: $('p-conditions')?.value?.trim() || '',
    allergies:        $('p-allergies')?.value?.trim()   || '',
    cuisine:          'Indian',
    activity_level:   'moderate',
  };
}

function saveProfile() {
  State.userProfile = getProfile();
  showToast('✅ Profile saved!');
}

// ── Chat ───────────────────────────────────────────────────────
function appendMessage(role, content) {
  const container = $('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = `nb-msg nb-msg-${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'nb-msg-avatar';
  avatar.textContent = role === 'bot' ? '🥗' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'nb-msg-bubble nb-rendered-md';
  bubble.innerHTML = renderMd(content);

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

async function sendChat(message) {
  if (!message.trim()) return;

  appendMessage('user', message);
  State.chatHistory.push({ role: 'user', content: message });

  show($('typingIndicator'));
  $('chatInput').value = '';
  autoResize($('chatInput'));
  $('sendBtn').disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: message,
        history: State.chatHistory.slice(-10),
        profile: State.userProfile,
      }),
    });

    const data = await res.json();
    const reply = data.reply || data.error || 'Something went wrong.';

    appendMessage('bot', reply);
    State.chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    appendMessage('bot', '⚠️ Network error. Please check your connection and try again.');
    console.error('Chat error:', err);
  } finally {
    hide($('typingIndicator'));
    $('sendBtn').disabled = false;
    $('chatInput').focus();
  }
}

// ── Nutrition Plan ─────────────────────────────────────────────
async function generateNutritionPlan() {
  const profile = {
    name:             $('d-name')?.value?.trim(),
    age:              $('d-age')?.value,
    gender:           $('d-gender')?.value,
    weight:           $('d-weight')?.value,
    height:           $('d-height')?.value,
    goal:             $('d-goal')?.value,
    diet_type:        $('d-diet')?.value,
    activity_level:   $('d-activity')?.value,
    cuisine:          $('d-cuisine')?.value,
    health_conditions: $('d-conditions')?.value?.trim(),
    allergies:        $('d-allergies')?.value?.trim(),
  };

  showLoading('Generating your personalized nutrition plan...');
  const output = $('nutritionPlanOutput');
  output.innerHTML = '';

  try {
    const res = await fetch('/api/nutrition-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(profile),
    });

    const data = await res.json();
    const plan = data.plan || data.error || 'Unable to generate plan.';

    output.innerHTML = `<div class="nb-ai-output nb-rendered-md">${renderMd(plan)}</div>`;
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Failed to generate plan. Check your credentials.</p>';
    console.error('Plan error:', err);
  } finally {
    hideLoading();
  }
}

// ── Meal Analyzer ──────────────────────────────────────────────
async function analyzeMeal() {
  const meal = $('mealAnalyzerInput')?.value.trim();
  if (!meal) { showToast('Please describe your meal first.'); return; }

  showLoading('Analyzing your meal...');
  const output = $('mealAnalysisOutput');

  try {
    const res = await fetch('/api/analyze-meal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ meal }),
    });

    const data = await res.json();
    const analysis = data.analysis || data.error || 'Unable to analyze meal.';

    output.innerHTML = `<div class="nb-rendered-md">${renderMd(analysis)}</div>`;
    show(output);
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Analysis failed.</p>';
    show(output);
    console.error('Analyze error:', err);
  } finally {
    hideLoading();
  }
}

// ── Meal Plan ──────────────────────────────────────────────────
async function generateMealPlan() {
  const prefs = {
    days:            parseInt($('mp-days')?.value) || 7,
    meals_per_day:   parseInt($('mp-meals')?.value) || 3,
    diet_type:       $('mp-diet')?.value || 'balanced',
    target_calories: parseInt($('mp-calories')?.value) || 2000,
    cuisine:         $('mp-cuisine')?.value || 'Indian',
    goal:            $('mp-goal')?.value || 'healthy eating',
    exclusions:      $('mp-exclusions')?.value?.trim() || 'none',
  };

  showLoading(`Generating your ${prefs.days}-day meal plan...`);
  const output = $('mealPlanOutput');
  output.innerHTML = '';

  try {
    const res = await fetch('/api/meal-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(prefs),
    });

    const data = await res.json();
    const plan = data.meal_plan || data.error || 'Unable to generate plan.';

    output.innerHTML = `<div class="nb-ai-output nb-rendered-md">${renderMd(plan)}</div>`;
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Failed to generate meal plan.</p>';
    console.error('Meal plan error:', err);
  } finally {
    hideLoading();
  }
}

// ── BMI Calculator ─────────────────────────────────────────────
async function calculateBMI() {
  const weight   = parseFloat($('bmi-weight')?.value);
  const height   = parseFloat($('bmi-height')?.value);
  const age      = parseInt($('bmi-age')?.value) || 25;
  const gender   = $('bmi-gender')?.value || 'female';
  const activity = $('bmi-activity')?.value || 'moderate';

  if (!weight || !height || weight <= 0 || height <= 0) {
    showToast('⚠️ Please enter valid weight and height.');
    return;
  }

  showLoading('Calculating...');

  try {
    const res = await fetch('/api/bmi', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ weight, height, age, gender, activity_level: activity }),
    });

    const d = await res.json();
    if (d.error) { showToast('⚠️ ' + d.error); return; }

    // Populate results
    $('bmiScore').textContent    = d.bmi;
    $('bmiCategory').textContent = d.category;
    $('bmiAdvice').textContent   = d.advice;
    $('statBMR').textContent     = d.bmr?.toLocaleString() || '--';
    $('statTDEE').textContent    = d.tdee?.toLocaleString() || '--';
    $('statLoss').textContent    = d.weight_loss?.toLocaleString() || '--';
    $('statGain').textContent    = d.weight_gain?.toLocaleString() || '--';

    // Color BMI score
    const score = d.bmi;
    let color = '#34D399';
    if      (score < 18.5) color = '#60A5FA';
    else if (score < 25)   color = '#34D399';
    else if (score < 30)   color = '#FCD34D';
    else                   color = '#F87171';
    $('bmiScore').style.borderColor = color;
    $('bmiScore').style.color       = color;

    // BMI bar marker: map 10-45 BMI range to 0-100%
    const pct = Math.min(100, Math.max(0, ((d.bmi - 10) / 35) * 100));
    $('bmiMarker').style.left = `${pct}%`;

    // Macros
    const m = d.macros || {};
    const macroContainer = $('macroDisplay');
    const macros = [
      { name: 'Protein',       val: m.protein_g, unit: 'g', color: '#FF6B35', pct: 30 },
      { name: 'Carbohydrates', val: m.carbs_g,   unit: 'g', color: '#2563EB', pct: 45 },
      { name: 'Fats',          val: m.fat_g,     unit: 'g', color: '#7C3AED', pct: 25 },
    ];

    macroContainer.innerHTML = macros.map(mac => `
      <div class="col-12 col-md-4">
        <div class="nb-macro-bar-wrap">
          <div class="nb-macro-label">
            <span>${mac.name}</span>
            <strong>${mac.val ?? '--'}${mac.unit}</strong>
          </div>
          <div class="nb-macro-bar">
            <div class="nb-macro-fill" style="width:0%;background:${mac.color};"
              data-target="${mac.pct}"></div>
          </div>
        </div>
      </div>
    `).join('');

    // Animate bars
    setTimeout(() => {
      macroContainer.querySelectorAll('.nb-macro-fill').forEach(bar => {
        bar.style.width = bar.dataset.target + '%';
      });
    }, 100);

    hide($('bmiEmpty'));
    show($('bmiResults'));
  } catch (err) {
    showToast('⚠️ Calculation failed.');
    console.error('BMI error:', err);
  } finally {
    hideLoading();
  }
}

// ── Family Planner ─────────────────────────────────────────────
function renderFamilyList() {
  const list   = $('familyMembersList');
  const empty  = $('familyEmpty');
  const genBtn = $('generateFamilyPlanBtn');

  list.innerHTML = '';

  if (State.familyMembers.length === 0) {
    show(empty);
    hide(genBtn);
    return;
  }

  hide(empty);
  show(genBtn);

  const avatars = ['👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👶'];

  State.familyMembers.forEach((member, idx) => {
    const card = document.createElement('div');
    card.className = 'nb-member-card';
    card.innerHTML = `
      <div class="nb-member-avatar">${avatars[idx % avatars.length]}</div>
      <div class="nb-member-info">
        <div class="nb-member-name">${escHtml(member.name || 'Member')}</div>
        <div class="nb-member-meta">
          Age ${member.age || '?'} • ${member.gender || ''} • ${member.goal || ''}
          ${member.conditions ? ' • ' + escHtml(member.conditions) : ''}
        </div>
      </div>
      <button class="nb-member-remove" data-idx="${idx}" title="Remove">
        <i class="bi bi-x-lg"></i>
      </button>
    `;
    list.appendChild(card);
  });

  // Remove buttons
  list.querySelectorAll('.nb-member-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      State.familyMembers.splice(parseInt(btn.dataset.idx), 1);
      renderFamilyList();
    });
  });
}

async function generateFamilyPlan() {
  if (State.familyMembers.length === 0) {
    showToast('Add at least one family member first.');
    return;
  }

  showLoading('Generating your family nutrition plan...');
  const output = $('familyPlanOutput');
  output.innerHTML = '';

  try {
    const res = await fetch('/api/family-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ members: State.familyMembers }),
    });

    const data = await res.json();
    const plan = data.plan || data.error || 'Unable to generate plan.';

    output.innerHTML = `<div class="nb-ai-output nb-rendered-md">${renderMd(plan)}</div>`;
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Failed to generate family plan.</p>';
    console.error('Family plan error:', err);
  } finally {
    hideLoading();
  }
}

// ── Textarea Auto-resize ────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ── Escape HTML ────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Health Check on Load ────────────────────────────────────────
async function checkHealth() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    if (!data.watsonx_connected) {
      console.warn('Watsonx.ai not connected — running in demo mode.');
    }
  } catch (e) { /* silent */ }
}

// ── Event Listeners ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Apply saved theme
  applyTheme(State.theme);

  // Health check
  checkHealth();

  // ── Theme toggle
  $('themeToggle')?.addEventListener('click', () => {
    applyTheme(State.theme === 'dark' ? 'light' : 'dark');
  });

  // ── Tab buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Mobile menu btn (also acts as tab toggle)
  $('mobileMenuBtn')?.addEventListener('click', () => {
    const nav = $('mobileNav');
    nav.style.display = nav.style.display === 'none' ? 'flex' : 'none';
  });

  // ── Save profile
  $('saveProfileBtn')?.addEventListener('click', saveProfile);

  // ── Chat send
  $('sendBtn')?.addEventListener('click', () => {
    sendChat($('chatInput').value);
  });

  $('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat($('chatInput').value);
    }
  });

  $('chatInput')?.addEventListener('input', function() { autoResize(this); });

  // ── Clear chat
  $('clearChatBtn')?.addEventListener('click', () => {
    const messages = $('chatMessages');
    // Keep only the welcome message
    while (messages.children.length > 1) {
      messages.removeChild(messages.lastChild);
    }
    State.chatHistory = [];
    showToast('Chat cleared');
  });

  // ── Quick prompts
  document.querySelectorAll('.nb-chip[data-prompt]').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = $('chatInput');
      input.value = chip.dataset.prompt;
      autoResize(input);
      switchTab('chat');
      sendChat(chip.dataset.prompt);
    });
  });

  // ── Dashboard: Generate Plan
  $('generatePlanBtn')?.addEventListener('click', generateNutritionPlan);

  // ── Dashboard: Analyze Meal
  $('analyzeMealBtn')?.addEventListener('click', analyzeMeal);
  $('mealAnalyzerInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeMeal();
  });

  // ── Meal Plan
  $('generateMealPlanBtn')?.addEventListener('click', generateMealPlan);

  // ── BMI Calculator
  $('calcBmiBtn')?.addEventListener('click', calculateBMI);

  // Allow Enter in BMI inputs
  ['bmi-weight', 'bmi-height', 'bmi-age'].forEach(id => {
    $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') calculateBMI(); });
  });

  // ── Family: Add Member Form toggle
  $('addMemberBtn')?.addEventListener('click', () => {
    show($('addMemberForm'));
    $('fm-name')?.focus();
  });

  $('cancelMemberBtn')?.addEventListener('click', () => {
    hide($('addMemberForm'));
    clearMemberForm();
  });

  $('saveMemberBtn')?.addEventListener('click', () => {
    const name = $('fm-name')?.value?.trim();
    if (!name) { showToast('Please enter a name for the member.'); return; }

    State.familyMembers.push({
      name:       name,
      age:        $('fm-age')?.value || '?',
      gender:     $('fm-gender')?.value || 'female',
      goal:       $('fm-goal')?.value || 'healthy eating',
      conditions: $('fm-conditions')?.value?.trim() || 'none',
    });

    renderFamilyList();
    hide($('addMemberForm'));
    clearMemberForm();
    showToast(`✅ ${name} added to family!`);
  });

  $('generateFamilyPlanBtn')?.addEventListener('click', generateFamilyPlan);

  // Render initial (empty) family list
  renderFamilyList();
});

function clearMemberForm() {
  ['fm-name', 'fm-age', 'fm-conditions'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
}
