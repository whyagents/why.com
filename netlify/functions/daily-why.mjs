import { createHash } from "node:crypto";
import { getDatabase } from "@netlify/database";
import {
  CURRENT_DAILY_WHY,
  dailyDoorById,
  dailyEpisodeById,
  dailyNodeById,
  pacificDayKey,
  publicDailyEpisode,
} from "../lib/daily-why.mjs";
import { databaseEpisodeStore } from "../lib/daily-why-store.mjs";
import { positionOf } from "../lib/slate-order.mjs";
import { clampStake } from "../lib/stakes.mjs";

export const config = {
  path: "/api/daily-why",
  rateLimit: {
    windowLimit: 90,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

const MAX_REQUEST_BYTES = 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,96}$/;

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

function requestIsSameSite(request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.hostname === requestUrl.hostname ||
        (originUrl.hostname.endsWith(".why.com") && requestUrl.hostname.endsWith(".why.com"));
    } catch {
      return false;
    }
  }
  return ["same-origin", "same-site"].includes(request.headers.get("sec-fetch-site"));
}

async function choiceStats(sql, episodeId) {
  const rows = await sql`
    SELECT node_id, door_id, COUNT(*)::int AS votes
    FROM daily_why_choices
    WHERE episode_id = ${episodeId}
    GROUP BY node_id, door_id
  `;
  const participantRows = await sql`
    SELECT COUNT(DISTINCT voter_hash)::int AS participants
    FROM daily_why_choices
    WHERE episode_id = ${episodeId}
  `;
  const nodes = {};
  for (const row of rows) {
    const nodeId = String(row.node_id || "");
    const doorId = String(row.door_id || "");
    if (!nodeId || !doorId) continue;
    const node = nodes[nodeId] || { total: 0, counts: {} };
    const votes = Math.max(0, Number(row.votes) || 0);
    node.counts[doorId] = votes;
    node.total += votes;
    nodes[nodeId] = node;
  }
  return {
    available: true,
    participants: Math.max(0, Number(participantRows[0]?.participants) || 0),
    nodes,
  };
}

export default async function handler(request) {
  if (request.method === "GET") {
    const requestedEpisodeId = new URL(request.url).searchParams.get("episode");
    let selectedEpisode = requestedEpisodeId ? dailyEpisodeById(requestedEpisodeId) : null;
    let sql = null;
    try {
      ({ sql } = getDatabase());
      const store = databaseEpisodeStore(sql);
      selectedEpisode ||= requestedEpisodeId
        ? await store.get(requestedEpisodeId)
        : await store.get(pacificDayKey());
    } catch (error) {
      console.warn("why_daily_episode_store_unavailable", JSON.stringify({ name: error?.name || "Error" }));
    }
    if (!requestedEpisodeId && !selectedEpisode) selectedEpisode = CURRENT_DAILY_WHY;
    if (!selectedEpisode) return json({ error: "Daily episode not found." }, 404);
    const episode = publicDailyEpisode(selectedEpisode);
    if (!sql) return json({ episode, stats: { available: false, participants: 0, nodes: {} } });
    try {
      return json({ episode, stats: await choiceStats(sql, selectedEpisode.id) });
    } catch (error) {
      console.warn("why_daily_stats_unavailable", JSON.stringify({ name: error?.name || "Error" }));
      return json({ episode, stats: { available: false, participants: 0, nodes: {} } });
    }
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!requestIsSameSite(request)) return json({ error: "Same-site requests only." }, 403);
  if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Use application/json." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length")) || 0;
  if (declaredLength > MAX_REQUEST_BYTES) return json({ error: "Request too large." }, 413);
  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return json({ error: "Request too large." }, 413);

  let input;
  try { input = JSON.parse(raw); }
  catch { return json({ error: "Invalid JSON." }, 400); }

  const episodeId = String(input?.episodeId || "").slice(0, 32);
  const nodeId = String(input?.nodeId || "").slice(0, 100);
  const doorId = String(input?.doorId || "").slice(0, 100);
  const browserToken = String(input?.browserToken || "");
  let sql;
  let episode = dailyEpisodeById(episodeId);
  let door = episode ? dailyDoorById(episode, nodeId, doorId) : null;
  if (episode && (!door || !TOKEN_PATTERN.test(browserToken))) {
    return json({ error: "Invalid daily choice." }, 400);
  }
  try {
    ({ sql } = getDatabase());
    if (!episode) episode = await databaseEpisodeStore(sql).get(episodeId);
  } catch (error) {
    console.error("why_daily_choice_store_unavailable", JSON.stringify({ name: error?.name || "Error" }));
    return json({ error: "The collective count is unavailable." }, 503);
  }
  door ||= dailyDoorById(episode, nodeId, doorId);
  if (!episode || !door || !TOKEN_PATTERN.test(browserToken)) {
    return json({ error: "Invalid daily choice." }, 400);
  }

  const voterHash = createHash("sha256").update(`${episodeId}:${browserToken}`).digest("hex");
  const node = dailyNodeById(episode, nodeId);
  const position = positionOf(node?.doors, browserToken, nodeId, doorId);
  const band = clampStake(door?.heat) || null;
  try {
    const inserted = await sql`
      INSERT INTO daily_why_choices (episode_id, node_id, door_id, voter_hash, position, band)
      VALUES (${episodeId}, ${nodeId}, ${doorId}, ${voterHash}, ${position}, ${band})
      ON CONFLICT (episode_id, node_id, voter_hash) DO NOTHING
      RETURNING door_id
    `;
    const recordedChoice = await sql`
      SELECT door_id
      FROM daily_why_choices
      WHERE episode_id = ${episodeId} AND node_id = ${nodeId} AND voter_hash = ${voterHash}
      LIMIT 1
    `;
    const stats = await choiceStats(sql, episodeId);
    return json({
      episodeId,
      nodeId,
      selectedDoorId: String(recordedChoice[0]?.door_id || doorId),
      recorded: inserted.length === 1,
      participants: stats.participants,
      ...(stats.nodes[nodeId] || { total: 0, counts: {} }),
    });
  } catch (error) {
    console.error("why_daily_choice_failed", JSON.stringify({ name: error?.name || "Error" }));
    return json({ error: "The collective count is unavailable." }, 503);
  }
}
