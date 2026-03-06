// chapters.js - 全章コンテンツをindex.htmlに動的に統合する
(function () {
    const files = ['ch1b.html', 'ch2.html', 'ch3.html', 'ch4to6.html'];
    const container = document.getElementById('dynamic-pages');
    if (!container) return;

    let pending = files.length;

    files.forEach(function (file) {
        fetch(file)
            .then(function (r) { return r.text(); })
            .then(function (html) {
                container.insertAdjacentHTML('beforeend', html);
                pending--;
                if (pending === 0) initDynamicPages();
            })
            .catch(function (e) {
                console.warn('Failed to load ' + file, e);
                pending--;
                if (pending === 0) initDynamicPages();
            });
    });

    function initDynamicPages() {
        // 動的に追加したページのクイズシステムを初期化
        document.querySelectorAll('#dynamic-pages .quiz-item').forEach(function (item) {
            var options = item.querySelectorAll('.quiz-option');
            var explanation = item.querySelector('.quiz-explanation');
            var answered = false;

            options.forEach(function (option, index) {
                option.addEventListener('click', function () {
                    if (answered) return;
                    answered = true;
                    var correctIndex = parseInt(item.dataset.answer);
                    options.forEach(function (opt, i) {
                        opt.disabled = true;
                        if (i === correctIndex) opt.classList.add('correct');
                        else if (i === index) opt.classList.add('incorrect');
                    });
                    if (explanation) explanation.classList.add('show');
                });
            });
        });

        // リセットボタン
        document.querySelectorAll('#dynamic-pages .btn-reset-quiz').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var section = btn.closest('.quiz-section');
                section.querySelectorAll('.quiz-option').forEach(function (opt) {
                    opt.disabled = false;
                    opt.classList.remove('correct', 'incorrect');
                });
                section.querySelectorAll('.quiz-explanation').forEach(function (exp) {
                    exp.classList.remove('show');
                });
            });
        });

        // ナビゲーションアイテムを再バインド
        document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
            // イベントは既存のapp.jsで初期化済みの場合は不要だがここで再設定
            item.addEventListener('click', function () {
                document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
                document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
                var targetPage = document.getElementById(item.dataset.page);
                if (targetPage) {
                    targetPage.classList.add('active');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                item.classList.add('active');
                var parentItems = item.closest('.nav-items');
                if (parentItems) {
                    parentItems.classList.add('open');
                    var parentHeader = parentItems.previousElementSibling;
                    if (parentHeader) parentHeader.classList.add('open');
                }
            });
        });

        console.log('All chapters loaded and initialized.');
    }
})();
