/* =============================================
   智绘旅途 - 前端主逻辑
   包含: 表单验证、API调用、地图渲染、图表、内容渲染
============================================= */

// ========== 工具函数 ==========

/** 根据字符串生成稳定的数字哈希（用于图片seed） */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h) % 1000;
}

/** 生成 Picsum 图片 URL */
function imgUrl(keyword, w = 800, h = 400) {
  const seed = hashStr(keyword || 'travel');
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

/** 构建大众点评搜索链接 */
function dianpingUrl(keyword, destination) {
  const q = encodeURIComponent(`${keyword} ${destination || ''}`.trim());
  return `https://www.dianping.com/search?keyword=${q}`;
}

/** 构建携程酒店搜索链接 */
function ctripUrl(keyword, destination) {
  const city = encodeURIComponent(destination || keyword || '');
  const kw = encodeURIComponent(keyword || '');
  return `https://hotels.ctrip.com/hotel/search.html?city=${city}&keyword=${kw}`;
}

/** 构建美团搜索链接（备选） */
function meituanUrl(keyword) {
  return `https://www.meituan.com/hotel/?q=${encodeURIComponent(keyword || '')}`;
}

/** 构建B站搜索链接 */
function biliUrl(keyword) {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword || '')}`;
}

/** 切换页面 */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ========== 页面切换 ==========
function goBack() {
  showPage('input-section');
  if (window._map) {
    window._map.remove();
    window._map = null;
  }
  if (window._chart) {
    window._chart.destroy();
    window._chart = null;
  }
}

// ========== 表单验证 ==========
document.getElementById('travel-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const destination = document.getElementById('destination').value.trim();
  const days = parseInt(document.getElementById('days').value) || 0;
  const budget = parseInt(document.getElementById('budget').value) || 0;
  const preferences = [...document.querySelectorAll('input[name="pref"]:checked')].map(c => c.value);

  // 至少两个条件
  const filled = [
    destination ? 1 : 0,
    days > 0 ? 1 : 0,
    budget > 0 ? 1 : 0,
    preferences.length > 0 ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  const msg = document.getElementById('validate-msg');
  if (filled < 2) {
    msg.textContent = '⚠️ 请至少填写两个条件：目的地、旅行天数、预算、旅游偏好中任意两个';
    msg.style.display = 'block';
    return;
  }
  msg.style.display = 'none';

  // 显示加载页
  const loadingDest = document.getElementById('loading-dest');
  loadingDest.textContent = destination ? `正在规划「${destination}」的旅游攻略...` : '正在根据您的偏好规划最佳目的地...';
  showPage('loading-section');
  startLoadingAnimation();

  try {
    // 本地开发用 Express，Netlify 部署直接调用函数
    const apiUrl = window.location.hostname === 'localhost'
      ? '/api/generate'
      : '/.netlify/functions/generate';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, days, budget, preferences })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || '生成失败，请重试');
    }

    renderResult(result.data, { destination, days, budget, preferences });
    showPage('result-section');

  } catch (err) {
    alert(`❌ 生成失败：${err.message}\n\n请检查网络连接或稍后重试。`);
    showPage('input-section');
  }
});

// ========== 加载动画 ==========
let loadingTimer = null;
function startLoadingAnimation() {
  const steps = ['s1', 's2', 's3', 's4'];
  let i = 0;
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
  });
  document.getElementById('s1').classList.add('active');

  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    if (i < steps.length - 1) {
      document.getElementById(steps[i]).classList.remove('active');
      document.getElementById(steps[i]).classList.add('done');
      i++;
      document.getElementById(steps[i]).classList.add('active');
    }
  }, 6000);
}

// ========== 主渲染函数 ==========
function renderResult(data, inputs) {
  clearInterval(loadingTimer);

  const dest = data.overview?.destination || inputs.destination || '目的地';

  // 顶栏
  document.getElementById('nav-title').textContent = data.overview?.title || '';

  // Hero
  document.getElementById('r-title').textContent = data.overview?.title || '';
  document.getElementById('rs-dest').textContent = data.overview?.destination || dest;
  document.getElementById('rs-days').textContent = data.overview?.days || inputs.days || '?';
  document.getElementById('rs-budget').textContent = data.overview?.budget || (inputs.budget ? `¥${inputs.budget}` : '未限定');
  document.getElementById('rs-season').textContent = data.overview?.bestSeason?.split('，')[0]?.split('。')[0]?.substring(0, 15) || '';

  // Hero 背景
  const hero = document.getElementById('r-hero');
  hero.style.backgroundImage = `url('${imgUrl(dest + ' travel scenery', 1200, 400)}')`;
  hero.style.backgroundSize = 'cover';
  hero.style.backgroundPosition = 'center';

  // 概览
  document.getElementById('r-summary').textContent = data.overview?.summary || '';
  const hlEl = document.getElementById('r-highlights');
  hlEl.innerHTML = '';
  (data.overview?.highlights || []).forEach(h => {
    const tag = document.createElement('span');
    tag.className = 'highlight-tag';
    tag.textContent = `✦ ${h}`;
    hlEl.appendChild(tag);
  });

  // 地图
  renderMap(data.locations || [], dest);

  // 日程
  renderItinerary(data.itinerary || [], dest);

  // 餐饮
  renderRestaurants(data.restaurants || [], dest);

  // 住宿
  renderHotels(data.hotels || [], dest);

  // 预算
  renderBudget(data.budgetBreakdown);

  // 交通
  renderTransport(data.transportation);

  // 购物
  renderShopping(data.shopping || []);

  // 视频
  renderVideos(data.videoSearchKeyword, dest);

  // 贴士
  renderTips(data.travelTips);
}

// ========== 地图渲染 ==========
const DAY_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#F97316', '#0EA5E9'];

function renderMap(locations, dest) {
  if (window._map) { window._map.remove(); window._map = null; }

  const mapEl = document.getElementById('travel-map');
  mapEl.innerHTML = '';

  if (!locations.length) {
    mapEl.innerHTML = '<div style="height:460px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:.9rem;">暂无地图数据</div>';
    return;
  }

  const map = L.map('travel-map');
  window._map = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  // 按天分组
  const byDay = {};
  locations.forEach(loc => {
    if (!byDay[loc.day]) byDay[loc.day] = [];
    byDay[loc.day].push(loc);
  });

  // 绘制每天路线
  const days = Object.keys(byDay).sort((a, b) => Number(a) - Number(b));
  days.forEach((day, di) => {
    const color = DAY_COLORS[di % DAY_COLORS.length];
    const locs = byDay[day].sort((a, b) => (a.order || 0) - (b.order || 0));

    if (locs.length > 1) {
      const coords = locs.map(l => [l.lat, l.lng]);
      L.polyline(coords, { color, weight: 3, opacity: .75, dashArray: '8, 6' }).addTo(map);
    }

    locs.forEach((loc, i) => {
      const icon = L.divIcon({
        html: `<div class="map-marker" style="background:${color}"><span class="map-marker-inner">${i + 1}</span></div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            <strong style="font-size:.95rem">${loc.name}</strong><br>
            <span style="font-size:.75rem;color:#64748b">第${loc.day}天 · ${loc.type || ''}</span>
            <p style="font-size:.8rem;margin-top:6px;color:#475569">${loc.description || ''}</p>
          </div>
        `);
    });
  });

  // 适配视野
  const allCoords = locations.filter(l => l.lat && l.lng).map(l => [l.lat, l.lng]);
  if (allCoords.length) {
    if (allCoords.length === 1) {
      map.setView(allCoords[0], 13);
    } else {
      map.fitBounds(allCoords, { padding: [40, 40] });
    }
  }

  // 图例
  const legend = document.getElementById('map-legend');
  legend.innerHTML = '';
  days.forEach((day, di) => {
    const locs = byDay[day];
    const color = DAY_COLORS[di % DAY_COLORS.length];
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${color}"></span><span>第${day}天（${locs.length}处景点）</span>`;
    legend.appendChild(item);
  });
}

