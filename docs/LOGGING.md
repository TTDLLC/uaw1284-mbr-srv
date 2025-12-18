# Logging & Monitoring

The server emits structured JSON logs using [Pino](https://github.com/pinojs/pino). Every request log entry contains:

- `requestId` – generated per request and propagated across logs
- `method`, `url`, `statusCode`, `ip`, `userAgent`
- `userId` (when the session is authenticated)

## Configuration

Environment variables control the logger:

| Variable | Description |
| --- | --- |
| `LOG_LEVEL` | Minimum log level (`debug`, `info`, `warn`, `error`). |
| `LOG_DESTINATION` | `stdout` (default) for log shipping, or `file` to write rotated files. |
| `LOG_FILE_DIR` | Directory for rotated logs (default `./logs`). |
| `LOG_FILE_NAME` | Basename for rotated files (default `app.log`). |
| `LOG_FILE_ROTATION` | Rotation interval passed to `rotating-file-stream` (default `1d`). |
| `LOG_FILE_MAX_FILES` | How many rotated files to keep (default `14`). |

Sensitive data (passwords, tokens, cookies, auth headers) is automatically redacted before logs are written.

## Shipping / Rotation

- **Containerized / cloud deployments**: leave `LOG_DESTINATION=stdout` and forward logs with the platform’s collector (CloudWatch, Stackdriver, etc.).  
- **Bare-metal / VM deployments**: set `LOG_DESTINATION=file` to write JSON logs under `LOG_FILE_DIR`. Files rotate automatically using the configured interval and retention; feed the directory into `logrotate`, `filebeat`, or similar tools for shipping to your SIEM.

Always verify logging after configuration changes by starting the server and ensuring request logs contain the required fields.
