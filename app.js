(function () {
  "use strict";

  var CURRENCY = "EGP";
  var WEEK_START = 6; // Saturday
  var cfg = window.APP_CONFIG || {};
  var sb = null;
  var user = null;
  var poll = null;
  var entries = [];
  var view = "week";
  var editingId = null;

  function $(id) {
    return document.getElementById(id);
  }

  // =========================================================
  // FORCE LOGIN / APP DISPLAY
  // =========================================================

  function forceLoginStyles() {
    var style = document.getElementById("forced-auth-styles");

    if (!style) {
      style = document.createElement("style");
      style.id = "forced-auth-styles";

      style.textContent = `
        #login {
          display: grid !important;
        }

        #app {
          display: none !important;
        }

        #login.logged-out {
          display: grid !important;
        }

        #app.logged-in {
          display: block !important;
        }
      `;

      document.head.appendChild(style);
    }
  }

  function showLogin(msg) {
    var login = $("login");
    var app = $("app");

    if (!login || !app) return;

    login.classList.add("logged-out");
    app.classList.remove("logged-in");

    login.style.setProperty("display", "grid", "important");
    app.style.setProperty("display", "none", "important");

    var m = $("loginMsg");

    if (m) {
      m.textContent = msg || "";
      m.hidden = !msg;
    }
  }

  function showApp() {
    var login = $("login");
    var app = $("app");

    if (!login || !app) return;

    login.classList.remove("logged-out");
    app.classList.add("logged-in");

    login.style.setProperty("display", "none", "important");
    app.style.setProperty("display", "block", "important");
  }

  // =========================================================
  // DATES
  // =========================================================

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function ymd(d) {
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate())
    );
  }

  function parse(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function weekStart(d) {
    return addDays(
      d,
      -((d.getDay() - WEEK_START + 7) % 7)
    );
  }

  function monthKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  }

  var MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  function bucketKey(dateStr, v) {
    var d = parse(dateStr);

    if (v === "day") {
      return dateStr;
    }

    if (v === "week") {
      return ymd(weekStart(d));
    }

    return monthKey(d);
  }

  function buckets(v) {
    var today = new Date();

    today.setHours(0, 0, 0, 0);

    var list = [];
    var i;
    var d;

    if (v === "day") {
      for (i = 13; i >= 0; i--) {
        d = addDays(today, -i);

        list.push({
          key: ymd(d),
          label:
            pad(d.getDate()) +
            " " +
            MONTHS[d.getMonth()],
          long: ymd(d)
        });
      }
    } else if (v === "week") {
      var ws = weekStart(today);

      for (i = 11; i >= 0; i--) {
        d = addDays(ws, -7 * i);

        var end = addDays(d, 6);

        list.push({
          key: ymd(d),
          label:
            pad(d.getDate()) +
            " " +
            MONTHS[d.getMonth()],
          long:
            pad(d.getDate()) +
            " " +
            MONTHS[d.getMonth()] +
            " – " +
            pad(end.getDate()) +
            " " +
            MONTHS[end.getMonth()]
        });
      }
    } else {
      for (i = 11; i >= 0; i--) {
        d = new Date(
          today.getFullYear(),
          today.getMonth() - i,
          1
        );

        list.push({
          key: monthKey(d),
          label:
            MONTHS[d.getMonth()] +
            " " +
            String(d.getFullYear()).slice(2),
          long:
            MONTHS[d.getMonth()] +
            " " +
            d.getFullYear()
        });
      }
    }

    list.forEach(function (b) {
      b.in = 0;
      b.out = 0;
    });

    var map = {};

    list.forEach(function (b) {
      map[b.key] = b;
    });

    entries.forEach(function (e) {
      var b = map[bucketKey(e.date, v)];

      if (b) {
        b[e.kind] += e.total;
      }
    });

    return list;
  }

  // =========================================================
  // FORMATTING
  // =========================================================

  function money(n) {
    var r = Math.round(n * 100) / 100;

    return (
      r.toLocaleString("en-US", {
        maximumFractionDigits: 2
      }) +
      " " +
      CURRENCY
    );
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c];
      }
    );
  }

  // =========================================================
  // STATUS
  // =========================================================

  function setStatus(text) {
    var s = $("status");

    if (!s) return;

    s.textContent = text || "";
    s.hidden = !text;
  }

  // =========================================================
  // SUMMARY CARDS
  // =========================================================

  function sums(v) {
    var key = bucketKey(ymd(new Date()), v);
    var inn = 0;
    var out = 0;

    entries.forEach(function (e) {
      if (bucketKey(e.date, v) === key) {
        if (e.kind === "in") {
          inn += e.total;
        } else {
          out += e.total;
        }
      }
    });

    return {
      in: inn,
      out: out,
      net: inn - out
    };
  }

  function renderCard(id, title, s) {
    var elCard = $(id);

    if (!elCard) return;

    var cls =
      s.net > 0
        ? "pos"
        : s.net < 0
        ? "neg"
        : "";

    elCard.innerHTML =
      '<div class="label">' +
      title +
      "</div>" +
      '<div class="net ' +
      cls +
      '">' +
      money(s.net) +
      "</div>" +
      '<div class="split">' +
      '<span><i class="dot in"></i>In <b>' +
      money(s.in) +
      "</b></span>" +
      '<span><i class="dot out"></i>Out <b>' +
      money(s.out) +
      "</b></span>" +
      "</div>";
  }

  function renderCards() {
    renderCard(
      "cardDay",
      "Today",
      sums("day")
    );

    renderCard(
      "cardWeek",
      "This week",
      sums("week")
    );

    renderCard(
      "cardMonth",
      "This month",
      sums("month")
    );
  }

  // =========================================================
  // CHART
  // =========================================================

  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, text) {
    var n = document.createElementNS(
      SVG_NS,
      name
    );

    for (var k in attrs) {
      n.setAttribute(k, attrs[k]);
    }

    if (text != null) {
      n.textContent = text;
    }

    return n;
  }

  function niceMax(v) {
    if (v <= 0) return 100;

    var p = Math.pow(
      10,
      Math.floor(Math.log10(v))
    );

    var f = v / p;

    return (
      (f <= 1
        ? 1
        : f <= 2
        ? 2
        : f <= 5
        ? 5
        : 10) * p
    );
  }

  function shortNum(n) {
    if (n >= 1e6) {
      return (
        (n / 1e6).toFixed(
          n % 1e6 ? 1 : 0
        ) + "M"
      );
    }

    if (n >= 1e3) {
      return (
        (n / 1e3).toFixed(
          n % 1e3 ? 1 : 0
        ) + "k"
      );
    }

    return String(n);
  }

  function renderChart() {
    var svg = $("chart");

    if (!svg) return;

    var data = buckets(view);

    var W = 800;
    var H = 320;

    var m = {
      t: 12,
      r: 12,
      b: 34,
      l: 52
    };

    svg.setAttribute(
      "viewBox",
      "0 0 " + W + " " + H
    );

    svg.innerHTML = "";

    var max = niceMax(
      Math.max.apply(
        null,
        data.map(function (b) {
          return Math.max(
            b.in,
            b.out
          );
        })
      )
    );

    var iw = W - m.l - m.r;
    var ih = H - m.t - m.b;

    function y(v) {
      return (
        m.t +
        ih -
        (v / max) * ih
      );
    }

    for (var t = 0; t <= 4; t++) {
      var val = (max / 4) * t;
      var yy = y(val);

      svg.appendChild(
        el("line", {
          x1: m.l,
          x2: W - m.r,
          y1: yy,
          y2: yy,
          "class": "grid"
        })
      );

      svg.appendChild(
        el(
          "text",
          {
            x: m.l - 8,
            y: yy + 4,
            "text-anchor": "end"
          },
          shortNum(val)
        )
      );
    }

    var slot = iw / data.length;

    var bw = Math.min(
      26,
      (slot - 10) / 2
    );

    var every =
      data.length > 12 ? 2 : 1;

    data.forEach(function (b, i) {
      var cx =
        m.l +
        slot * i +
        slot / 2;

      [
        ["in", cx - bw - 1],
        ["out", cx + 1]
      ].forEach(function (p) {
        var v = b[p[0]];

        if (v > 0) {
          svg.appendChild(
            el("rect", {
              x: p[1],
              y: y(v),
              width: bw,
              height: Math.max(
                (v / max) * ih,
                1
              ),
              rx: 3,
              "class":
                "bar-" + p[0]
            })
          );
        }
      });

      if (i % every === 0) {
        svg.appendChild(
          el(
            "text",
            {
              x: cx,
              y: H - 12,
              "text-anchor": "middle"
            },
            b.label
          )
        );
      }

      var hit = el("rect", {
        x: m.l + slot * i,
        y: m.t,
        width: slot,
        height: ih,
        "class": "hit"
      });

      hit.addEventListener(
        "mousemove",
        function (ev) {
          showTip(ev, b);
        }
      );

      hit.addEventListener(
        "mouseleave",
        hideTip
      );

      hit.addEventListener(
        "click",
        function (ev) {
          showTip(ev, b);
        }
      );

      svg.appendChild(hit);
    });

    var names = {
      day: "Last 14 days",
      week: "Last 12 weeks (Sat–Fri)",
      month: "Last 12 months"
    };

    if ($("chartTitle")) {
      $("chartTitle").textContent =
        "Income vs output · " +
        names[view];
    }

    var rows =
      "<thead>" +
      "<tr>" +
      "<th>Period</th>" +
      '<th class="num">Income</th>' +
      '<th class="num">Output</th>' +
      '<th class="num">Net</th>' +
      "</tr>" +
      "</thead>" +
      "<tbody>";

    data.forEach(function (b) {
      rows +=
        "<tr>" +
        "<td>" +
        esc(b.long) +
        "</td>" +
        '<td class="num">' +
        money(b.in) +
        "</td>" +
        '<td class="num">' +
        money(b.out) +
        "</td>" +
        '<td class="num">' +
        money(b.in - b.out) +
        "</td>" +
        "</tr>";
    });

    rows += "</tbody>";

    if ($("chartTable")) {
      $("chartTable").innerHTML =
        rows;
    }
  }

  function showTip(ev, b) {
    var tip = $("tip");
    var wrap = $("chartWrap");

    if (!tip || !wrap) return;

    var rect =
      wrap.getBoundingClientRect();

    tip.innerHTML =
      "<b>" +
      esc(b.long) +
      "</b>" +
      '<i class="dot in"></i>Income ' +
      money(b.in) +
      '<br><i class="dot out"></i>Output ' +
      money(b.out) +
      "<br>Net " +
      money(b.in - b.out);

    tip.hidden = false;

    var x =
      ev.clientX -
      rect.left +
      14;

    var yv =
      ev.clientY -
      rect.top +
      14;

    tip.style.left =
      Math.max(
        4,
        Math.min(
          x,
          rect.width -
            tip.offsetWidth -
            4
        )
      ) + "px";

    tip.style.top =
      Math.max(4, yv) + "px";
  }

  function hideTip() {
    if ($("tip")) {
      $("tip").hidden = true;
    }
  }

  // =========================================================
  // ENTRIES TABLE
  // =========================================================

  function renderEntries() {
    var search = $("search");

    if (!search || !$("entries")) {
      return;
    }

    var q =
      search.value
        .trim()
        .toLowerCase();

    var list = entries.filter(
      function (e) {
        return (
          !q ||
          (
            e.item +
            " " +
            e.size
          )
            .toLowerCase()
            .indexOf(q) !== -1
        );
      }
    );

    var tbody =
      $("entries").querySelector(
        "tbody"
      );

    if (!tbody) return;

    tbody.innerHTML =
      list
        .slice(0, 300)
        .map(function (e) {
          var change = e.by
            ? esc(e.by) +
              (e.at
                ? " · " +
                  esc(
                    e.at.slice(
                      0,
                      10
                    )
                  )
                : "")
            : "";

          return (
            "<tr>" +
            "<td>" +
            esc(e.date) +
            "</td>" +
            '<td><span class="pill ' +
            e.kind +
            '">' +
            (e.kind === "in"
              ? "Income"
              : "Output") +
            "</span></td>" +
            '<td class="num">' +
            e.qty +
            "</td>" +
            "<td>" +
            esc(e.item) +
            "</td>" +
            "<td>" +
            esc(e.size) +
            "</td>" +
            '<td class="num">' +
            money(e.price) +
            "</td>" +
            '<td class="num">' +
            money(e.total) +
            "</td>" +
            "<td>" +
            change +
            "</td>" +
            '<td>' +
            '<button type="button" class="act" data-edit="' +
            e.id +
            '">Edit</button> ' +
            '<button type="button" class="act del" data-del="' +
            e.id +
            '">Delete</button>' +
            "</td>" +
            "</tr>"
          );
        })
        .join("");

    if ($("empty")) {
      $("empty").hidden =
        entries.length > 0;
    }
  }

  function renderAll() {
    renderCards();
    renderChart();
    renderEntries();
  }

  // =========================================================
  // SUPABASE DATA
  // =========================================================

  function mapRow(r) {
    return {
      id: r.id,
      date: r.entry_date,
      kind: r.kind,
      qty: Number(r.qty),
      item: r.item,
      size: r.size || "",
      price: Number(r.price),
      total: Number(r.total),
      by:
        r.updated_by ||
        r.created_by ||
        "",
      at:
        r.updated_at ||
        r.created_at ||
        ""
    };
  }

  function loadEntries() {
    if (!sb || !user) {
      return Promise.resolve();
    }

    var all = [];
    var from = 0;
    var size = 1000;

    function page() {
      return sb
        .from("entries")
        .select("*")
        .order(
          "entry_date",
          {
            ascending: false
          }
        )
        .order("id", {
          ascending: false
        })
        .range(
          from,
          from + size - 1
        )
        .then(function (r) {
          if (r.error) {
            throw r.error;
          }

          all =
            all.concat(
              r.data || []
            );

          if (
            r.data &&
            r.data.length ===
              size
          ) {
            from += size;
            return page();
          }
        });
    }

    return page()
      .then(function () {
        entries =
          all.map(mapRow);

        setStatus("");
        renderAll();
      })
      .catch(function (e) {
        setStatus(
          "Could not load data: " +
            (e.message || e)
        );
      });
  }

  // =========================================================
  // FORM
  // =========================================================

  function updateTotal() {
    var q =
      parseFloat(
        $("fQty").value
      ) || 0;

    var p =
      parseFloat(
        $("fPrice").value
      ) || 0;

    $("fTotal").textContent =
      money(q * p);
  }

  function resetForm() {
    editingId = null;

    $("fDate").value =
      ymd(new Date());

    $("fKind").value = "in";

    $("fQty").value = 1;

    $("fItem").value = "";
    $("fSize").value = "";
    $("fPrice").value = "";

    $("formTitle").textContent =
      "Add entry";

    $("fSubmit").textContent =
      "Add";

    $("fCancel").hidden = true;

    updateTotal();
  }

  function startEdit(id) {
    var e =
      entries.filter(
        function (x) {
          return x.id === id;
        }
      )[0];

    if (!e) return;

    editingId = id;

    $("fDate").value = e.date;
    $("fKind").value = e.kind;
    $("fQty").value = e.qty;
    $("fItem").value = e.item;
    $("fSize").value = e.size;
    $("fPrice").value = e.price;

    $("formTitle").textContent =
      "Edit entry";

    $("fSubmit").textContent =
      "Save changes";

    $("fCancel").hidden = false;

    updateTotal();

    $("formPanel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    $("fItem").focus();
  }

  function onSubmit(ev) {
    ev.preventDefault();

    var qty =
      parseFloat(
        $("fQty").value
      );

    var price =
      parseFloat(
        $("fPrice").value
      );

    var item =
      $("fItem").value.trim();

    if (
      !item ||
      !(qty >= 0) ||
      !(price >= 0)
    ) {
      return;
    }

    var row = {
      entry_date:
        $("fDate").value,
      kind:
        $("fKind").value,
      qty: qty,
      item: item,
      size:
        $("fSize").value.trim(),
      price: price
    };

    var btn =
      $("fSubmit");

    btn.disabled = true;

    var req = editingId
      ? sb
          .from("entries")
          .update(row)
          .eq("id", editingId)
      : sb
          .from("entries")
          .insert(row);

    req
      .then(function (r) {
        if (r.error) {
          throw r.error;
        }

        var wasEdit =
          !!editingId;

        resetForm();

        return loadEntries().then(
          function () {
            if (!wasEdit) {
              $("fItem").focus();
            }
          }
        );
      })
      .catch(function (e) {
        setStatus(
          "Could not save: " +
            (e.message || e)
        );
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  // =========================================================
  // TABLE ACTIONS
  // =========================================================

  function onTableClick(ev) {
    var ed =
      ev.target.closest(
        "[data-edit]"
      );

    if (ed) {
      startEdit(
        +ed.getAttribute(
          "data-edit"
        )
      );
      return;
    }

    var del =
      ev.target.closest(
        "[data-del]"
      );

    if (!del) return;

    if (
      !window.confirm(
        "Delete this entry?"
      )
    ) {
      return;
    }

    var id =
      +del.getAttribute(
        "data-del"
      );

    sb
      .from("entries")
      .delete()
      .eq("id", id)
      .then(function (r) {
        if (r.error) {
          throw r.error;
        }

        if (editingId === id) {
          resetForm();
        }

        return loadEntries();
      })
      .catch(function (e) {
        setStatus(
          "Could not delete: " +
            (e.message || e)
        );
      });
  }

  // =========================================================
  // CSV EXPORT
  // =========================================================

  function exportCsv() {
    var rows = [
      [
        "date",
        "type",
        "qty",
        "item",
        "size",
        "price_each",
        "total",
        "last_change_by"
      ]
    ];

    entries
      .slice()
      .sort(function (a, b) {
        return a.date < b.date
          ? -1
          : a.date > b.date
          ? 1
          : a.id - b.id;
      })
      .forEach(function (e) {
        rows.push([
          e.date,
          e.kind === "in"
            ? "income"
            : "output",
          e.qty,
          e.item,
          e.size,
          e.price,
          e.total,
          e.by
        ]);
      });

    var csv =
      "\uFEFF" +
      rows
        .map(function (r) {
          return r
            .map(function (c) {
              return (
                '"' +
                String(c).replace(
                  /"/g,
                  '""'
                ) +
                '"'
              );
            })
            .join(",");
        })
        .join("\n");

    var a =
      document.createElement(
        "a"
      );

    a.href =
      URL.createObjectURL(
        new Blob([csv], {
          type: "text/csv"
        })
      );

    a.download =
      "entries-" +
      ymd(new Date()) +
      ".csv";

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(function () {
      URL.revokeObjectURL(
        a.href
      );
    }, 1000);
  }

  // =========================================================
  // AUTH
  // =========================================================

  function setUser(u) {
    if (
      u &&
      user &&
      u.id === user.id
    ) {
      user = u;
      return;
    }

    user = u || null;

    clearInterval(poll);
    poll = null;

    if (!user) {
      entries = [];

      showLogin();

      return;
    }

    // ==========================================
    // USER LOGGED IN
    // ==========================================

    showApp();

    if ($("who")) {
      $("who").textContent =
        user.email || "";
    }

    resetForm();

    loadEntries();

    poll = setInterval(
      loadEntries,
      60000
    );
  }

  function onLogin(ev) {
    ev.preventDefault();

    var btn = $("lBtn");

    btn.disabled = true;

    var email =
      $("lEmail").value.trim();

    var password =
      $("lPass").value;

    sb.auth
      .signInWithPassword({
        email: email,
        password: password
      })
      .then(function (r) {
        if (r.error) {
          showLogin(
            "Wrong email or password."
          );

          return;
        }

        // IMPORTANT:
        // Force dashboard immediately.
        showApp();

        $("lPass").value = "";

        if (
          r.data &&
          r.data.user
        ) {
          setUser(
            r.data.user
          );
        }
      })
      .catch(function () {
        showLogin(
          "Could not reach the server. Check your internet connection."
        );
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  // =========================================================
  // INIT
  // =========================================================

  function init() {
    // Force our auth CSS before doing anything.
    forceLoginStyles();

    // Make sure initial state is Login.
    showLogin();

    // -----------------------------------------
    // Form events
    // -----------------------------------------

    $("fDate").value =
      ymd(new Date());

    $("fQty").addEventListener(
      "input",
      updateTotal
    );

    $("fPrice").addEventListener(
      "input",
      updateTotal
    );

    $("entryForm").addEventListener(
      "submit",
      onSubmit
    );

    $("fCancel").addEventListener(
      "click",
      resetForm
    );

    $("entries").addEventListener(
      "click",
      onTableClick
    );

    $("search").addEventListener(
      "input",
      renderEntries
    );

    $("btnExport").addEventListener(
      "click",
      exportCsv
    );

    $("loginForm").addEventListener(
      "submit",
      onLogin
    );

    $("btnLogout").addEventListener(
      "click",
      function () {
        if (sb) {
          sb.auth.signOut();
        }
      }
    );

    // -----------------------------------------
    // Chart controls
    // -----------------------------------------

    document
      .querySelectorAll(".seg button")
      .forEach(function (btn) {
        btn.addEventListener(
          "click",
          function () {
            view =
              btn.getAttribute(
                "data-view"
              );

            document
              .querySelectorAll(
                ".seg button"
              )
              .forEach(
                function (x) {
                  x.setAttribute(
                    "aria-selected",
                    x === btn
                      ? "true"
                      : "false"
                  );
                }
              );

            renderChart();
          }
        );
      });

    // -----------------------------------------
    // Visibility
    // -----------------------------------------

    document.addEventListener(
      "visibilitychange",
      function () {
        if (
          !document.hidden &&
          user
        ) {
          loadEntries();
        }
      }
    );

    // -----------------------------------------
    // Supabase configuration
    // -----------------------------------------

    if (
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_ANON_KEY ||
      !window.supabase
    ) {
      showLogin(
        "Setup is not finished. Fill in config.js (see README.md)."
      );

      $("lBtn").disabled = true;

      return;
    }

    // -----------------------------------------
    // Create Supabase client
    // -----------------------------------------

    sb =
      window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );

    // -----------------------------------------
    // Check existing session
    // -----------------------------------------

    sb.auth
      .getSession()
      .then(function (r) {
        var session =
          r.data &&
          r.data.session;

        if (
          session &&
          session.user
        ) {
          setUser(
            session.user
          );
        } else {
          showLogin();
        }
      })
      .catch(function () {
        showLogin(
          "Could not check your session."
        );
      });

    // -----------------------------------------
    // Auth state listener
    // -----------------------------------------

    sb.auth.onAuthStateChange(
      function (
        _event,
        session
      ) {
        setUser(
          session &&
            session.user
        );
      }
    );
  }

  // =========================================================
  // START
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();