"""Gate line and branch coverage separately for the money/fraud core."""

import json
from pathlib import Path

report = json.loads(Path("coverage.json").read_text(encoding="utf-8"))
for suffix in ["banking/domain.py", "banking/money.py"]:
    data = next(
        value for key, value in report["files"].items() if key.replace("\\", "/").endswith(suffix)
    )
    summary = data["summary"]
    line = 100 * summary["covered_lines"] / summary["num_statements"]
    branch = (
        100 * summary["covered_branches"] / summary["num_branches"]
        if summary["num_branches"]
        else 100
    )
    print(f"{suffix}: lines={line:.1f}%, branches={branch:.1f}%")
    if min(line, branch) < 80:
        raise SystemExit("Core coverage is below the approved 80% line/branch threshold")
