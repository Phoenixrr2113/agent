# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of AI Agent Platform seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT

- Open a public GitHub issue for security vulnerabilities
- Discuss the vulnerability in public forums, chat rooms, or social media

### Please DO

**Report security vulnerabilities via GitHub Security Advisories:**

1. Go to the [Security Advisories page](https://github.com/Phoenixrr2113/agent/security/advisories)
2. Click "Report a vulnerability"
3. Fill in the details of the vulnerability
4. Submit the advisory

**Alternatively, you can report via email:**

Create a GitHub issue with the tag `security` and provide:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### What to Include

When reporting a vulnerability, please include:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Triage**: Within 7 days
- **Fix Development**: Depends on severity
  - Critical: Within 7 days
  - High: Within 30 days
  - Medium: Within 90 days
  - Low: Best effort
- **Disclosure**: After fix is released

### Security Update Process

1. Vulnerability is reported and acknowledged
2. Vulnerability is confirmed and assessed
3. Fix is developed and tested
4. Security advisory is prepared
5. Fix is released
6. Security advisory is published

## Security Best Practices

When using AI Agent Platform:

### Deployment

- **Never expose the agent directly to the internet** without proper authentication
- Run the agent in **sandboxed environments** (containers, VMs)
- Use **environment variables** for sensitive configuration (API keys, etc.)
- Enable **shell command restrictions** in production environments
- Implement **rate limiting** on API endpoints
- Use **HTTPS** for all network communications

### Configuration

- **Limit workspace access** to only necessary directories
- **Restrict shell command execution** to specific allowed commands
- **Use read-only mode** when full write access isn't needed
- **Enable audit logging** for all agent actions
- **Implement user approval flows** for sensitive operations

### API Keys

- **Never commit API keys** to version control
- Use **separate API keys** for development and production
- Rotate API keys regularly
- **Restrict API key permissions** to minimum required
- Store API keys in secure secrets management systems

### Code Execution

The agent has shell access and can execute arbitrary commands. This is inherently risky:

- **Container isolation**: Run in Docker/Podman with limited privileges
- **Network isolation**: Restrict network access where possible
- **Filesystem isolation**: Mount only necessary directories
- **User isolation**: Run as non-root user
- **Resource limits**: Set CPU, memory, and disk quotas

### Memory/Knowledge Base

- The SQLite memory database may contain **sensitive information**
- **Encrypt the database** at rest
- Implement **access controls** for memory queries
- **Regularly audit** stored memories for sensitive data
- **Implement data retention policies**

## Known Security Considerations

### Shell Access

The agent has full shell access by design. This is required for many features but presents security risks:

- All shell commands are logged
- Consider implementing command allowlists
- Use Docker/Podman for isolation
- Run with minimal file system access

### External API Calls

The agent makes calls to external services:

- OpenRouter/LLM providers
- Web search APIs (Brave, Tavily)
- User-specified URLs (via web fetch)

Ensure:
- API keys are properly secured
- Network traffic is monitored
- Rate limits are enforced

### Memory System

The knowledge graph stores conversation history and extracted facts:

- May contain sensitive information
- Stored in SQLite by default (unencrypted)
- Consider encryption for production use
- Implement data retention/deletion policies

### Workspace/Codebase Access

When configured with workspace access:

- Agent can read any file in workspace
- Agent can modify any file in workspace
- Use version control and backups
- Review all changes before deployment

## Security Hall of Fame

We appreciate security researchers who help keep AI Agent Platform safe. Contributors who responsibly disclose vulnerabilities will be listed here (with their permission):

- Currently empty

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)

## Questions?

If you have questions about security that don't involve reporting a vulnerability, please open a regular GitHub issue with the `security` label.
