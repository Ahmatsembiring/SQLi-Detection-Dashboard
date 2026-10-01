FROM python:3.12-slim
RUN pip install --no-cache-dir sqlmap
COPY run_sqlmap.sh /run_sqlmap.sh
RUN chmod +x /run_sqlmap.sh
ENTRYPOINT ["/run_sqlmap.sh"]
