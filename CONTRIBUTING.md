# Working on BarnDoors

`main` is now protected: you can't push directly to it. Every change goes
through a short-lived branch and a pull request (PR). This keeps `main`
always-deployable and gives every change a reviewable history — the habit
that matters most once teammates come on board.

As the repo owner you *can* bypass protection in a real emergency, but the
normal flow below should be your default.

## The everyday loop

```bash
# 1. Start from an up-to-date main
git checkout main
git pull

# 2. Make a branch for your change (name it after the work)
git checkout -b reports-csv-export

# 3. Do the work, then stage + commit
git add -A
git commit -m "Add CSV export to the reports page"

# 4. Push the branch and open a PR
git push -u origin reports-csv-export
gh pr create --fill        # opens a PR using your commit message

# 5. Review your own diff on GitHub, then merge
gh pr merge --squash --delete-branch
```

That's it. Step 5's `--squash` collapses your branch into one tidy commit on
`main`; `--delete-branch` cleans up afterward.

## Handy shortcuts

- `gh pr view --web` — open the current PR in your browser
- `gh pr checks` — see if any automated checks are passing
- `gh pr list` — see open PRs

## When you add a teammate

Bump the ruleset to require 1 approval so someone else signs off before merge:

```bash
gh api /repos/lisawilkins/barndoors/rulesets   # find the "protect-main" id
# then edit the pull_request rule's required_approving_review_count to 1
```

Ask Claude to do this for you when the time comes.
