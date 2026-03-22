#!/usr/bin/env python3
"""Generate questions_data.js from an Excel workbook (openpyxl)."""
import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Install: pip install openpyxl", file=sys.stderr)
    sys.exit(1)


def main():
    # Default workbook name (Polish filename is common for this project); override with argv[1].
    default = Path.home() / "Downloads" / "Konfiguracja testu AI z bazą pytań.xlsx"
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    if not xlsx.is_file():
        print(f"File not found: {xlsx}", file=sys.stderr)
        sys.exit(1)

    out_js = Path(__file__).resolve().parent / "questions_data.js"

    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    out = []
    for row in rows[1:]:
        if not row or row[0] is None:
            continue
        nr, question, options, key, sugg, expl = row[:6]
        out.append(
            {
                "id": int(nr) if not isinstance(nr, int) else nr,
                "text": str(question).strip(),
                "options": str(options).strip() if options else "",
                "key": str(key).strip().upper()[:1],
                "suggestion": str(sugg).strip().upper()[:1]
                if sugg
                else "",
                "explanation": str(expl).strip() if expl else "",
            }
        )

    with open(out_js, "w", encoding="utf-8") as f:
        f.write(
            "/** Generated — do not edit by hand; run: python3 generate_questions.py [path.xlsx] */\n"
        )
        f.write("export const QUESTIONS = ")
        f.write(json.dumps(out, ensure_ascii=False, indent=2))
        f.write(";\n")

    print(f"OK: {len(out)} questions -> {out_js}")


if __name__ == "__main__":
    main()
