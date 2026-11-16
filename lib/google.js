import { appUrl } from './env';

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'];

export function googleRedirectUri() {
  return `${appUrl()}/api/google/callback`;
}

export function googleAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...params,
    }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google: ${json.error_description || json.error || res.status}`);
  return json;
}

export function exchangeCode(code) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: googleRedirectUri() });
}

export async function refreshAccessToken(refreshToken) {
  const json = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  return json.access_token;
}

export function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return payload.email || null;
  } catch {
    return null;
  }
}

async function gfetch(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText;
    const err = new Error(`Google ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function createSpreadsheet(token, { title, sheetTitle, header, rows, appColumnsFrom }) {
  const created = await gfetch(token, 'https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title, locale: 'es_AR', timeZone: 'America/Argentina/Buenos_Aires' },
      sheets: [{ properties: { title: sheetTitle, gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  const id = created.spreadsheetId;
  const sheetId = created.sheets[0].properties.sheetId;
  await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${sheetTitle}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header, ...rows] }),
  });
  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.98, green: 0.93, blue: 0.86 } } },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: header.length } } },
  ];
  if (appColumnsFrom !== undefined) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: appColumnsFrom, endColumnIndex: header.length },
        cell: { userEnteredFormat: { backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 } } },
        fields: 'userEnteredFormat(backgroundColor)',
      },
    });
  }
  await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
  return id;
}

export async function getFileMeta(token, fileId) {
  return gfetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime,trashed,name`);
}

export async function readValues(token, spreadsheetId, range) {
  const json = await gfetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return json.values || [];
}

export async function batchWrite(token, spreadsheetId, data) {
  if (!data.length) return;
  await gfetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}

export function sheetUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
