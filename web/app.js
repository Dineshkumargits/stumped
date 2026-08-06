/* Stumped public scores — vanilla JS, no build step.
 *
 * Talks to the backend's read-only `public.*` tRPC procedures over plain
 * HTTP GET. Deploy this folder as a static site (e.g. Cloudflare Pages).
 *
 * API base: defaults to production; override for local testing with
 *   ?api=http://127.0.0.1:3013/trpc
 * Club code: deep-link with ?code=TURF01 (or #TURF01).
 */
const params = new URLSearchParams(location.search);
const API =
  params.get("api") ||
  window.STUMPED_API ||
  "https://api-stumped.adkdev.in/trpc";

const LIVE_STATUSES = ["SETUP", "TOSS", "FIRST_INNINGS", "SECOND_INNINGS"];

const state = {
  club: null,
  tab: "live",
  pollTimer: null,
};

/* ---------- API ---------- */
async function trpc(proc, input) {
  const url = `${API}/${proc}?input=${encodeURIComponent(JSON.stringify(input || {}))}`;
  const res = await fetch(url);
  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message || "Request failed");
  }
  return body.result.data;
}

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();
const teamName = (match, team) => (team === "TEAM_A" ? match.teamAName : match.teamBName);
const overs = (o) => (o ?? 0).toFixed(1);

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function setContent(node) {
  const host = $("#tabContent");
  host.innerHTML = "";
  host.append(node);
}

function loadingNode(msg) {
  return el(`<div class="loading"><div class="spinner"></div>${esc(msg || "Loading…")}</div>`);
}
function emptyNode(icon, title, sub) {
  return el(
    `<div class="empty"><div class="ic">${icon}</div><h3>${esc(title)}</h3><p>${esc(sub || "")}</p></div>`,
  );
}

/* ---------- gate / club load ---------- */
async function enterClub(code) {
  const gateError = $("#gateError");
  gateError.hidden = true;
  try {
    const club = await trpc("public.getClub", { code: code.trim().toUpperCase() });
    state.club = club;
    // reflect in URL for sharing
    const u = new URL(location.href);
    u.searchParams.set("code", club.inviteCode);
    history.replaceState(null, "", u);
    showClub();
  } catch (e) {
    gateError.textContent = "No club found for that code. Check and try again.";
    gateError.hidden = false;
  }
}

function showGate() {
  stopPolling();
  state.club = null;
  $("#gate").hidden = false;
  $("#club").hidden = true;
  $("#clubPill").hidden = true;
}

function showClub() {
  $("#gate").hidden = true;
  $("#club").hidden = false;
  const pill = $("#clubPill");
  pill.hidden = false;
  pill.innerHTML = `<span class="dot"></span>${esc(state.club.name)}`;
  document.title = `${state.club.name} · Stumped Live`;
  selectTab(state.tab || "live");
}

/* ---------- tabs ---------- */
function selectTab(tab) {
  state.tab = tab;
  stopPolling();
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "live") renderLive();
  else if (tab === "matches") renderMatches();
  else if (tab === "leaderboard") renderLeaderboard();
  else if (tab === "series") renderSeries();
}

/* ---------- LIVE ---------- */
async function renderLive() {
  setContent(loadingNode("Checking for a live match…"));
  let matches;
  try {
    matches = await trpc("public.listMatches", { clubId: state.club.id });
  } catch {
    return setContent(emptyNode("⚠️", "Couldn't load", "Please try again."));
  }
  if (state.tab !== "live") return;

  const live = matches.find((m) => LIVE_STATUSES.includes(m.status));
  if (!live) {
    return setContent(
      emptyNode("🏏", "No live match", "Nothing is being scored right now. Check the Matches tab for past results."),
    );
  }

  const inn = live.innings.find((i) => !i.isCompleted) || live.innings[live.innings.length - 1];

  const paint = async () => {
    if (state.tab !== "live") return;
    // Pre-innings (setup/toss) — no live state yet
    if (!inn) {
      setContent(
        el(`<div class="card live-score">
          <div class="live-team">${esc(live.teamAName)} vs ${esc(live.teamBName)}</div>
          <div class="badge ${live.status === "TOSS" ? "live" : "setup"}" style="margin-top:8px">${
            live.status === "TOSS" ? "Toss in progress" : "Match setup"
          }</div>
        </div>`),
      );
      return;
    }
    let ls;
    try {
      ls = await trpc("public.getLiveState", { matchId: live.id, inningsId: inn.id });
    } catch {
      return;
    }
    if (state.tab !== "live") return;
    setContent(liveView(live, ls));
  };

  await paint();
  state.pollTimer = setInterval(paint, 5000);
}

