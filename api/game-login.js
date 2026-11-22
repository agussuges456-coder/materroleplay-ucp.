const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

module.exports = async function gameLogin(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-UCP-Server-Secret");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).send("ERROR|METHOD_NOT_ALLOWED");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverSecret = process.env.UCP_GAME_SERVER_SECRET;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !serverSecret) {
    return response.status(500).send("ERROR|SERVER_NOT_CONFIGURED");
  }

  const body = readBody(request);
  const suppliedSecret = request.headers["x-ucp-server-secret"] || body.secret || "";
  if (!safeEqual(String(suppliedSecret), serverSecret)) {
    return response.status(401).send("ERROR|UNAUTHORIZED");
  }

  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!USERNAME_PATTERN.test(username) || password.length < 8 || password.length > 72) {
    return response.status(400).send("ERROR|INVALID_INPUT");
  }

  try {
    const profileUrl = `${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,email,status&limit=1`;
    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });
    if (!profileResponse.ok) return response.status(502).send("ERROR|PROFILE_LOOKUP_FAILED");

    const profiles = await profileResponse.json();
    const profile = profiles[0];
    if (!profile || profile.status === "banned") return response.status(401).send("ERROR|INVALID_CREDENTIALS");

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: profile.email, password })
    });
    if (!authResponse.ok) return response.status(401).send("ERROR|INVALID_CREDENTIALS");

    return response.status(200).send(`OK|${profile.id}|${profile.username}`);
  } catch (_error) {
    return response.status(500).send("ERROR|UPSTREAM_FAILURE");
  }
};

function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  const raw = typeof request.body === "string" ? request.body : "";
  if ((request.headers["content-type"] || "").includes("application/json")) {
    try { return JSON.parse(raw); } catch (_error) { return {}; }
  }
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
