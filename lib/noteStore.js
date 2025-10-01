import { put, head, del, list } from "@vercel/blob";

const NOTES_PREFIX = "notes";
const MAX_NOTES_DEFAULT = 10;

function blobPath(fridgeId) {
  return `${NOTES_PREFIX}/${fridgeId}.json`;
}

async function downloadJson(downloadUrl) {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download notes (status ${response.status} ${response.statusText})`,
    );
  }
  return response.json();
}

export async function loadNotes(fridgeId) {
  const pathname = blobPath(fridgeId);
  try {
    const metadata = await head(pathname);
    const payload = await downloadJson(metadata.downloadUrl);
    return {
      notes: Array.isArray(payload.notes) ? payload.notes : [],
      lastUpdated: payload.lastUpdated || metadata.uploadedAt?.getTime() || Date.now(),
      fridgeId: payload.fridgeId || fridgeId,
      pathname,
    };
  } catch (error) {
    if (error?.name === "BlobNotFoundError" || error?.status === 404) {
      return { notes: [], lastUpdated: Date.now(), fridgeId, pathname };
    }
    throw error;
  }
}

export async function saveNotes(fridgeId, notes) {
  const normalizedNotes = Array.isArray(notes) ? notes : [];
  const payload = {
    fridgeId,
    lastUpdated: Date.now(),
    notes: normalizedNotes,
  };

  const pathname = blobPath(fridgeId);

  const result = await put(pathname, JSON.stringify(payload), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    lastUpdated: payload.lastUpdated,
    notes: normalizedNotes,
  };
}

export async function appendNote(fridgeId, note, { keep = MAX_NOTES_DEFAULT } = {}) {
  const existing = await loadNotes(fridgeId);
  const current = existing.notes || [];
  const withNew = [note, ...current];
  const trimmed = withNew
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, keep);
  return saveNotes(fridgeId, trimmed);
}

export async function deleteAllNotes(fridgeId) {
  const pathname = blobPath(fridgeId);
  try {
    await del(pathname);
  } catch (error) {
    if (error?.name !== "BlobNotFoundError" && error?.status !== 404) {
      throw error;
    }
  }
}

export async function deleteNote(fridgeId, identifier) {
  const existing = await loadNotes(fridgeId);
  const current = existing.notes || [];
  const filtered = current.filter((note) => {
    if (!note) return false;
    const idMatch = note.id && String(note.id) === String(identifier);
    const timestampMatch =
      note.timestamp && String(note.timestamp) === String(identifier);
    return !(idMatch || timestampMatch);
  });

  if (filtered.length === current.length) {
    return { removed: false, notes: current };
  }

  await saveNotes(fridgeId, filtered);
  return { removed: true, notes: filtered };
}

export async function cleanupOverflow(fridgeId, keep = MAX_NOTES_DEFAULT) {
  const existing = await loadNotes(fridgeId);
  const current = existing.notes || [];
  if (current.length <= keep) {
    return { removed: 0, notes: current };
  }
  const trimmed = current
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, keep);
  await saveNotes(fridgeId, trimmed);
  return { removed: current.length - trimmed.length, notes: trimmed };
}

export async function listFridgeBlobs(prefix = NOTES_PREFIX) {
  const response = await list({ prefix });
  return response.blobs || [];
}
