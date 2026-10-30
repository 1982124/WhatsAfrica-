#!/usr/bin/env python3
"""Fail only on newly introduced HTML integrity findings in changed HTML files."""
from __future__ import annotations

import collections
import pathlib
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit

ROOT = pathlib.Path(".").resolve()


def git_text(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True, stderr=subprocess.PIPE)


def git_file(revision: str, path: str) -> str | None:
    try:
        return git_text("show", f"{revision}:{path}")
    except subprocess.CalledProcessError:
        return None


class IntegrityParser(HTMLParser):
    def __init__(self, relative_path: str):
        super().__init__(convert_charrefs=True)
        self.relative_path = relative_path
        self.findings: list[tuple[str, str, int]] = []
        self.ids: collections.Counter[str] = collections.Counter()
        self.img_sources: collections.Counter[str] = collections.Counter()

    def add(self, kind: str, value: str) -> None:
        self.findings.append((kind, value, self.getpos()[0]))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        element_id = attrs_dict.get("id")
        if element_id:
            self.ids[element_id] += 1
            if self.ids[element_id] > 1:
                self.add("duplicate-id", f"{element_id}#{self.ids[element_id]}")

        if tag.lower() != "img":
            return

        src = (attrs_dict.get("src") or "").strip()
        if not src:
            self.add("img-empty-src", f"image#{len(self.img_sources) + len(self.findings) + 1}")
            return

        # Compare canonical image identity, not just the literal URL: query strings,
        # width variants, and format parameters must not allow the same photo twice.
        parsed = urlsplit(src)
        pexels_match = re.search(r"/photos/(\d+)(?:/|$)", parsed.path)
        if pexels_match:
            image_key = f"pexels:{pexels_match.group(1)}"
        elif parsed.scheme or parsed.netloc or src.startswith("//"):
            image_key = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")
        else:
            image_key = parsed.path
        self.img_sources[image_key] += 1
        if self.img_sources[image_key] > 1:
            self.add("duplicate-image-src", f"{image_key}#{self.img_sources[image_key]}")

        if "alt" not in attrs_dict:
            self.add("img-missing-alt", f"{src}#{self.img_sources[src]}")

        parsed = urlsplit(src)
        if parsed.scheme or parsed.netloc or src.startswith("//") or src.startswith("data:"):
            return
        if "{" in parsed.path or "}" in parsed.path:
            return

        # Only validate file-like local image paths; route URLs and runtime-generated URLs
        # are deliberately outside this static integrity check.
        candidate = (ROOT / parsed.path.lstrip("/")) if parsed.path.startswith("/") else (
            ROOT / pathlib.Path(self.relative_path).parent / parsed.path
        )
        if pathlib.PurePosixPath(parsed.path).suffix.lower() in {
            ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"
        } and not candidate.resolve().is_file():
            self.add("img-missing-local-asset", parsed.path)


def inspect(relative_path: str, content: str) -> list[tuple[str, str, int]]:
    parser = IntegrityParser(relative_path)
    try:
        parser.feed(content)
        parser.close()
    except Exception as exc:  # malformed HTML should not hide parser findings
        parser.add("html-parse-error", type(exc).__name__)
    return parser.findings


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/wassafrica-regression-diff.py <base-sha> <head-sha>")
        return 2

    base, head = sys.argv[1], sys.argv[2]
    try:
        changed = git_text(
            "diff", "--name-only", "--diff-filter=ACMRT", base, head, "--", "*.html"
        ).splitlines()
    except subprocess.CalledProcessError as exc:
        print(f"Cannot compute HTML diff ({base}...{head}): {exc}")
        return 2

    if not changed:
        print("PASS: no HTML files changed; HTML integrity gate not applicable.")
        return 0

    regressions: list[tuple[str, str, str, int]] = []
    baseline_count = 0
    checked = 0

    for relative_path in changed:
        current_path = ROOT / relative_path
        if not current_path.is_file():
            continue
        head_content = current_path.read_text(encoding="utf-8", errors="replace")
        base_content = git_file(base, relative_path)
        before = inspect(relative_path, base_content) if base_content is not None else []
        after = inspect(relative_path, head_content)
        before_signatures = {(kind, value) for kind, value, _ in before}
        baseline_count += len(before)
        checked += 1
        for kind, value, line in after:
            if (kind, value) not in before_signatures:
                regressions.append((relative_path, kind, value, line))

    print(f"Changed HTML files checked: {checked}")
    print(f"Existing baseline findings in those files: {baseline_count}")
    print(f"New integrity regressions: {len(regressions)}")
    for path, kind, value, line in regressions:
        print(f"::error file={path},line={line}::[{kind}] {value}")

    if regressions:
        print("FAIL: resolve newly introduced HTML integrity findings before merge.")
        return 1

    print("PASS: no new duplicate IDs, repeated image sources, missing alt attributes, empty image sources, or missing local image assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
