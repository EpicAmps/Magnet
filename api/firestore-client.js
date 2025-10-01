import crypto from "node:crypto";

const FIRESTORE_HOST = "https://firestore.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/datastore";

const projectId = process.env.FIREBASE_PROJECT_ID;
let cachedToken = null;
let cachedExpiry = 0;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getAccessToken() {
  if (cachedToken && cachedExpiry - 60000 > Date.now()) {
    return cachedToken;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase service account configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.",
    );
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const tokenSegments = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
  ];

  const unsignedToken = tokenSegments.join(".");

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(privateKey, "base64");

  const signedJwt = `${unsignedToken}.${signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signedJwt,
  }).toString();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    const detail = json.error_description || json.error || response.statusText;
    throw new Error(`Failed to obtain Firebase access token: ${detail}`);
  }

  cachedToken = json.access_token;
  cachedExpiry = Date.now() + json.expires_in * 1000;
  return cachedToken;
}

async function firestoreRequest(path, { method = "GET", body } = {}) {
  const accessToken = await getAccessToken();
  const url = `${FIRESTORE_HOST}/v1/projects/${projectId}/databases/(default)${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.error?.message || response.statusText;
    const error = new Error(`Firestore request failed: ${message}`);
    error.status = response.status;
    error.details = json?.error || json;
    throw error;
  }

  return json;
}

function parseFirestoreDocument(doc) {
  const { fields = {}, name } = doc;
  const getString = (key) => fields[key]?.stringValue || "";
  const getNumber = (key) => {
    const value = fields[key];
    if (!value) return undefined;
    if (value.integerValue !== undefined) {
      return Number(value.integerValue);
    }
    if (value.doubleValue !== undefined) {
      return Number(value.doubleValue);
    }
    return undefined;
  };
  const getBoolean = (key) => {
    const value = fields[key];
    if (value && "booleanValue" in value) {
      return Boolean(value.booleanValue);
    }
    return false;
  };
  const getArray = (key) => {
    const arr = fields[key]?.arrayValue?.values;
    if (!arr) return [];
    return arr.map((entry) => entry.stringValue || "");
  };

  return {
    id: name?.split("/").pop() || undefined,
    content: getString("content"),
    timestamp: getNumber("timestamp"),
    fridgeId: getString("fridgeId"),
    fridgeName: getString("fridgeName"),
    source: getString("source"),
    tags: getArray("tags"),
    timeBoundStatus: getString("timeBoundStatus") || "normal",
    hasTimeElements: getBoolean("hasTimeElements"),
    sender: getString("sender"),
  };
}

function buildFirestoreDocument(note) {
  const arrayValues = (values = []) => ({
    arrayValue: {
      values: values.map((value) => ({ stringValue: value })),
    },
  });

  const fields = {
    content: { stringValue: note.content || "" },
    timestamp: { integerValue: String(note.timestamp || Date.now()) },
    fridgeId: { stringValue: note.fridgeId },
    fridgeName: { stringValue: note.fridgeName || "" },
    source: { stringValue: note.source || "unknown" },
    tags: arrayValues(note.tags || []),
    timeBoundStatus: { stringValue: note.timeBoundStatus || "normal" },
    hasTimeElements: { booleanValue: Boolean(note.hasTimeElements) },
  };

  if (note.sender) {
    fields.sender = { stringValue: note.sender };
  }

  return { fields };
}

export async function fetchNotesForFridge(fridgeId, { limit = 20 } = {}) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "notes" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "fridgeId" },
          op: "EQUAL",
          value: { stringValue: fridgeId },
        },
      },
      orderBy: [
        {
          field: { fieldPath: "timestamp" },
          direction: "DESCENDING",
        },
      ],
      limit,
    },
  };

  const response = await firestoreRequest("/documents:runQuery", {
    method: "POST",
    body,
  });

  const notes = [];
  for (const entry of response) {
    if (entry.document) {
      notes.push(parseFirestoreDocument(entry.document));
    }
  }

  return notes;
}

export async function createNoteDocument(note) {
  const firestoreDoc = buildFirestoreDocument(note);
  const response = await firestoreRequest("/documents/notes", {
    method: "POST",
    body: firestoreDoc,
  });
  return parseFirestoreDocument(response);
}

export async function deleteNoteById(noteId) {
  const path = `/documents/notes/${noteId}`;
  await firestoreRequest(path, { method: "DELETE" });
}

export async function deleteNotesByFridge(fridgeId) {
  const notes = await fetchNotesForFridge(fridgeId, { limit: 100 });
  if (notes.length === 0) return 0;

  await Promise.all(
    notes.map((note) =>
      firestoreRequest(`/documents/notes/${note.id}`, { method: "DELETE" }).catch(
        () => {},
      ),
    ),
  );
  return notes.length;
}

export async function findNotesByTimestamp(fridgeId, timestamp) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "notes" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "fridgeId" },
                op: "EQUAL",
                value: { stringValue: fridgeId },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "timestamp" },
                op: "EQUAL",
                value: { integerValue: String(timestamp) },
              },
            },
          ],
        },
      },
    },
  };

  const response = await firestoreRequest("/documents:runQuery", {
    method: "POST",
    body,
  });

  const matches = [];
  for (const entry of response) {
    if (entry.document) {
      matches.push(parseFirestoreDocument(entry.document));
    }
  }
  return matches;
}

export async function cleanupOldNotes(fridgeId, keep = 10) {
  const notes = await fetchNotesForFridge(fridgeId, { limit: keep + 10 });
  if (notes.length <= keep) return 0;

  const excess = notes.slice(keep);
  await Promise.all(
    excess.map((note) =>
      firestoreRequest(`/documents/notes/${note.id}`, { method: "DELETE" }).catch(
        () => {},
      ),
    ),
  );
  return excess.length;
}
