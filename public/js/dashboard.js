/* Dynamic Student Dashboard wiring
 - Requires: app.js (for AuthManager and apiFetch)
 - Fetches: /api/profiles/me, /api/enrollments/mine, /api/courses
*/
(function(){
  const API_BASE = 'http://localhost:5000';

  // Use centralized token getter
  function getToken(){
    return window.AuthManager ? window.AuthManager.getToken() : null;
  }

  function q(sel, root=document){ return root.querySelector(sel); }
  function qa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function findH2(title){
    return qa('h2').find(h => h.textContent.trim().toLowerCase() === title.toLowerCase()) || null;
  }

  function setUserName(name){
    const span = q('#profile-btn span');
    if (span) span.textContent = name || '';
  }

  function setWelcomeTitle(name){
    const hero = q('.hero-gradient');
    if (!hero) return;
    const h1 = q('h1', hero);
    if (h1) h1.textContent = name ? `Welcome back, ${name.split(' ')[0]}! 👋` : 'Welcome back! 👋';
  }

  function setStats({ enrolled=0, completed=0, certificates=0, streakDays=0 }={}){
    const hero = q('.hero-gradient');
    if (!hero) return;
    const statCards = qa('.bg-white/20', hero);
    function setNum(cardIdx, value){
      const card = statCards[cardIdx];
      const num = card ? q('p.text-2xl', card) : null;
      if (num) num.textContent = String(value);
    }
    setNum(0, enrolled);
    setNum(1, completed);
    setNum(2, certificates);
    setNum(3, `${streakDays} days`);
  }

  function courseCard(c, progress){
    const pct = Math.round(progress || 0);
    const href = `/courseDetail.html?id=${encodeURIComponent(c.id)}`;
    return `
      <div class="bg-white rounded-xl shadow-lg overflow-hidden card-hover">
        <div class="video-placeholder h-48"></div>
        <div class="p-6">
          <h3 class="text-xl font-bold mb-2">${c.title}</h3>
          <p class="text-gray-600 text-sm mb-4">${c.category || ''}</p>
          <div class="mb-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-gray-600">Progress</span>
              <span class="font-semibold text-indigo-600">${pct}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="progress-bar bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
          <a href="${href}" class="w-full block text-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all">Continue Learning</a>
        </div>
      </div>`;
  }

  function recoCard(c){
    const price = c.price_cents ? `$${(c.price_cents/100).toFixed(0)}` : 'Free';
    const href = `/courseDetail.html?id=${encodeURIComponent(c.id)}`;
    return `
      <div class="bg-white rounded-xl shadow-lg overflow-hidden card-hover">
        <div class="h-40 bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
          <span class="text-white text-xl font-bold">${c.category || 'Course'}</span>
        </div>
        <div class="p-4">
          <h3 class="font-bold mb-2">${c.title}</h3>
          <p class="text-sm text-gray-600 mb-3 line-clamp-2">${c.description || ''}</p>
          <div class="flex items-center justify-between">
            <span class="text-indigo-600 font-bold text-lg">${price}</span>
            <a href="${href}" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">View</a>
          </div>
        </div>
      </div>`;
  }

  async function loadDashboard(){
    // Profile
    try {
      const token = await getToken();
      if (token) {
        const me = await window.apiFetch(`${API_BASE}/api/profiles/me`).then(r=>r.json()).catch(()=>null);
        const name = me?.data?.full_name || 'Learner';
        setUserName(name);
        setWelcomeTitle(name);
      } else {
        setWelcomeTitle('');
      }
    } catch {}

    // Enrollments (Continue learning)
    let enrolledCount = 0;
    try {
      const token = await getToken();
      const gridH2 = findH2('Continue Learning');
      const grid = gridH2 ? gridH2.nextElementSibling : null;
      if (token && grid) {
        const enr = await window.apiFetch(`${API_BASE}/api/enrollments/mine`).then(r=>r.json());
        const list = enr?.data || [];
        enrolledCount = list.length;
        grid.innerHTML = list.slice(0,2).map(e => courseCard(e.courses, e.progress_percent)).join('') || '<p class="text-gray-600">No active courses yet.</p>';
      } else if (grid) {
        grid.innerHTML = '<p class="text-gray-600">Sign in to see your courses.</p>';
      }
    } catch {}

    // Certificates feature removed

    // Recommended
    try {
      const recH2 = findH2('Recommended For You');
      const recGrid = recH2 ? recH2.nextElementSibling : null;
      if (recGrid) {
        const rec = await window.apiFetch(`${API_BASE}/api/courses?published=true`).then(r=>r.json());
        const items = rec?.data || [];
        recGrid.innerHTML = items.slice(0,3).map(recoCard).join('') || '<p class="text-gray-600">No recommendations yet.</p>';
      }
    } catch {}

    // Assignments placeholder
    try {
      const asH2 = findH2('Upcoming Assignments');
      const as = asH2 ? asH2.nextElementSibling : null;
      if (as) as.innerHTML = '<div class="space-y-4 text-gray-600">No upcoming assignments.</div>';
    } catch {}

    // Completed count heuristic: treat progress >= 95% as completed
    try {
      const token = await getToken();
      let completed = 0;
      if (token) {
        const enr = await window.apiFetch(`${API_BASE}/api/enrollments/mine`).then(r=>r.json());
        completed = (enr?.data || []).filter(e => (e.progress_percent || 0) >= 95).length;
      }
      setStats({ enrolled: enrolledCount, completed, certificates: certCount, streakDays: 0 });
    } catch { setStats({ enrolled: enrolledCount, certificates: certCount, streakDays: 0 }); }
  }

  // Boot
  document.addEventListener('DOMContentLoaded', loadDashboard);
})();
