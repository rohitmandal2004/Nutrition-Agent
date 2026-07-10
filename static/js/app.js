/* ═══════════════════════════════════════════════════════════════
   NutriBot — Frontend Application Logic
   app.js
════════════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────
const State = {
  currentSessionId: null,
  userProfile:   JSON.parse(localStorage.getItem('nb-userProfile') || '{}'),
  familyMembers: JSON.parse(localStorage.getItem('nb-familyMembers') || '[]'),
  theme:         localStorage.getItem('nb-theme') || 'light',
  progressChart: null,
};

// ── DOM Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);

function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

// ── Markdown Renderer ──────────────────────────────────────────
function renderMd(text) {
  if (!text) return '';
  // Sanitize text: prevent markdown strikethroughs by removing tildes (which the AI sometimes uses for "approx")
  text = text.replace(/~/g, '');
  
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
  
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'chat') createNewSession();
}

// ── Profile Helpers ────────────────────────────────────────────
function getProfile() {
  return {
    avatar:           $('p-avatar')?.value?.trim() || '',
    name:             $('p-name')?.value?.trim()  || '',
    age:              $('p-age')?.value           || '',
    gender:           $('p-gender')?.value        || '',
    weight:           $('p-weight')?.value        || '',
    height:           $('p-height')?.value        || '',
    target_weight:    $('p-target-weight')?.value || '',
    goal:             $('p-goal')?.value          || '',
    diet_type:        $('p-diet')?.value          || '',
    health_conditions: $('p-conditions')?.value?.trim() || '',
    allergies:        $('p-allergies')?.value?.trim()   || '',
    medications:      $('p-medications')?.value?.trim() || '',
    blood:            $('p-blood')?.value         || '',
    activity_level:   $('p-activity')?.value      || 'moderate',
    exercise:         $('p-exercise')?.value?.trim() || '',
    sleep:            $('p-sleep')?.value         || '',
    water:            $('p-water')?.value         || '',
    waterCount:       State.userProfile?.waterCount || 0,
    cuisine:          'Indian',
  };
}

function saveProfile() {
  State.userProfile = getProfile();
  localStorage.setItem('nb-userProfile', JSON.stringify(State.userProfile));
  
  // Sync to bmi tab and others
  const p = State.userProfile;
  if (p.age) { ['bmi-age'].forEach(id => { if ($(id)) $(id).value = p.age; }); }
  if (p.gender) { ['bmi-gender'].forEach(id => { if ($(id)) $(id).value = p.gender; }); }
  if (p.weight) { ['bmi-weight'].forEach(id => { if ($(id)) $(id).value = p.weight; }); }
  if (p.height) { ['bmi-height'].forEach(id => { if ($(id)) $(id).value = p.height; }); }
  if (p.diet_type) { ['mp-diet'].forEach(id => { if ($(id)) $(id).value = p.diet_type; }); }
  
  // Update Profile Avatar preview
  if (p.avatar && $('profileAvatarImg')) {
    $('profileAvatarImg').src = p.avatar;
    $('p-avatar').style.display = 'none'; // hide input after save
  }

  if (typeof renderDashboard === 'function') renderDashboard();
  
  showToast('✅ Profile saved!');
}

// ── Chat ───────────────────────────────────────────────────────
function appendMessage(role, content) {
  const container = $('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = `nb-msg nb-msg-${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'nb-msg-avatar';
  if (role === 'bot') {
    avatar.textContent = '🥗';
  } else {
    if (State.userProfile && State.userProfile.avatar) {
      avatar.innerHTML = `<img src="${State.userProfile.avatar}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" />`;
    } else {
      avatar.textContent = '👤';
    }
  }

  const bubble = document.createElement('div');
  bubble.className = 'nb-msg-bubble nb-rendered-md';
  bubble.innerHTML = renderMd(content);

  // Inject Action Buttons
  if (role === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-2 mt-3 flex-wrap';
    
    if (content.toLowerCase().includes('meal plan')) {
      const btn = document.createElement('button');
      btn.className = 'nb-btn nb-btn-sm';
      btn.style.background = 'rgba(13, 110, 253, 0.1)';
      btn.style.color = '#0d6efd';
      btn.style.border = '1px solid rgba(13,110,253,0.3)';
      btn.innerHTML = '<i class="bi bi-calendar2-check"></i> Send to Meal Plan';
      btn.onclick = () => {
        if ($('mealPlanOutput')) {
          $('mealPlanOutput').innerHTML = `<div class="nb-ai-output nb-rendered-md">${renderMd(content)}</div>`;
          State.lastMealPlan = content;
          if ($('exportPdfBtn')) show($('exportPdfBtn'));
          if ($('groceryListBtn')) show($('groceryListBtn'));
          switchTab('mealplan');
          showToast('✅ Saved to Meal Plan tab');
        }
      };
      actions.appendChild(btn);
    }
    
    if (content.toLowerCase().includes('grocery') || content.toLowerCase().includes('shopping list')) {
      const btn = document.createElement('button');
      btn.className = 'nb-btn nb-btn-sm';
      btn.style.background = 'rgba(16, 185, 129, 0.1)';
      btn.style.color = '#10b981';
      btn.style.border = '1px solid rgba(16,185,129,0.3)';
      btn.innerHTML = '<i class="bi bi-cart3"></i> View Grocery List';
      btn.onclick = () => {
        $('groceryListContent').innerHTML = renderMd(content);
        show($('groceryListModal'));
      };
      actions.appendChild(btn);
    }

    if (actions.children.length > 0) {
      bubble.appendChild(actions);
    }
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

async function loadChatSessions() {
  try {
    const res = await fetch('/api/chats');
    const data = await res.json();
    const list = $('chatHistoryList');
    if (!list) return;
    list.innerHTML = '';
    
    if (data.sessions && data.sessions.length > 0) {
      data.sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'nb-chat-session-item' + (State.currentSessionId === session.id ? ' active' : '');
        
        const title = document.createElement('div');
        title.className = 'nb-chat-session-title';
        title.textContent = session.title || 'Chat';
        
        const delBtn = document.createElement('button');
        delBtn.className = 'nb-chat-session-delete';
        delBtn.innerHTML = '<i class="bi bi-trash3"></i>';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteSession(session.id);
        };
        
        item.appendChild(title);
        item.appendChild(delBtn);
        
        item.onclick = () => loadSessionMessages(session.id);
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<div class="nb-muted text-center mt-3 p-2">No past chats</div>';
    }
  } catch (err) {
    console.error('Failed to load chat sessions:', err);
  }
}

async function createNewSession(title = 'New Chat') {
  State.currentSessionId = null;
  
  // Close mobile sidebar if open
  $('chatSidebar')?.classList.remove('open');
  
  // Clear chat window
  const container = $('chatMessages');
  container.innerHTML = `
    <div class="nb-msg nb-msg-bot">
      <div class="nb-msg-avatar">🥗</div>
      <div class="nb-msg-bubble">
        <p><strong>Namaste! I'm NutriBot 👋</strong></p>
        <p>Your AI-powered family nutrition advisor, trained on Indian cuisine and global dietary guidelines.</p>
        <p>I can help you with:</p>
        <ul>
          <li>🍱 Personalized meal plans</li>
          <li>🔥 Calorie & macro analysis</li>
          <li>🥗 Healthy food suggestions</li>
          <li>👨‍👩‍👧‍👦 Family diet recommendations</li>
          <li>📊 BMI & TDEE calculations</li>
        </ul>
        <p>Fill in your profile in the Profile tab for personalized advice, or just start chatting!</p>
      </div>
    </div>
    
    <div class="nb-quick-prompts mt-3" style="justify-content: center;">
      <button class="nb-chip" data-prompt="What should I eat for breakfast today?">🍳 Breakfast ideas</button>
      <button class="nb-chip" data-prompt="Give me a high protein vegetarian meal plan">💪 High protein plan</button>
      <button class="nb-chip" data-prompt="What are the best Indian foods for weight loss?">⚖️ Weight loss foods</button>
      <button class="nb-chip" data-prompt="Suggest healthy Indian snacks under 200 calories">🥜 Healthy snacks</button>
    </div>
  `;
  
  await loadChatSessions();
}

async function loadSessionMessages(sessionId) {
  State.currentSessionId = sessionId;
  await loadChatSessions(); // to update active state
  
  // Close mobile sidebar if open
  $('chatSidebar')?.classList.remove('open');
  
  try {
    const res = await fetch(`/api/chats/${sessionId}`);
    const data = await res.json();
    
    const container = $('chatMessages');
    container.innerHTML = ''; // clear current
    
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
      });
    } else {
      // Empty session state
      container.innerHTML = `
        <div class="nb-msg nb-msg-bot">
          <div class="nb-msg-avatar">🥗</div>
          <div class="nb-msg-bubble">
            <p><strong>Namaste! I'm NutriBot 👋</strong></p>
            <p>Your AI-powered family nutrition advisor, trained on Indian cuisine and global dietary guidelines.</p>
            <p>I can help you with:</p>
            <ul>
              <li>🍱 Personalized meal plans</li>
              <li>🔥 Calorie & macro analysis</li>
              <li>🥗 Healthy food suggestions</li>
              <li>👨‍👩‍👧‍👦 Family diet recommendations</li>
              <li>📊 BMI & TDEE calculations</li>
            </ul>
            <p>Fill in your profile in the Profile tab for personalized advice, or just start chatting!</p>
          </div>
        </div>
        
        <div class="nb-quick-prompts mt-3" style="justify-content: center;">
          <button class="nb-chip" data-prompt="What should I eat for breakfast today?">🍳 Breakfast ideas</button>
          <button class="nb-chip" data-prompt="Give me a high protein vegetarian meal plan">💪 High protein plan</button>
          <button class="nb-chip" data-prompt="What are the best Indian foods for weight loss?">⚖️ Weight loss foods</button>
          <button class="nb-chip" data-prompt="Suggest healthy Indian snacks under 200 calories">🥜 Healthy snacks</button>
        </div>
      `;
    }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this chat?')) return;
  
  try {
    await fetch(`/api/chats/${sessionId}`, { method: 'DELETE' });
    if (State.currentSessionId === sessionId) {
      await createNewSession();
    } else {
      await loadChatSessions();
    }
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

async function sendChat(message) {
  if (!message.trim()) return;

  if (!State.currentSessionId) {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' })
      });
      const data = await res.json();
      State.currentSessionId = data.session_id;
    } catch (err) {
      console.error('Failed to create session:', err);
      // Proceeding with null session_id will hit the backwards-compatibility logic in backend, 
      // but it's better than failing completely
    }
  }

  appendMessage('user', message);

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
        session_id: State.currentSessionId,
        profile: State.userProfile,
      }),
    });

    const data = await res.json();
    const reply = data.reply || data.error || 'Something went wrong.';

    appendMessage('bot', reply);
    
    // Refresh sidebar to update titles
    loadChatSessions();
  } catch (err) {
    appendMessage('bot', '⚠️ Network error. Please check your connection and try again.');
    console.error('Chat error:', err);
  } finally {
    hide($('typingIndicator'));
    $('sendBtn').disabled = false;
    $('chatInput').focus();
  }
}

// ── Dashboard Progress & Snapshot ──────────────────────────────
async function renderDashboard() {
  const p = State.userProfile;
  
  // Update Snapshot UI
  if ($('dashName')) $('dashName').textContent = p.name || 'Guest';
  if ($('dashMeta')) {
    const ageText = p.age ? `${p.age} years old` : 'Age unknown';
    const genderText = p.gender ? (p.gender.charAt(0).toUpperCase() + p.gender.slice(1)) : '';
    $('dashMeta').textContent = genderText ? `${genderText}, ${ageText}` : ageText;
  }
  if ($('dashGoal')) $('dashGoal').textContent = p.goal || '--';
  
  // We'll update current weight and BMI from the DB later if available
  if ($('dashWeight')) $('dashWeight').textContent = p.weight ? `${p.weight} kg` : '-- kg';
  
  let currentBmi = '--';
  if (p.weight && p.height) {
    const hm = parseFloat(p.height) / 100;
    currentBmi = (parseFloat(p.weight) / (hm * hm)).toFixed(1);
    if ($('dashBmi')) $('dashBmi').textContent = currentBmi;
  }
  
  await fetchAndRenderDailyLogs();
  await fetchAndRenderProgress();
  
  if ($('dashWaterCount') && State.userProfile) {
    const wc = State.userProfile.waterCount || 0;
    $('dashWaterCount').textContent = `${wc} / 8 Glasses`;
  }
  
  if (typeof updateDashboardCalculations === 'function') updateDashboardCalculations();
}

async function fetchAndRenderDailyLogs() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/daily-log?date=${today}`);
    const data = await res.json();
    const logs = data.logs || [];
    
    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
    const list = $('dailyLogList');
    
    if (logs.length > 0) {
      if ($('dailyLogEmpty')) hide($('dailyLogEmpty'));
      list.innerHTML = logs.map(log => {
        totalCal += log.calories || 0;
        totalPro += log.protein || 0;
        totalCarb += log.carbs || 0;
        totalFat += log.fats || 0;
        return `
          <div class="d-flex justify-content-between align-items-center nb-card p-2 border-0" style="background: var(--nb-bg);">
            <div style="font-size: 0.9rem; font-weight: 500;">${escHtml(log.food_name)}</div>
            <div style="font-size: 0.8rem;" class="nb-muted">
              <span class="text-danger fw-bold">${Math.round(log.calories)}</span> kcal | 
              P: ${Math.round(log.protein)}g 
              C: ${Math.round(log.carbs)}g 
              F: ${Math.round(log.fats)}g
            </div>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<div class="text-center nb-muted p-2" id="dailyLogEmpty">No foods logged today. Search the database below to add foods!</div>';
    }
    
    if ($('macroCal')) $('macroCal').textContent = Math.round(totalCal);
    if ($('macroPro')) $('macroPro').textContent = Math.round(totalPro) + 'g';
    if ($('macroCarb')) $('macroCarb').textContent = Math.round(totalCarb) + 'g';
    if ($('macroFat')) $('macroFat').textContent = Math.round(totalFat) + 'g';
  } catch (err) {
    console.error('Failed to fetch daily logs:', err);
  }
}

async function addDailyLog(btn) {
  const data = {
    food_name: btn.dataset.name,
    calories: parseFloat(btn.dataset.cal) || 0,
    protein: parseFloat(btn.dataset.pro) || 0,
    carbs: parseFloat(btn.dataset.carb) || 0,
    fats: parseFloat(btn.dataset.fat) || 0
  };
  
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '...';
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/daily-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      btn.innerHTML = '<i class="bi bi-check2"></i> Added';
      btn.classList.replace('nb-btn-primary', 'nb-btn-success');
      showToast(`${data.food_name} added to today's log!`);
      await fetchAndRenderDailyLogs();
    } else {
      throw new Error('Failed to add');
    }
  } catch (err) {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    showToast('Failed to add food to log.');
    console.error(err);
  }
}

async function fetchAndRenderProgress() {
  try {
    const res = await fetch('/api/progress');
    const data = await res.json();
    const history = data.progress || [];
    
    // Update the snapshot with latest weight and BMI if history exists
    if (history.length > 0) {
      const latest = history[history.length - 1];
      if ($('dashWeight')) $('dashWeight').textContent = `${latest.weight} kg`;
      if ($('dashBmi')) $('dashBmi').textContent = latest.bmi.toFixed(1);
    }
    
    renderProgressChart(history);
  } catch (err) {
    console.error('Failed to fetch progress:', err);
  }
}

function renderProgressChart(history) {
  const canvases = ['progressChart', 'bmiTabChart'];
  
  const labels = history.map(entry => {
    // Format date nicely (e.g. "Jul 3")
    const d = new Date(entry.date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const weights = history.map(entry => entry.weight);
  const bmis = history.map(entry => entry.bmi);

  if (!State.charts) State.charts = {};

  canvases.forEach(id => {
    const canvas = $(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (State.charts[id]) {
      State.charts[id].destroy();
    }
  

  
    State.charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Weight (kg)',
            data: weights.length ? weights : [0],
            borderColor: '#ff6b35', // Primary brand color
            backgroundColor: 'rgba(255, 107, 53, 0.1)',
            yAxisID: 'yWeight',
            tension: 0.3,
            fill: true
          },
          {
            label: 'BMI',
            data: bmis.length ? bmis : [0],
            borderColor: '#4d8076', // Muted green/teal
            backgroundColor: 'rgba(77, 128, 118, 0.1)',
            yAxisID: 'yBmi',
            tension: 0.3,
            fill: true
          },
          ...(State.userProfile?.target_weight ? [{
            label: 'Target Weight (kg)',
            data: Array(labels.length).fill(parseFloat(State.userProfile.target_weight)),
            borderColor: '#0d6efd',
            borderDash: [5, 5],
            yAxisID: 'yWeight',
            pointRadius: 0,
            fill: false,
            tension: 0
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          yWeight: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Weight (kg)' }
          },
          yBmi: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'BMI' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  });
}

async function logProgress() {
  const weightInput = $('logWeightInput');
  const weight = parseFloat(weightInput?.value);
  
  if (!weight || isNaN(weight)) {
    showToast('Please enter a valid weight.');
    return;
  }
  
  const p = State.userProfile;
  if (!p.height) {
    showToast('Please set your height in the Profile tab first to calculate BMI.');
    return;
  }
  
  // Calculate new BMI
  const hm = parseFloat(p.height) / 100;
  const bmi = (weight / (hm * hm)).toFixed(1);
  
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: weight, bmi: bmi }),
    });
    
    if (res.ok) {
      showToast('Progress logged successfully!');
      weightInput.value = '';
      
      // Update profile locally to reflect new weight
      p.weight = weight;
      localStorage.setItem('nb-userProfile', JSON.stringify(p));
      if ($('p-weight')) $('p-weight').value = weight;
      if ($('bmi-weight')) $('bmi-weight').value = weight;
      
      // Re-render dashboard
      await renderDashboard();
    } else {
      throw new Error('Server error');
    }
  } catch (err) {
    console.error('Failed to log progress:', err);
    showToast('⚠️ Failed to log progress.');
  }
}

// ── Meal Analyzer ──────────────────────────────────────────────
async function analyzeMeal() {
  const meal = $('unifiedFoodInput')?.value.trim();
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
    State.lastMealPlan = plan; // Store for grocery list parsing
    
    if ($('exportPdfBtn')) show($('exportPdfBtn'));
    if ($('groceryListBtn')) show($('groceryListBtn'));
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Failed to generate meal plan.</p>';
    console.error('Meal plan error:', err);
  } finally {
    hideLoading();
  }
}

async function generateGroceryList() {
  if (!State.lastMealPlan) return;
  showLoading('Extracting groceries...');
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: `Extract a categorized grocery shopping list from this meal plan. Do not include anything else, just the list formatted as markdown. Meal Plan: \n\n${State.lastMealPlan}`, 
        history: [] 
      })
    });
    
    const data = await res.json();
    const list = data.reply || 'Could not generate list.';
    
    $('groceryListContent').innerHTML = renderMd(list);
    show($('groceryListModal'));
  } catch (err) {
    showToast('⚠️ Failed to generate grocery list');
    console.error(err);
  } finally {
    hideLoading();
  }
}

function exportPdf(elementId, filename) {
  const element = $(elementId);
  if (!element || !window.html2pdf) {
    showToast('⚠️ PDF export unavailable');
    return;
  }
  
  const opt = {
    margin:       0.5,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(element).save();
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
    if (macroContainer) {
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
    }

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

// ── Indian Food Database ───────────────────────────────────────
async function searchFoodDb() {
  const query = $('unifiedFoodInput')?.value?.trim();
  const output = $('foodDbOutput');
  
  if (!query) {
    showToast('Please enter a food name to search.');
    return;
  }
  
  showLoading('Searching food database...');
  output.innerHTML = '';
  show(output);
  
  try {
    const res = await fetch('/api/search-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      let html = '<div class="d-flex flex-column gap-2">';
      data.results.forEach(item => {
        html += `
          <div class="nb-card" style="padding: 0.75rem; border-color: var(--nb-muted);">
            <div class="d-flex justify-content-between align-items-center">
              <strong>${escHtml(item['Dish Name'] || 'Unknown')}</strong>
              <button class="nb-btn nb-btn-sm nb-btn-primary add-log-btn" data-name="${escHtml(item['Dish Name'])}" data-cal="${item['Calories (kcal)']}" data-pro="${item['Protein (g)']}" data-carb="${item['Carbohydrates (g)']}" data-fat="${item['Fats (g)']}">
                <i class="bi bi-plus-lg"></i> Add
              </button>
            </div>
            <div style="font-size: 0.85rem; color: var(--nb-fg); margin-top: 0.25rem;">
              <span class="badge bg-danger" style="margin-right:0.25rem;">${item['Calories (kcal)']} kcal</span>
              <span class="badge bg-success" style="margin-right:0.25rem;">P: ${item['Protein (g)']}g</span>
              <span class="badge bg-info text-dark" style="margin-right:0.25rem;">C: ${item['Carbohydrates (g)']}g</span>
              <span class="badge bg-warning text-dark">F: ${item['Fats (g)']}g</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--nb-muted); margin-top: 0.25rem;">
              Fibre: ${item['Fibre (g)']}g | Sugar: ${item['Free Sugar (g)']}g | Sodium: ${item['Sodium (mg)']}mg
            </div>
          </div>
        `;
      });
      html += '</div>';
      output.innerHTML = html;
    } else {
      output.innerHTML = '<div class="text-center nb-muted p-3">No matching foods found in the database.</div>';
    }
  } catch (err) {
    output.innerHTML = '<p class="text-danger">⚠️ Failed to search food database.</p>';
    console.error('Food DB search error:', err);
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
      localStorage.setItem('nb-familyMembers', JSON.stringify(State.familyMembers));
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
  const output = $('mealPlanOutput');
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
    if ($('exportPdfBtn')) show($('exportPdfBtn'));
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

// ── Dashboard Rendering ─────────────────────────────────────────
// (Merged with earlier renderDashboard declaration)

// ── Load State into UI ─────────────────────────────────────────
function loadStateIntoUI() {
  const p = State.userProfile;
  if (p.avatar) {
    if ($('p-avatar')) $('p-avatar').value = p.avatar;
    if ($('profileAvatarImg')) $('profileAvatarImg').src = p.avatar;
  }
  if (p.name) { ['p-name', 'd-name'].forEach(id => { if ($(id)) $(id).value = p.name; }); }
  if (p.age) { ['p-age', 'd-age', 'bmi-age'].forEach(id => { if ($(id)) $(id).value = p.age; }); }
  if (p.gender) { ['p-gender', 'd-gender', 'bmi-gender'].forEach(id => { if ($(id)) $(id).value = p.gender; }); }
  if (p.weight) { ['p-weight', 'd-weight', 'bmi-weight'].forEach(id => { if ($(id)) $(id).value = p.weight; }); }
  if (p.height) { ['p-height', 'd-height', 'bmi-height'].forEach(id => { if ($(id)) $(id).value = p.height; }); }
  if (p.target_weight) { ['p-target-weight'].forEach(id => { if ($(id)) $(id).value = p.target_weight; }); }
  if (p.goal) { ['p-goal', 'd-goal'].forEach(id => { if ($(id)) $(id).value = p.goal; }); }
  if (p.diet_type) { ['p-diet', 'd-diet', 'mp-diet'].forEach(id => { if ($(id)) $(id).value = p.diet_type; }); }
  if (p.health_conditions) { ['p-conditions', 'd-conditions'].forEach(id => { if ($(id)) $(id).value = p.health_conditions; }); }
  if (p.allergies) { ['p-allergies', 'd-allergies'].forEach(id => { if ($(id)) $(id).value = p.allergies; }); }
  if (p.medications) { if ($('p-medications')) $('p-medications').value = p.medications; }
  if (p.blood) { if ($('p-blood')) $('p-blood').value = p.blood; }
  if (p.activity_level) { if ($('p-activity')) $('p-activity').value = p.activity_level; }
  if (p.exercise) { if ($('p-exercise')) $('p-exercise').value = p.exercise; }
  if (p.sleep) { if ($('p-sleep')) $('p-sleep').value = p.sleep; }
  if (p.water) { if ($('p-water')) $('p-water').value = p.water; }

  if (p.diet_type && $('dietTypeContainer')) {
    document.querySelectorAll('#dietTypeContainer .nb-chip-select').forEach(c => {
      c.classList.toggle('active', c.dataset.val === p.diet_type);
    });
  }

  if (typeof updateDashboardCalculations === 'function') updateDashboardCalculations();
}

// ── Profile Dashboard Calculations ──────────────────────────────
function updateDashboardCalculations() {
  const p = State.userProfile;
  if (!p || !p.weight || !p.height || !p.age) return;
  
  const w = parseFloat(p.weight);
  const h = parseFloat(p.height);
  const a = parseInt(p.age);
  const isMale = (p.gender === 'male');
  
  // BMI
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);
  if ($('p-display-bmi')) $('p-display-bmi').textContent = bmi.toFixed(1);
  
  // BMR (Mifflin-St Jeor)
  let bmr = (10 * w) + (6.25 * h) - (5 * a);
  bmr += isMale ? 5 : -161;
  if ($('p-display-bmr')) $('p-display-bmr').textContent = Math.round(bmr);
  
  // Display stats
  if ($('p-display-name')) $('p-display-name').textContent = p.name || 'User';
  if ($('p-display-age')) $('p-display-age').textContent = p.age || '--';
  if ($('p-display-gender')) $('p-display-gender').textContent = p.gender || '--';
  
  // Dashboard User Snapshot
  if ($('dashName')) $('dashName').textContent = p.name || '--';
  if ($('dashMeta')) $('dashMeta').textContent = `${p.gender || '--'}, ${p.age || '--'} years old`;
  if ($('dashGoal')) $('dashGoal').textContent = p.goal || '--';
  
  // Health Score Simulation (just a visual representation)
  let score = 70;
  if (bmi > 18.5 && bmi < 25) score += 15;
  if (p.water >= 2.5) score += 5;
  if (p.sleep >= 7) score += 5;
  if (p.activity_level === 'active') score += 5;
  
  if ($('p-display-score')) $('p-display-score').textContent = Math.round(score);
  
  const ring = $('healthScoreRing');
  if (ring) {
    const offset = 100 - score;
    ring.style.strokeDashoffset = offset;
    ring.style.strokeDasharray = `${score}, 100`;
  }
}


// ── Event Listeners ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Apply saved theme
  applyTheme(State.theme);

  // Health check
  checkHealth();

  // Load state into UI
  loadStateIntoUI();

  // Load chat sessions and initialize chat window
  loadChatSessions().then(async () => {
    try {
      // Always start a new chat when opening the site, rather than loading the past one
      createNewSession();
    } catch (err) {
      console.error(err);
    }
  });

  // Setup Dashboard Quick Log Buttons
  if ($('logWaterBtn')) {
    $('logWaterBtn').addEventListener('click', () => {
      if (!State.userProfile) State.userProfile = {};
      State.userProfile.waterCount = (State.userProfile.waterCount || 0) + 1;
      localStorage.setItem('nb-userProfile', JSON.stringify(State.userProfile));
      renderDashboard();
      showToast('💧 Water logged! Keep hydrating.');
    });
  }
  
  // New Chat button
  $('newChatBtn')?.addEventListener('click', () => createNewSession());

  // ── Onboarding Check
  const p = State.userProfile;
  if (!p.name || !p.age || !p.weight || !p.height) {
    show($('onboardingModal'));
  }

  $('saveOnboardingBtn')?.addEventListener('click', () => {
    const obName = $('ob-name').value.trim();
    const obAge = $('ob-age').value;
    const obGender = $('ob-gender').value;
    const obWeight = $('ob-weight').value;
    const obHeight = $('ob-height').value;
    const obTargetWeight = $('ob-target-weight')?.value || '';
    
    if (!obName || !obAge || !obGender || !obWeight || !obHeight) {
      showToast('⚠️ Please fill out all mandatory fields.');
      return;
    }

    State.userProfile = {
      name: obName,
      age: obAge,
      gender: obGender,
      weight: obWeight,
      height: obHeight,
      target_weight: obTargetWeight,
      goal: $('ob-goal').value,
      diet_type: $('ob-diet').value,
      health_conditions: $('ob-conditions').value.trim(),
      allergies: $('ob-allergies').value.trim(),
      cuisine: 'Indian',
      activity_level: 'moderate'
    };
    
    localStorage.setItem('nb-userProfile', JSON.stringify(State.userProfile));
    loadStateIntoUI();
    
    // Also update the sidebar form specifically since loadStateIntoUI maps to 'p-*' prefixed inputs
    ['name', 'age', 'gender', 'weight', 'height', 'target_weight', 'goal', 'diet_type', 'health_conditions', 'allergies'].forEach(key => {
      const el = $(`p-${key === 'diet_type' ? 'diet' : key === 'health_conditions' ? 'conditions' : key === 'target_weight' ? 'target-weight' : key}`);
      if (el) el.value = State.userProfile[key];
    });

    hide($('onboardingModal'));
    showToast('✅ Welcome to NutriBot!');
  });

  // ── Theme toggle
  $('themeToggle')?.addEventListener('click', () => {
    applyTheme(State.theme === 'dark' ? 'light' : 'dark');
  });

  // ── Tab buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── (Mobile menu btn listener removed to make bottom nav always visible) ──

  // ── Save profile
  $('saveProfileBtn')?.addEventListener('click', saveProfile);
  
  // ── Profile Diet Chips
  document.querySelectorAll('#dietTypeContainer .nb-chip-select').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#dietTypeContainer .nb-chip-select').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const pDiet = $('p-diet');
      if (pDiet) pDiet.value = chip.dataset.val;
    });
  });

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
    createNewSession();
    showToast('New chat started');
  });

  // ── Quick prompts & Dynamic buttons (Event delegation)
  document.body.addEventListener('click', (e) => {
    const chip = e.target.closest('.nb-chip[data-prompt]');
    if (chip) {
      const input = $('chatInput');
      input.value = chip.dataset.prompt;
      autoResize(input);
      switchTab('chat');
      sendChat(chip.dataset.prompt);
      return;
    }
    
    const addLogBtn = e.target.closest('.add-log-btn');
    if (addLogBtn) {
      addDailyLog(addLogBtn);
      return;
    }
  });

  // ── Dashboard
  $('logWeightBtn')?.addEventListener('click', logProgress);
  $('logWeightInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') logProgress();
  });

  // ── Unified Smart Food & Meal Analyzer
  $('analyzeMealBtn')?.addEventListener('click', analyzeMeal);
  $('searchFoodBtn')?.addEventListener('click', searchFoodDb);
  $('unifiedFoodInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeMeal();
  });

  // ── Meal Plan
  $('generateMealPlanBtn')?.addEventListener('click', generateMealPlan);
  
  $('exportPdfBtn')?.addEventListener('click', () => {
    const element = $('mealPlanOutput');
    const opt = {
      margin:       1,
      filename:     'NutriBot_Meal_Plan.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  });

  // ── BMI Calculator
  $('calcBmiBtn')?.addEventListener('click', calculateBMI);

  // Allow Enter in BMI inputs
  ['bmi-weight', 'bmi-height', 'bmi-age'].forEach(id => {
    $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') calculateBMI(); });
  });

  // Mobile Chat Sidebar
  $('mobileHistoryToggle')?.addEventListener('click', () => {
    $('chatSidebar')?.classList.add('open');
  });
  $('closeSidebarBtn')?.addEventListener('click', () => {
    $('chatSidebar')?.classList.remove('open');
  });


  // ── Family: Add Member Form toggle
  $('addMemberBtn')?.addEventListener('click', () => {
    show($('addMemberForm'));
    $('fm-name')?.focus();
    $('familyEmpty').style.display = 'none';
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
    localStorage.setItem('nb-familyMembers', JSON.stringify(State.familyMembers));

    renderFamilyList();
    hide($('addMemberForm'));
    clearMemberForm();
    showToast(`✅ ${name} added to family!`);
  });

  $('generateFamilyPlanBtn')?.addEventListener('click', generateFamilyPlan);

  // Render initial (empty) family list
  renderFamilyList();
  
  // Render Dashboard
  renderDashboard();
});

function clearMemberForm() {
  ['fm-name', 'fm-age', 'fm-conditions'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
}
