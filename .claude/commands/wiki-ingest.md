# Wiki Ingest

Ingest a source document into the LLM Wiki. This implements Karpathy's LLM Wiki ingest pattern.

## Workflow

1. Read the source file specified by the user (from `vault/sources/` or as argument: $ARGUMENTS)
2. Read the current wiki schema from `vault/schema.md`
3. Read `vault/index.md` to understand existing categorization
4. Scan all files in `vault/wiki/` — read first 10 lines of each for context
5. For the source document:
   - Create a summary page in `vault/wiki/` with YAML frontmatter (title, type: summary, source, date)
   - Identify entities, concepts mentioned and create/update their wiki pages
   - Add `[[wiki links]]` cross-references between related pages
   - When updating an existing page, merge new information — don't replace
6. Update `vault/index.md` with new entries under the appropriate category
7. Append to `vault/log.md`: `## [YYYY-MM-DD] ingest | Source Title — brief description`
8. Report what was created and updated

## Rules

- Each wiki page must have YAML frontmatter: title, type (summary/entity/concept/comparison/synthesis), source, date
- Use Obsidian `[[wiki links]]` for cross-references
- One topic per page
- Keep pages concise but informative
- A single source typically touches 5-15 wiki pages
