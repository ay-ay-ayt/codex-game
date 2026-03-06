// ===== CCNA学習資料 JavaScript =====

document.addEventListener('DOMContentLoaded', function () {

  // ===== Navigation =====
  const navSectionHeaders = document.querySelectorAll('.nav-section-header');
  navSectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      header.classList.toggle('open');
      const items = header.nextElementSibling;
      items.classList.toggle('open');
    });
  });

  // ===== Mobile Sidebar =====
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const hamburger = document.querySelector('.hamburger');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  // ===== Page Routing =====
  const pages = document.querySelectorAll('.page');
  const navItems = document.querySelectorAll('.nav-item[data-page]');

  function showPage(pageId) {
    pages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) {
      activeNav.classList.add('active');
      // Open parent section
      const parentItems = activeNav.closest('.nav-items');
      if (parentItems) {
        parentItems.classList.add('open');
        const parentHeader = parentItems.previousElementSibling;
        if (parentHeader) parentHeader.classList.add('open');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update breadcrumb
    updateBreadcrumb(pageId);

    // Close mobile sidebar
    sidebar.classList.remove('open');
    overlay.classList.remove('show');

    // Update progress
    updateProgress();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      showPage(item.dataset.page);
    });
  });

  // Topic card clicks on home page
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => showPage(el.dataset.goto));
  });

  // ===== Breadcrumb =====
  function updateBreadcrumb() {
    const activeNav = document.querySelector('.nav-item.active');
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    if (activeNav) {
      const section = activeNav.closest('.nav-section');
      const sectionName = section ? section.querySelector('.nav-section-header span:last-child')?.textContent : '';
      bc.innerHTML = `CCNA 200-301 <span>›</span> ${sectionName || ''} <span>›</span> ${activeNav.textContent.trim()}`;
    } else {
      bc.innerHTML = 'CCNA 200-301 <span>›</span> ホーム';
    }
  }

  // ===== Progress Tracking =====
  function updateProgress() {
    const completedPages = JSON.parse(localStorage.getItem('ccna_completed') || '[]');
    const totalPages = pages.length;
    const progressPct = Math.round((completedPages.length / totalPages) * 100);
    const fill = document.querySelector('.progress-fill');
    const label = document.querySelector('.progress-label span:last-child');
    if (fill) fill.style.width = progressPct + '%';
    if (label) label.textContent = progressPct + '%';

    // Mark completed in nav
    completedPages.forEach(pageId => {
      const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
      if (navItem) navItem.classList.add('completed');
    });
  }

  function markPageComplete(pageId) {
    const completed = JSON.parse(localStorage.getItem('ccna_completed') || '[]');
    if (!completed.includes(pageId)) {
      completed.push(pageId);
      localStorage.setItem('ccna_completed', JSON.stringify(completed));
    }
    updateProgress();
  }

  // Complete button
  document.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.closest('.page');
      if (page) {
        markPageComplete(page.id);
        btn.textContent = '✓ 完了';
        btn.disabled = true;
        btn.style.opacity = '0.6';
      }
    });
  });

  // ===== Quiz System =====
  document.querySelectorAll('.quiz-item').forEach(item => {
    const question = item.dataset.answer; // correct index (0-based)
    const options = item.querySelectorAll('.quiz-option');
    const explanation = item.querySelector('.quiz-explanation');
    let answered = false;

    options.forEach((option, index) => {
      option.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const correctIndex = parseInt(item.dataset.answer);
        options.forEach((opt, i) => {
          opt.disabled = true;
          if (i === correctIndex) opt.classList.add('correct');
          else if (i === index) opt.classList.add('incorrect');
        });

        if (explanation) explanation.classList.add('show');

        // Track quiz score
        const quizId = item.closest('.quiz-section')?.dataset.quizId;
        if (quizId) {
          const scores = JSON.parse(localStorage.getItem('ccna_scores') || '{}');
          if (!scores[quizId]) scores[quizId] = { correct: 0, total: 0 };
          scores[quizId].total++;
          if (index === correctIndex) scores[quizId].correct++;
          localStorage.setItem('ccna_scores', JSON.stringify(scores));
        }
      });
    });
  });

  // Quiz reset
  document.querySelectorAll('.btn-reset-quiz').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.quiz-section');
      section.querySelectorAll('.quiz-option').forEach(opt => {
        opt.disabled = false;
        opt.classList.remove('correct', 'incorrect', 'show-answer');
      });
      section.querySelectorAll('.quiz-explanation').forEach(exp => {
        exp.classList.remove('show');
      });
      section.querySelectorAll('.quiz-item').forEach(item => {
        item._answered = false;
      });
      // Reset answered flags
      section.querySelectorAll('.quiz-item').forEach(item => {
        // Re-attach listener by reloading - simple approach:
      });
      const scoreDisplay = section.querySelector('.score-display');
      if (scoreDisplay) scoreDisplay.classList.remove('show');
    });
  });

  // ===== Subnet Calculator =====
  const calcBtn = document.getElementById('calc-subnet-btn');
  if (calcBtn) {
    calcBtn.addEventListener('click', calculateSubnet);
  }

  const ipInput = document.getElementById('calc-ip');
  const prefixInput = document.getElementById('calc-prefix');

  if (ipInput) ipInput.addEventListener('keydown', e => { if (e.key === 'Enter') calculateSubnet(); });
  if (prefixInput) prefixInput.addEventListener('keydown', e => { if (e.key === 'Enter') calculateSubnet(); });

  function calculateSubnet() {
    const ipStr = document.getElementById('calc-ip')?.value.trim();
    const prefixStr = document.getElementById('calc-prefix')?.value.trim();
    const result = document.getElementById('calc-result');
    if (!ipStr || !prefixStr || !result) return;

    const prefix = parseInt(prefixStr.replace('/', ''));
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      result.innerHTML = '<span style="color:var(--accent-red)">無効なプレフィックス長です</span>';
      result.classList.add('show');
      return;
    }

    const ipParts = ipStr.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some(p => isNaN(p) || p < 0 || p > 255)) {
      result.innerHTML = '<span style="color:var(--accent-red)">無効なIPアドレスです</span>';
      result.classList.add('show');
      return;
    }

    const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const networkInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
    const firstHost = prefix < 31 ? networkInt + 1 : networkInt;
    const lastHost = prefix < 31 ? broadcastInt - 1 : broadcastInt;
    const hostCount = prefix >= 32 ? 1 : prefix === 31 ? 2 : Math.pow(2, 32 - prefix) - 2;

    function intToIp(n) {
      return [(n >>> 24), (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }

    function maskToStr(m) {
      return [(m >>> 24), (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.');
    }

    result.innerHTML = `
      <div class="calc-result-row"><span class="calc-result-label">ネットワークアドレス:</span><span class="calc-result-value">${intToIp(networkInt)}/${prefix}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">サブネットマスク:</span><span class="calc-result-value">${maskToStr(maskInt)}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">ブロードキャスト:</span><span class="calc-result-value">${intToIp(broadcastInt)}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">使用可能範囲:</span><span class="calc-result-value">${intToIp(firstHost)} ～ ${intToIp(lastHost)}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">ホスト数:</span><span class="calc-result-value">${hostCount.toLocaleString()} 台</span></div>
      <div class="calc-result-row"><span class="calc-result-label">ブロックサイズ:</span><span class="calc-result-value">${Math.pow(2, 32 - prefix)}</span></div>
    `;
    result.classList.add('show');
  }

  // ===== Scroll to Top =====
  const scrollTopBtn = document.getElementById('scrollTop');
  const mainEl = document.getElementById('main');

  if (mainEl && scrollTopBtn) {
    mainEl.addEventListener('scroll', () => {
      if (mainEl.scrollTop > 200) scrollTopBtn.classList.add('show');
      else scrollTopBtn.classList.remove('show');
    });
    scrollTopBtn.addEventListener('click', () => {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Also handle window scroll for fallback
  window.addEventListener('scroll', () => {
    if (window.scrollY > 200) scrollTopBtn?.classList.add('show');
    else scrollTopBtn?.classList.remove('show');
  });

  scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ===== Initial Load =====
  const firstPage = document.querySelector('.page');
  if (firstPage) {
    firstPage.classList.add('active');
  }

  // Open first nav section
  const firstSection = document.querySelector('.nav-section-header');
  if (firstSection) {
    firstSection.classList.add('open');
    firstSection.nextElementSibling.classList.add('open');
  }

  updateProgress();
  updateBreadcrumb();
});
