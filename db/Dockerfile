FROM postgres:16-alpine
# Log directory on a volume shared (read-only) with the log collector container.
RUN mkdir -p /var/log/postgresql && chown postgres:postgres /var/log/postgresql
COPY init/ /docker-entrypoint-initdb.d/
# Settings from postgresql-logging.conf (kept there with comments for documentation).
CMD ["postgres", "-c", "logging_collector=on", "-c", "log_destination=jsonlog", "-c", "log_directory=/var/log/postgresql", "-c", "log_filename=postgresql.log", "-c", "log_file_mode=0644", "-c", "log_rotation_age=0", "-c", "log_rotation_size=0", "-c", "log_statement=all", "-c", "log_parameter_max_length=-1", "-c", "log_parameter_max_length_on_error=-1", "-c", "log_min_error_statement=error", "-c", "log_timezone=UTC"]
