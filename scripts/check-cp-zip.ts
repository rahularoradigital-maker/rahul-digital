// Runnable check for lib/creative-production/media/zip.ts (dependency-free STORE zip writer).
// Run: node --experimental-strip-types scripts/check-cp-zip.ts
import assert from "node:assert/strict";
import { makeZip, crc32 } from "../lib/creative-production/media/zip.ts";

const enc = new TextEncoder();

// 1) CRC32 matches the known ISO-HDLC value for "hello".
assert.equal(crc32(enc.encode("hello")), 0x3610a686, "crc32('hello')");
assert.equal(crc32(new Uint8Array(0)), 0, "crc32 of empty = 0");

// 2) A two-entry zip has the right signatures, entry count, and sizes.
const zip = makeZip([
  { name: "a.txt", data: enc.encode("hello") },
  { name: "dir/b.bin", data: new Uint8Array([1, 2, 3, 4]) },
]);
// local file header signature "PK\x03\x04"
assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], "starts with a local file header");
// end-of-central-directory signature "PK\x05\x06" is the last 22 bytes
const eocd = zip.slice(zip.length - 22);
assert.deepEqual([...eocd.slice(0, 4)], [0x50, 0x4b, 0x05, 0x06], "ends with EOCD");
const dv = new DataView(eocd.buffer, eocd.byteOffset, 22);
assert.equal(dv.getUint16(8, true), 2, "entries on disk = 2");
assert.equal(dv.getUint16(10, true), 2, "total entries = 2");
// central directory offset + size must land inside the buffer and end exactly at the EOCD.
const cdSize = dv.getUint32(12, true);
const cdOffset = dv.getUint32(16, true);
assert.equal(cdOffset + cdSize, zip.length - 22, "central dir sits right before the EOCD");
// central dir header signature "PK\x01\x02" at cdOffset
assert.deepEqual([...zip.slice(cdOffset, cdOffset + 4)], [0x50, 0x4b, 0x01, 0x02], "central dir header present");

// 3) The stored bytes are present verbatim (STORE, no compression): "hello" appears after the first header.
const text = new TextDecoder().decode(zip);
assert.ok(text.includes("hello"), "stored data is embedded uncompressed");
assert.ok(text.includes("dir/b.bin"), "nested path name embedded");

// 4) Deterministic: same input -> identical bytes (fixed DOS timestamp).
assert.deepEqual([...makeZip([{ name: "a.txt", data: enc.encode("hello") }])], [...makeZip([{ name: "a.txt", data: enc.encode("hello") }])], "deterministic");

// 5) Empty zip is just an EOCD with zero entries.
const empty = makeZip([]);
assert.equal(empty.length, 22);
assert.equal(new DataView(empty.buffer).getUint16(10, true), 0, "empty zip: 0 entries");

console.log("PASS: check-cp-zip");
