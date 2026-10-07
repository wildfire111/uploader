const MAX_TOKEN_LENGTH = 200;
const MAX_USER_NAME_LENGTH = 100;

export type TokenFragment = { refreshToken: string; userName: string | null };

// Reads what the bookmarklet puts after the # of the settings page URL.
export function parseTokenFragment(hash: string): TokenFragment | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const refreshToken = params.get("rt")?.trim() ?? "";
  if (!refreshToken || refreshToken.length > MAX_TOKEN_LENGTH || /\s/.test(refreshToken)) {
    return null;
  }
  const userName = params.get("u")?.trim() ?? "";
  if (userName.length > MAX_USER_NAME_LENGTH) {
    return null;
  }
  return { refreshToken, userName: userName || null };
}

// No %, # or newlines in the source: a javascript: URL gets percent-decoded and cut at the #.
const BOOKMARKLET_SOURCE = [
  "(async()=>{try{",
  "if(location.hostname!=='moxfield.com'&&!location.hostname.endsWith('.moxfield.com')){",
  "alert('Taking you to moxfield.com. Once it loads, click the bookmark again.');",
  "location.href='https://moxfield.com';return}",
  "const r=await fetch('https://api2.moxfield.com/v1/startup/authenticated',",
  "{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},",
  "body:JSON.stringify({ignoreCookie:false,isAppLogin:false})});",
  "const j=await r.json().catch(()=>null);",
  "const t=j&&j.refresh&&j.refresh.refresh_token;",
  "if(!t){alert('You are not logged in to Moxfield. Log in, then click the bookmark again.');return}",
  "const u=j.refresh.user_name||'';",
  "const url=__ORIGIN__+'/admin/moxfield\\x23rt='+encodeURIComponent(t)+'&u='+encodeURIComponent(u);",
  "if(!window.open(url,'_blank')){",
  "try{await navigator.clipboard.writeText(t);",
  "alert('Your browser blocked the new tab, so the token is on your clipboard. ",
  "Paste it into the box on the Moxfield Settings page.')}",
  "catch(e){alert('Your browser blocked the new tab. Allow pop-ups for moxfield.com and try again.')}}",
  "}catch(e){alert('Something went wrong ('+e.message+'). Use the manual instructions on the Moxfield Settings page.')}",
  "})()",
].join("");

export function buildBookmarkletHref(appOrigin: string): string {
  const origin = new URL(appOrigin).origin;
  return `javascript:${BOOKMARKLET_SOURCE.replace("__ORIGIN__", JSON.stringify(origin))}`;
}
