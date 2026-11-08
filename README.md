# Study Desk — Year 1, Semester 2

Open `index.html` in a modern browser. Keep the `data` folder beside it.

## Files
- `index.html` — app shell
- `style.css` — responsive styling
- `app.js` — navigation, study tools, filters and rendering
- `data/catalog.js` — lightweight semester course catalogue and syllabus index
- `data/crm121.js` … `data/crm125.js` — separate course data files

## Data conventions
The course syllabus is the source of truth for course ordering. Each course stores `syllabus` entries in syllabus order and `chapters` with matching IDs and titles. Notes are attached to a syllabus chapter with `chapterId`; note IDs are listed in that chapter's `noteIds`. Glossary terms, timeline entries, quiz questions and reference items carry the same `chapterId` and optional `noteId` so the same taxonomy filters can be reused everywhere.

Only CRM 123 currently has study notes and revision content. The other courses contain the supplied syllabus structure and can be expanded gradually.

## Scaling the data
For larger courses, split material into chapter-level files and add a small manifest to each course file. Load a chapter's note, term, timeline, quiz and reference data only when that syllabus chapter is opened. Keep IDs stable and use the shared `chapterId` / `noteId` fields for filtering. For now, each course is loaded separately to avoid loading all five courses at startup.
