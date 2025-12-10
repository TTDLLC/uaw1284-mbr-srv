# Git Workflow Cheat Sheet

A concise reference for Scenic Vacations / TTD development workflow.

---

## 1. Creating a New Branch

**Modern (recommended):**
```bash
git switch -c feat/branch-name
```

**Classic equivalent:**
```bash
git checkout -b feat/branch-name
```

**Push new branch:**
```bash
git push -u origin feat/branch-name
```

---

## 2. Branch Naming Conventions

```
feat/new-feature
fix/bug-description
hotfix/emergency-patch
chore/maintenance-task
refactor/code-cleanup
docs/update-readme
experiment/test-idea
```

Rules:
- Lowercase only
- Hyphens instead of spaces
- One `/` between prefix and slug

---

## 3. General Branch Workflow

**Start from main:**
```bash
git checkout main
git pull origin main
```

**Create branch:**
```bash
git switch -c feat/your-branch
```

**Commit work:**
```bash
git add -A
git commit -m "feat: description"
```

**Push:**
```bash
git push -u origin feat/your-branch
```

**Merge via GitHub PR → then:**
```bash
git checkout main
git pull origin main
```

---

## 4. Tagging Releases

**Create a tag:**
```bash
git tag -a v2025.11.01 -m "Release"
```

**Push main + tags:**
```bash
git push origin main --follow-tags
```

---

## 5. Duplicating a Repo (clean, independent copy)

```bash
git clone --depth=1 https://github.com/you/Template-Server.git new-project
cd new-project
rm -rf .git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/you/New-Repo.git
git push -u origin main
```

---

## 6. Remote Management

**Check remotes:**
```bash
git remote -v
```

**Remove incorrect remote:**
```bash
git remote remove origin
```

**Add correct remote:**
```bash
git remote add origin https://github.com/you/repo.git
```

---

## 7. Fixing Common Errors

**Could not resolve host:**
- Usually a typo → re-add remote.

**Repository not found:**
- Repo not created yet
- Wrong URL
- Wrong branch name

Check:
```bash
git remote -v
git status
git ls-remote origin
```

**Rename master → main:**
```bash
git branch -M main
```

---

## 8. Deleting Branches

### Delete a local branch **after merge**
```bash
git branch -d feat/branch-name
```

### Force delete local branch (not merged / abandoned)
```bash
git branch -D feat/branch-name
```

### Delete remote branch
```bash
git push origin --delete feat/branch-name
```

### Full cleanup workflow for abandoned branch
```bash
git switch main
# optional: update main
git pull origin main

git branch -D feat/abandoned-branch
git push origin --delete feat/abandoned-branch
```

---

## 9. Cheat Sheet — Minimal Workflow

```
git checkout main
git pull origin main
git switch -c feat/new-feature

# work

git add -A
git commit -m "feat: add new feature"
git push -u origin feat/new-feature

# PR → merge
git checkout main
git pull origin main

git branch -d feat/new-feature
git push origin --delete feat/new-feature

# Tag

git tag -a v2025.11.01 -m "Release"
git push origin main --follow-tags
```

---

A simple, fast, and scalable development flow.

