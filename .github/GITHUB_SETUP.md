# GitHub Repository Setup Guide

This guide will help you configure GitHub settings to enable smooth open source contribution.

## 1. Repository Settings

Navigate to **Settings** in your GitHub repository.

### General Settings

- **Repository name**: `agent`
- **Description**: "AI Agent Platform - Server-side AI agent runtime for Node.js with persistent memory, web search, and codebase understanding"
- **Topics**: Add relevant topics like `ai`, `agent`, `llm`, `nodejs`, `typescript`, `openai`, `rag`, `memory`, `autonomous`
- ✅ **Include in the home page**: Check this box to make the README visible

### Features

Enable the following features:
- ✅ **Issues**: For bug reports and feature requests
- ✅ **Discussions**: For Q&A and community discussion
- ✅ **Projects**: For project management
- ✅ **Wiki**: Optional documentation
- ⬜ **Sponsorships**: Optional

### Pull Requests

- ✅ **Allow merge commits**
- ✅ **Allow squash merging** (recommended default)
- ✅ **Allow rebase merging**
- ✅ **Automatically delete head branches** after merge
- ✅ **Allow auto-merge**

## 2. Branch Protection Rules

Navigate to **Settings** → **Branches** → **Add rule**

### For `main` branch:

**Branch name pattern**: `main`

#### Protection Settings

- ✅ **Require a pull request before merging**
  - ✅ **Require approvals**: 1 (or more for larger teams)
  - ✅ **Dismiss stale pull request approvals when new commits are pushed**
  - ⬜ **Require review from Code Owners** (optional, if you have a CODEOWNERS file)

- ✅ **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - Required status checks (add these):
    - `Build and Test (ubuntu-latest, 20.x)`
    - `Build and Test (macos-latest, 20.x)`
    - `Build and Test (windows-latest, 20.x)`
    - `Lint`
    - `Security Audit`

- ✅ **Require conversation resolution before merging**

- ⬜ **Require signed commits** (optional but recommended for higher security)

- ⬜ **Require linear history** (optional, prevents merge commits)

- ⬜ **Include administrators** (optional, applies rules to admins too)

- ✅ **Restrict who can push to matching branches** (optional, for larger teams)

- ✅ **Allow force pushes**: **Specify who can force push** → Select specific people/teams only

- ⬜ **Allow deletions**: Keep this disabled for main

### For `develop` branch (if using):

Same settings as `main`, but you might want:
- Fewer required approvals (0 or 1)
- More flexibility for force pushes

## 3. Code Security & Analysis

Navigate to **Settings** → **Security** → **Code security and analysis**

### Recommended Settings

- ✅ **Dependency graph**: Automatically enabled for public repos
- ✅ **Dependabot alerts**: Enable
- ✅ **Dependabot security updates**: Enable
- ✅ **Secret scanning**: Enable (for public repos)
- ✅ **Secret scanning push protection**: Enable

## 4. GitHub Actions Settings

Navigate to **Settings** → **Actions** → **General**

### Actions Permissions

- ⚪ **Allow all actions and reusable workflows** (recommended)
- Or: ⚪ **Allow select actions and reusable workflows**
  - If selected, allow actions from:
    - ✅ **GitHub-created actions**
    - ✅ **Actions from verified creators**
    - Add specific actions if needed

### Workflow Permissions

- ⚪ **Read repository contents and packages permissions** (safer)
- Or: ⚪ **Read and write permissions** (more convenient)

- ✅ **Allow GitHub Actions to create and approve pull requests**

## 5. Discussions Setup

Navigate to **Settings** → **Features** → Enable **Discussions**

Then go to **Discussions** tab and set up categories:

### Recommended Categories

1. **💬 General** - General discussion
2. **💡 Ideas** - Share ideas for new features
3. **🙏 Q&A** - Ask questions and get answers
4. **🙌 Show and tell** - Share what you've built
5. **📣 Announcements** - Project announcements (maintainers only)