// ========== 日程渲染 ==========
function renderItinerary(itinerary, dest) {
  const tabsEl = document.getElementById('day-tabs');
  const panelsEl = document.getElementById('day-panels');
  tabsEl.innerHTML = '';
  panelsEl.innerHTML = '';

  itinerary.forEach((day, di) => {
    // Tab按钮
    const tab = document.createElement('button');
    tab.className = `day-tab${di === 0 ? ' active' : ''}`;
    tab.textContent = `第${day.day}天`;
    tab.onclick = () => switchDay(di);
    tabsEl.appendChild(tab);

    // Panel
    const panel = document.createElement('div');
    panel.className = `day-panel${di === 0 ? ' active' : ''}`;
    panel.id = `day-panel-${di}`;

    // 封面图
    const coverImg = `<img class="day-cover" src="${imgUrl(day.imageKeyword || dest, 960, 200)}" alt="${day.theme}" loading="lazy" onerror="this.style.display='none'">`;

    // 时间轴
    let timelineHtml = '<div class="timeline">';
    (day.schedule || []).forEach(item => {
      timelineHtml += `
        <div class="tl-item">
          <div class="tl-time">
            <div class="tl-dot"></div>
            <span class="tl-time-label">${item.time || ''}</span>
          </div>
          <div class="tl-card">
            <div class="tl-activity">${item.activity || ''}</div>
            <div class="tl-loc">${item.location || ''}</div>
            <div class="tl-desc">${item.description || ''}</div>
            <div class="tl-meta">
              ${item.duration ? `<span class="tl-tag duration">⏱ ${item.duration}</span>` : ''}
              ${item.estimatedCost ? `<span class="tl-tag cost">💴 ${item.estimatedCost}</span>` : ''}
            </div>
            ${item.tips ? `<div class="tl-tip">${item.tips}</div>` : ''}
          </div>
        </div>`;
    });
    timelineHtml += '</div>';

    // 餐饮
    const meals = day.meals || {};
    let mealsHtml = '<div class="day-meals">';
    [
      { key: 'breakfast', label: '🌅 早餐', emoji: '🌅' },
      { key: 'lunch',     label: '☀️ 午餐', emoji: '☀️' },
      { key: 'dinner',    label: '🌙 晚餐', emoji: '🌙' }
    ].forEach(({ key, label }) => {
      const m = meals[key];
      if (!m) return;
      const searchKw = m.searchKeyword || m.name || '';
      mealsHtml += `
        <div class="meal-card">
          <div class="meal-type">${label}</div>
          <div class="meal-name">${m.name || ''}</div>
          ${m.cuisine ? `<div class="meal-desc" style="color:#64748b;font-size:.72rem">${m.cuisine}</div>` : ''}
          <div class="meal-desc">${m.description || ''}</div>
          <div class="meal-price">人均 ${m.pricePerPerson || ''}</div>
          <a class="meal-link" href="${dianpingUrl(searchKw, dest)}" target="_blank" rel="noopener">
            🔍 大众点评
          </a>
        </div>`;
    });
    mealsHtml += '</div>';

    // 住宿
    let hotelHtml = '';
    if (day.accommodation) {
      const acc = day.accommodation;
      const hotelLink = ctripUrl(acc.searchKeyword || acc.name || '', dest);
      hotelHtml = `
        <div class="night-hotel">
          <div class="hotel-ico">🏨</div>
          <div class="hotel-info-mini">
            <h4>${acc.name || ''} <small style="font-weight:400;color:#94a3b8">${acc.type || ''}</small></h4>
            <p>${acc.description || ''}</p>
            <p class="price">每晚 ${acc.pricePerNight || ''} · ${acc.address || ''}</p>
            <a href="${hotelLink}" target="_blank" rel="noopener" class="meal-link" style="margin-top:8px;display:inline-flex">
              🏨 携程预订
            </a>
            <a href="${meituanUrl(acc.searchKeyword || acc.name || '')}" target="_blank" rel="noopener" class="meal-link" style="margin-top:8px;display:inline-flex;margin-left:6px">
              🟡 美团查看
            </a>
          </div>
        </div>`;
    }

    panel.innerHTML = `
      <div class="day-header">
        <div class="day-num">D${day.day}</div>
        <div class="day-theme">${day.theme || `第${day.day}天行程`}</div>
      </div>
      ${coverImg}
      ${timelineHtml}
      <h3 style="font-size:.9rem;font-weight:700;color:#475569;margin:20px 0 4px">今日餐饮</h3>
      ${mealsHtml}
      <h3 style="font-size:.9rem;font-weight:700;color:#475569;margin:16px 0 4px">今晚住宿</h3>
      ${hotelHtml}
    `;

    panelsEl.appendChild(panel);
  });
}

