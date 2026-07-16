# Security policy

## Supported versions

Until tagged releases exist, security fixes are made only on the latest
revision of the default branch. Older commits and forks are not maintained by
this project.

## Reporting a vulnerability

Do not disclose a vulnerability, credential, authentication state, HAR content,
or sensitive target details in a public issue.

Use the repository's **Security → Report a vulnerability** option to submit a
private report through GitHub Security Advisories. If private vulnerability
reporting is not yet available, open a public issue containing no sensitive
details and ask `@jpbaking` to establish a private contact channel.

Include the affected command or workflow, impact, minimal reproduction, and any
suggested mitigation. Use synthetic targets and credentials wherever possible.
Reports are reviewed as maintainer availability permits; no response or repair
time is guaranteed.

Relevant reports include authorization-scope bypasses, unintended secret
disclosure, unsafe artifact handling, or command execution beyond an explicitly
provided flow, matrix, or test command.