function ballChip(b) {
  if (b === -1) return `<div class="ball wd">Wd</div>`;
  if (b === -2) return `<div class="ball nb">Nb</div>`;
  if (b === -3) return `<div class="ball w">W</div>`;
  if (b === 4) return `<div class="ball four">4</div>`;
  if (b === 6) return `<div class="ball six">6</div>`;
  return `<div class="ball">${b}</div>`;
}

function liveView(match, ls) {
  const i = ls.innings;
  const battingName = teamName(match, i.battingTeam);
  const bat = ls.currentBatsman;
  const nons = ls.nonStriker;
  const bowl = ls.currentBowler;
  const wrap = el('<div></div>');

  wrap.append(
    el(`<div class="card live-score">
      <div class="live-team">${esc(battingName)} · Innings ${i.inningsNumber}</div>
      <div class="live-runs"><span class="big">${i.totalRuns}/${i.totalWickets}</span><span class="overs">${overs(i.totalOvers)} ov</span></div>
      <div class="live-meta">
        <span>CRR ${(ls.currentRunRate ?? 0).toFixed(2)}</span>
        ${ls.target ? `<span>Target ${ls.target} · RRR ${(ls.requiredRunRate ?? 0).toFixed(2)}</span>` : ""}
      </div>
    </div>`),
  );

  wrap.append(
    el(`<div class="card live-players">
      <div class="pl-row striker"><span class="nm">🏏 ${esc(bat?.name || "TBD")} *</span><span class="st">${bat?.runs ?? 0} (${bat?.balls ?? 0})</span></div>
      <div class="pl-row"><span class="nm">🎾 ${esc(nons?.name || "TBD")}</span><span class="st">${nons?.runs ?? 0} (${nons?.balls ?? 0})</span></div>
      <div class="divider"></div>
      <div class="pl-row"><span class="nm">⚾ ${esc(bowl?.name || "TBD")}</span><span class="st">${bowl?.wickets ?? 0}-${bowl?.runs ?? 0} (${overs(bowl?.overs)})</span></div>
    </div>`),
  );

  const strip = (ls.currentOver || []).map(ballChip).join("");
  wrap.append(
    el(`<div class="card"><div class="over-strip"><span class="lbl">This over</span>${
      strip || '<span style="color:var(--text-3)">First ball pending…</span>'
    }</div></div>`),
  );

  return wrap;
}

/* ---------- MATCHES ---------- */
async function renderMatches() {
  setContent(loadingNode("Loading matches…"));
  let matches;
  try {
    matches = await trpc("public.listMatches", { clubId: state.club.id });
  } catch {
    return setContent(emptyNode("⚠️", "Couldn't load", "Please try again."));
  }
  if (state.tab !== "matches") return;
  if (!matches.length) {
    return setContent(emptyNode("📋", "No matches yet", "This club hasn't recorded any matches."));
  }

  const list = el('<div></div>');
  matches.forEach((m) => {
    const inn1 = m.innings.find((i) => i.inningsNumber === 1);
    const inn2 = m.innings.find((i) => i.inningsNumber === 2);
    const badge =
      m.status === "COMPLETED"
        ? '<span class="badge done">Completed</span>'
        : LIVE_STATUSES.includes(m.status) && (m.status === "FIRST_INNINGS" || m.status === "SECOND_INNINGS")
          ? '<span class="badge live">Live</span>'
          : '<span class="badge setup">' + esc(m.status.replace("_", " ")) + "</span>";
    const scoreLine = (inn) =>
      inn
        ? `<div class="score-line"><span class="lbl">${esc(teamName(m, inn.battingTeam))}</span><span class="val">${inn.totalRuns}/${inn.totalWickets} (${overs(inn.totalOvers)})</span></div>`
        : "";
    const result =
      m.status === "COMPLETED"
        ? `<div class="result-line">${m.winnerTeam ? "🏆 " + esc(teamName(m, m.winnerTeam)) + " won" + (m.winMargin ? " by " + esc(m.winMargin) : "") : "🤝 " + esc(m.winMargin || "Match tied")}</div>`
        : "";
    const card = el(`<div class="card match-card">
      <div class="match-head"><span class="match-date">📅 ${new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>${badge}</div>
      <div class="match-teams">${esc(m.teamAName)} vs ${esc(m.teamBName)}</div>
      ${scoreLine(inn1)}${scoreLine(inn2)}${result}
    </div>`);
    card.addEventListener("click", () => renderScorecard(m.id));
    list.append(card);
  });
  setContent(list);
}