function switchDay(idx) {
  document.querySelectorAll('.day-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  document.querySelectorAll('.day-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
}

// ========== 餐饮卡片 ==========
function renderRestaurants(restaurants, dest) {
  const grid = document.getElementById('restaurants-grid');
  grid.innerHTML = '';

  restaurants.forEach((r, i) => {
    const link = dianpingUrl(r.searchKeyword || r.name, dest);
    const card = document.createElement('a');
    card.href = link;
    card.target = '_blank';
    card.rel = 'noopener';
    card.className = 'r-card';
    card.innerHTML = `
      <div class="card-img-placeholder" style="background:linear-gradient(135deg,${pickColor(i, 0.15)},${pickColor(i+2, 0.1)})">
        🍽️
      </div>
      <div class="card-body">
        <span class="card-badge badge-food">${r.cuisine || '美食'}</span>
        <div class="card-name">${r.name || ''}</div>
        <div class="card-cuisine">${r.specialty || ''}</div>
        <div class="card-specialty">${r.reason || ''}</div>
        ${r.openHours ? `<div class="card-reason">⏰ ${r.openHours}</div>` : ''}
        <div class="card-footer">
          <div class="card-price">人均 ${r.priceRange || ''}</div>
          <span class="card-link card-link-dp">大众点评 →</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ========== 住宿卡片 ==========
function renderHotels(hotels, dest) {
  const grid = document.getElementById('hotels-grid');
  grid.innerHTML = '';

  hotels.forEach((h, i) => {
    const link = ctripUrl(h.searchKeyword || h.name, dest);
    const mtLink = meituanUrl(h.searchKeyword || h.name);
    const card = document.createElement('div');
    card.className = 'r-card';
    card.style.cursor = 'default';
    card.innerHTML = `
      <div class="card-img-placeholder" style="background:linear-gradient(135deg,${pickColor(i+4, 0.12)},${pickColor(i+6, 0.08)})">
        🏨
      </div>
      <div class="card-body">
        <span class="card-badge badge-hotel">${h.type || '住宿'}</span>
        <div class="card-name">${h.name || ''}</div>
        <div class="card-cuisine">${h.stars || ''} · ${h.location || ''}</div>
        <div class="card-specialty">${(h.features || []).join(' · ')}</div>
        <div class="card-reason">👥 ${h.suitable || ''}</div>
        <div class="card-footer">
          <div class="card-price">¥${h.pricePerNight || ''}/晚</div>
          <div style="display:flex;gap:6px">
            <a href="${link}" target="_blank" rel="noopener" class="card-link card-link-ctrip">携程 →</a>
            <a href="${mtLink}" target="_blank" rel="noopener" class="card-link" style="background:#fef3c7;color:#92400e;padding:6px 10px;border-radius:20px;font-size:.72rem;font-weight:700">美团</a>
          </div>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ========== 预算图表 ==========
function renderBudget(breakdown) {
  if (!breakdown) return;

  const labels = ['住宿', '餐饮', '景点', '交通', '购物', '其他'];
  const icons  = ['🏨', '🍜', '🎫', '🚄', '🛍️', '💡'];
  const keys   = ['accommodation', 'food', 'attractions', 'transportation', 'shopping', 'misc'];
  const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const values = keys.map(k => Number(breakdown[k]) || 0);
  const total  = values.reduce((a, b) => a + b, 0);

  // Chart.js 环形图
  if (window._chart) { window._chart.destroy(); window._chart = null; }
  const ctx = document.getElementById('budget-chart');
  if (ctx && total > 0) {
    window._chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Noto Sans SC', size: 11 }, padding: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => ` ¥${ctx.parsed.toLocaleString()} (${total ? Math.round(ctx.parsed/total*100) : 0}%)`
            }
          }
        }
      }
    });
  }

  // 明细列表
  const listEl = document.getElementById('budget-list');
  listEl.innerHTML = '';
  const maxVal = Math.max(...values, 1);

  values.forEach((v, i) => {
    const pct = maxVal ? Math.round(v / maxVal * 100) : 0;
    const row = document.createElement('div');
    row.className = 'budget-row';
    row.innerHTML = `
      <div class="budget-label"><span>${icons[i]}</span>${labels[i]}</div>
      <div class="budget-bar-wrap">
        <div class="budget-bar" style="width:${pct}%;background:${colors[i]}"></div>
      </div>
      <div class="budget-amount">¥${v.toLocaleString()}</div>`;
    listEl.appendChild(row);
  });

  if (total > 0) {
    const totalRow = document.createElement('div');
    totalRow.className = 'budget-total';
    totalRow.innerHTML = `<span class="budget-total-label">预计总花费</span><span class="budget-total-amount">¥${total.toLocaleString()}</span>`;
    listEl.appendChild(totalRow);
  }
}

