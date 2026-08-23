import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
} from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS };

// Starts the OAuth flow only from a user interaction. The nonce is bound to
// a host-only cookie so the callback can reject forged or stale OAuth state.
export const startLogin = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  if (!oauthPortalUrl || !appId) {
    window.alert(
      "Güvenli giriş henüz bu Vercel alan adı için yapılandırılmadı. Yönetici, VITE_OAUTH_PORTAL_URL ve VITE_APP_ID ayarlarını Vercel'e eklemelidir."
    );
    return;
  }

  const nonce = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint32Array(4)))
        .map(value => value.toString(16))
        .join("-");

  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  window.location.href = url.toString();
};