/* ---------- SCORECARD ---------- */
async function renderScorecard(matchId) {
  stopPolling();
  setContent(loadingNode("Loading scorecard…"));
  let m, awards;
  try {
    [m, awards] = await Promise.all([
      trpc("public.getMatch", { matchId }),
      trpc("public.getMatchAwards", { matchId }).catch(() => null),
    ]);
  } catch {
    return setContent(emptyNode("⚠️", "Couldn't load", "Please try again."));
  }

  const wrap = el("<div></div>");
  const back = el('<button class="back-link">← Back to matches</button>');
  back.addEventListener("click", () => selectTab("matches"));
  wrap.append(back);

  // Result banner
  if (m.status === "COMPLETED") {
    wrap.append(
      el(`<div class="card" style="text-align:center;border-left:4px solid var(--gold)">
        <div style="font-weight:800">🏆 ${m.winnerTeam ? esc(teamName(m, m.winnerTeam)) + " won" : esc(m.winMargin || "Match tied")}</div>
        ${m.winnerTeam && m.winMargin ? `<div style="color:var(--gold);font-size:13px;margin-top:2px">by ${esc(m.winMargin)}</div>` : ""}
      </div>`),
    );
  } else {
    wrap.append(
      el(`<div class="card" style="text-align:center;border-left:4px solid var(--danger)">
        <div style="font-weight:800;color:var(--danger)">${LIVE_STATUSES.includes(m.status) && m.innings.length ? "🔴 In progress" : "⚙️ Match setup"}</div>
      </div>`),
    );
  }

  // Innings
  m.innings.forEach((inn) => {
    const card = el(`<div class="card">
      <div class="match-head">
        <span class="section-title" style="margin:0">${inn.inningsNumber === 1 ? "1st" : "2nd"} innings · ${esc(teamName(m, inn.battingTeam))}</span>
        <span class="val" style="font-weight:800;color:var(--emerald)">${inn.totalRuns}/${inn.totalWickets} (${overs(inn.totalOvers)})</span>
      </div>
    </div>`);

    // Batting table
    const batRows = inn.battingInnings
      .map(
        (b) => `<tr>
          <td class="nm">${esc(b.player.name)} ${b.isOut ? "" : '<span class="sub">not out</span>'}</td>
          <td class="sub">${b.isOut ? esc((b.dismissalType || "out").replace("_", " ").toLowerCase()) : "—"}</td>
          <td class="num nm">${b.runs}</td>
          <td class="num">${b.balls}</td>
          <td class="num">${b.fours}/${b.sixes}</td>
          <td class="num">${(b.strikeRate ?? 0).toFixed(0)}</td>
        </tr>`,
      )
      .join("");
    card.append(
      el(`<table class="tbl">
        <thead><tr><th>Batter</th><th></th><th class="num">R</th><th class="num">B</th><th class="num">4/6</th><th class="num">SR</th></tr></thead>
        <tbody>${batRows || '<tr><td colspan="6" class="sub">No batting yet</td></tr>'}</tbody>
      </table>`),
    );

    // Bowling table
    const bowlRows = inn.bowlingInnings
      .map(
        (b) => `<tr>
          <td class="nm">${esc(b.player.name)}</td>
          <td class="num">${overs(b.overs)}</td>
          <td class="num">${b.maidens}</td>
          <td class="num nm">${b.runs}</td>
          <td class="num nm">${b.wickets}</td>
          <td class="num">${(b.economy ?? 0).toFixed(1)}</td>
        </tr>`,
      )
      .join("");
    card.append(
      el(`<table class="tbl" style="margin-top:14px">
        <thead><tr><th>Bowler</th><th class="num">O</th><th class="num">M</th><th class="num">R</th><th class="num">W</th><th class="num">Econ</th></tr></thead>
        <tbody>${bowlRows || '<tr><td colspan="6" class="sub">No bowling yet</td></tr>'}</tbody>
      </table>`),
    );

    wrap.append(card);
  });

  // Awards
  if (awards && (awards.mom || awards.topBatsman || awards.topBowler)) {
    const rows = [];
    if (awards.mom) rows.push(`<div class="score-line"><span class="lbl">🌟 Man of the Match</span><span class="val">${esc(awards.mom.name)}</span></div>`);
    if (awards.topBatsman) rows.push(`<div class="score-line"><span class="lbl">🏏 Top batter</span><span class="val">${esc(awards.topBatsman.player.name)} · ${awards.topBatsman.runs}(${awards.topBatsman.balls})</span></div>`);
    if (awards.topBowler) rows.push(`<div class="score-line"><span class="lbl">⚾ Top bowler</span><span class="val">${esc(awards.topBowler.player.name)} · ${awards.topBowler.wickets}-${awards.topBowler.runs}</span></div>`);
    wrap.append(el(`<div class="card"><div class="section-title">Match awards</div>${rows.join("")}</div>`));
  }

  setContent(wrap);
}

