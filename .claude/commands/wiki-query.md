# Wiki Query

Answer a question by searching the LLM Wiki. The question: $ARGUMENTS

## Workflow

1. Read `vault/schema.md` for wiki conventions
2. Read all pages in `vault/wiki/` to find relevant content
3. Synthesize an answer grounded in wiki content, using `[[wiki links]]` citations
4. If the wiki lacks sufficient information, clearly state what's missing
5. If the answer is a valuable synthesis, ask the user if they'd like to save it as a new wiki page
6. If saving:
   - Create the page in `vault/wiki/` with type: synthesis frontmatter
   - Update `vault/index.md` under Syntheses
   - Append to `vault/log.md`: `## [YYYY-MM-DD] query | Question text`

## Rules

- Always ground answers in wiki content — cite specific pages
- Don't fabricate information not present in the wiki
- Indicate confidence level when synthesizing across multiple sources
