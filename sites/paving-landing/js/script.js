// БрусДвор — лендинг (демо-проект). Чистый JS без зависимостей.

document.addEventListener('DOMContentLoaded', function () {
  /* ---- 1. Шапка: непрозрачный фон при скролле ---- */
  var header = document.getElementById('site-header');
  var SCROLL_THRESHOLD = 40;

  function updateHeaderState() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }

  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });

  /* ---- 2. Мобильное меню (гамбургер) ---- */
  var navToggle = document.getElementById('nav-toggle');
  var mainNav = document.getElementById('main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Закрывать меню при переходе по якорной ссылке (мобильный UX)
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- 3. FAQ-аккордеон ---- */
  var accordionItems = document.querySelectorAll('.accordion__item');

  accordionItems.forEach(function (item) {
    var trigger = item.querySelector('.accordion__trigger');
    var panel = item.querySelector('.accordion__panel');

    trigger.addEventListener('click', function () {
      var isOpen = item.classList.contains('is-open');

      // Простой аккордеон: один открытый вопрос за раз
      accordionItems.forEach(function (other) {
        other.classList.remove('is-open');
        other.querySelector('.accordion__trigger').setAttribute('aria-expanded', 'false');
        other.querySelector('.accordion__panel').style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ---- 4. Форма заявки: демо-обработка без бэкенда ---- */
  var leadForm = document.getElementById('lead-form');
  var formSuccess = document.getElementById('form-success');

  if (leadForm) {
    leadForm.addEventListener('submit', function (event) {
      event.preventDefault();
      // Демо-проект: реальной отправки на сервер нет — только имитация UX.
      formSuccess.hidden = false;
      formSuccess.setAttribute('tabindex', '-1');
      formSuccess.focus();
      leadForm.reset();
    });
  }

  /* ---- 5. Год в футере ---- */
  var yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
