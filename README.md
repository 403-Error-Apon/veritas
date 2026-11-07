# Study Desk — Year 1, Semester 2

A lightweight, responsive study website for the five CRM courses in the first-year second-semester syllabus.

## Open the site

Open `index.html` in a modern browser. No installation, build step or local server is required.

## File structure

```text
study-desk/
├── index.html       # Page structure
├── style.css        # All visual styling
├── app.js           # Navigation, search, notes, quiz and flashcard behavior
└── data/
    ├── crm121.js    # Introduction to Law
    ├── crm122.js    # Introduction to Criminal Justice
    ├── crm123.js    # Introduction to Policing
    ├── crm124.js    # Psychology of Criminal Behavior
    └── crm125.js    # Principles of Economics
```

Each course has exactly one course-data file. The data files are JavaScript objects (JSON-compatible structure) attached to `window.STUDY_DATA`. This is intentional: a browser can load them as ordinary script files when `index.html` is opened directly, whereas `fetch()` of separate JSON files is commonly blocked from `file://` pages.

## Current coverage

- **CRM 123 — Introduction to Policing:** Class 1 and Class 2 History of Policing material is organized into study chapters, key terms, a timeline, Peel’s nine principles, eras of policing, flashcards and a quiz bank.
- **CRM 121, CRM 122, CRM 124 and CRM 125:** course objectives, syllabus sections/topics and the suggested readings supplied in the semester outline are included. Detailed study notes have deliberately not been invented or researched yet.

## Updating the material

Edit only the relevant file in `data/` to add or revise a course. The CRM 123 object uses these fields:

- `notes`: study chapters and their sections
- `terms`: glossary terms and definitions
- `timeline`: dated events
- `principles`: Peel’s principles
- `eras`: period summaries and key features
- `quiz`: questions, options, correct answer index and explanations
- `flashcards`: generated from the `terms` list

The other course files already have `code`, `title`, `credits`, `objective`, `syllabus` and `readings` fields. As each course is studied, the same material fields can be added to its file. The app detects the available fields automatically.

## Source note

The CRM 123 history material follows the two class-note sets shared in the conversation. The other four courses follow the uploaded First Year, Second Semester syllabus. Where a class note gives a particular historical date or description, the study material retains that lecture framing rather than silently substituting outside research.
