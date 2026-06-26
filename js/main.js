(function () {
  "use strict";

  var REL = document.body.getAttribute("data-rel-prefix") || "./";
  var CATALOG = window.CATALOG || { products: {}, collections: [] };

  function formatPrice(price) {
    return "₹ " + Number(price).toLocaleString("en-IN");
  }

  // catalog.json paths look like "/images/products/x.webp" or "/videos/x.mp4" —
  // map them onto our exported assets/ folder, then make relative to this page.
  function assetPath(p) {
    if (/^(https?:)?\/\//.test(p)) return p; // remote URL fallback, leave untouched
    var clean = p.replace(/^\//, "");
    if (clean.indexOf("images/") === 0 || clean.indexOf("videos/") === 0) {
      clean = "assets/" + clean;
    }
    return REL + clean;
  }

  function productHandleFromHref(href) {
    if (!href) return null;
    var clean = href.split("?")[0].split("#")[0];
    var file = clean.split("/").pop();
    if (!file) return null;
    return file.replace(/\.html$/, "");
  }

  function currentPageHandle() {
    var file = location.pathname.split("/").pop();
    return file.replace(/\.html$/, "");
  }

  // ---------- localStorage store ----------
  var STORAGE_KEY = "tamannaah-store";

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { cart: [], wishlist: [] };
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  var store = loadStore();

  function cartCount() {
    return store.cart.reduce(function (sum, l) {
      return sum + l.qty;
    }, 0);
  }

  function cartTotal() {
    return store.cart.reduce(function (sum, l) {
      var p = CATALOG.products[l.handle];
      return sum + (p ? p.price * l.qty : 0);
    }, 0);
  }

  function isWishlisted(handle) {
    return store.wishlist.indexOf(handle) !== -1;
  }

  function toggleWishlist(handle) {
    var idx = store.wishlist.indexOf(handle);
    if (idx === -1) {
      store.wishlist.push(handle);
      showToast("Added to wishlist");
    } else {
      store.wishlist.splice(idx, 1);
      showToast("Removed from wishlist");
    }
    saveStore(store);
    refreshHeaderBadges();
    refreshWishlistHearts();
  }

  function addToCart(handle) {
    var line = null;
    for (var i = 0; i < store.cart.length; i++) {
      if (store.cart[i].handle === handle) line = store.cart[i];
    }
    if (line) {
      line.qty += 1;
    } else {
      store.cart.push({ handle: handle, qty: 1 });
    }
    saveStore(store);
    showToast("Added to bag");
    refreshHeaderBadges();
  }

  function removeFromCart(handle) {
    store.cart = store.cart.filter(function (l) {
      return l.handle !== handle;
    });
    saveStore(store);
    refreshHeaderBadges();
    renderCartPage();
  }

  // ---------- toast ----------
  var toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.position = "fixed";
      toastEl.style.bottom = "24px";
      toastEl.style.left = "50%";
      toastEl.style.transform = "translateX(-50%)";
      toastEl.style.background = "#000";
      toastEl.style.color = "#fff";
      toastEl.style.padding = "10px 20px";
      toastEl.style.borderRadius = "999px";
      toastEl.style.fontSize = "14px";
      toastEl.style.zIndex = "9999";
      toastEl.style.transition = "opacity .2s";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.style.opacity = "0";
    }, 2000);
  }

  // ---------- header badges ----------
  function refreshHeaderBadges() {
    var wishCount = store.wishlist.length;
    var cCount = cartCount();

    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var text = a.textContent || "";
      if (/wishlist\.html$/.test(href) && /^Wishlist/.test(text.trim())) {
        a.textContent = "Wishlist(" + wishCount + ")";
      }
      if (/cart\.html$/.test(href) && /^Cart/.test(text.trim())) {
        a.textContent = "Cart (" + cCount + ")";
      }
    });

    // mobile icon badges: small circles next to heart/bag icons in header
    document.querySelectorAll('a[aria-label="Wishlist"], a[aria-label="Cart"]').forEach(function (a) {
      var isWish = a.getAttribute("aria-label") === "Wishlist";
      var n = isWish ? wishCount : cCount;
      var badge = a.querySelector(".js-count-badge");
      if (n > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "js-count-badge";
          badge.style.position = "absolute";
          badge.style.top = "-8px";
          badge.style.right = "-8px";
          badge.style.width = "16px";
          badge.style.height = "16px";
          badge.style.borderRadius = "50%";
          badge.style.background = "#fff";
          badge.style.color = "#000";
          badge.style.fontSize = "10px";
          badge.style.fontWeight = "600";
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          a.style.position = "relative";
          a.appendChild(badge);
        }
        badge.textContent = String(n);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function refreshWishlistHearts() {
    document.querySelectorAll(".group, main").forEach(function (scope) {
      var link = scope.querySelector ? scope.querySelector('a[href*="/products/"], a[href*="products/"]') : null;
    });
    // Product card hearts
    document.querySelectorAll('button[aria-label*="wishlist" i]').forEach(function (btn) {
      var card = btn.closest(".group") || btn.closest("div");
      var handle = findHandleNear(btn);
      if (!handle) return;
      var path = btn.querySelector("svg path");
      var on = isWishlisted(handle);
      btn.setAttribute("aria-label", on ? "Remove from wishlist" : "Add to wishlist");
      var svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
    });
  }

  function findHandleNear(el) {
    var container = el.closest(".group") || el.parentElement;
    if (!container) return currentPageHandle();
    var link = container.querySelector('a[href*="products/"]');
    if (link) return productHandleFromHref(link.getAttribute("href"));
    return currentPageHandle();
  }

  // ---------- header drawer (Shop/About Us + submenu) ----------
  var SHOP_LINKS = [
    { label: "T-Bars", href: "collections/t-bar-collection.html" },
    { label: "Most Popular", href: "collections/most-popular.html" },
    { label: "New Collection", href: "collections/new.html" },
    {
      label: "Jewelry",
      href: "collections/jewelry.html",
      submenu: {
        links: [
          { label: "New in", href: "collections/new-in.html" },
          { label: "T-Bars", href: "collections/t-bar-collection.html" },
          { label: "Necklace & Pendants", href: "collections/necklace-pendants.html" },
          { label: "Earrings", href: "collections/earrings.html" },
          { label: "Rings", href: "collections/rings.html" },
          { label: "Bracelets", href: "collections/bracelet.html" },
          { label: "All Jewelry", href: "collections/jewelry.html" },
        ],
        featuredHeading: "Featured Collections",
        featured: [
          { label: "Wave collection – Not just a curve, a current", href: "collections/wave.html" },
          { label: "Split Bezel Classics – Study In Balance", href: "collections/split-bezel-classics.html" },
          { label: "The Flick – Not just a link. A language.", href: "collections/the-flick.html" },
          { label: "Plumptious – Bold, bulbous, and joyfully voluminous.", href: "collections/plumptious.html" },
          { label: "The Rib – Form, rhythm, repetition", href: "collections/the-rib.html" },
          { label: "All Collection", href: "collections.html" },
        ],
      },
    },
    {
      label: "High Jewelry",
      href: "collections/high-jewelry.html",
      submenu: { links: [{ label: "All High Jewelry", href: "collections/high-jewelry.html" }] },
    },
    { label: "Tamannaah's Favourites", href: "collections/tamannaahs-favourites.html" },
  ];

  var ABOUT_LINKS = [
    { label: "Meet Tamannaah", href: "pages/meet-tamannaah.html" },
    { label: "About Us", href: "pages/about-us.html" },
    { label: "Our Store", href: "pages/our-store.html" },
  ];

  function linkRow(item, onLink, onSubmenu) {
    if (item.submenu) {
      var btn = document.createElement("button");
      btn.className = "group";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "space-between";
      btn.style.width = "100%";
      btn.style.fontSize = "1.125rem";
      btn.style.color = "#000";
      btn.textContent = item.label;
      var chev = document.createElement("span");
      chev.textContent = "›";
      chev.style.marginLeft = "8px";
      btn.appendChild(chev);
      btn.addEventListener("click", function () {
        onSubmenu(item);
      });
      return btn;
    }
    var a = document.createElement("a");
    a.href = REL + item.href;
    a.style.fontSize = "1.125rem";
    a.style.color = "#000";
    a.style.textDecoration = "none";
    a.textContent = item.label;
    a.addEventListener("click", onLink);
    return a;
  }

  function setupDrawer() {
    var aside = document.querySelector("aside");
    if (!aside) return;
    var nav = aside.querySelector("nav");
    var tabRow = aside.querySelector(":scope > div > div");
    var tabButtons = tabRow ? Array.prototype.slice.call(tabRow.querySelectorAll("button")) : [];
    var shopTabBtn = tabButtons[0];
    var aboutTabBtn = tabButtons[1];
    var searchTabBtn = tabButtons[2];

    var overlay = document.querySelector(".js-drawer-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "js-drawer-overlay";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,.4)";
      overlay.style.zIndex = "30";
      overlay.style.display = "none";
      document.body.appendChild(overlay);
    }

    var DRAWER_WIDTH = "min(576px, 90vw)";
    var DRAWER_WIDTH_WITH_SUBMENU = "min(960px, 95vw)";

    var submenuPanel = document.createElement("div");
    submenuPanel.style.display = "none";
    submenuPanel.style.flexShrink = "0";
    submenuPanel.style.width = "384px";
    submenuPanel.style.maxWidth = "min(384px, 40vw)";
    submenuPanel.style.borderLeft = "1px solid rgba(0,0,0,.1)";
    submenuPanel.style.padding = "2rem 2.5rem";
    submenuPanel.style.overflowY = "auto";
    submenuPanel.style.background = "#fff";
    aside.appendChild(submenuPanel);

    function showSubmenuPanel(item) {
      aside.style.width = DRAWER_WIDTH_WITH_SUBMENU;
      submenuPanel.innerHTML = "";
      submenuPanel.style.display = "flex";
      submenuPanel.style.flexDirection = "column";
      submenuPanel.style.gap = "2rem";
      var navWrap = document.createElement("nav");
      navWrap.style.display = "flex";
      navWrap.style.flexDirection = "column";
      navWrap.style.gap = "1.25rem";
      item.submenu.links.forEach(function (l) {
        var a = document.createElement("a");
        a.href = REL + l.href;
        a.style.fontSize = "1rem";
        a.style.color = "#000";
        a.style.textDecoration = "none";
        a.textContent = l.label;
        a.addEventListener("click", closeDrawer);
        navWrap.appendChild(a);
      });
      submenuPanel.appendChild(navWrap);
      if (item.submenu.featured) {
        var heading = document.createElement("p");
        heading.style.fontSize = ".75rem";
        heading.style.textTransform = "uppercase";
        heading.style.color = "rgba(0,0,0,.4)";
        heading.textContent = item.submenu.featuredHeading;
        var wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.gap = "1.25rem";
        wrap.appendChild(heading);
        item.submenu.featured.forEach(function (l) {
          var a = document.createElement("a");
          a.href = REL + l.href;
          a.style.fontSize = "1rem";
          a.style.lineHeight = "1.3";
          a.style.color = "#000";
          a.style.textDecoration = "none";
          a.textContent = l.label;
          a.addEventListener("click", closeDrawer);
          wrap.appendChild(a);
        });
        submenuPanel.appendChild(wrap);
      }
    }

    function hideSubmenuPanel() {
      aside.style.width = DRAWER_WIDTH;
      submenuPanel.style.display = "none";
    }

    var SEARCH_ICON_SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg>';

    function renderSearchView() {
      nav.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:2rem;">' +
        '<div><p style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(0,0,0,.4);">Type Your Search</p>' +
        '<div style="display:flex;align-items:center;gap:.75rem;border-bottom:1px solid rgba(0,0,0,.2);padding-bottom:.75rem;margin-top:.75rem;color:rgba(0,0,0,.4);">' +
        SEARCH_ICON_SVG +
        '<input type="text" class="js-drawer-search-input" style="flex:1;font-size:1rem;border:none;outline:none;color:#000;background:transparent;"/></div></div>' +
        '<div class="js-drawer-search-results"></div></div>';
      var input = nav.querySelector(".js-drawer-search-input");
      var results = nav.querySelector(".js-drawer-search-results");

      function renderTrending() {
        results.innerHTML =
          '<p style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(0,0,0,.4);">Trending Now</p>' +
          '<nav style="display:flex;flex-direction:column;gap:1.25rem;margin-top:1.25rem;">' +
          '<a href="' + REL + 'collections/canvas.html" style="font-size:1rem;color:#000;text-decoration:none;">Canvas</a>' +
          '<a href="' + REL + 'collections/the-flick.html" style="font-size:1rem;color:#000;text-decoration:none;">The Flick</a>' +
          '<a href="' + REL + 'collections/plumptious.html" style="font-size:1rem;color:#000;text-decoration:none;">Plumptious</a>' +
          "</nav>";
      }
      renderTrending();

      input.addEventListener("input", function () {
        var q = input.value.trim().toLowerCase();
        if (!q) {
          renderTrending();
          return;
        }
        var matches = Object.values(CATALOG.products || {})
          .filter(function (p) {
            return p.title.toLowerCase().indexOf(q) !== -1 || (p.type || "").toLowerCase().indexOf(q) !== -1;
          })
          .slice(0, 8);
        if (matches.length === 0) {
          results.innerHTML = '<p style="font-size:.875rem;color:rgba(0,0,0,.5);">No results for &ldquo;' + q + "&rdquo;</p>";
          return;
        }
        results.innerHTML = matches
          .map(function (p) {
            var img = (p.localImages && p.localImages[0]) || p.images[0];
            return (
              '<a href="' + REL + "products/" + p.handle + '.html" style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;color:#000;text-decoration:none;">' +
              '<img src="' + assetPath(img) + '" style="width:56px;height:64px;object-fit:cover;background:#f5f5f5;"/>' +
              '<span><span style="display:block;font-size:.875rem;font-weight:600;text-transform:uppercase;">' + p.title + "</span>" +
              '<span style="display:block;font-size:.875rem;color:rgba(0,0,0,.6);">' + formatPrice(p.price) + "</span></span></a>"
            );
          })
          .join("");
      });
      setTimeout(function () { input.focus(); }, 50);
    }

    function renderNav(which) {
      hideSubmenuPanel();
      if (which === "search") {
        renderSearchView();
      } else {
        nav.innerHTML = "";
        var items = which === "about" ? ABOUT_LINKS : SHOP_LINKS;
        items.forEach(function (item) {
          nav.appendChild(linkRow(item, closeDrawer, showSubmenuPanel));
        });
      }
      if (shopTabBtn) shopTabBtn.style.color = which === "shop" ? "#000" : "rgba(0,0,0,.4)";
      if (aboutTabBtn) aboutTabBtn.style.color = which === "about" ? "#000" : "rgba(0,0,0,.4)";
      if (searchTabBtn) searchTabBtn.style.color = which === "search" ? "#000" : "rgba(0,0,0,.4)";
    }
    renderNav("shop");

    // Force the box model/positioning explicitly — including a concrete pixel
    // width — so the drawer is guaranteed visible regardless of whether every
    // Tailwind utility class (and the percentage-width child relying on it)
    // survived export.
    aside.style.position = "fixed";
    aside.style.top = "0";
    aside.style.left = "0";
    aside.style.bottom = "0";
    aside.style.height = "100vh";
    aside.style.width = DRAWER_WIDTH;
    aside.style.background = "#fff";
    aside.style.zIndex = "2147483000";
    aside.style.display = "flex";
    aside.style.flexDirection = "row";
    aside.style.transition = "translate .3s ease";
    aside.style.translate = "-100% 0";
    aside.style.willChange = "translate";
    aside.style.boxShadow = "2px 0 24px rgba(0,0,0,.15)";

    var asideWrapper = aside.querySelector(":scope > div");
    if (asideWrapper) {
      asideWrapper.style.width = DRAWER_WIDTH;
      asideWrapper.style.flexShrink = "0";
      asideWrapper.style.display = "flex";
      asideWrapper.style.flexDirection = "column";
      asideWrapper.style.background = "#fff";
    }

    function openDrawer() {
      aside.style.translate = "0 0";
      overlay.style.display = "block";
    }
    function closeDrawer() {
      aside.style.translate = "-100% 0";
      overlay.style.display = "none";
      hideSubmenuPanel();
    }
    overlay.addEventListener("click", closeDrawer);

    if (shopTabBtn) shopTabBtn.addEventListener("click", function () { renderNav("shop"); });
    if (aboutTabBtn) aboutTabBtn.addEventListener("click", function () { renderNav("about"); });
    if (searchTabBtn) searchTabBtn.addEventListener("click", function () { renderNav("search"); });

    // Header triggers: hamburger icon (mobile) + "Shop"/"About Us"/"Search" (desktop text + mobile icon)
    // all open the SAME drawer, just switching which view it shows.
    document.querySelectorAll('header button[aria-label="Open menu"]').forEach(function (b) {
      b.addEventListener("click", openDrawer);
    });
    document.querySelectorAll("header button").forEach(function (b) {
      var t = b.textContent.trim();
      if (t === "Shop") b.addEventListener("click", function () { renderNav("shop"); openDrawer(); });
      if (t === "About Us") b.addEventListener("click", function () { renderNav("about"); openDrawer(); });
      if (t === "Search") b.addEventListener("click", function () { renderNav("search"); openDrawer(); });
    });
    document.querySelectorAll('header button[aria-label="Search"]').forEach(function (b) {
      b.addEventListener("click", function () { renderNav("search"); openDrawer(); });
    });
  }

  // ---------- hero slideshow (homepage) ----------
  function setupHeroSlideshow() {
    var section = document.querySelector("main section.relative.h-screen");
    if (!section) return;
    var slides = Array.prototype.slice.call(section.querySelectorAll(":scope > div.absolute.inset-0"));
    if (slides.length < 2) return;
    var index = 0;
    function show(i) {
      slides.forEach(function (s, idx) {
        s.style.opacity = idx === i ? "1" : "0";
      });
    }
    show(0);
    var prevBtn = section.querySelector('button[aria-label="Previous slide"]');
    var nextBtn = section.querySelector('button[aria-label="Next slide"]');
    function go(delta) {
      index = (index + delta + slides.length) % slides.length;
      show(index);
    }
    if (prevBtn) prevBtn.addEventListener("click", function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { go(1); });
    setInterval(function () { go(1); }, 5000);
  }

  // ---------- product card hover/click image cycle ----------
  function setupProductCards() {
    document.querySelectorAll(".group").forEach(function (card) {
      var link = card.querySelector('a[href*="products/"]');
      if (!link) return;
      var handle = productHandleFromHref(link.getAttribute("href"));
      var product = CATALOG.products[handle];
      if (!product) return;
      var images = (product.localImages && product.localImages.length ? product.localImages : product.images).map(
        assetPath
      );
      var img = card.querySelector("img");
      if (!img || images.length < 2) return;
      var idx = 0;
      function setSrc(i) {
        img.src = images[i];
      }
      card.addEventListener("mouseenter", function () {
        idx = 1 % images.length;
        setSrc(idx);
      });
      card.addEventListener("mouseleave", function () {
        idx = 0;
        setSrc(idx);
      });
      var prevBtn = card.querySelector('button[aria-label="Previous image"]');
      var nextBtn = card.querySelector('button[aria-label="Next image"]');
      if (prevBtn)
        prevBtn.addEventListener("click", function (e) {
          e.preventDefault();
          idx = (idx - 1 + images.length) % images.length;
          setSrc(idx);
        });
      if (nextBtn)
        nextBtn.addEventListener("click", function (e) {
          e.preventDefault();
          idx = (idx + 1) % images.length;
          setSrc(idx);
        });
    });
  }

  // ---------- wishlist heart buttons (cards + product page) ----------
  function setupWishlistButtons() {
    document.querySelectorAll('button[aria-label*="wishlist" i]').forEach(function (btn) {
      var handle = findHandleNear(btn);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleWishlist(handle);
      });
    });
    refreshWishlistHearts();
  }

  // ---------- add to bag (product detail) ----------
  function setupAddToBag() {
    document.querySelectorAll("button").forEach(function (btn) {
      if (btn.textContent.trim() === "Add to Bag") {
        btn.addEventListener("click", function () {
          addToCart(currentPageHandle());
        });
      }
    });
  }

  // ---------- product detail thumbnail gallery ----------
  function setupGallery() {
    var mainImgWrap = document.querySelector(".grid img");
    if (!mainImgWrap) return;
    var thumbs = document.querySelectorAll("button.relative.aspect-\\[3\\/4\\].w-16 img");
    if (!thumbs.length) return;
    var mainImg = document.querySelector('.flex.flex-col.gap-3 > div.relative.aspect-\\[3\\/4\\].w-full img');
    thumbs.forEach(function (t) {
      t.closest("button").addEventListener("click", function () {
        if (mainImg) mainImg.src = t.src;
      });
    });
  }

  // ---------- collection grid: View Four/Two + Filter & Sort ----------
  function setupCollectionControls() {
    var allSpans = document.querySelectorAll("span, button");
    var fourBtn, twoBtn, sortBtn;
    allSpans.forEach(function (el) {
      var t = el.textContent.trim();
      if (t === "Four") fourBtn = el;
      if (t === "Two") twoBtn = el;
      if (t === "Filter & Sort") sortBtn = el;
    });
    var grid = document.querySelector(".grid.max-w-7xl");
    if (!grid) return;

    if (fourBtn && twoBtn) {
      fourBtn.style.cursor = "pointer";
      twoBtn.style.cursor = "pointer";
      fourBtn.addEventListener("click", function () {
        grid.classList.remove("sm:grid-cols-2");
        grid.classList.add("sm:grid-cols-3", "lg:grid-cols-4");
        fourBtn.style.textDecoration = "underline";
        twoBtn.style.textDecoration = "none";
      });
      twoBtn.addEventListener("click", function () {
        grid.classList.add("sm:grid-cols-2");
        grid.classList.remove("sm:grid-cols-3", "lg:grid-cols-4");
        twoBtn.style.textDecoration = "underline";
        fourBtn.style.textDecoration = "none";
      });
    }

    if (sortBtn) {
      var menu = document.createElement("div");
      menu.style.position = "absolute";
      menu.style.right = "0";
      menu.style.top = "100%";
      menu.style.marginTop = "8px";
      menu.style.width = "192px";
      menu.style.background = "#fff";
      menu.style.border = "1px solid rgba(0,0,0,.1)";
      menu.style.padding = "8px 0";
      menu.style.display = "none";
      menu.style.zIndex = "10";
      menu.innerHTML =
        '<button data-sort="featured" style="display:block;width:100%;text-align:left;padding:8px 16px;">Featured</button>' +
        '<button data-sort="price-asc" style="display:block;width:100%;text-align:left;padding:8px 16px;">Price: Low to High</button>' +
        '<button data-sort="price-desc" style="display:block;width:100%;text-align:left;padding:8px 16px;">Price: High to Low</button>';
      sortBtn.style.position = "relative";
      sortBtn.appendChild(menu);
      sortBtn.addEventListener("click", function (e) {
        if (e.target === sortBtn) menu.style.display = menu.style.display === "block" ? "none" : "block";
      });
      menu.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          sortGrid(grid, b.getAttribute("data-sort"));
          menu.style.display = "none";
        });
      });
    }
  }

  function sortGrid(grid, mode) {
    var cards = Array.prototype.slice.call(grid.children);
    function priceOf(card) {
      var link = card.querySelector('a[href*="products/"]');
      var handle = link ? productHandleFromHref(link.getAttribute("href")) : null;
      var p = handle ? CATALOG.products[handle] : null;
      return p ? p.price : 0;
    }
    if (mode === "price-asc") cards.sort(function (a, b) { return priceOf(a) - priceOf(b); });
    if (mode === "price-desc") cards.sort(function (a, b) { return priceOf(b) - priceOf(a); });
    cards.forEach(function (c) { grid.appendChild(c); });
  }

  // ---------- cart page rendering ----------
  function renderCartPage() {
    var main = document.querySelector("main");
    if (!main || currentPageHandle() !== "cart") return;
    if (store.cart.length === 0) return; // keep the static "empty" markup

    var product0 = CATALOG.products[store.cart[0].handle];
    if (!product0) return;

    var html =
      '<div style="max-width:42rem;margin:0 auto;padding:4rem 1.5rem 6rem;">' +
      '<h1 style="font-size:1.25rem;font-weight:600;text-transform:uppercase;">Your Bag</h1>' +
      '<div style="margin-top:2rem;display:flex;flex-direction:column;gap:1.5rem;">' +
      store.cart
        .map(function (line) {
          var p = CATALOG.products[line.handle];
          if (!p) return "";
          var img = (p.localImages && p.localImages[0]) || p.images[0];
          return (
            '<div style="display:flex;align-items:center;gap:1rem;border-bottom:1px solid rgba(0,0,0,.1);padding-bottom:1.5rem;">' +
            '<img src="' + assetPath(img) + '" style="width:80px;height:96px;object-fit:cover;background:#f5f5f5;"/>' +
            '<div style="flex:1;"><p style="font-size:.875rem;font-weight:600;text-transform:uppercase;">' + p.title + "</p>" +
            '<p style="margin-top:4px;font-size:.875rem;color:rgba(0,0,0,.6);">Qty ' + line.qty + "</p>" +
            '<p style="margin-top:4px;font-size:.875rem;">' + formatPrice(p.price * line.qty) + "</p></div>" +
            '<button class="js-remove" data-handle="' + line.handle + '" style="font-size:.875rem;text-decoration:underline;color:rgba(0,0,0,.6);">Remove</button></div>'
          );
        })
        .join("") +
      "</div>" +
      '<div style="margin-top:2rem;display:flex;align-items:center;justify-content:space-between;font-size:.875rem;font-weight:600;text-transform:uppercase;">' +
      "<span>Subtotal</span><span>" + formatPrice(cartTotal()) + "</span></div>" +
      '<button style="margin-top:1.5rem;width:100%;background:#000;color:#fff;padding:14px;font-size:.875rem;font-weight:600;text-transform:uppercase;">Checkout</button>' +
      "</div>";

    main.innerHTML = html;
    main.querySelectorAll(".js-remove").forEach(function (b) {
      b.addEventListener("click", function () {
        removeFromCart(b.getAttribute("data-handle"));
      });
    });
  }

  // ---------- wishlist page rendering ----------
  function renderWishlistPage() {
    var main = document.querySelector("main");
    if (!main || currentPageHandle() !== "wishlist") return;
    if (store.wishlist.length === 0) return;

    var grid =
      '<div style="padding:8rem 1.5rem 6rem;">' +
      '<h1 style="text-align:center;font-size:1.25rem;font-weight:600;text-transform:uppercase;">Your Wishlist</h1>' +
      '<div style="margin:4rem auto 0;max-width:80rem;display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem 1.5rem;">' +
      store.wishlist
        .map(function (handle) {
          var p = CATALOG.products[handle];
          if (!p) return "";
          var img = (p.localImages && p.localImages[0]) || p.images[0];
          return (
            '<div><a href="' + REL + "products/" + p.handle + '.html"><img src="' + assetPath(img) + '" style="width:100%;aspect-ratio:3/4;object-fit:cover;background:#f5f5f5;"/></a>' +
            '<a href="' + REL + "products/" + p.handle + '.html" style="display:block;margin-top:12px;font-size:.875rem;font-weight:600;text-transform:uppercase;">' + p.title + "</a>" +
            '<p style="margin-top:4px;font-size:.875rem;color:rgba(0,0,0,.6);">' + formatPrice(p.price) + "</p></div>"
          );
        })
        .join("") +
      "</div></div>";
    main.innerHTML = grid;
  }

  // ---------- forms (contact/account) ----------
  function setupForms() {
    document.querySelectorAll("form").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var heading = document.querySelector("h1");
        if (heading && /contact/i.test(heading.textContent)) {
          form.outerHTML =
            '<p style="margin-top:2rem;font-size:.875rem;color:rgba(0,0,0,.7);">Thank you — your message has been sent. Our team will get back to you shortly.</p>';
        } else {
          showToast("Submitted");
        }
      });
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", function () {
    setupDrawer();
    setupHeroSlideshow();
    setupProductCards();
    setupWishlistButtons();
    setupAddToBag();
    setupGallery();
    setupCollectionControls();
    setupForms();
    refreshHeaderBadges();
    renderCartPage();
    renderWishlistPage();
  });
})();
