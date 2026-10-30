#!/usr/bin/env python3
"""Print the text of an Apple Pages document, no dependencies.

A .pages file is a zip; its text lives in Index/Document.iwa, a snappy-framed protobuf.
This decompresses the frames (a small snappy decoder, not a library) and prints the
readable strings in document order, which is enough for a recipe importer to work from.
Treat the input as untrusted: run with `python3 -I tools/pages-text.py <file.pages>`.

Written in Phase 1 to read the chili lineage; the Phase 2 importer runbook uses it.
"""
from __future__ import annotations

import re
import sys
import zipfile


def snappy_decompress(data: bytes) -> bytes:
    i = 0
    while data[i] & 0x80:  # varint: uncompressed length, unused
        i += 1
    i += 1
    out = bytearray()
    n = len(data)
    while i < n:
        tag = data[i]
        i += 1
        kind = tag & 3
        if kind == 0:
            length = tag >> 2
            if length < 60:
                length += 1
            else:
                nbytes = length - 59
                length = int.from_bytes(data[i : i + nbytes], "little") + 1
                i += nbytes
            out += data[i : i + length]
            i += length
            continue
        if kind == 1:
            length = ((tag >> 2) & 7) + 4
            offset = ((tag >> 5) << 8) | data[i]
            i += 1
        elif kind == 2:
            length = (tag >> 2) + 1
            offset = int.from_bytes(data[i : i + 2], "little")
            i += 2
        else:
            length = (tag >> 2) + 1
            offset = int.from_bytes(data[i : i + 4], "little")
            i += 4
        start = len(out) - offset
        for k in range(length):
            out.append(out[start + k])
    return bytes(out)


def iwa_text(blob: bytes) -> bytes:
    chunks = []
    i = 0
    while i < len(blob):
        kind = blob[i]
        length = int.from_bytes(blob[i + 1 : i + 4], "little")
        i += 4
        chunk = blob[i : i + length]
        i += length
        chunks.append(snappy_decompress(chunk) if kind == 0 else chunk)
    return b"".join(chunks)


STRINGS = re.compile(rb"[\x20-\x7e\xc2-\xf4][\x20-\x7e\x80-\xbf\xc2-\xf4\n\t]{3,}")
LEADING_JUNK = re.compile(r"^[^\w#(\[\u00c0-\uffff]+")
TRAILING_JUNK = re.compile(r"[^\w.)!?\]\u00c0-\uffff]+$")

# A Pages body is stored as one text storage, which surfaces here as a single long run
# with its own newlines; everything else in the file is short template strings (calendar
# names, number formats, style ids). So the document's text is simply the long runs.
MIN_BODY_CHARS = 200


def main(path: str) -> int:
    with zipfile.ZipFile(path) as z:
        try:
            raw = z.read("Index/Document.iwa")
        except KeyError:
            print(f"{path}: no Index/Document.iwa; is this a Pages file?", file=sys.stderr)
            return 1
    text = iwa_text(raw)
    runs = [m.group().decode("utf-8", "ignore") for m in STRINGS.finditer(text)]
    bodies = [
        TRAILING_JUNK.sub("", LEADING_JUNK.sub("", r)).strip() for r in runs if len(r) >= MIN_BODY_CHARS
    ]
    if not bodies:
        print(f"{path}: no text storage of {MIN_BODY_CHARS}+ characters found", file=sys.stderr)
        return 1
    print("\n\n".join(bodies))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python3 -I tools/pages-text.py <file.pages>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