/* ---------- LEADERBOARD ---------- */
async function renderLeaderboard() {
  setContent(loadingNode("Loading leaderboard…"));
  let players;
  try {
    players = await trpc("public.getLeaderboard", { clubId: state.club.id });
  } catch {
    return setContent(emptyNode("⚠️", "Couldn't load", "Please try again."));
  }
  if (state.tab !== "leaderboard") return;
  if (!players.length) {
    return setContent(emptyNode("🏆", "No players yet", "This club hasn't added any players."));
  }
  const card = el('<div class="card"><div class="section-title">Player ratings</div></div>');
  players.forEach((p, idx) => {
    const rankCls = idx === 0 ? "g1" : idx === 1 ? "g2" : idx === 2 ? "g3" : "";
    card.append(
      el(`<div class="lb-row">
        <div class="rank ${rankCls}">${idx + 1}</div>
        <div class="avatar" style="background:${esc(p.avatarColor)}">${initials(p.name)}</div>
        <div class="lb-name">${esc(p.name)}<div class="lb-cat">${esc(p.category.replace("_", " ").toLowerCase())}</div></div>
        <div class="lb-rating">★ ${Math.round(p.overallRating)}</div>
      </div>`),
    );
  });
  setContent(card);
}

/* ---------- SERIES ---------- */
async function renderSeries() {
  setContent(loadingNode("Loading series…"));
  let series;
  try {
    series = await trpc("public.listSeries", { clubId: state.club.id });
  } catch {
    return setContent(emptyNode("⚠️", "Couldn't load", "Please try again."));
  }
  if (state.tab !== "series") return;
  if (!series.length) {
    return setContent(emptyNode("📊", "No series yet", "This club hasn't created any tournament series."));
  }

  const wrap = el("<div></div>");
  const chips = el('<div class="chips"></div>');
  const tableHost = el("<div></div>");
  let selected = series[0].id;

  const loadTable = async (seriesId) => {
    selected = seriesId;
    chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === seriesId));
    tableHost.innerHTML = "";
    tableHost.append(loadingNode("Loading points table…"));
    let rows;
    try {
      rows = await trpc("public.getPointsTable", { seriesId });
    } catch {
      tableHost.innerHTML = "";
      tableHost.append(emptyNode("⚠️", "Couldn't load", ""));
      return;
    }
    tableHost.innerHTML = "";
    if (!rows.length) {
      tableHost.append(emptyNode("🏏", "No completed matches", "Points appear once matches finish."));
      return;
    }
    const body = rows
      .map(
        (r, i) => `<tr>
          <td class="rank ${i < 2 ? "g" + (i + 1) : ""}">${i + 1}</td>
          <td class="nm">${esc(r.name)}</td>
          <td class="num">${r.played}</td>
          <td class="num">${r.won}</td>
          <td class="num">${r.lost}</td>
          <td class="num">${r.tied}</td>
          <td class="num nm" style="color:var(--emerald)">${r.points}</td>
          <td class="num">${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}</td>
        </tr>`,
      )
      .join("");
    tableHost.append(
      el(`<div class="card"><table class="tbl">
        <thead><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">T</th><th class="num">Pts</th><th class="num">NRR</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`),
    );
  };

  series.forEach((s) => {
    const chip = el(`<button class="chip" data-id="${s.id}">🏆 ${esc(s.name)}</button>`);
    chip.addEventListener("click", () => loadTable(s.id));
    chips.append(chip);
  });
  wrap.append(chips, tableHost);
  setContent(wrap);
  loadTable(selected);
}

/* ---------- wire up ---------- */
$("#codeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("#codeInput").value;
  if (code.trim()) enterClub(code);
});
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (btn) selectTab(btn.dataset.tab);
});
$("#brandHome").addEventListener("click", showGate);

// Deep link: ?code=TURF01 or #TURF01
const initialCode = params.get("code") || location.hash.replace(/^#/, "");
if (initialCode) {
  $("#codeInput").value = initialCode.toUpperCase();
  enterClub(initialCode);
}
