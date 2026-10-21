(function () {
  var endpoints = resolveEndpoints();
  var placesUrl = endpoints.placesUrl;
  var siteOrigin = endpoints.siteOrigin;
  var dict = null;

  var ACTIVITY_LABEL_KEYS = {
    daily: "map.activity_daily",
    within7Days: "map.activity_weekly",
    within30Days: "map.activity_monthly",
    olderThan30Days: "map.activity_idle",
    none: "map.activity_none"
  };

  var ACTIVITY_SWATCHES = {
    daily: "is-daily",
    within7Days: "is-weekly",
    within30Days: "is-monthly",
    olderThan30Days: "is-idle",
    none: "is-none"
  };

  var HELP_ROWS = [
    ["map.activity_daily", "map.activity_daily_help", "is-daily"],
    ["map.activity_weekly", "map.activity_weekly_help", "is-weekly"],
    ["map.activity_monthly", "map.activity_monthly_help", "is-monthly"],
    ["map.activity_idle", "map.activity_idle_help", "is-idle"],
    ["map.activity_none", "map.activity_none_help", "is-none"]
  ];

  // Any bech32 body length. A fixed 58-character check would drop published ids.
  var NPUB = /^npub1[02-9ac-hj-np-z]+$/;
  var symbolSelects = [];
  var symbolSelectSeq = 0;

  function resolveEndpoints() {
    var host = location.hostname;
    if (host === "dfx.swiss" || host === "www.dfx.swiss") {
      return {
        placesUrl: "https://api.opencryptopay.io/map/places",
        siteOrigin: "https://opencryptopay.io"
      };
    }
    if (host === "dev.dfx.swiss" || host === "www.dev.dfx.swiss") {
      return {
        placesUrl: "https://dev-api.opencryptopay.io/map/places",
        siteOrigin: "https://dev.opencryptopay.io"
      };
    }
    return {
      placesUrl: "https://dev-api.opencryptopay.io/map/places",
      siteOrigin: "https://dev.opencryptopay.io"
    };
  }

  function currentLang() {
    if (!window.DfxI18nCore || typeof window.DfxI18nCore.resolveLang !== "function") return "de";
    var params = new URLSearchParams(window.location.search);
    var storedLang = null;
    try {
      storedLang = localStorage.getItem("dfx-lang");
    } catch (error) {
      storedLang = null;
    }
    return window.DfxI18nCore.resolveLang({
      urlLang: params.get("lang"),
      storedLang: storedLang,
      navigatorLang: navigator.language,
      supported: ["de", "en", "fr", "it"],
      defaultLang: "de"
    });
  }

  function i18nBase() {
    var scripts = document.getElementsByTagName("script");
    var basePath = "";
    for (var i = 0; i < scripts.length; i += 1) {
      var src = scripts[i].getAttribute("src");
      if (src && src.indexOf("dfx-places.js") !== -1) {
        basePath = src.replace(/js\/dfx-places\.js.*$/, "");
        break;
      }
    }
    return basePath;
  }

  function t(key) {
    if (dict && typeof dict[key] === "string") return dict[key];
    return key;
  }

  function setStatus(key) {
    var status = document.getElementById("dfx-places-status");
    if (!status) return;
    if (!key) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.textContent = t(key);
  }

  function loadDictionary() {
    return fetch(i18nBase() + "i18n/" + currentLang() + ".json").then(function (response) {
      if (!response.ok) throw new Error("status");
      return response.json();
    }).then(function (body) {
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("dict");
      dict = body;
    }).catch(function (error) {
      dict = null;
      if (error && error.name === "AbortError") return;
    });
  }

  function loadCss(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("script")); };
      document.body.appendChild(script);
    });
  }

  function createMap() {
    loadCss("https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css");
    return loadScript("https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js").then(function () {
      var container = document.getElementById("dfx-places-map");
      if (!container || !window.maplibregl || typeof window.maplibregl.Map !== "function") {
        throw new Error("map");
      }
      var map = new window.maplibregl.Map({
        container: container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [8.23, 46.8],
        zoom: 7
      });
      map.addControl(new window.maplibregl.NavigationControl(), "top-right");
      map.on("error", function (event) {
        if (!event || !event.error) return;
      });
      return map;
    });
  }

  function filtersUrl() {
    return placesUrl.replace(/\/places$/, "/filters");
  }

  function placesRequestUrl(query) {
    var params = [];
    if (query.country) params.push("country=" + encodeURIComponent(query.country));
    if (query.shopName) params.push("shopName=" + encodeURIComponent(query.shopName));
    if (query.blockchain) params.push("blockchain=" + encodeURIComponent(query.blockchain));
    if (query.asset) params.push("asset=" + encodeURIComponent(query.asset));
    if (!params.length) return placesUrl;
    return placesUrl + "?" + params.join("&");
  }

  function stringList(body, key) {
    var list = body && Array.isArray(body[key]) ? body[key] : [];
    var seen = {};
    var values = [];
    list.forEach(function (value) {
      if (typeof value !== "string") return;
      var token = value.trim();
      if (!token || seen[token]) return;
      seen[token] = true;
      values.push(token);
    });
    return values;
  }

  function providerSpec(body, name) {
    var list = body && Array.isArray(body.techProviders) ? body.techProviders : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].name === name) return list[i];
    }
    return null;
  }

  function specTokens(spec, key) {
    if (!spec || !Array.isArray(spec[key])) return [];
    var seen = {};
    var values = [];
    spec[key].forEach(function (value) {
      if (typeof value !== "string") return;
      var token = value.trim();
      if (!token || seen[token]) return;
      seen[token] = true;
      values.push(token);
    });
    return values;
  }

  function assetsFor(spec, blockchain) {
    if (!spec) return [];
    if (!blockchain || !Array.isArray(spec.pairs)) return specTokens(spec, "assets");
    var seen = {};
    var values = [];
    spec.pairs.forEach(function (pair) {
      if (!pair || pair.blockchain !== blockchain || typeof pair.asset !== "string") return;
      var token = pair.asset.trim();
      if (!token || seen[token]) return;
      seen[token] = true;
      values.push(token);
    });
    values.sort(function (a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return values;
  }

  function iconUrl(value) {
    if (typeof value !== "string") return "";
    var url = value.trim();
    if (!/^https:\/\//.test(url)) return "";
    return url;
  }

  function symbolMap(body, group) {
    var symbols = body && body.symbols;
    var map = symbols && symbols[group];
    if (!map || typeof map !== "object" || Array.isArray(map)) return {};
    return map;
  }

  function activityOptions(body) {
    return stringList(body, "activities").map(function (value) {
      var labelKey = ACTIVITY_LABEL_KEYS[value];
      var option = {
        value: value,
        label: labelKey ? t(labelKey) : value
      };
      if (ACTIVITY_SWATCHES[value]) option.swatch = ACTIVITY_SWATCHES[value];
      return option;
    });
  }

  function namedSymbolOptions(names, icons) {
    return names.map(function (name) {
      var option = { value: name, label: name };
      var url = iconUrl(icons[name]);
      if (url) option.icon = url;
      return option;
    });
  }

  function shopNameOptions(body) {
    return stringList(body, "shopNames").map(function (name) {
      return { value: name, label: name };
    });
  }

  function fillSelect(select, values) {
    var previous = select.value;
    while (select.firstChild) select.removeChild(select.firstChild);
    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = t("map.filter_all");
    select.appendChild(allOption);
    var keep = previous === "";
    values.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === previous) keep = true;
      select.appendChild(option);
    });
    select.value = keep ? previous : "";
  }

  function fillNamedSelect(select, options) {
    var previous = select.value;
    while (select.firstChild) select.removeChild(select.firstChild);
    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = t("map.filter_all");
    select.appendChild(allOption);
    var keep = previous === "";
    options.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      if (item.value === previous) keep = true;
      select.appendChild(option);
    });
    select.value = keep ? previous : "";
  }

  function paintSymbolMark(node, item) {
    while (node.firstChild) node.removeChild(node.firstChild);
    if (!item || (!item.swatch && !item.icon)) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    if (item.swatch) {
      var swatch = document.createElement("span");
      swatch.className = "dfx-places-activity-swatch " + item.swatch;
      swatch.setAttribute("aria-hidden", "true");
      node.appendChild(swatch);
      return;
    }
    var image = document.createElement("img");
    image.className = "dfx-places-symbol-filter-icon";
    image.alt = "";
    image.src = item.icon;
    image.addEventListener("error", function () {
      node.hidden = true;
    });
    node.appendChild(image);
  }

  function makeSymbolSelect(captionText) {
    var root = document.createElement("div");
    root.className = "dfx-places-tech-provider dfx-places-symbol-filter";
    var caption = document.createElement("span");
    caption.className = "dfx-places-tech-provider-label";
    caption.textContent = captionText;
    root.appendChild(caption);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "dfx-places-symbol-filter-value";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    var valueMark = document.createElement("span");
    valueMark.className = "dfx-places-symbol-filter-mark";
    valueMark.hidden = true;
    var valueText = document.createElement("span");
    valueText.className = "dfx-places-symbol-filter-text";
    valueText.textContent = t("map.filter_all");
    button.appendChild(valueMark);
    button.appendChild(valueText);
    root.appendChild(button);

    var menu = document.createElement("div");
    menu.className = "dfx-places-symbol-filter-menu";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    var controlId = "dfx-places-symbol-filter-" + symbolSelectSeq;
    symbolSelectSeq += 1;
    caption.id = controlId + "-label";
    valueText.id = controlId + "-value";
    button.id = controlId;
    menu.id = controlId + "-menu";
    button.setAttribute("aria-labelledby", caption.id + " " + valueText.id);
    button.setAttribute("aria-controls", menu.id);
    root.appendChild(menu);

    var current = "";
    var options = [];
    var listeners = [];
    var open = false;
    var control = {
      root: root,
      close: function () {
        open = false;
        root.classList.remove("is-open");
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    };

    function selectedOption() {
      for (var i = 0; i < options.length; i += 1) {
        if (options[i].value === current) return options[i];
      }
      return null;
    }

    function paintValue() {
      var match = selectedOption();
      valueText.textContent = match ? match.label : t("map.filter_all");
      paintSymbolMark(valueMark, match);
      var nodes = menu.querySelectorAll("[role='option']");
      for (var i = 0; i < nodes.length; i += 1) {
        nodes[i].setAttribute("aria-selected", nodes[i].getAttribute("data-value") === current ? "true" : "false");
      }
    }

    function choose(next) {
      control.close();
      button.focus();
      if (next === current) return;
      current = next;
      paintValue();
      listeners.forEach(function (fn) { fn(); });
    }

    function renderMenu() {
      while (menu.firstChild) menu.removeChild(menu.firstChild);
      function addOption(item) {
        var option = document.createElement("button");
        option.type = "button";
        option.className = "dfx-places-symbol-filter-option";
        option.setAttribute("role", "option");
        option.tabIndex = -1;
        option.setAttribute("data-value", item.value);
        var mark = document.createElement("span");
        mark.className = "dfx-places-symbol-filter-mark";
        paintSymbolMark(mark, item);
        var text = document.createElement("span");
        text.textContent = item.label;
        option.appendChild(mark);
        option.appendChild(text);
        option.addEventListener("click", function (event) {
          event.stopPropagation();
          choose(item.value);
        });
        menu.appendChild(option);
      }
      addOption({ value: "", label: t("map.filter_all") });
      options.forEach(addOption);
      paintValue();
    }

    function optionNodes() {
      return menu.querySelectorAll("[role='option']");
    }

    function focusOption(index) {
      var nodes = optionNodes();
      if (!nodes.length) return;
      var next = index;
      if (next < 0) next = nodes.length - 1;
      if (next >= nodes.length) next = 0;
      nodes[next].focus();
    }

    function openMenu() {
      symbolSelects.forEach(function (other) {
        if (other !== control) other.close();
      });
      open = true;
      root.classList.add("is-open");
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      var nodes = optionNodes();
      var index = 0;
      for (var i = 0; i < nodes.length; i += 1) {
        if (nodes[i].getAttribute("data-value") === current) index = i;
      }
      if (nodes[index]) nodes[index].focus();
    }

    root.addEventListener("click", function (event) {
      if (menu.contains(event.target)) return;
      if (open) {
        control.close();
        button.focus();
        return;
      }
      openMenu();
    });

    button.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!open) {
          openMenu();
          return;
        }
        if (event.key === "ArrowDown") focusOption(0);
        if (event.key === "ArrowUp") focusOption(-1);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        control.close();
      }
    });

    menu.addEventListener("keydown", function (event) {
      var nodes = optionNodes();
      var index = -1;
      for (var i = 0; i < nodes.length; i += 1) {
        if (nodes[i] === document.activeElement) index = i;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusOption(index + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusOption(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusOption(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusOption(nodes.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        control.close();
        button.focus();
      } else if (event.key === "Tab") {
        control.close();
      }
    });

    control.isOpen = function () { return open; };
    control.focusButton = function () { button.focus(); };
    symbolSelects.push(control);
    if (symbolSelects.length === 1) {
      document.addEventListener("click", function (event) {
        symbolSelects.forEach(function (item) {
          if (!item.root.contains(event.target)) item.close();
        });
      });
      document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        var restore = null;
        symbolSelects.forEach(function (item) {
          if (item.isOpen()) restore = item;
          item.close();
        });
        if (restore) restore.focusButton();
      });
    }
    renderMenu();

    return {
      label: root,
      fill: function (next) {
        var previous = current;
        options = [];
        next.forEach(function (item) {
          if (!item || typeof item.value !== "string" || !item.value || typeof item.label !== "string") return;
          options.push(item);
        });
        var keep = previous === "";
        options.forEach(function (item) {
          if (item.value === previous) keep = true;
        });
        current = keep ? previous : "";
        renderMenu();
      },
      select: {
        get value() { return current; },
        set value(next) {
          var value = typeof next === "string" ? next : "";
          var known = value === "";
          for (var i = 0; i < options.length; i += 1) {
            if (options[i].value === value) known = true;
          }
          current = known ? value : "";
          paintValue();
        },
        addEventListener: function (type, fn) {
          if (type === "change") listeners.push(fn);
        }
      }
    };
  }

  function makeSelect(captionText) {
    var label = document.createElement("label");
    label.className = "dfx-places-tech-provider";
    var caption = document.createElement("span");
    caption.className = "dfx-places-tech-provider-label";
    caption.textContent = captionText;
    label.appendChild(caption);
    var select = document.createElement("select");
    label.appendChild(select);
    fillSelect(select, []);
    return { label: label, select: select };
  }

  function trimmedField(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function displayedName(place) {
    return trimmedField(place.name);
  }

  function joinedNonEmpty(parts, separator) {
    var out = [];
    parts.forEach(function (part) {
      if (part) out.push(part);
    });
    return out.join(separator);
  }

  function shopPath(place) {
    if (!place || typeof place.id !== "string" || !NPUB.test(place.id)) return "";
    return "/" + place.id;
  }

  function shopHref(place) {
    var path = shopPath(place);
    if (!path) return "";
    return siteOrigin + path;
  }

  function displayedLocation(place) {
    return joinedNonEmpty([
      joinedNonEmpty([trimmedField(place.street), trimmedField(place.houseNumber)], " "),
      joinedNonEmpty([trimmedField(place.postalCode), trimmedField(place.city)], " ")
    ], ", ");
  }

  function displayedActivity(place) {
    var key = ACTIVITY_LABEL_KEYS[place.activity];
    if (key) return t(key);
    return t("map.activity_none");
  }

  function activityMarkerClass(place) {
    var swatch = ACTIVITY_SWATCHES[place.activity];
    if (!swatch) swatch = "is-none";
    return "dfx-places-place-marker " + swatch;
  }

  // Recent buckets include the more active ones. Idle, none and unknown stay exact.
  function activityMeets(place, selected) {
    if (!selected) return true;
    var activity = place.activity;
    if (selected === "olderThan30Days") return activity === "olderThan30Days";
    if (selected === "none") return activity === "none";
    if (selected === "daily") return activity === "daily";
    if (selected === "within7Days") return activity === "daily" || activity === "within7Days";
    if (selected === "within30Days") {
      return activity === "daily" || activity === "within7Days" || activity === "within30Days";
    }
    return false;
  }

  function finiteCoord(value, min, max) {
    return typeof value === "number" && isFinite(value) && value >= min && value <= max;
  }

  function isDfxPlace(place) {
    return !!place && place.techProvider === "DFX.swiss";
  }

  function pairMatches(item, blockchain, asset) {
    if (!item || typeof item !== "object") return false;
    if (blockchain && item.blockchain !== blockchain) return false;
    if (asset && item.asset !== asset) return false;
    return true;
  }

  function helpIcon() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", "8");
    ring.setAttribute("cy", "8");
    ring.setAttribute("r", "6.25");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "currentColor");
    ring.setAttribute("stroke-width", "1.5");
    var path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M6.15 6.2a1.85 1.85 0 0 1 3.2 1.25c0 .9-.7 1.25-1.35 1.55V10");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    var dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", "8");
    dot.setAttribute("cy", "11.7");
    dot.setAttribute("r", "0.7");
    dot.setAttribute("fill", "currentColor");
    svg.appendChild(ring);
    svg.appendChild(path);
    svg.appendChild(dot);
    return svg;
  }

  function bindActivityHelp(button, panel) {
    if (!button || !panel || typeof panel.showPopover !== "function") return;

    function place() {
      if (!panel.matches(":popover-open")) return;
      var rect = button.getBoundingClientRect();
      var margin = 8;
      panel.style.left = "0px";
      panel.style.top = "0px";
      var width = panel.offsetWidth;
      var height = panel.offsetHeight;
      var left = rect.left;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
      if (left < margin) left = margin;
      var top = rect.bottom + margin;
      if (top + height > window.innerHeight - margin && rect.top - margin - height >= margin) {
        top = rect.top - margin - height;
      }
      panel.style.left = Math.round(left) + "px";
      panel.style.top = Math.round(top) + "px";
    }

    panel.addEventListener("toggle", function (event) {
      if (event.newState === "open") place();
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
  }

  function mountActivityHelp(table) {
    var label = table.querySelector(".dfx-places-activity-label");
    if (!label) return;
    var button = document.createElement("button");
    button.type = "button";
    button.id = "dfx-places-activity-help-button";
    button.className = "dfx-places-activity-help";
    button.setAttribute("aria-label", t("map.activity_help_label"));
    button.setAttribute("popovertarget", "dfx-places-activity-help");
    button.appendChild(helpIcon());
    var panel = document.createElement("div");
    panel.id = "dfx-places-activity-help";
    panel.className = "dfx-places-activity-help-panel";
    panel.setAttribute("popover", "auto");
    var list = document.createElement("dl");
    HELP_ROWS.forEach(function (row) {
      var term = document.createElement("dt");
      var swatch = document.createElement("span");
      swatch.className = "dfx-places-activity-swatch " + row[2];
      swatch.setAttribute("aria-hidden", "true");
      var termText = document.createElement("span");
      termText.textContent = t(row[0]);
      term.appendChild(swatch);
      term.appendChild(termText);
      var desc = document.createElement("dd");
      desc.textContent = t(row[1]);
      list.appendChild(term);
      list.appendChild(desc);
    });
    var hierarchy = document.createElement("p");
    hierarchy.textContent = t("map.activity_hierarchy");
    panel.appendChild(list);
    panel.appendChild(hierarchy);
    label.appendChild(button);
    document.body.appendChild(panel);
    bindActivityHelp(button, panel);
  }

  function csvField(value) {
    var text = String(value);
    var first = text.charAt(0);
    if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r") {
      text = "'" + text;
    }
    if (text.indexOf(",") !== -1 || text.indexOf('"') !== -1 || text.indexOf("\r") !== -1 || text.indexOf("\n") !== -1) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function exportStoresCsv(table) {
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var bodyRows = tbody.querySelectorAll("tr");
    if (!bodyRows.length) return;
    var lines = [];
    var headerFields = [];
    table.querySelectorAll("thead th").forEach(function (cell) {
      var label = cell.querySelector(".dfx-places-col-label");
      headerFields.push(csvField(label ? label.textContent : cell.textContent));
    });
    headerFields.push(csvField("URL"));
    lines.push(headerFields.join(","));
    bodyRows.forEach(function (row) {
      var fields = [];
      row.querySelectorAll("td").forEach(function (cell) {
        fields.push(csvField(cell.textContent));
      });
      var path = row.getAttribute("data-shop-path");
      fields.push(csvField(path ? siteOrigin + path : ""));
      lines.push(fields.join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = objectUrl;
    link.download = "stores.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }

  function addCell(row, text) {
    var cell = document.createElement("td");
    cell.textContent = text;
    row.appendChild(cell);
  }

  function collectNodes() {
    var mapWrap = document.getElementById("dfx-places-map-wrap");
    var tableWrap = document.getElementById("dfx-places-table-wrap");
    var table = document.getElementById("dfx-places-table");
    if (!mapWrap || !mapWrap.parentNode || !tableWrap || !table) return null;
    return { mapWrap: mapWrap, tableWrap: tableWrap, table: table };
  }

  function mountUi(map, nodes, filters) {
    var filtersBody = filters && typeof filters === "object" && !Array.isArray(filters) ? filters : null;
    var countryControl = makeSelect(t("map.filter_country"));
    var nameControl = makeSelect(t("map.filter_name"));
    var chainControl = makeSymbolSelect(t("map.filter_blockchain"));
    var assetControl = makeSymbolSelect(t("map.filter_asset"));
    var activityControl = makeSymbolSelect(t("map.filter_activity"));
    var blockchainIcons = symbolMap(filtersBody, "blockchains");
    var assetIcons = symbolMap(filtersBody, "assets");
    fillSelect(countryControl.select, stringList(filtersBody, "countries"));
    fillNamedSelect(nameControl.select, shopNameOptions(filtersBody));
    activityControl.fill(activityOptions(filtersBody));

    function dfxSpec() {
      return providerSpec(filtersBody, "DFX.swiss");
    }

    function syncPaymentOptions() {
      var spec = dfxSpec();
      chainControl.fill(namedSymbolOptions(specTokens(spec, "blockchains"), blockchainIcons));
      assetControl.fill(namedSymbolOptions(assetsFor(spec, chainControl.select.value), assetIcons));
    }

    syncPaymentOptions();

    var view = "map";
    var row = document.createElement("div");
    row.className = "dfx-places-map-filters";
    [countryControl, nameControl, chainControl, assetControl, activityControl].forEach(function (control) {
      row.appendChild(control.label);
    });
    var switchRoot = document.createElement("div");
    switchRoot.className = "dfx-places-view-switch";
    var pill = document.createElement("div");
    pill.className = "dfx-places-view-switch-pill";
    pill.setAttribute("role", "group");
    pill.setAttribute("aria-label", t("map.view"));
    var mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.className = "dfx-places-view-switch-choice";
    mapButton.setAttribute("aria-pressed", "true");
    mapButton.textContent = t("map.view_map");
    var tableButton = document.createElement("button");
    tableButton.type = "button";
    tableButton.className = "dfx-places-view-switch-choice";
    tableButton.setAttribute("aria-pressed", "false");
    tableButton.textContent = t("map.view_table");
    pill.appendChild(mapButton);
    pill.appendChild(tableButton);
    switchRoot.appendChild(pill);
    row.appendChild(switchRoot);
    nodes.mapWrap.parentNode.insertBefore(row, nodes.mapWrap);

    var csvButton = document.createElement("button");
    csvButton.type = "button";
    csvButton.className = "dfx-places-stores-csv";
    csvButton.textContent = t("map.csv");
    csvButton.addEventListener("click", function () {
      exportStoresCsv(nodes.table);
    });
    nodes.tableWrap.insertBefore(csvButton, nodes.tableWrap.firstChild);
    mountActivityHelp(nodes.table);

    var loadedPlaces = [];
    var placesReady = false;
    var placesTask = null;
    var markers = [];

    function currentQuery() {
      return {
        country: countryControl.select.value,
        shopName: nameControl.select.value,
        blockchain: chainControl.select.value,
        asset: assetControl.select.value,
        activity: activityControl.select.value
      };
    }

    function queryKey(query) {
      return query.country + "\n" + query.shopName + "\n" + query.blockchain + "\n" + query.asset + "\n" + query.activity;
    }

    function unstatedPaymentMatches(blockchain, asset) {
      var spec = dfxSpec();
      var pairs = spec && Array.isArray(spec.pairs) ? spec.pairs : null;
      if (!pairs) return false;
      for (var i = 0; i < pairs.length; i += 1) {
        if (pairMatches(pairs[i], blockchain, asset)) return true;
      }
      return false;
    }

    function placeMatchesQuery(place, query) {
      if (!place) return false;
      if (query.country && place.country !== query.country) return false;
      if (query.shopName === "SPAR" && place.shopName !== "SPAR") return false;
      if (query.shopName === "others" && place.shopName === "SPAR") return false;
      if (!activityMeets(place, query.activity)) return false;
      if (!query.blockchain && !query.asset) return true;
      var supports = place.supports;
      if (Array.isArray(supports) && supports.length > 0) {
        for (var i = 0; i < supports.length; i += 1) {
          if (pairMatches(supports[i], query.blockchain, query.asset)) return true;
        }
        return false;
      }
      if (supports != null && !Array.isArray(supports)) return false;
      return unstatedPaymentMatches(query.blockchain, query.asset);
    }

    function renderRows(places) {
      var tbody = nodes.table.querySelector("tbody");
      if (!tbody) return;
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      places.forEach(function (place) {
        var placeRow = document.createElement("tr");
        var path = shopPath(place);
        var href = shopHref(place);
        if (href) {
          placeRow.setAttribute("data-shop-path", path);
          var nameCell = document.createElement("td");
          var link = document.createElement("a");
          link.href = href;
          link.textContent = displayedName(place);
          nameCell.appendChild(link);
          placeRow.appendChild(nameCell);
        } else {
          addCell(placeRow, displayedName(place));
        }
        addCell(placeRow, displayedLocation(place));
        addCell(placeRow, trimmedField(place.country));
        addCell(placeRow, trimmedField(place.shopName));
        addCell(placeRow, typeof place.techProvider === "string" ? place.techProvider : "");
        addCell(placeRow, displayedActivity(place));
        tbody.appendChild(placeRow);
      });
    }

    function clearMarkers() {
      markers.forEach(function (marker) { marker.remove(); });
      markers = [];
    }

    function createMarker(place) {
      var markerEl = document.createElement("div");
      markerEl.className = activityMarkerClass(place);
      markerEl.title = displayedActivity(place);
      var popupNode = document.createElement("div");
      popupNode.className = "dfx-places-place-popup";
      var cover = place.coverPhoto;
      if (cover && typeof cover.url === "string" && /^https:\/\//.test(cover.url)) {
        var coverImage = document.createElement("img");
        coverImage.loading = "lazy";
        coverImage.referrerPolicy = "no-referrer";
        coverImage.alt = "";
        coverImage.src = cover.url;
        popupNode.appendChild(coverImage);
      }
      var href = shopHref(place);
      var nameText = displayedName(place);
      if (href) {
        var nameLink = document.createElement("a");
        nameLink.href = href;
        nameLink.textContent = nameText;
        popupNode.appendChild(nameLink);
      } else {
        var nameNode = document.createElement("strong");
        nameNode.textContent = nameText;
        popupNode.appendChild(nameNode);
      }
      if (typeof place.category === "string" && place.category) {
        var category = document.createElement("div");
        category.textContent = place.category;
        popupNode.appendChild(category);
      }
      var marker = new window.maplibregl.Marker({ element: markerEl })
        .setLngLat([place.lon, place.lat])
        .setPopup(new window.maplibregl.Popup({ offset: 16 }).setDOMContent(popupNode));
      marker.addTo(map);
      return marker;
    }

    // The hidden map has no size. Framing it would throw or keep the wrong view.
    function frameVisibleMarkers() {
      if (!map) return;
      if (nodes.mapWrap.hidden) return;
      if (markers.length === 0) return;
      if (markers.length === 1) {
        map.setCenter(markers[0].getLngLat());
        map.setZoom(12);
        return;
      }
      if (!window.maplibregl || typeof window.maplibregl.LngLatBounds !== "function") return;
      var bounds = new window.maplibregl.LngLatBounds();
      markers.forEach(function (marker) {
        bounds.extend(marker.getLngLat());
      });
      map.fitBounds(bounds, { padding: 48, maxZoom: 12 });
    }

    function revealMap() {
      nodes.mapWrap.hidden = false;
      nodes.tableWrap.hidden = true;
      if (!map) return;
      map.resize();
      frameVisibleMarkers();
    }

    function chooseView(next) {
      mapButton.setAttribute("aria-pressed", next === "map" ? "true" : "false");
      tableButton.setAttribute("aria-pressed", next === "table" ? "true" : "false");
      if (view === next) return;
      view = next;
      if (next === "map") {
        revealMap();
        return;
      }
      nodes.mapWrap.hidden = true;
      nodes.tableWrap.hidden = false;
    }

    mapButton.addEventListener("click", function () { chooseView("map"); });
    tableButton.addEventListener("click", function () { chooseView("table"); });

    function showPlaces(places) {
      var query = currentQuery();
      var queryBefore = queryKey(query);
      var list = Array.isArray(places) ? places : [];
      var rows = [];
      list.forEach(function (place) {
        if (!isDfxPlace(place)) return;
        if (!placeMatchesQuery(place, query)) return;
        rows.push(place);
      });
      rows.sort(function (a, b) {
        return displayedName(a).localeCompare(displayedName(b));
      });
      renderRows(rows);
      clearMarkers();
      if (map) {
        rows.forEach(function (place) {
          if (!finiteCoord(place.lat, -90, 90) || !finiteCoord(place.lon, -180, 180)) return;
          markers.push(createMarker(place));
        });
      }
      if (rows.length === 0) setStatus("map.empty");
      else setStatus(null);
      if (map && !nodes.mapWrap.hidden) map.resize();
      frameVisibleMarkers();
      if (queryKey(currentQuery()) !== queryBefore) loadPlaces();
    }

    function loadPlaces() {
      if (placesTask) placesTask.abort();
      var controller = new AbortController();
      placesTask = controller;
      return fetch(placesRequestUrl(currentQuery()), {
        credentials: "omit",
        signal: controller.signal
      }).then(function (response) {
        if (!response.ok) throw new Error("status");
        return response.json();
      }).then(function (body) {
        if (placesTask !== controller) return;
        loadedPlaces = body && Array.isArray(body.places) ? body.places : [];
        placesReady = true;
        showPlaces(loadedPlaces);
      }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        if (placesTask !== controller) return;
        setStatus("map.load_error");
      });
    }

    countryControl.select.addEventListener("change", loadPlaces);
    nameControl.select.addEventListener("change", loadPlaces);
    chainControl.select.addEventListener("change", function () {
      syncPaymentOptions();
      loadPlaces();
    });
    assetControl.select.addEventListener("change", loadPlaces);
    activityControl.select.addEventListener("change", function () {
      if (!placesReady) return;
      showPlaces(loadedPlaces);
    });

    return { loadPlaces: loadPlaces };
  }

  function start(map) {
    var nodes = collectNodes();
    if (!nodes) return;
    var api = null;
    function ensure(filters) {
      if (api) return api;
      api = mountUi(map, nodes, filters);
      return api;
    }
    return fetch(filtersUrl(), { credentials: "omit" }).then(function (response) {
      if (!response.ok) throw new Error("status");
      return response.json();
    }).then(function (filters) {
      return ensure(filters).loadPlaces();
    }, function (error) {
      if (error && error.name === "AbortError") return;
      setStatus("map.load_error");
      return ensure(null).loadPlaces();
    });
  }

  try {
    loadDictionary().then(function () {
      return createMap().then(function (map) {
        return start(map);
      }, function () {
        return start(null);
      });
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      setStatus("map.load_error");
    });
  } catch (error) {
    setStatus("map.load_error");
  }
})();
