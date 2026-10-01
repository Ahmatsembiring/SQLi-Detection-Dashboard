"""Download the public datasets used in this project into ml/data/raw (reproducibility)."""
from __future__ import annotations

import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data/raw"

PALLT = "https://raw.githubusercontent.com/swisskyrepo/PayloadsAllTheThings/master/SQL%20Injection/Intruder/"
FUZZDB = "https://raw.githubusercontent.com/fuzzdb-project/fuzzdb/master/attack/sql-injection/detect/"
SOURCES = {
    # Labeled HTTP parameter values: normal (CSIC 2010 derived) + SQLi (sqlmap generated) + other attacks.
    "httpparams_payload_full.csv": "https://raw.githubusercontent.com/Morzeux/HttpParamsDataset/master/payload_full.csv",
    **{f"pallt_{n}": PALLT + n for n in [
        "Generic_ErrorBased.txt", "Generic_UnionSelect.txt", "Generic_TimeBased.txt",
        "Auth_Bypass.txt", "Auth_Bypass2.txt"]},
    "fuzzdb_generic.txt": FUZZDB + "GenericBlind.txt",
    "fuzzdb_mysql.txt": FUZZDB + "MySQL.txt",
    "fuzzdb_mssql.txt": FUZZDB + "MSSQL.txt",
    "fuzzdb_xplatform.txt": FUZZDB + "xplatform.txt",
}


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        target = RAW / name
        if target.exists():
            print(f"skip  {name}")
            continue
        urllib.request.urlretrieve(url, target)
        print(f"saved {name}")


if __name__ == "__main__":
    main()