// ========== 交通 ==========
function renderTransport(transport) {
  if (!transport) return;
  const el = document.getElementById('transport-content');
  const tips = (transport.tips || []).map(t => `<li>${t}</li>`).join('');
  el.innerHTML = `
    <div class="transport-cards">
      <div class="transport-card">
        <h3>🛫 如何抵达</h3>
        <p>${transport.arrival || ''}</p>
      </div>
      <div class="transport-card">
        <h3>🚌 当地出行</h3>
        <p>${transport.local || ''}</p>
        ${tips ? `<ul class="transport-tips">${tips}</ul>` : ''}
      </div>
    </div>`;
}

// ========== 购物 ==========
function renderShopping(shopping) {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  shopping.forEach(s => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="shop-name">${s.name || ''}</div>
      <div class="shop-type">${s.type || ''}</div>
      <div class="shop-specialty">${s.specialty || ''}</div>
      ${s.priceRange ? `<div class="shop-price">💴 ${s.priceRange}</div>` : ''}
      ${s.tips ? `<div class="shop-tips">${s.tips}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

// ========== 视频推荐 ==========
function renderVideos(videoKeyword, dest) {
  const el = document.getElementById('video-cards');
  const keyword = videoKeyword || `${dest}旅游攻略`;

  // 生成几个不同角度的搜索建议
  const searches = [
    { title: `${dest}旅游攻略 2025`, desc: '完整旅游攻略视频', icon: '🎬' },
    { title: `${dest}必去景点打卡`, desc: '热门景点Vlog', icon: '📍' },
    { title: `${dest}美食探店合集`, desc: '当地特色美食推荐', icon: '🍜' }
  ];

  el.innerHTML = searches.map(s => `
    <a href="${biliUrl(s.title)}" target="_blank" rel="noopener" class="video-card">
      <div class="video-thumb">
        <span>${s.icon}</span>
        <div class="video-play-btn">▶</div>
      </div>
      <div class="video-info">
        <div class="video-title">${s.title}</div>
        <div class="video-platform">📺 B站视频搜索</div>
      </div>
      <div class="video-btn">在 Bilibili 搜索查看 →</div>
    </a>`).join('');

  // 更新section副标题
  const secSub = document.querySelector('.video-section .sec-sub');
  if (secSub) secSub.textContent = `在B站搜索「${keyword}」获取更多旅游参考视频`;
}

// ========== 旅行贴士 ==========
function renderTips(tips) {
  if (!tips) return;
  const grid = document.getElementById('tips-grid');
  grid.innerHTML = '';

  const sections = [
    { title: '📦 必备物品',   key: 'essentials', color: '#2563EB' },
    { title: '🏮 文化礼仪',   key: 'cultural',   color: '#D97706' },
    { title: '💡 实用建议',   key: 'practical',  color: '#10B981' }
  ];

  sections.forEach(({ title, key, color }) => {
    const items = tips[key] || [];
    if (!items.length) return;
    const card = document.createElement('div');
    card.className = 'tips-card';
    card.innerHTML = `
      <div class="tips-card-title" style="color:${color}">${title}</div>
      <ul class="tips-list">
        ${items.map(t => `<li>${t}</li>`).join('')}
      </ul>`;
    grid.appendChild(card);
  });
}

// ========== 辅助颜色 ==========
function pickColor(i, alpha) {
  const hues = [210, 160, 40, 0, 270, 330, 25, 195];
  const h = hues[i % hues.length];
  return `hsla(${h},70%,55%,${alpha})`;
}

// ========== 字段填写状态高亮 ==========
['destination', 'days', 'budget'].forEach(id => {
  const input = document.getElementById(id);
  const group = input?.closest('.field-group');
  if (!input || !group) return;
  input.addEventListener('input', () => {
    group.classList.toggle('filled', input.value.trim() !== '');
  });
});

document.querySelectorAll('input[name="pref"]').forEach(cb => {
  const group = cb.closest('.pref-group');
  cb.addEventListener('change', () => {
    const anyChecked = document.querySelectorAll('input[name="pref"]:checked').length > 0;
    group.classList.toggle('filled', anyChecked);
  });
});