## 6. Labels Setup

GitHub automatically creates default labels, but you may want to add more:

### Additional Recommended Labels

- `good first issue` (color: #7057ff) - Good for newcomers
- `help wanted` (color: #008672) - Extra attention needed
- `needs-triage` (color: #d93f0b) - Needs initial review
- `blocked` (color: #b60205) - Blocked by dependencies
- `breaking-change` (color: #b60205) - Breaking changes
- `performance` (color: #0e8a16) - Performance improvements
- `security` (color: #d93f0b) - Security issues
- `dependencies` (color: #0366d6) - Dependency updates
- `automated` (color: #0366d6) - Automated PRs

## 7. Issue Templates Configuration

Issue templates are already created in `.github/ISSUE_TEMPLATE/`:
- `bug_report.yml` - For bug reports
- `feature_request.yml` - For feature requests
- `question.yml` - For questions
- `config.yml` - Configuration

These will automatically appear when users create new issues.

## 8. Collaborators & Teams

Navigate to **Settings** → **Collaborators and teams**

### Recommended Setup

For open source projects:
- **Maintainers team**: Admin access
- **Contributors team**: Write access (for regular contributors)
- **Triage team**: Triage access (can manage issues/PRs without code access)

## 9. Webhooks (Optional)

If you want to integrate with external services:

Navigate to **Settings** → **Webhooks** → **Add webhook**

Common webhooks:
- CI/CD services
- Project management tools
- Chat notifications (Slack, Discord)

## 10. Security Advisories

Navigate to **Security** → **Advisories**

When security issues are reported via GitHub Security Advisories:
1. You'll receive a private notification
2. You can discuss with the reporter privately
3. Coordinate a fix
4. Publish a security advisory when fixed

## 11. Repository Visibility

Navigate to **Settings** → **Danger Zone**

### Making Repository Public

If your repo is currently private:
1. Scroll to **Change repository visibility**
2. Click **Change visibility**
3. Select **Make public**
4. Type the repository name to confirm

⚠️ **Important**: Before making public, ensure:
- No secrets/API keys in code or commit history
- No sensitive information in issues/PRs
- License file is present (LICENSE)
- README is up to date
- Documentation is complete

## 12. Code Owners (Optional)

Create `.github/CODEOWNERS` file:

```
*                   @Phoenixrr2113
/packages/core/     @Phoenixrr2113
/packages/server/   @Phoenixrr2113
/docs/              @Phoenixrr2113
/.github/           @Phoenixrr2113
```

This will automatically request reviews from specified people for specific paths.

## 13. Enable GitHub Pages (Optional)

If you want to host documentation:

Navigate to **Settings** → **Pages**
- **Source**: Deploy from a branch
- **Branch**: `gh-pages` or `main`
- **Folder**: `/` or `/docs`

## 14. Verify Everything

After setup, verify:
- [ ] Issues can be created with templates
- [ ] PRs show the template
- [ ] CI workflows run on push/PR
- [ ] Branch protection is active
- [ ] Dependabot is working
- [ ] Discussions are enabled
- [ ] Security features are active

## Quick Checklist

Use this checklist when setting up the repository:

- [ ] Set repository description and topics
- [ ] Enable Issues and Discussions
- [ ] Configure branch protection for `main`
- [ ] Enable Dependabot alerts and security updates
- [ ] Configure GitHub Actions permissions
- [ ] Set up Discussion categories
- [ ] Add custom labels
- [ ] Configure collaborators/teams (if applicable)
- [ ] Create CODEOWNERS file (optional)
- [ ] Make repository public (when ready)
- [ ] Verify all features work

## Additional Resources

- [GitHub Docs - Managing Repository Settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features)
- [GitHub Docs - Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Docs - Security Best Practices](https://docs.github.com/en/code-security/getting-started/securing-your-repository)
