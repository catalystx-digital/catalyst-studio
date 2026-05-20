# Security Policy

## Reporting Vulnerabilities

Please report security issues privately by emailing the project maintainers or by using GitHub private vulnerability reporting if it is enabled for the repository.

Do not open a public issue for suspected vulnerabilities.

## Secrets

Never commit real API keys, OAuth secrets, database URLs, service tokens, private deployment hostnames, or production credentials. Use `.env.local` for local configuration and keep `.env.example` limited to placeholders.
