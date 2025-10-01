// api/webhook.js - Integrated with Time-Bound Tasks + TBT Build Support
import { marked } from "marked";
import { appendNote, loadNotes } from "../lib/noteStore.js";

marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false,
});

const isTBTBuild =
  process.env.VERCEL_GIT_COMMIT_REF?.includes("tbt") ||
  process.env.VERCEL_URL?.includes("tbt") ||
  process.env.NODE_ENV === "development";

if (isTBTBuild) {
  console.log("🔧 TBT Build - Using in-memory storage");
}

class TBTStorage {
  constructor() {
    this.notes = new Map();
  }

  async addNote(noteData) {
    const id = Date.now().toString();
    const note = { ...noteData, id };
    this.notes.set(id, note);
    return { id };
  }

  async getNotes(fridgeId) {
    return Array.from(this.notes.values())
      .filter((note) => note.fridgeId === fridgeId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 10);
  }
}

const tbtStorage = new TBTStorage();

export default async function handler(req, res) {
  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log("Method:", req.method);
  console.log("Build:", isTBTBuild ? "TBT" : "PROD");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Webhook-Secret",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET" && req.url === "/api/webhook") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(
      `data: {"status":"connected","build":"${isTBTBuild ? "TBT" : "PROD"}","timestamp":${Date.now()}}\n\n`,
    );

    const heartbeat = setInterval(() => {
      res.write(`data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`);
    }, 30000);

    req.on("close", () => clearInterval(heartbeat));
    return;
  }

  if (req.method === "GET") {
    const fridgeId = req.query.fridgeId || req.query.fridge_id;

    if (!fridgeId) {
      return res.status(400).json({ error: "fridgeId is required" });
    }

    try {
      let notes = [];

      if (isTBTBuild) {
        notes = await tbtStorage.getNotes(fridgeId);
      } else {
        const { notes: storedNotes } = await loadNotes(fridgeId);
        notes = storedNotes;
      }

      return res.status(200).json({
        success: true,
        notes,
        count: notes.length,
        build: isTBTBuild ? "TBT" : "PROD",
      });
    } catch (error) {
      console.error("❌ Error fetching notes:", error);
      return res.status(500).json({
        error: "Failed to fetch notes",
        details: error.message,
      });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("Body:", body);

    let fridgeId, fridgeName;

    if (body.to) {
      const emailMatch = body.to.match(/incoming\.magnet\+([^@]+)@/);
      if (emailMatch) {
        fridgeName = emailMatch[1].toLowerCase();
        fridgeId = generateFridgeId(fridgeName);
      }
    }

    fridgeId = fridgeId || body.fridgeId || body.fridge_id || body.id;
    fridgeName =
      fridgeName ||
      body.fridgeName ||
      body.fridge_name ||
      body.name ||
      "unknown";
    let noteContent = body.body || body.content || body.text || "";

    if (!fridgeId) {
      return res.status(400).json({ error: "fridgeId is required" });
    }

    if (!noteContent || noteContent.trim() === "") {
      return res.status(400).json({ error: "Note content is required" });
    }

    let processedContent = noteContent;

    processedContent = processedContent
      .replace(/\t◦\t/g, "- [ ] ")
      .replace(/☐\s*/g, "- [ ] ")
      .replace(/✓\s*/g, "- [x] ")
      .replace(/✅\s*/g, "- [x] ")
      .replace(/☑\s*/g, "- [x] ");

    processedContent = processedContent.replace(
      /(@\d{1,2}(:\d{2})?(am|pm|AM|PM))/g,
      '<span class="due-time" data-due-time="$1">$1</span>',
    );

    processedContent = processedContent.replace(
      /(@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}))/gi,
      '<span class="due-date" data-due-date="$1">$1</span>',
    );

    processedContent = processedContent.replace(
      /(@\d+(\.\d+)?(min|minutes|hr|hour|hours|sec|seconds|s|m|h))/gi,
      '<span class="timer" data-timer="$1">$1</span>',
    );

    processedContent = processedContent.replace(
      /(@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday) @?\d{1,2}(:\d{2})?(am|pm|AM|PM))/gi,
      '<span class="due-datetime" data-due-datetime="$1">$1</span>',
    );

    processedContent = processedContent.replace(
      /(@(daily|weekly|monthly|yearly))/gi,
      '<span class="recurring" data-recurring="$1">$1</span>',
    );

    processedContent = processedContent.replace(
      /(@(urgent|high|medium|low|critical))/gi,
      '<span class="priority priority-$2" data-priority="$1">$1</span>',
    );

    let formattedContent = marked(processedContent);

    formattedContent = formattedContent.replace(
      /(<input[^>]*?)disabled([^>]*>)/gi,
      "$1$2",
    );

    formattedContent = formattedContent.replace(
      /<input([^>]*?)>/gi,
      (match, attributes) => {
        let cleanAttributes = attributes.replace(/\s*=""\s*/g, " ").trim();

        if (!cleanAttributes.includes("type=")) {
          cleanAttributes = `type="checkbox" ${cleanAttributes}`;
        }

        cleanAttributes = cleanAttributes.replace(/\s+/g, " ").trim();

        return `<input ${cleanAttributes}>`;
      },
    );

    const tags = extractTags(formattedContent);
    const timeBoundStatus = determineTimeBoundStatus(formattedContent);

    const timestamp = Date.now();
    const noteRecord = {
      id: timestamp.toString(),
      content: formattedContent,
      timestamp,
      fridgeId,
      fridgeName,
      source: "ios_shortcut",
      tags,
      timeBoundStatus,
      hasTimeElements: timeBoundStatus !== "normal",
      sender: body.sender || "iPhone",
    };

    let noteId = noteRecord.id;

    if (isTBTBuild) {
      const created = await tbtStorage.addNote(noteRecord);
      noteId = created.id;
    } else {
      await appendNote(fridgeId, noteRecord, { keep: 20 });
      noteId = noteRecord.id;
    }

    console.log("✅ Note saved successfully with ID:", noteId);

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      noteId,
      fridgeId,
      fridgeName,
      tags,
      timeBoundStatus,
      hasTimeElements: timeBoundStatus !== "normal",
      build: isTBTBuild ? "TBT" : "PROD",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return res.status(500).json({
      error: "Failed to process note",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

function generateFridgeId(fridgeName) {
  let hash = 0;
  const str = fridgeName.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "fridge_" + Math.abs(hash).toString(36);
}

function extractTags(content) {
  const tags = [];
  const tagMatches = content.match(/<p[^>]*>\s*#(dad|mom|jess)\s*<\/p>/gi);

  if (tagMatches) {
    tagMatches.forEach((match) => {
      const tagMatch = match.match(/#(dad|mom|jess)/i);
      if (tagMatch) {
        const cleanTag = tagMatch[1].toLowerCase();
        if (!tags.includes(cleanTag)) {
          tags.push(cleanTag);
        }
      }
    });
  }

  return tags;
}

function determineTimeBoundStatus(content) {
  const now = new Date();

  if (
    content.includes("priority-urgent") ||
    content.includes("priority-critical")
  ) {
    return "urgent";
  }

  const timeMatch = content.match(
    /data-due-time="@(\d{1,2})(:\d{2})?(am|pm|AM|PM)"/i,
  );
  const dateMatch = content.match(
    /data-due-date="@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})"/i,
  );
  const datetimeMatch = content.match(/data-due-datetime="[^"]+"/i);

  if (timeMatch || dateMatch || datetimeMatch) {
    const dueDateTime = parseDueDateTime(timeMatch, dateMatch, datetimeMatch);
    if (dueDateTime) {
      const timeDiff = dueDateTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (timeDiff < 0) return "overdue";
      if (hoursDiff < 1) return "due-soon";
      if (hoursDiff < 24) return "upcoming";
    }
    return "time-bound";
  }

  if (content.includes("data-timer=")) {
    return "timer";
  }

  if (content.includes("data-recurring=")) {
    return "recurring";
  }

  return "normal";
}

function parseDueDateTime(timeMatch, dateMatch, datetimeMatch) {
  const now = new Date();
  let targetDate = new Date();

  if (datetimeMatch) {
    const datetimeStr = datetimeMatch[0].match(
      /data-due-datetime="([^"]+)"/,
    )[1];
    const parts = datetimeStr.split(" ");
    if (parts.length >= 2) {
      const datePart = parts[0];
      const timePart = parts[1].replace("@", "");

      if (datePart.includes("tomorrow")) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const timeParseMatch = timePart.match(/(\d{1,2})(:\d{2})?(am|pm)/i);
      if (timeParseMatch) {
        let hours = parseInt(timeParseMatch[1]);
        const minutes = timeParseMatch[2]
          ? parseInt(timeParseMatch[2].slice(1))
          : 0;
        const ampm = timeParseMatch[3].toLowerCase();

        if (ampm === "pm" && hours !== 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;

        targetDate.setHours(hours, minutes, 0, 0);
      }

      return targetDate;
    }
  }

  if (dateMatch) {
    const dateStr = dateMatch[1].toLowerCase();
    if (dateStr === "today") {
      targetDate = new Date();
    } else if (dateStr === "tomorrow") {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      targetDate = new Date(dateStr);
    } else {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const targetDay = days.indexOf(dateStr);
      if (targetDay !== -1) {
        targetDate = new Date();
        const currentDay = targetDate.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (daysUntilTarget || 7));
      }
    }
  }

  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
    const ampm = timeMatch[3].toLowerCase();

    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    targetDate.setHours(hours, minutes, 0, 0);
  } else if (!dateMatch) {
    targetDate.setHours(9, 0, 0, 0);
  }

  return targetDate;
}
