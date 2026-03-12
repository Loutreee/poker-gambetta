/**
 * Récupère le pseudo et l'avatar Steam à partir d'une URL de profil Steam
 * (https://steamcommunity.com/id/... ou .../profiles/76561198...).
 * Nécessite STEAM_API_KEY dans .env (https://steamcommunity.com/dev/apikey).
 */

const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
const STEAM_API_BASE = "https://api.steampowered.com";

export type SteamProfileResult = {
  personaname: string;
  avatarfull: string;
} | null;

/**
 * Parse une URL Steam et retourne soit le steamid (profiles/xxx) soit le vanityurl (id/xxx).
 */
function parseSteamProfileUrl(profileUrl: string): { steamid?: string; vanityurl?: string } | null {
  try {
    const url = new URL(profileUrl.trim());
    if (!url.hostname.endsWith("steamcommunity.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "profiles" && parts[1] && /^\d{17}$/.test(parts[1])) {
      return { steamid: parts[1] };
    }
    if (parts[0] === "id" && parts[1]) {
      return { vanityurl: decodeURIComponent(parts[1]) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Résout un vanity URL en Steam ID.
 */
async function resolveVanityUrl(vanityurl: string): Promise<string | null> {
  if (!STEAM_API_KEY) return null;
  const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(STEAM_API_KEY)}&vanityurl=${encodeURIComponent(vanityurl)}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as { response?: { steamid?: string; success?: number } };
    if (data.response?.success === 1 && data.response.steamid) {
      return data.response.steamid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Récupère les infos du joueur (personaname, avatarfull) via l'API Steam.
 */
async function getPlayerSummaries(steamid: string): Promise<SteamProfileResult> {
  if (!STEAM_API_KEY) return null;
  const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(STEAM_API_KEY)}&steamids=${encodeURIComponent(steamid)}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      response?: { players?: Array<{ personaname?: string; avatarfull?: string }> };
    };
    const players = data.response?.players;
    if (!players?.length || !players[0].personaname) return null;
    const p = players[0];
    return {
      personaname: p.personaname ?? "",
      avatarfull: p.avatarfull ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * À partir d'une URL de profil Steam, retourne le pseudo et l'URL de l'avatar.
 * Retourne null si pas de clé API, URL invalide, ou profil introuvable.
 */
export async function fetchSteamProfile(profileUrl: string): Promise<SteamProfileResult> {
  const parsed = parseSteamProfileUrl(profileUrl);
  if (!parsed) return null;

  let steamid: string | null = null;
  if (parsed.steamid) {
    steamid = parsed.steamid;
  } else if (parsed.vanityurl) {
    steamid = await resolveVanityUrl(parsed.vanityurl);
  }
  if (!steamid) return null;

  return getPlayerSummaries(steamid);
}
