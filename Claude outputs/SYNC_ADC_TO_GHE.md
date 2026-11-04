# Sync ADC Code to GHE — Repeatable Guide

Use this whenever you want to push the latest code from the **ADC** repo (GitHub) to the **GHE** master repo.

| | |
|---|---|
| **Source** | `https://github.com/pkiran-aloha/ADC` (the `origin` remote, or the downloaded zip) |
| **Destination** | `https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics` (the `ghe` remote) |
| **Local folder** | `C:\ADC\ADC` (`origin` = GitHub, `ghe` = the organization repo) |
| **Zip extract folder** | `C:\ADC\ADC_zip` |
| **Shell** | PowerShell |
| **Scope** | `main` branch only |

> **Last sync:** commit `c453ca8` on 4 Nov 2026. The GHE tree is byte-identical to `origin/main` at that point.

> **The plain `git push ghe main` no longer works.** GHE's tip is a zip-route "Sync from ADC main" commit whose tree matches an older `origin/main` commit, so `ghe/main` is **not** an ancestor of `origin/main` and GitHub rejects the push as non-fast-forward. Use **Route B** below.

> **Remotes changed (1 Nov 2026).** The local `origin` remote now points at **GitHub**, and the organization repo is the **`ghe`** remote. Older versions of this guide said "its `origin` remote = GHE"; read the steps below with `origin` meaning GitHub and `ghe` meaning the organization repo. The zip route below still works unchanged, because it never depends on the remote names.

---

## Quick Reference (the whole process)

### Route B — direct push with an `-s ours` merge (use this)

```powershell
cd C:\ADC\ADC
git fetch origin
git switch -c chore/sync-ghe origin/main
git merge -s ours ghe/main -m "Merge origin/main into GHE sync"
git push ghe HEAD:main
```

`-s ours` records a merge commit that keeps GHE's history intact while taking `origin/main`'s tree. It is a fast-forward for GHE, so no force-push is needed. Verify with `git ls-remote ghe refs/heads/main` and compare the tree hashes of `ghe/main` and `origin/main`.

### Route A — the original zip workflow

```powershell
cd C:\ADC\ADC
git pull origin main
robocopy C:\ADC\ADC_zip\ADC-main C:\ADC\ADC /MIR /XD .git node_modules bin obj
git add -A
git --no-pager status -sb
# review the status output, then:
git commit -m "Sync from ADC main"
git push ghe main
```

Details for each step are below.

---

## Step 1 — Download ADC's latest code

1. Go to `github.com/pkiran-aloha/ADC` → **Code** → **Download ZIP**.
2. **Delete everything inside `C:\ADC\ADC_zip`** so stale files don't carry over.
3. Extract the zip into `C:\ADC\ADC_zip`.

The code should now be in `C:\ADC\ADC_zip\ADC-main`. If your extracted folder has a different name, use that name in the robocopy commands below.

## Step 2 — Get GHE's latest

```powershell
cd C:\ADC\ADC
git status -sb
git pull ghe main
```

`git status -sb` should show `## main...ghe/main` with **no files listed**. If files are listed, they are leftovers from an earlier attempt, so check them before continuing.

## Step 3 — Preview the copy (optional)

This lists what would be copied and **changes nothing**:

```powershell
robocopy C:\ADC\ADC_zip\ADC-main C:\ADC\ADC /MIR /L /XD .git node_modules bin obj /NFL /NDL
```

Every file will show as "Copied" because the zip's timestamps differ from yours. That is normal and does **not** mean every file changed.

## Step 4 — Copy the code in

```powershell
robocopy C:\ADC\ADC_zip\ADC-main C:\ADC\ADC /MIR /XD .git node_modules bin obj
```

- `/MIR` makes the folder an exact copy of the zip, including removing files that are not in the zip.
- `.git`, `node_modules`, `bin` and `obj` are excluded, so git history and build folders are left alone.
- Robocopy exit codes **below 8** mean success.

## Step 5 — Stage and review the real changes

```powershell
git add -A
git --no-pager status -sb
```

Staging drops files that differ only by line endings (CRLF vs LF), so you should see **only the real changes**, usually a handful of files.

- If `status` shows nothing, ADC has no new changes. **Stop here.**
- If it shows around 150 files, **do not commit**. See Troubleshooting.
- The `warning: LF will be replaced by CRLF` messages are harmless. Ignore them.

To see the size of what you're about to commit:

```powershell
git --no-pager diff --cached --stat 2>$null
```

## Step 6 — Commit and push

```powershell
git commit -m "Sync from ADC main"
git push ghe main
```

## Step 7 — Verify

```powershell
git --no-pager log --oneline -3
git ls-remote ghe main
```

The hash printed by `ls-remote` should match the top commit in the log.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Screen ends with `:` and nothing happens | That's git's pager. Press **`q`**. Using `git --no-pager` avoids it. |
| `fatal: 'ghe' does not appear to be a git repository` | The remote is missing. Run `git remote -v`. If it prints nothing, run `git remote add ghe https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics.git`, then `git fetch ghe`, and make sure you're on `main`. |
| Push rejected (not a fast-forward) | Someone committed to GHE directly. Run `git pull ghe main`, then repeat Steps 4–6. Do not force-push unless you've checked what you would overwrite. |
| Fetch or push hangs | Look for a hidden sign-in window behind your other windows and complete it. |
| About 150 files marked modified | That's line-ending noise. Check with `git --no-pager -c core.safecrlf=false diff --ignore-cr-at-eol --stat 2>$null`. If it prints nothing, nothing real changed. |
| `git status` isn't clean before Step 4 | Review the listed files. If they are only line-ending noise, `git checkout -- .` restores them. **Don't run it if you have real changes you want to keep.** |

---

## Good to Know

- **Each zip-route sync is one commit.** ADC's individual commits don't carry over, because the zip has no git history.
- **Only `main` is synced.** No other branches are pushed.
- **`git config core.autocrlf true` is set on this repo.** It converts line endings between Windows and the repo automatically. Don't change it.
- **Never force-push** unless you've compared the branches and know what you would overwrite.
- **Route B keeps full history.** `git switch -c chore/sync-ghe origin/main && git merge -s ours ghe/main && git push ghe HEAD:main` publishes `origin/main` verbatim with an extra merge commit, no force-push. Use the zip route (Route A) only when the local tree is authoritative.

---

## Related documents

- [`AGENTS.md`](../AGENTS.md) — the rules every agent on this repo follows.
- [`docs/HANDOFF.md`](../docs/HANDOFF.md) — current state and planned work.

