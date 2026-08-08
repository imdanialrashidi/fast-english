// server/pb_hooks/content_import_core.pb.js
// Podcast Slice 3 — server-side content-import core helpers.
//
// Mirrors the shared pipeline contract (shared/content-package/*):
//   - SHA-256 + canonical manifest + deterministic package fingerprint
//     (CLI/server parity is asserted by scripts/smoke-content-import.mjs);
//   - MP3 / M4A duration extraction (authoritative: duration is never
//     accepted from the manifest);
//   - transcript normalization (BOM, line endings, blank lines);
//   - structural manifest validation with stable codes;
//   - bounded, sanitized diagnostic serialization.
//
// PB 0.39 JSVM quirk: routerAdd handlers cannot see top-level
// declarations, so route files load this module with
// require(__hooks + '/content_import_core.pb.js'). The module is also
// installed on globalThis for consistency with the other hook modules.

try {
  $app.logger().info("content_import_core: hook file loaded");
} catch (_) {}

var __contentImportModule = (function () {
  var PACKAGE_SCHEMA_VERSION = "1.0.0";
  var CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  var ARTWORK_MAX = 5 * 1024 * 1024;
  var AUDIO_MAX = 10 * 1024 * 1024;
  var PRONUNCIATION_MAX = 2 * 1024 * 1024;
  var TRANSCRIPT_MAX_CHARS = 50000;
  var IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

  // ------------------------------------------------------------------
  // SHA-256 (mirror of shared/content-package/checksums.ts)
  // ------------------------------------------------------------------
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function sha256Compress(state, block) {
    var w = new Uint32Array(64);
    for (var i = 0; i < 16; i++) {
      w[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
    }
    for (var i2 = 16; i2 < 64; i2++) {
      var s0 = ((w[i2 - 15] >>> 7) | (w[i2 - 15] << 25)) ^ ((w[i2 - 15] >>> 18) | (w[i2 - 15] << 14)) ^ (w[i2 - 15] >>> 3);
      var s1 = ((w[i2 - 2] >>> 17) | (w[i2 - 2] << 15)) ^ ((w[i2 - 2] >>> 19) | (w[i2 - 2] << 13)) ^ (w[i2 - 2] >>> 10);
      w[i2] = (w[i2 - 16] + s0 + w[i2 - 7] + s1) | 0;
    }
    var a = state[0], b = state[1], c = state[2], d = state[3];
    var e = state[4], f = state[5], g = state[6], h = state[7];
    for (var i3 = 0; i3 < 64; i3++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + K[i3] + w[i3]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    state[0] = (state[0] + a) | 0;
    state[1] = (state[1] + b) | 0;
    state[2] = (state[2] + c) | 0;
    state[3] = (state[3] + d) | 0;
    state[4] = (state[4] + e) | 0;
    state[5] = (state[5] + f) | 0;
    state[6] = (state[6] + g) | 0;
    state[7] = (state[7] + h) | 0;
  }

  function sha256Hex(bytes) {
    var state = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    var len = bytes.length;
    var paddedLen = (((len + 8) >> 6) + 1) << 6;
    var padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[len] = 0x80;
    var bitLenHi = Math.floor(len / 0x20000000);
    var bitLenLo = len << 3;
    padded[paddedLen - 8] = (bitLenHi >>> 24) & 0xff;
    padded[paddedLen - 7] = (bitLenHi >>> 16) & 0xff;
    padded[paddedLen - 6] = (bitLenHi >>> 8) & 0xff;
    padded[paddedLen - 5] = bitLenHi & 0xff;
    padded[paddedLen - 4] = (bitLenLo >>> 24) & 0xff;
    padded[paddedLen - 3] = (bitLenLo >>> 16) & 0xff;
    padded[paddedLen - 2] = (bitLenLo >>> 8) & 0xff;
    padded[paddedLen - 1] = bitLenLo & 0xff;
    for (var off = 0; off < paddedLen; off += 64) {
      sha256Compress(state, padded.subarray(off, off + 64));
    }
    var out = "";
    for (var i = 0; i < 8; i++) {
      out += state[i].toString(16).padStart(8, "0");
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Canonical JSON + package fingerprint (mirror of checksums.ts)
  // ------------------------------------------------------------------
  function canonicalJson(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      var parts = [];
      for (var i = 0; i < value.length; i++) parts.push(canonicalJson(value[i]));
      return "[" + parts.join(",") + "]";
    }
    var keys = Object.keys(value).sort();
    var out = [];
    for (var j = 0; j < keys.length; j++) {
      out.push(JSON.stringify(keys[j]) + ":" + canonicalJson(value[keys[j]]));
    }
    return "{" + out.join(",") + "}";
  }

  function packageFingerprint(manifestCanonical, assets) {
    var sorted = assets.slice().sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    var lines = [];
    for (var i = 0; i < sorted.length; i++) {
      lines.push(sorted[i].path + "\u0000" + sorted[i].sizeBytes + "\u0000" + sorted[i].sha256);
    }
    var input = "fep-episode-package-v1\n" + manifestCanonical + "\n" + lines.join("\n");
    return sha256Hex(utf8Bytes(input));
  }

  function planStateHash(state) {
    var canonical = canonicalJson({
      contentKey: state.contentKey,
      episode: state.episode,
      variants: state.variants,
      categoryExists: state.categoryExists,
    });
    return sha256Hex(utf8Bytes("fep-plan-state-v1\n" + canonical));
  }

  // ------------------------------------------------------------------
  // UTF-8 helpers
  // ------------------------------------------------------------------
  function utf8Bytes(str) {
    var encoded = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        encoded.push(code);
      } else if (code < 0x800) {
        encoded.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          var combined = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          encoded.push(0xf0 | (combined >> 18), 0x80 | ((combined >> 12) & 0x3f), 0x80 | ((combined >> 6) & 0x3f), 0x80 | (combined & 0x3f));
          i++;
        } else {
          encoded.push(0xef, 0xbf, 0xbd);
        }
      } else if (code >= 0xd800 && code <= 0xdfff) {
        encoded.push(0xef, 0xbf, 0xbd);
      } else if (code < 0x10000) {
        encoded.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        encoded.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return new Uint8Array(encoded);
  }

  // Decode UTF-8 bytes; invalid sequences become U+FFFD. Bounded: the
  // input length is already capped by the transcript limit.
  function utf8Decode(bytes) {
    var out = "";
    var i = 0;
    var n = bytes.length;
    while (i < n) {
      var b0 = bytes[i];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
        i++;
      } else if ((b0 & 0xe0) === 0xc0 && i + 1 < n && (bytes[i + 1] & 0xc0) === 0x80) {
        out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if ((b0 & 0xf0) === 0xe0 && i + 2 < n && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80) {
        out += String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
        i += 3;
      } else if ((b0 & 0xf8) === 0xf0 && i + 3 < n && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80 && (bytes[i + 3] & 0xc0) === 0x80) {
        var cp = ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        if (cp >= 0x10000 && cp <= 0x10ffff) {
          var s = cp - 0x10000;
          out += String.fromCharCode(0xd800 + (s >> 10), 0xdc00 + (s & 0x3ff));
        } else {
          out += "\ufffd";
        }
        i += 4;
      } else {
        out += "\ufffd";
        i++;
      }
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Transcript normalization (mirror of shared normalize.ts)
  // ------------------------------------------------------------------
  function normalizeTranscriptText(raw) {
    var text = String(raw).replace(/^\uFEFF/, "");
    text = text.replace(/\r\n?/g, "\n");
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) lines[i] = lines[i].replace(/[ \t]+$/, "");
    text = lines.join("\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/^\n+|\n+$/g, "");
    return text;
  }

  function transcriptIsEffectivelyEmpty(normalized) {
    var lines = normalized.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.length > 0 && !/^#{1,6}\s+/.test(line)) return false;
    }
    return true;
  }

  var TRANSCRIPT_FORBIDDEN = [
    { code: "TRANSCRIPT_EMBEDDED_SCRIPT", pattern: /<script[\s>]/i },
    { code: "TRANSCRIPT_EMBEDDED_SCRIPT", pattern: /<iframe[\s>]/i },
    { code: "TRANSCRIPT_EMBEDDED_SCRIPT", pattern: /<object[\s>]/i },
    { code: "TRANSCRIPT_EMBEDDED_SCRIPT", pattern: /<embed[\s>]/i },
    { code: "TRANSCRIPT_UNSAFE_LINK", pattern: /javascript:/i },
  ];

  // ------------------------------------------------------------------
  // Audio duration (mirror of scripts/content/assets.mjs)
  // ------------------------------------------------------------------
  var MPEG_SAMPLE_RATES = [44100, 48000, 32000, 0];
  var MPEG1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  var MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

  function mp3DurationSeconds(bytes) {
    var off = 0;
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      var size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
      var footer = bytes[5] & 0x10 ? 10 : 0;
      off = 10 + size + footer;
    }
    var MAX_FRAMES = 200000;
    var pos = off;
    var frames = 0;
    var vbrFrames = 0;
    var firstHeader = null;
    var n = bytes.length;
    while (pos + 4 <= n && frames < MAX_FRAMES) {
      while (pos + 4 <= n && !(bytes[pos] === 0xff && (bytes[pos + 1] & 0xe0) === 0xe0)) pos++;
      if (pos + 4 > n) break;
      var b1 = bytes[pos + 1];
      var b2 = bytes[pos + 2];
      var b3 = bytes[pos + 3];
      var version = (b1 >> 3) & 0x03;
      var layerBits = (b1 >> 1) & 0x03;
      var bitrateIdx = (b2 >> 4) & 0x0f;
      var sampleIdx = (b2 >> 2) & 0x03;
      var padding = (b2 >> 1) & 0x01;
      if (version === 1 || layerBits === 0 || bitrateIdx === 0 || bitrateIdx === 15 || sampleIdx === 3) {
        pos++;
        continue;
      }
      var mpeg1 = version === 3;
      var layer = 4 - layerBits;
      var bitrateKbps = mpeg1 ? MPEG1_BITRATES[bitrateIdx] : MPEG2_BITRATES[bitrateIdx];
      var sampleRate = mpeg1 ? MPEG_SAMPLE_RATES[sampleIdx] : MPEG_SAMPLE_RATES[sampleIdx] / 2;
      if (!bitrateKbps || !sampleRate) { pos++; continue; }
      var samplesPerFrame = layer === 3 ? (mpeg1 ? 1152 : 576) : layer === 2 ? 1152 : 384;
      var frameLen = Math.floor((mpeg1 ? 144 : 72) * bitrateKbps * 1000 / sampleRate) + padding;
      if (frameLen < 24 || frameLen > 5000) { pos++; continue; }
      if (!firstHeader) {
        firstHeader = { samplesPerFrame: samplesPerFrame, sampleRate: sampleRate };
        var payloadOff = pos + 4;
        if (payloadOff + 8 <= n) {
          var tag = String.fromCharCode(bytes[payloadOff], bytes[payloadOff + 1], bytes[payloadOff + 2], bytes[payloadOff + 3]);
          if (tag === "Xing" || tag === "Info") {
            var flags = (bytes[payloadOff + 4] << 24) | (bytes[payloadOff + 5] << 16) | (bytes[payloadOff + 6] << 8) | bytes[payloadOff + 7];
            var vpos = payloadOff + 8;
            if ((flags & 0x01) && vpos + 4 <= n) {
              vbrFrames = (bytes[vpos] << 24) | (bytes[vpos + 1] << 16) | (bytes[vpos + 2] << 8) | bytes[vpos + 3];
            }
          } else if (tag === "VBRI" && payloadOff + 18 <= n) {
            vbrFrames = (bytes[payloadOff + 14] << 24) | (bytes[payloadOff + 15] << 16) | (bytes[payloadOff + 16] << 8) | bytes[payloadOff + 17];
          }
        }
      }
      frames++;
      pos += frameLen;
    }
    if (!firstHeader) return 0;
    var total = vbrFrames > 0 ? vbrFrames : frames;
    if (total <= 0) return 0;
    return Math.round((total * firstHeader.samplesPerFrame) / firstHeader.sampleRate);
  }

  function mp4DurationSeconds(bytes) {
    var pos = 0;
    var n = bytes.length;
    while (pos + 8 <= n) {
      var size = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
      var type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      var boxEnd = size > 0 ? pos + size : n;
      if (type === "moov" && boxEnd > pos + 8) {
        var p = pos + 8;
        while (p + 8 <= boxEnd && p < n) {
          var childSize = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
          var childType = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
          if (childType === "mvhd" && childSize >= 32 && p + 32 <= n) {
            var version = bytes[p + 8];
            if (version === 1) {
              var ts1 = (bytes[p + 20] << 24) | (bytes[p + 21] << 16) | (bytes[p + 22] << 8) | bytes[p + 23];
              var durHi = (bytes[p + 24] << 24) | (bytes[p + 25] << 16) | (bytes[p + 26] << 8) | bytes[p + 27];
              var durLo = (bytes[p + 28] << 24) | (bytes[p + 29] << 16) | (bytes[p + 30] << 8) | bytes[p + 31];
              if (ts1 > 0) return Math.round((durHi * 0x100000000 + durLo) / ts1);
            } else if (p + 24 <= n) {
              var ts2 = (bytes[p + 12] << 24) | (bytes[p + 13] << 16) | (bytes[p + 14] << 8) | bytes[p + 15];
              var dur2 = (bytes[p + 16] << 24) | (bytes[p + 17] << 16) | (bytes[p + 18] << 8) | bytes[p + 19];
              if (ts2 > 0) return Math.round(dur2 / ts2);
            }
            return 0;
          }
          if (childSize < 8) break;
          p += childSize;
        }
      }
      if (size <= 0) break;
      pos = boxEnd;
    }
    return 0;
  }

  // ------------------------------------------------------------------
  // Structural manifest validation (server-side, authoritative)
  // ------------------------------------------------------------------
  function assetPathSafe(path) {
    if (typeof path !== "string" || path.length === 0 || path.length > 200) return false;
    if (path.indexOf("\u0000") >= 0) return false;
    if (path.indexOf("\\") >= 0) return false;
    if (path.indexOf("/") === 0) return false;
    if (/^[A-Za-z]:/.test(path)) return false;
    if (path.indexOf("//") === 0) return false;
    if (path.indexOf("%2e%2e") >= 0 || path.indexOf("%2E%2E") >= 0) return false;
    var segments = path.split("/");
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (seg === ".." || seg === "." || seg === "") return false;
    }
    return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path);
  }

  function normalizeVocabularyTerm(term) {
    var s = typeof term === "string" ? term : String(term || "");
    s = s.replace(/^\s+|\s+$/g, "");
    s = s.replace(/\s+/g, " ");
    return s.toLowerCase();
  }

  function isNormalizedLevel(level) {
    for (var i = 0; i < CEFR_LEVELS.length; i++) if (CEFR_LEVELS[i] === level) return true;
    return false;
  }

  /**
   * Validates the parsed manifest. Returns { ok, errors: [{code, path,
   * message}] } — never throws. The CLI's JSON Schema validation is the
   * editor-facing gate; this structural check is the server's own
   * authoritative revalidation of identity, paths and duplicate rules.
   */
  function validateManifestStruct(manifest) {
    var errors = [];
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      return { ok: false, errors: [{ code: "MANIFEST_INVALID_JSON", path: "$", message: "Manifest must be a JSON object." }] };
    }
    if (manifest.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
      errors.push({ code: "SCHEMA_VERSION_UNSUPPORTED", path: "schemaVersion", message: "Unsupported schemaVersion (expected 1.0.0)." });
    }
    var contentKey = typeof manifest.contentKey === "string" ? manifest.contentKey : "";
    var categoryKey = typeof manifest.categoryKey === "string" ? manifest.categoryKey : "";
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(contentKey) || contentKey.length < 3 || contentKey.length > 160) {
      errors.push({ code: "CONTENT_KEY_INVALID", path: "contentKey", message: "contentKey must match ^[a-z0-9][a-z0-9._-]*$ (3..160 chars)." });
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(categoryKey) || categoryKey.length < 1 || categoryKey.length > 80) {
      errors.push({ code: "CATEGORY_KEY_INVALID", path: "categoryKey", message: "categoryKey must match ^[a-z0-9][a-z0-9_-]*$." });
    }
    var cv = manifest.contentVersion;
    if (typeof cv !== "number" || !Number.isInteger(cv) || cv < 1 || cv > 100000) {
      errors.push({ code: "CONTENT_VERSION_INVALID", path: "contentVersion", message: "contentVersion must be a positive integer." });
    }
    var ep = manifest.episode;
    if (!ep || typeof ep !== "object") {
      errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode", message: "Episode object is required." });
    } else {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(ep.slug || "")) || String(ep.slug || "").length < 2 || String(ep.slug || "").length > 120) {
        errors.push({ code: "EPISODE_SLUG_INVALID", path: "episode.slug", message: "Episode slug must match ^[a-z0-9]+(-[a-z0-9]+)*$." });
      }
      if (!ep.titleEn || !String(ep.titleEn).trim() || String(ep.titleEn).length > 120) {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.titleEn", message: "titleEn is required (<= 120 chars)." });
      }
      if (!ep.titleFa || !String(ep.titleFa).trim() || String(ep.titleFa).length > 200) {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.titleFa", message: "titleFa is required (<= 200 chars)." });
      }
      if (!ep.descriptionFa || !String(ep.descriptionFa).trim() || String(ep.descriptionFa).length > 2000) {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.descriptionFa", message: "descriptionFa is required (<= 2000 chars)." });
      }
      if (!ep.artworkSquare || !assetPathSafe(ep.artworkSquare)) {
        errors.push({ code: "ASSET_PATH_UNSAFE", path: "episode.artworkSquare", message: "artworkSquare must be a safe package-relative path." });
      }
      if (ep.heroImageWide && !assetPathSafe(ep.heroImageWide)) {
        errors.push({ code: "ASSET_PATH_UNSAFE", path: "episode.heroImageWide", message: "heroImageWide must be a safe package-relative path." });
      }
      if (!ep.artworkAltFa || !String(ep.artworkAltFa).trim() || String(ep.artworkAltFa).length > 500) {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.artworkAltFa", message: "artworkAltFa is required (<= 500 chars)." });
      }
      if (ep.episodeNumber !== undefined && ep.episodeNumber !== null && (typeof ep.episodeNumber !== "number" || !Number.isInteger(ep.episodeNumber) || ep.episodeNumber < 1)) {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.episodeNumber", message: "episodeNumber must be a positive integer." });
      }
      if (ep.featured !== undefined && typeof ep.featured !== "boolean") {
        errors.push({ code: "EPISODE_FIELDS_INVALID", path: "episode.featured", message: "featured must be a boolean." });
      }
      if (contentKey && categoryKey && ep.slug && contentKey !== categoryKey + "." + ep.slug) {
        errors.push({ code: "CONTENT_KEY_MISMATCH", path: "contentKey", message: "contentKey must equal '<categoryKey>.<episode.slug>'." });
      }
    }
    var variants = manifest.variants;
    if (!Array.isArray(variants) || variants.length < 1 || variants.length > 6) {
      errors.push({ code: "VARIANT_COUNT_INVALID", path: "variants", message: "One to six Variants are required." });
    } else {
      var seenLevels = {};
      var allAudioPaths = {};
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var vPath = "variants[" + i + "]";
        if (!v || typeof v !== "object") {
          errors.push({ code: "VARIANT_FIELDS_INVALID", path: vPath, message: "Variant must be an object." });
          continue;
        }
        if (!isNormalizedLevel(v.level)) {
          errors.push({ code: "VARIANT_LEVEL_INVALID", path: vPath + ".level", message: "Level must be one of A1..C2." });
        } else if (seenLevels[v.level]) {
          errors.push({ code: "VARIANT_LEVEL_DUPLICATE", path: vPath + ".level", message: "Level " + v.level + " appears more than once." });
        }
        seenLevels[v.level] = true;
        if (!v.summaryFa || !String(v.summaryFa).trim() || String(v.summaryFa).length > 500) {
          errors.push({ code: "VARIANT_FIELDS_INVALID", path: vPath + ".summaryFa", message: "summaryFa is required (<= 500 chars)." });
        }
        if (!assetPathSafe(v.audio)) {
          errors.push({ code: "ASSET_PATH_UNSAFE", path: vPath + ".audio", message: "audio must be a safe package-relative path." });
        } else {
          if (allAudioPaths[v.audio]) {
            errors.push({ code: "AUDIO_PATH_REUSED", path: vPath + ".audio", message: "The same audio file is used by more than one Variant." });
          }
          allAudioPaths[v.audio] = true;
        }
        if (!assetPathSafe(v.transcript)) {
          errors.push({ code: "ASSET_PATH_UNSAFE", path: vPath + ".transcript", message: "transcript must be a safe package-relative path." });
        }
        var vocab = v.vocabulary;
        if (!Array.isArray(vocab)) {
          errors.push({ code: "VOCAB_FIELDS_INVALID", path: vPath + ".vocabulary", message: "vocabulary must be an array." });
        } else if (vocab.length > 100) {
          // Mirrors schemas/episode-package.schema.json (maxItems: 100).
          errors.push({ code: "VOCAB_COUNT_INVALID", path: vPath + ".vocabulary", message: "vocabulary must not exceed 100 entries." });
        } else {
          var seenTerms = {};
          for (var j = 0; j < vocab.length; j++) {
            var entry = vocab[j];
            var ePath = vPath + ".vocabulary[" + j + "]";
            if (!entry || typeof entry !== "object") {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath, message: "Vocabulary entry must be an object." });
              continue;
            }
            if (!entry.term || !String(entry.term).trim() || String(entry.term).length > 200) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".term", message: "term is required (<= 200 chars)." });
            } else {
              var norm = normalizeVocabularyTerm(entry.term);
              if (seenTerms[norm]) {
                errors.push({ code: "VOCAB_TERM_DUPLICATE", path: ePath + ".term", message: "Duplicate vocabulary term \"" + entry.term + "\"." });
              }
              seenTerms[norm] = true;
            }
            if (!entry.meaningFa || !String(entry.meaningFa).trim() || String(entry.meaningFa).length > 500) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".meaningFa", message: "meaningFa is required (<= 500 chars)." });
            }
            if (!entry.definitionEn || !String(entry.definitionEn).trim() || String(entry.definitionEn).length > 500) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".definitionEn", message: "definitionEn is required (<= 500 chars)." });
            }
            if (entry.phonetic && String(entry.phonetic).length > 200) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".phonetic", message: "phonetic is too long." });
            }
            if (entry.partOfSpeech && String(entry.partOfSpeech).length > 50) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".partOfSpeech", message: "partOfSpeech is too long." });
            }
            if (entry.exampleSentence && String(entry.exampleSentence).length > 1000) {
              errors.push({ code: "VOCAB_FIELDS_INVALID", path: ePath + ".exampleSentence", message: "exampleSentence is too long." });
            }
            if (entry.pronunciationAudio && !assetPathSafe(entry.pronunciationAudio)) {
              errors.push({ code: "ASSET_PATH_UNSAFE", path: ePath + ".pronunciationAudio", message: "pronunciationAudio must be a safe package-relative path." });
            }
          }
        }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Collects the declared asset set from a valid manifest:
   * { path -> kind } where kind is artworkSquare | heroImageWide |
   * audio | transcript | pronunciationAudio.
   */
  function declaredAssets(manifest) {
    var declared = {};
    declared[manifest.episode.artworkSquare] = "artworkSquare";
    if (manifest.episode.heroImageWide) declared[manifest.episode.heroImageWide] = "heroImageWide";
    for (var i = 0; i < manifest.variants.length; i++) {
      var v = manifest.variants[i];
      declared[v.audio] = "audio";
      declared[v.transcript] = "transcript";
      for (var j = 0; j < v.vocabulary.length; j++) {
        var e = v.vocabulary[j];
        if (e.pronunciationAudio) declared[e.pronunciationAudio] = "pronunciationAudio";
      }
    }
    return declared;
  }

  // ------------------------------------------------------------------
  // Sanitized diagnostics (mirror of shared serialize.ts)
  // ------------------------------------------------------------------
  var SECRET_PATTERNS = [/password/i, /authorization/i, /bearer\s+[a-z0-9._-]{8,}/i, /token/i, /encryption_key/i];
  var PATH_PATTERNS = [/\/var\//, /\/tmp\//, /\/home\//, /storage\//, /pb_data/, /[A-Za-z]:\\/];
  var MAX_DIAGNOSTICS = 50;
  var MAX_MESSAGE_CHARS = 500;

  function sanitizeDiagnostics(diagnostics) {
    var out = [];
    var count = diagnostics && diagnostics.length ? diagnostics.length : 0;
    if (count > MAX_DIAGNOSTICS) count = MAX_DIAGNOSTICS;
    for (var i = 0; i < count; i++) {
      var entry = diagnostics[i];
      if (!entry) continue;
      var clean = function (value) {
        if (!value) return value;
        var s = String(value).slice(0, MAX_MESSAGE_CHARS);
        var bad = false;
        for (var a = 0; a < SECRET_PATTERNS.length && !bad; a++) if (SECRET_PATTERNS[a].test(s)) bad = true;
        for (var b = 0; b < PATH_PATTERNS.length && !bad; b++) if (PATH_PATTERNS[b].test(s)) bad = true;
        return bad ? "[REDACTED]" : s;
      };
      var item = {
        code: String(entry.code || "UNKNOWN").slice(0, 80),
        severity: entry.severity === "warning" || entry.severity === "info" ? entry.severity : "error",
        path: clean(entry.path) || "",
        message: clean(entry.message) || "",
      };
      if (entry.suggestion) item.suggestion = clean(entry.suggestion);
      out.push(item);
    }
    return out;
  }

  return {
    PACKAGE_SCHEMA_VERSION: PACKAGE_SCHEMA_VERSION,
    CEFR_LEVELS: CEFR_LEVELS,
    ARTWORK_MAX: ARTWORK_MAX,
    AUDIO_MAX: AUDIO_MAX,
    PRONUNCIATION_MAX: PRONUNCIATION_MAX,
    TRANSCRIPT_MAX_CHARS: TRANSCRIPT_MAX_CHARS,
    IMAGE_MIME: IMAGE_MIME,
    sha256Hex: sha256Hex,
    canonicalJson: canonicalJson,
    packageFingerprint: packageFingerprint,
    planStateHash: planStateHash,
    utf8Bytes: utf8Bytes,
    utf8Decode: utf8Decode,
    normalizeTranscriptText: normalizeTranscriptText,
    transcriptIsEffectivelyEmpty: transcriptIsEffectivelyEmpty,
    TRANSCRIPT_FORBIDDEN: TRANSCRIPT_FORBIDDEN,
    mp3DurationSeconds: mp3DurationSeconds,
    mp4DurationSeconds: mp4DurationSeconds,
    assetPathSafe: assetPathSafe,
    normalizeVocabularyTerm: normalizeVocabularyTerm,
    isNormalizedLevel: isNormalizedLevel,
    validateManifestStruct: validateManifestStruct,
    declaredAssets: declaredAssets,
    sanitizeDiagnostics: sanitizeDiagnostics,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = __contentImportModule;
}
globalThis.__fepContentImport = __contentImportModule;
