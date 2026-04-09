# Wiki Lint

Audit the LLM Wiki for quality issues.

## Workflow

1. Read all pages in `vault/wiki/`
2. Read `vault/index.md`
3. Check for the following issues:

### Checks

- **Contradictions**: Pages making conflicting claims about the same topic
- **Orphan pages**: Pages with no incoming `[[wiki links]]` from other pages
- **Stale claims**: Information that may be outdated based on dates
- **Missing cross-references**: Pages discussing related topics but not linking to each other
- **Gaps**: Important topics mentioned across pages that lack their own dedicated page
- **Index drift**: Pages that exist but aren't listed in index.md, or index entries pointing to non-existent pages

4. Report findings with:
   - Health score (0-100)
   - List of issues with type, description, affected pages, and suggested fix
   - Overall assessment

5. Ask the user if they'd like to auto-fix any issues

## Auto-fix Capabilities

- Add missing cross-references
- Update index.md to match actual wiki contents
- Create stub pages for identified gaps
- DO NOT auto-fix contradictions — flag them for human review
