/* =========================================================
   Вкусняшки от Сашки — логика меню, конструктора заказа и
   отправки заказа в WhatsApp / копирования текста.
   Простой JS без сборки и внешних зависимостей.
   ========================================================= */
(function () {
  'use strict';

  var WHATSAPP_NUMBER = '79168232824';
  var MAX_CHANNEL = 'https://max.ru/channel_minimym_na_kuhne';
  // Instagram и Telegram — заказчица сейчас регистрирует аккаунты (см.
  // brief.md, «Instagram и Telegram — РЕШЕНИЕ ИЗМЕНИЛОСЬ 2026-09-13»),
  // ссылок пока нет. Кнопки/иконки в шапке, футере и разделе «Контакты»
  // уже свёрстаны (index.html, data-social="instagram"/"telegram") и
  // видны на сайте, но пока неактивны — href="#" + aria-disabled="true" +
  // приглушённый стиль (styles.css). Чтобы включить их, когда придут
  // реальные ссылки, достаточно подставить их сюда двумя строками —
  // никакую разметку/CSS менять не нужно, setupSocialLinks() при загрузке
  // страницы сам расставит href, снимет aria-disabled/подсказку «Скоро» и
  // включит переход по клику. Пример: 'https://instagram.com/vkusnyashki_ot_sashki'.
  var INSTAGRAM_URL = null;
  var TELEGRAM_URL = null;
  var FREE_DELIVERY_THRESHOLD = 5000;

  /* ---------------------------------------------------------
     1) Точные данные меню (см. brief.md — цифры/названия не менять)
     Типы карточек:
       'tiers'        — сегмент из 2 цен (напр. 0.5 кг / 1 кг) + степпер количества
       'unit'         — сегмент "за шт" / "за кг", у каждого режима свой степпер
       'single'       — одна цена (за кг или за шт), степпер стартует с минимума
       'weight-anchor' — гибкий вес от minG и выше (степпер с шагом stepG),
                         цена считается линейной интерполяцией между двумя
                         реперными точками из брифа: (minG, priceAtMin) и
                         (refG, priceAtRef) — так минимальная порция и 1 кг
                         стоят ровно столько, сколько указано в брифе, а
                         между ними и выше — плавный линейный рост
       'pack'         — фикс. фасовка (упаковка из packSize шт), степпер
                         считает количество упаковок (шаг 1, минимум 1).
                         Используется вместе с флагом priceTBD: true у
                         позиций, для которых цена ещё не определена —
                         такая позиция показывает «Цена уточняется» вместо
                         цифры, не входит в сумму заказа (computeCardTotal
                         и lineTotal возвращают для неё 0), но остаётся в
                         списке корзины и в тексте заказа отдельной строкой
                         с пометкой «(цена уточняется)».
     --------------------------------------------------------- */
  var MENU = [
    {
      key: 'pelmeni',
      title: 'Пельмени — лепим вручную',
      items: [
        {
          id: 'pelmeni-babushkiny',
          name: 'Бабушкины (говядина-свинина), крупные',
          badge: 'Хит',
          type: 'tiers',
          tiers: [
            { label: '0.5 кг', price: 550 },
            { label: '1 кг', price: 1100 }
          ]
        },
        {
          id: 'pelmeni-malenkie',
          name: 'Маленькие (говядина-свинина)',
          type: 'tiers',
          tiers: [
            { label: '0.5 кг', price: 550 },
            { label: '1 кг', price: 1100 }
          ]
        }
      ]
    },
    {
      key: 'vareniki',
      title: 'Вареники — с картошкой, по-домашнему',
      items: [
        {
          id: 'vareniki-luk',
          name: 'С картошкой и жареным луком',
          type: 'tiers',
          tiers: [{ label: '0.5 кг', price: 350 }, { label: '1 кг', price: 700 }]
        },
        {
          id: 'vareniki-bekon',
          name: 'С картошкой и беконом',
          type: 'tiers',
          tiers: [{ label: '0.5 кг', price: 400 }, { label: '1 кг', price: 800 }]
        },
        {
          id: 'vareniki-griby',
          name: 'С картошкой и грибами',
          type: 'tiers',
          tiers: [{ label: '0.5 кг', price: 400 }, { label: '1 кг', price: 800 }]
        }
      ]
    },
    {
      key: 'myaso',
      title: 'Мясная продукция — котлеты, фрикадельки, отбивные',
      items: [
        {
          id: 'kotlety-klassicheskie',
          name: 'Котлеты классические в панировке (говядина-свинина, 100 г/шт)',
          type: 'unit',
          modes: [
            { key: 'pc', label: 'за 1 шт', price: 550, step: 1, min: 1, suffix: 'шт' },
            { key: 'kg', label: 'за 1 кг', price: 1100, step: 0.5, min: 0.5, suffix: 'кг' }
          ]
        },
        {
          id: 'kotlety-kurinye',
          name: 'Котлеты куриные с пассерованными овощами в панировке (100 г/шт)',
          type: 'unit',
          modes: [
            { key: 'pc', label: 'за 1 шт', price: 500, step: 1, min: 1, suffix: 'шт' },
            { key: 'kg', label: 'за 1 кг', price: 1000, step: 0.5, min: 0.5, suffix: 'кг' }
          ]
        },
        {
          id: 'frikadelki-kurinye-standart',
          name: 'Фрикадельки куриные с пассерованными овощами, стандарт',
          note: 'продажа от 300 г',
          type: 'weight-anchor',
          minG: 300, priceAtMin: 500, refG: 1000, priceAtRef: 1000, stepG: 100
        },
        {
          id: 'frikadelki-kurinye-mini',
          name: 'Фрикадельки куриные с пассерованными овощами, мини/детские',
          note: 'продажа от 300 г',
          type: 'weight-anchor',
          minG: 300, priceAtMin: 500, refG: 1000, priceAtRef: 1000, stepG: 100
        },
        {
          id: 'frikadelki-myasnye-standart',
          name: 'Фрикадельки мясные, стандарт',
          note: 'продажа от 300 г',
          type: 'weight-anchor',
          minG: 300, priceAtMin: 600, refG: 1000, priceAtRef: 1200, stepG: 100
        },
        {
          id: 'frikadelki-myasnye-mini',
          name: 'Фрикадельки мясные (говядина-свинина), мини/детские',
          note: 'продажа от 300 г',
          type: 'weight-anchor',
          minG: 300, priceAtMin: 600, refG: 1000, priceAtRef: 1200, stepG: 100
        },
        {
          id: 'otbivnye-kurinye',
          name: 'Отбивные куриные в сухарях',
          type: 'unit',
          modes: [
            { key: 'pc', label: 'за 1 шт', price: 600, step: 1, min: 1, suffix: 'шт' },
            { key: 'kg', label: 'за 1 кг', price: 1200, step: 0.5, min: 0.5, suffix: 'кг' }
          ]
        }
      ]
    },
    {
      key: 'farshirovannye',
      title: 'Фаршированные блюда',
      items: [
        {
          id: 'perzy-farshirovannye',
          name: 'Перцы фаршированные (говядина-свинина)',
          type: 'single',
          rate: 900,
          unit: 'кг',
          step: 0.5,
          min: 0.5,
          priceLabel: '900 ₽ / кг'
        },
        {
          id: 'golubtsy-nezhnye',
          name: 'Голубцы нежные (говядина-свинина)',
          type: 'single',
          rate: 900,
          unit: 'кг',
          step: 0.5,
          min: 0.5,
          priceLabel: '900 ₽ / кг'
        },
        {
          id: 'gnezda-myasnye',
          name: 'Гнёзда мясные (фаршированные грибами и адыгейским сыром)',
          note: 'продажа от 4 шт',
          type: 'single',
          rate: 150,
          unit: 'шт',
          step: 1,
          min: 4,
          priceLabel: '150 ₽ / шт'
        }
      ]
    },
    {
      key: 'syrniki',
      // Отдельный якорь #syrniki (а не #cat-syrniki, как у остальных
      // категорий) — по карте сайта content-writer/sitemap.md, где у
      // «Сырников» отдельный слаг /#syrniki.
      anchorId: 'syrniki',
      title: 'Сырники классические',
      intro: [
        'Домашние сырники из творога — готовятся точно так же, как и всё остальное в меню: на заказ, руками, а не берутся готовыми с полки. Простой, тёплый, знакомый с детства вкус — то, что хочется на завтрак.',
        'Продаются пачкой по 10 штук. Меньше пачки заказать нельзя: минимальный объём заказа — тоже 10 штук.'
      ],
      items: [
        {
          id: 'syrniki-klassicheskie',
          name: 'Сырники классические',
          alt: 'Домашние сырники классические из творога',
          note: 'пачка 10 шт · минимальный заказ — 1 пачка',
          type: 'pack',
          packSize: 10,
          // Цена ещё не определена заказчицей — как только придёт цифра,
          // достаточно добавить поле price/rate и убрать priceTBD, логику
          // менять не нужно (см. brief.md, «Новая позиция меню...»).
          priceTBD: true
        }
      ]
    }
  ];

  /* ---------------------------------------------------------
     Утилиты
     --------------------------------------------------------- */
  function formatRub(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function pluralPositions(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'позиции';
    return 'позиций';
  }

  function formatAmount(value, unit) {
    var v = Math.round(value * 100) / 100;
    var str = (v % 1 === 0) ? String(v) : String(v).replace('.', ',');
    return unit ? (str + ' ' + unit) : str;
  }

  // Вес в граммах -> человекочитаемая подпись: до 1 кг — в граммах,
  // от 1 кг — в килограммах (с дробной частью через запятую).
  function formatWeightG(g) {
    if (g < 1000) return String(g) + ' г';
    return formatAmount(g / 1000, 'кг');
  }

  // Линейная интерполяция цены между двумя реперными точками веса.
  // anchor = { minG, priceAtMin, refG, priceAtRef }. На minG и refG даёт
  // ровно priceAtMin/priceAtRef (без ошибки округления), между и за
  // пределами refG — продолжает той же прямой. Итог округляется до рубля.
  function computeWeightAnchorPrice(anchor, weightG) {
    var slope = (anchor.priceAtRef - anchor.priceAtMin) / (anchor.refG - anchor.minG);
    var raw = anchor.priceAtMin + (weightG - anchor.minG) * slope;
    return Math.round(raw);
  }

  // Текст цены для карточки типа 'weight-anchor' (аналог item.priceLabel у 'single').
  function weightAnchorPriceLabel(item) {
    return formatRub(item.priceAtMin) + ' / ' + formatWeightG(item.minG) +
      ' · ' + formatRub(item.priceAtRef) + ' / ' + formatWeightG(item.refG);
  }

  function imgPath(id) {
    return 'assets/images/' + id + '.jpg';
  }

  function handleImgError(img) {
    img.classList.add('is-missing');
    var wrap = img.closest('.photo');
    if (wrap) wrap.classList.add('show-placeholder');
  }
  window.handleImgError = handleImgError;

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------------------------------------------------------
     2) Состояние карточек (текущий выбор веса/кол-ва на каждой)
     --------------------------------------------------------- */
  var cardState = {};

  function initCardState(item) {
    if (item.type === 'tiers') {
      cardState[item.id] = { tierIndex: 0, qty: 1 };
    } else if (item.type === 'unit') {
      var firstMode = item.modes[0];
      cardState[item.id] = { modeKey: firstMode.key, amounts: {} };
      item.modes.forEach(function (m) { cardState[item.id].amounts[m.key] = m.min; });
    } else if (item.type === 'single') {
      cardState[item.id] = { amount: item.min };
    } else if (item.type === 'weight-anchor') {
      cardState[item.id] = { amountG: item.minG };
    } else if (item.type === 'pack') {
      cardState[item.id] = { packs: 1 };
    }
  }

  // Сумма по карточке. Позиции с priceTBD (цена ещё не известна, напр.
  // «Сырники классические») намеренно всегда дают 0, чтобы не портить
  // общую сумму заказа — сама позиция при этом всё равно добавляется в
  // корзину и в текст заказа отдельной строкой с пометкой «цена уточняется».
  function computeCardTotal(item) {
    if (item.priceTBD) return 0;
    var st = cardState[item.id];
    if (item.type === 'tiers') {
      return item.tiers[st.tierIndex].price * st.qty;
    }
    if (item.type === 'unit') {
      var mode = item.modes.filter(function (m) { return m.key === st.modeKey; })[0];
      return mode.price * st.amounts[mode.key];
    }
    if (item.type === 'single') {
      return item.rate * st.amount;
    }
    if (item.type === 'weight-anchor') {
      return computeWeightAnchorPrice(item, st.amountG);
    }
    return 0;
  }

  function cardVariantSignature(item) {
    var st = cardState[item.id];
    if (item.type === 'tiers') return item.tiers[st.tierIndex].label;
    if (item.type === 'unit') {
      var mode = item.modes.filter(function (m) { return m.key === st.modeKey; })[0];
      return mode.label;
    }
    if (item.type === 'single') return item.unit === 'кг' ? '1 кг' : '1 шт';
    if (item.type === 'weight-anchor') return formatWeightG(st.amountG);
    if (item.type === 'pack') return 'уп. по ' + item.packSize + ' шт';
    return '';
  }

  function cardVariantUnitPrice(item) {
    if (item.priceTBD) return 0;
    var st = cardState[item.id];
    if (item.type === 'tiers') return item.tiers[st.tierIndex].price;
    if (item.type === 'unit') {
      var mode = item.modes.filter(function (m) { return m.key === st.modeKey; })[0];
      return mode.price;
    }
    if (item.type === 'single') return item.rate;
    if (item.type === 'weight-anchor') return computeCardTotal(item) / st.amountG;
    return 0;
  }

  function cardVariantCount(item) {
    var st = cardState[item.id];
    if (item.type === 'tiers') return st.qty;
    if (item.type === 'unit') return st.amounts[st.modeKey];
    if (item.type === 'single') return st.amount;
    if (item.type === 'weight-anchor') return st.amountG;
    if (item.type === 'pack') return st.packs;
    return 1;
  }

  function cardVariantStepMin(item) {
    var st = cardState[item.id];
    if (item.type === 'tiers') return { step: 1, min: 1 };
    if (item.type === 'unit') {
      var mode = item.modes.filter(function (m) { return m.key === st.modeKey; })[0];
      return { step: mode.step, min: mode.min };
    }
    if (item.type === 'single') return { step: item.step, min: item.min };
    if (item.type === 'weight-anchor') return { step: item.stepG, min: item.minG };
    if (item.type === 'pack') return { step: 1, min: 1 };
    return { step: 1, min: 1 };
  }

  /* ---------------------------------------------------------
     3) Рендер карточек меню
     --------------------------------------------------------- */
  function renderMenu() {
    var root = document.getElementById('menu-categories');
    MENU.forEach(function (category) {
      var section = el('div', 'menu-category');
      section.id = category.anchorId || ('cat-' + category.key);

      var header = el('div', 'menu-category__header', '<h3>' + category.title + '</h3>');
      section.appendChild(header);

      // Необязательный вводный текст категории (напр. описание сырников
      // из content/syrniki.md) — рендерится как обычные абзацы под заголовком.
      if (category.intro && category.intro.length) {
        var introWrap = el('div', 'menu-category__intro');
        category.intro.forEach(function (paragraph) {
          introWrap.appendChild(el('p', '', paragraph));
        });
        section.appendChild(introWrap);
      }

      var grid = el('div', 'cards-grid');
      category.items.forEach(function (item) {
        initCardState(item);
        grid.appendChild(renderCard(item));
      });
      section.appendChild(grid);
      root.appendChild(section);
    });
  }

  function renderCard(item) {
    var tplId = item.type === 'tiers' ? 'tpl-card-tiers' : (item.type === 'unit' ? 'tpl-card-unit' : 'tpl-card-single');
    var tpl = document.getElementById(tplId);
    var node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.itemId = item.id;

    var img = node.querySelector('img');
    img.src = imgPath(item.id);
    img.alt = item.alt || item.name;
    img.setAttribute('onerror', 'handleImgError(this)');

    if (item.badge) {
      var badgeEl = node.querySelector('.badge');
      badgeEl.textContent = item.badge;
      badgeEl.hidden = false;
    }

    node.querySelector('.dish-card__name').textContent = item.name;

    var noteEl = node.querySelector('.dish-card__note');
    if (noteEl) {
      if (item.note) { noteEl.textContent = item.note; noteEl.hidden = false; }
      else if (item.type !== 'single' && item.type !== 'weight-anchor') { noteEl.hidden = true; }
    }

    if (item.type === 'tiers') {
      var tiersWrap = node.querySelector('.dish-card__tiers');
      item.tiers.forEach(function (tier, idx) {
        var btn = el('button', 'segmented__btn' + (idx === 0 ? ' is-active' : ''),
          tier.label + ' · ' + formatRub(tier.price));
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', idx === 0 ? 'true' : 'false');
        btn.addEventListener('click', function () {
          cardState[item.id].tierIndex = idx;
          tiersWrap.querySelectorAll('.segmented__btn').forEach(function (b, i) {
            b.classList.toggle('is-active', i === idx);
            b.setAttribute('aria-checked', i === idx ? 'true' : 'false');
          });
          updateCardTotal(item, node);
        });
        tiersWrap.appendChild(btn);
      });
    }

    if (item.type === 'unit') {
      var modesWrap = node.querySelector('.dish-card__modes');
      item.modes.forEach(function (mode, idx) {
        var btn = el('button', 'segmented__btn' + (idx === 0 ? ' is-active' : ''),
          mode.label + ' · ' + formatRub(mode.price));
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', idx === 0 ? 'true' : 'false');
        btn.addEventListener('click', function () {
          cardState[item.id].modeKey = mode.key;
          modesWrap.querySelectorAll('.segmented__btn').forEach(function (b, i) {
            b.classList.toggle('is-active', i === idx);
            b.setAttribute('aria-checked', i === idx ? 'true' : 'false');
          });
          renderStepperValue(item, node);
          updateCardTotal(item, node);
        });
        modesWrap.appendChild(btn);
      });
    }

    if (item.type === 'single') {
      node.querySelector('[data-role="unit-price"]').textContent = item.priceLabel;
      if (noteEl && item.note) { noteEl.textContent = item.note; noteEl.hidden = false; }
      else if (noteEl) { noteEl.hidden = true; }
    }

    if (item.type === 'weight-anchor') {
      node.querySelector('[data-role="unit-price"]').textContent = weightAnchorPriceLabel(item);
      if (noteEl && item.note) { noteEl.textContent = item.note; noteEl.hidden = false; }
      else if (noteEl) { noteEl.hidden = true; }
    }

    if (item.type === 'pack') {
      var priceEl = node.querySelector('[data-role="unit-price"]');
      priceEl.textContent = 'Цена уточняется';
      priceEl.classList.add('dish-card__price--tbd');
      if (noteEl && item.note) { noteEl.textContent = item.note; noteEl.hidden = false; }
      else if (noteEl) { noteEl.hidden = true; }
    }

    // Степпер
    var decBtn = node.querySelector('[data-action="dec"]');
    var incBtn = node.querySelector('[data-action="inc"]');
    decBtn.addEventListener('click', function () { stepCard(item, node, -1); });
    incBtn.addEventListener('click', function () { stepCard(item, node, 1); });

    renderStepperValue(item, node);
    updateCardTotal(item, node);

    // Кнопка добавления
    var addBtn = node.querySelector('.dish-card__add');
    addBtn.addEventListener('click', function () {
      addToCart(item);
      var originalText = addBtn.textContent;
      addBtn.textContent = 'Добавлено ✓';
      addBtn.classList.add('is-success');
      addBtn.disabled = true;
      setTimeout(function () {
        addBtn.textContent = originalText;
        addBtn.classList.remove('is-success');
        addBtn.disabled = false;
      }, 1600);
    });

    return node;
  }

  function renderStepperValue(item, node) {
    var valueEl = node.querySelector('[data-role="qty"], [data-role="amount"]');
    var decBtn = node.querySelector('[data-action="dec"]');
    var sm = cardVariantStepMin(item);
    var count = cardVariantCount(item);
    var unitSuffix = '';
    if (item.type === 'unit') {
      var st = cardState[item.id];
      var mode = item.modes.filter(function (m) { return m.key === st.modeKey; })[0];
      unitSuffix = mode.suffix;
    } else if (item.type === 'single') {
      unitSuffix = item.unit;
    }
    if (item.type === 'weight-anchor') {
      valueEl.textContent = formatWeightG(count);
    } else if (item.type === 'pack') {
      valueEl.textContent = count + ' уп. (' + (count * item.packSize) + ' шт)';
    } else {
      valueEl.textContent = unitSuffix ? formatAmount(count, unitSuffix) : String(count);
    }
    decBtn.disabled = (count <= sm.min + 1e-9);
  }

  function stepCard(item, node, direction) {
    var sm = cardVariantStepMin(item);
    var st = cardState[item.id];
    if (item.type === 'tiers') {
      st.qty = Math.max(1, Math.round((st.qty + direction) * 100) / 100);
    } else if (item.type === 'unit') {
      var next = Math.round((st.amounts[st.modeKey] + direction * sm.step) * 100) / 100;
      st.amounts[st.modeKey] = Math.max(sm.min, next);
    } else if (item.type === 'single') {
      var nextS = Math.round((st.amount + direction * sm.step) * 100) / 100;
      st.amount = Math.max(sm.min, nextS);
    } else if (item.type === 'weight-anchor') {
      st.amountG = Math.max(sm.min, st.amountG + direction * sm.step);
    } else if (item.type === 'pack') {
      st.packs = Math.max(sm.min, st.packs + direction * sm.step);
    }
    renderStepperValue(item, node);
    updateCardTotal(item, node);
  }

  // «Итого по позиции» на карточке: для priceTBD-позиций (цена ещё не
  // определена) вместо суммы всегда показывается пояснительный текст.
  function updateCardTotal(item, node) {
    var totalEl = node.querySelector('[data-role="total"]');
    if (item.priceTBD) {
      totalEl.textContent = 'Цена уточняется';
      return;
    }
    var total = computeCardTotal(item);
    totalEl.textContent = formatRub(total);
  }

  /* ---------------------------------------------------------
     4) Корзина / конструктор заказа
     --------------------------------------------------------- */
  var cart = {
    lines: [], // {id, itemId, name, variantLabel, unitPrice, count, step, min, unitSuffix}
    receiveMethod: 'pickup', // 'pickup' | 'delivery'
    zone: '',
    address: '',
    customerName: '',
    customerPhone: ''
  };

  // Короткие названия категорий — добавляются перед названием блюда только
  // в тексте заказа (WhatsApp/копирование) и в панели корзины, для ясности
  // вне контекста страницы. Названия самих блюд на карточках меню при этом
  // остаются ровно такими, как в brief.md.
  var CATEGORY_LABELS = { pelmeni: 'Пельмени', vareniki: 'Вареники', myaso: 'Мясная продукция', farshirovannye: 'Фаршированные' };

  function findCategoryLabel(itemId) {
    for (var c = 0; c < MENU.length; c++) {
      for (var i = 0; i < MENU[c].items.length; i++) {
        if (MENU[c].items[i].id === itemId) return CATEGORY_LABELS[MENU[c].key] || '';
      }
    }
    return '';
  }

  function addToCart(item) {
    var variantLabel = cardVariantSignature(item);
    var unitPrice = cardVariantUnitPrice(item);
    var count = cardVariantCount(item);
    var sm = cardVariantStepMin(item);
    var unitSuffix = (item.type === 'unit')
      ? item.modes.filter(function (m) { return cardState[item.id].modeKey === m.key; })[0].suffix
      : (item.type === 'single' ? item.unit : (item.type === 'pack' ? 'уп.' : ''));

    var existing = cart.lines.filter(function (l) {
      return l.itemId === item.id && l.variantLabel === variantLabel;
    })[0];

    if (existing) {
      existing.count = Math.round((existing.count + count) * 100) / 100;
    } else {
      var categoryLabel = findCategoryLabel(item.id);
      var line = {
        id: item.id + '__' + variantLabel,
        itemId: item.id,
        name: categoryLabel ? (categoryLabel + ': ' + item.name) : item.name,
        variantLabel: variantLabel,
        unitPrice: unitPrice,
        count: count,
        step: sm.step,
        min: sm.min,
        unitSuffix: unitSuffix
      };
      // У 'weight-anchor' цена — не константный тариф, а функция от веса
      // (линейная интерполяция), поэтому для пересчёта суммы при изменении
      // веса прямо в корзине сохраняем реперные точки, а не unitPrice.
      if (item.type === 'weight-anchor') {
        line.weightAnchor = { minG: item.minG, priceAtMin: item.priceAtMin, refG: item.refG, priceAtRef: item.priceAtRef };
      }
      // Позиции с ещё не определённой ценой (напр. сырники): помечаем
      // строку корзины priceTBD, чтобы не включать её в сумму заказа, но
      // показывать явно и в панели, и в тексте заказа.
      if (item.priceTBD) {
        line.priceTBD = true;
        if (item.type === 'pack') line.pack = { size: item.packSize };
      }
      cart.lines.push(line);
    }
    renderCart();
  }

  // Сумма по строке корзины: для 'weight-anchor' считается заново по весу
  // (реперные точки), для остальных типов — unitPrice × count. Позиции с
  // priceTBD (цена ещё не определена) всегда дают 0 — не портят сумму заказа.
  function lineTotal(line) {
    if (line.priceTBD) return 0;
    return line.weightAnchor ? computeWeightAnchorPrice(line.weightAnchor, line.count) : line.unitPrice * line.count;
  }

  function removeCartLine(lineId) {
    cart.lines = cart.lines.filter(function (l) { return l.id !== lineId; });
    renderCart();
  }

  function stepCartLine(lineId, direction) {
    var line = cart.lines.filter(function (l) { return l.id === lineId; })[0];
    if (!line) return;
    var next = Math.round((line.count + direction * line.step) * 100) / 100;
    line.count = Math.max(line.min, next);
    renderCart();
  }

  function cartTotal() {
    return cart.lines.reduce(function (sum, l) { return sum + lineTotal(l); }, 0);
  }

  function cartItemsCount() {
    return cart.lines.length;
  }

  function renderCart() {
    var cartEl = document.getElementById('cart');
    var listEl = document.getElementById('cart-list');
    listEl.innerHTML = '';

    var hasItems = cart.lines.length > 0;
    cartEl.classList.toggle('has-items', hasItems);
    // Панель НЕ открывается сама при добавлении товара — только по клику
    // пользователя на плашку-корзину внизу (мобильный) или на значок
    // корзины в шапке (десктоп/мобильный). Иначе на телефоне шторка на
    // 80vh перекрывает меню при каждом добавлении товара — неудобно.

    cart.lines.forEach(function (line) {
      var li = el('li', 'cart-line');

      var photoWrap = el('div', 'photo cart-line__photo');
      var img = document.createElement('img');
      img.src = imgPath(line.itemId);
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', function () { handleImgError(img); });
      photoWrap.appendChild(img);
      var ph = el('span', 'photo__placeholder', '<svg class="icon icon--placeholder"><use href="#icon-dish"/></svg>');
      ph.setAttribute('aria-hidden', 'true');
      photoWrap.appendChild(ph);
      li.appendChild(photoWrap);

      var info = el('div', 'cart-line__info');
      info.appendChild(el('p', 'cart-line__name', line.name));
      info.appendChild(el('p', 'cart-line__meta', line.variantLabel));

      var row = el('div', 'cart-line__row');
      var stepperWrap = el('div', 'cart-line__stepper');
      var minus = el('button', '', '<svg class="icon"><use href="#icon-minus"/></svg>');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Уменьшить количество');
      minus.disabled = (line.count <= line.min + 1e-9);
      minus.addEventListener('click', function () { stepCartLine(line.id, -1); });
      var amountSpan = el('span', '', line.weightAnchor
        ? formatWeightG(line.count)
        : line.pack
          ? (line.count + ' уп. (' + (line.count * line.pack.size) + ' шт)')
          : (line.unitSuffix ? formatAmount(line.count, line.unitSuffix) : ('× ' + line.count)));
      var plus = el('button', '', '<svg class="icon"><use href="#icon-plus"/></svg>');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Увеличить количество');
      plus.addEventListener('click', function () { stepCartLine(line.id, 1); });
      stepperWrap.appendChild(minus);
      stepperWrap.appendChild(amountSpan);
      stepperWrap.appendChild(plus);
      row.appendChild(stepperWrap);

      var price = el('span', 'cart-line__price' + (line.priceTBD ? ' cart-line__price--tbd' : ''),
        line.priceTBD ? 'Цена уточняется' : formatRub(lineTotal(line)));
      row.appendChild(price);

      var removeBtn = el('button', 'cart-line__remove', '<svg class="icon"><use href="#icon-close"/></svg>');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Удалить позицию');
      removeBtn.addEventListener('click', function () { removeCartLine(line.id); });
      row.appendChild(removeBtn);

      info.appendChild(row);
      li.appendChild(info);
      listEl.appendChild(li);
    });

    var total = cartTotal();

    // Заголовок свернутой панели
    document.getElementById('cart-toggle-summary').textContent = hasItems
      ? cartItemsCount() + ' ' + pluralPositions(cartItemsCount()) + ' · ' + formatRub(total)
      : 'Пока пусто';

    // Счётчик в шапке
    var headerCount = document.getElementById('header-cart-count');
    if (hasItems) { headerCount.hidden = false; headerCount.textContent = String(cartItemsCount()); }
    else { headerCount.hidden = true; }

    // Прогресс бесплатной доставки
    var progressWrap = document.getElementById('cart-progress');
    var progressText = document.getElementById('cart-progress-text');
    var progressFill = document.getElementById('cart-progress-fill');
    var receiveWrap = document.getElementById('cart-receive');
    var contactWrap = document.getElementById('cart-contact');
    var totalWrap = document.getElementById('cart-total-wrap');

    if (hasItems) {
      progressWrap.hidden = false;
      receiveWrap.hidden = false;
      contactWrap.hidden = false;
      totalWrap.hidden = false;
      cartEl.classList.add('has-total');

      if (total >= FREE_DELIVERY_THRESHOLD) {
        progressText.textContent = 'Доставка бесплатно!';
        progressText.classList.add('is-done');
        progressFill.style.width = '100%';
      } else {
        var remaining = FREE_DELIVERY_THRESHOLD - total;
        progressText.textContent = 'До бесплатной доставки: ещё ' + formatRub(remaining);
        progressText.classList.remove('is-done');
        progressFill.style.width = Math.max(4, (total / FREE_DELIVERY_THRESHOLD) * 100) + '%';
      }
    } else {
      progressWrap.hidden = true;
      receiveWrap.hidden = true;
      contactWrap.hidden = true;
      totalWrap.hidden = true;
      cartEl.classList.remove('has-total');
    }

    document.getElementById('cart-total').textContent = formatRub(total);

    // WhatsApp кнопка
    var waBtn = document.getElementById('cart-whatsapp-btn');
    if (hasItems) {
      waBtn.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(buildOrderText());
      waBtn.removeAttribute('aria-disabled');
    } else {
      waBtn.href = 'https://wa.me/' + WHATSAPP_NUMBER;
      waBtn.setAttribute('aria-disabled', 'true');
    }
  }

  /* ---------------------------------------------------------
     5) Текст заказа (для WhatsApp и копирования)
     --------------------------------------------------------- */
  function buildOrderText() {
    var lines = [];
    lines.push('Здравствуйте! Хочу сделать заказ в «Вкусняшки от Сашки»:');
    lines.push('');
    cart.lines.forEach(function (line, idx) {
      // Позиции с ещё не определённой ценой (priceTBD) попадают в текст
      // заказа отдельной строкой без суммы и с явной пометкой — они не
      // должны создавать впечатление, что их стоимость равна 0 ₽.
      if (line.priceTBD) {
        var packDesc = line.pack
          ? (line.count + ' уп. по ' + line.pack.size + ' шт')
          : (line.count + ' × ' + line.variantLabel);
        lines.push((idx + 1) + '. ' + line.name + ' — ' + packDesc + ' (цена уточняется)');
        return;
      }
      var desc;
      if (line.weightAnchor) {
        desc = line.name + ' — ' + formatWeightG(line.count);
      } else {
        var qtyLabel = line.unitSuffix ? formatAmount(line.count, line.unitSuffix) : (line.count + ' × ' + line.variantLabel);
        desc = line.unitSuffix
          ? (line.name + ' — ' + qtyLabel)
          : (line.name + ' — ' + line.variantLabel + ' × ' + line.count);
      }
      lines.push((idx + 1) + '. ' + desc + ' = ' + formatRub(lineTotal(line)));
    });
    lines.push('');
    lines.push('Итого: ' + formatRub(cartTotal()));

    if (cart.receiveMethod === 'pickup') {
      lines.push('Способ получения: самовывоз (СНТ Скоротово, Одинцовский р-н)');
    } else {
      var zoneLine = 'Способ получения: доставка';
      if (cart.zone) zoneLine += ' — ' + cart.zone;
      lines.push(zoneLine);
      if (cartTotal() >= FREE_DELIVERY_THRESHOLD) {
        lines.push('Доставка бесплатно (заказ от 5000 ₽)');
      } else {
        lines.push('Доставка 300–600 ₽, оплачивается отдельно — уточните точную стоимость');
      }
      if (cart.address) lines.push('Адрес: ' + cart.address);
    }

    if (cart.customerName) lines.push('Имя: ' + cart.customerName);
    if (cart.customerPhone) lines.push('Телефон: ' + cart.customerPhone);

    lines.push('');
    lines.push('Оплата наличными или переводом при получении.');

    return lines.join('\n');
  }

  /* ---------------------------------------------------------
     6) Обработчики панели заказа
     --------------------------------------------------------- */
  function setupCartPanel() {
    var receiveBtns = document.querySelectorAll('[data-receive]');
    receiveBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        cart.receiveMethod = btn.dataset.receive;
        receiveBtns.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
        document.getElementById('cart-pickup-info').hidden = cart.receiveMethod !== 'pickup';
        document.getElementById('cart-delivery-info').hidden = cart.receiveMethod !== 'delivery';
        renderCart();
      });
    });

    document.getElementById('cart-zone').addEventListener('change', function (e) {
      cart.zone = e.target.value;
      renderCart();
    });
    document.getElementById('cart-address').addEventListener('input', function (e) {
      cart.address = e.target.value;
      renderCart();
    });
    document.getElementById('cart-name').addEventListener('input', function (e) {
      cart.customerName = e.target.value;
      renderCart();
    });
    document.getElementById('cart-phone').addEventListener('input', function (e) {
      cart.customerPhone = e.target.value;
      renderCart();
    });

    document.getElementById('cart-copy-btn').addEventListener('click', function () {
      var text = buildOrderText();
      var confirmEl = document.getElementById('cart-copy-confirm');
      function showConfirm() {
        confirmEl.hidden = false;
        setTimeout(function () { confirmEl.hidden = true; }, 3000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showConfirm, function () {
          fallbackCopy(text, showConfirm);
        });
      } else {
        fallbackCopy(text, showConfirm);
      }
    });

    function fallbackCopy(text, cb) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      cb();
    }

    // Мобильная шторка / десктопная панель — открытие/сворачивание не
    // зависит от того, есть ли уже товары (можно открыть пустую панель).
    var cartEl = document.getElementById('cart');
    document.getElementById('cart-toggle').addEventListener('click', function () {
      cartEl.classList.toggle('is-open');
      this.setAttribute('aria-expanded', cartEl.classList.contains('is-open') ? 'true' : 'false');
    });
    document.getElementById('cart-close').addEventListener('click', function () {
      cartEl.classList.remove('is-open');
      document.getElementById('cart-toggle').setAttribute('aria-expanded', 'false');
    });
    document.getElementById('header-cart-btn').addEventListener('click', function () {
      cartEl.classList.toggle('is-open');
      var open = cartEl.classList.contains('is-open');
      document.getElementById('cart-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) document.getElementById('cart-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ---------------------------------------------------------
     7) Хедер / навигация / мелкие детали страницы
     --------------------------------------------------------- */
  function setupHeaderScroll() {
    var header = document.getElementById('site-header');
    window.addEventListener('scroll', function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  function setupMenuTabs() {
    var links = document.querySelectorAll('.menu-tabs__link');
    var sections = Array.prototype.map.call(links, function (link) {
      return document.querySelector(link.getAttribute('href'));
    });

    function updateActive() {
      var scrollPos = window.scrollY + 140;
      var activeIndex = 0;
      sections.forEach(function (sec, i) {
        if (sec && sec.offsetTop <= scrollPos) activeIndex = i;
      });
      links.forEach(function (l, i) { l.classList.toggle('is-active', i === activeIndex); });
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }

  function setupFooterYear() {
    document.getElementById('footer-year').textContent = String(new Date().getFullYear());
  }

  // Включает/держит выключенными кнопки Instagram и Telegram (шапка, футер,
  // «Контакты») в зависимости от констант INSTAGRAM_URL/TELEGRAM_URL вверху
  // файла. Пока константа пустая — кнопка остаётся href="#" с
  // aria-disabled="true" (клик по ней ничего не делает, см. ниже). Как
  // только в константу подставят реальную ссылку — кнопка становится
  // рабочей: настоящий href, открытие в новой вкладке, обычный вид.
  function setupSocialLinks() {
    var socials = [
      { key: 'instagram', url: INSTAGRAM_URL, label: 'Instagram' },
      { key: 'telegram', url: TELEGRAM_URL, label: 'Telegram' }
    ];

    socials.forEach(function (social) {
      var links = document.querySelectorAll('[data-social="' + social.key + '"]');
      links.forEach(function (link) {
        if (social.url) {
          link.href = social.url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.removeAttribute('aria-disabled');
          link.removeAttribute('title');
          link.setAttribute('aria-label', social.label);
        }
        // Если ссылки ещё нет — оставляем разметку из index.html как есть
        // (href="#", aria-disabled="true", title="Скоро").
      });
    });

    // Поясняющую подпись «скоро» в футере/контактах прячем только когда
    // обе ссылки уже подставлены — до этого момента она честно объясняет,
    // почему кнопки неактивны.
    var bothReady = !!INSTAGRAM_URL && !!TELEGRAM_URL;
    document.querySelectorAll('[data-social-note]').forEach(function (note) {
      note.hidden = bothReady;
    });

    // Клик по ещё неактивной кнопке соцсети не должен уводить наверх
    // страницы (href="#") — гасим переход, пока aria-disabled стоит.
    document.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('.icon-link[aria-disabled="true"]') : null;
      if (target) e.preventDefault();
    });
  }

  /* ---------------------------------------------------------
     Инициализация
     --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderMenu();
    setupCartPanel();
    setupHeaderScroll();
    setupMenuTabs();
    setupFooterYear();
    setupSocialLinks();
    renderCart();
  });
})();
