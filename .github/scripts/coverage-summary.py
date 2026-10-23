"""Appends one service's line/branch coverage to the GitHub job summary.

usage: coverage-summary.py <jacoco|jest|pytest> <report file> <service>
  jacoco: target/site/jacoco/jacoco.csv
  jest:   coverage/coverage-summary.json
  pytest: coverage.json (pytest --cov-report=json)
"""
import csv
import json
import os
import sys


def pct(covered, total):
    return 100.0 * covered / total if total else 100.0


def main():
    kind, path, service = sys.argv[1:4]
    if kind == "jacoco":
        rows = list(csv.DictReader(open(path, encoding="utf-8")))
        lc = sum(int(r["LINE_COVERED"]) for r in rows)
        lm = sum(int(r["LINE_MISSED"]) for r in rows)
        bc = sum(int(r["BRANCH_COVERED"]) for r in rows)
        bm = sum(int(r["BRANCH_MISSED"]) for r in rows)
        lines, branches = pct(lc, lc + lm), pct(bc, bc + bm)
    elif kind == "jest":
        total = json.load(open(path, encoding="utf-8"))["total"]
        lines, branches = total["lines"]["pct"], total["branches"]["pct"]
    elif kind == "pytest":
        totals = json.load(open(path, encoding="utf-8"))["totals"]
        lines = totals["percent_covered"]
        nb = totals.get("num_branches", 0)
        branches = pct(totals.get("covered_branches", 0), nb) if nb else float("nan")
    else:
        raise SystemExit("unknown report kind: " + kind)

    line = f"| {service} | {lines:.1f}% | {branches:.1f}% |\n"
    print(line, end="")
    out = os.environ.get("GITHUB_STEP_SUMMARY")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write("| Service | Lines | Branches |\n|---|---|---|\n" + line)


if __name__ == "__main__":
    main()
