# Security baseline

- Never commit secrets, tokens, or private keys. Use environment variables or a secret manager.
- Treat all external input as untrusted until validated and encoded appropriately.
- Prefer parameterized queries / prepared statements over string concatenation for SQL.
- For web apps: set secure cookie flags, CSRF protections where applicable, and safe Content Security Policy where owned.
- When unsure about a security-sensitive change, stop and ask for human review.
