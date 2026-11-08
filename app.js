(() => {
  'use strict';

  const CATALOG = window.STUDY_CATALOG || {};
  const COURSE_ORDER = Object.keys(CATALOG);
  window.STUDY_DATA = window.STUDY_DATA || {};
  const COURSE_CACHE = window.STUDY_DATA;
  const LOADS = new Map();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const palette = { crm121:'#b9854b', crm122:'#6c87a2', crm123:'#39766e', crm124:'#887aa5', crm125:'#b47b62' };

  let courseId = 'crm123';
  let page = 'overview';
  let activeNoteId = '';
  let expandedChapters = new Set();
  let termQuery = '';
  let termPage = 1;
  const TERMS_PER_PAGE = 30;
  let searchItems = [];
  let quizQuestions = [];
  let quizIndex = 0;
  let quizAnswers = [];
  let selectedAnswer = null;
  let quizLocked = false;
  let quizStyle = 'mixed';
  let quizLength = '10';
  let flashDeck = [];
  let flashIndex = 0;
  let flashFlipped = false;
  let flashDeckKey = '';
  let selectedReferenceSet = '';
  const filters = {
    terms: { chapter: 'all', subchapter: 'all', sort: 'az' },
    timeline: { chapter: 'all', subchapter: 'all', place: 'all', sort: 'course' },
    quiz: { chapter: 'all', subchapter: 'all' },
    flashcards: { chapter: 'all', subchapter: 'all', sort: 'shuffle' },
    references: { chapter: 'all', subchapter: 'all', sort: 'course' }
  };

  const currentCourse = () => COURSE_CACHE[courseId] || null;
  const courseMeta = () => CATALOG[courseId] || {};
  function hasStudyMaterials(course = currentCourse()) {
    if (!course) return false;
    return ['notes','terms','timeline','quiz','referenceSets'].some(key => Array.isArray(course[key]) && course[key].length > 0);
  }
  function hasPageMaterials(pageName, course = currentCourse()) {
    const source = ({ notes:'notes', terms:'terms', timeline:'timeline', quiz:'quiz', flashcards:'terms', references:'referenceSets' })[pageName];
    return !!source && Array.isArray(course?.[source]) && course[source].length > 0;
  }

  function loadCourse(id) {
    if (COURSE_CACHE[id]) return Promise.resolve(COURSE_CACHE[id]);
    if (LOADS.has(id)) return LOADS.get(id);
    if (!CATALOG[id]) return Promise.reject(new Error('Unknown course.'));
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `data/${encodeURIComponent(id)}.js`;
      script.async = true;
      script.onload = () => COURSE_CACHE[id] ? resolve(COURSE_CACHE[id]) : reject(new Error('Course data did not register correctly.'));
      script.onerror = () => reject(new Error(`Could not load ${CATALOG[id].code} data.`));
      document.head.appendChild(script);
    }).catch(error => {
      LOADS.delete(id);
      throw error;
    });
    LOADS.set(id, promise);
    return promise;
  }

  function getChapters(c = currentCourse()) {
    if (!c) return [];
    if (Array.isArray(c.chapters) && c.chapters.length) return c.chapters;
    const groups = new Map();
    (c.notes || []).forEach(note => {
      const key = note.chapterId || slug(note.group || 'course-notes');
      if (!groups.has(key)) groups.set(key, { id:key, title:note.group || 'Course notes', noteIds:[] });
      groups.get(key).noteIds.push(note.id);
    });
    return [...groups.values()];
  }
  function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function getChapter(chapterId, c = currentCourse()) { return getChapters(c).find(ch => ch.id === chapterId); }
  function getNote(noteId, c = currentCourse()) { return (c?.notes || []).find(note => note.id === noteId); }
  function chapterTitle(chapterId, c = currentCourse()) { return getChapter(chapterId, c)?.title || 'Course materials'; }
  function noteTitle(noteId, c = currentCourse()) { return getNote(noteId, c)?.title || 'All subchapters'; }
  function noteOrder(c = currentCourse()) {
    return getChapters(c).flatMap(ch => ch.noteIds.map(id => getNote(id, c)).filter(Boolean));
  }
  function resetCourseState() {
    page = 'overview'; activeNoteId = ''; expandedChapters = new Set(); termQuery = ''; termPage = 1;
    Object.values(filters).forEach(state => { state.chapter='all'; state.subchapter='all'; });
    filters.terms.sort = 'az'; filters.timeline.place = 'all'; filters.timeline.sort = 'course'; filters.flashcards.sort = 'shuffle';
    filters.references.chapter='all'; filters.references.subchapter='all'; filters.references.sort='course';
    quizQuestions = []; quizIndex = 0; quizAnswers = []; selectedAnswer = null; quizLocked = false;
    flashDeck = []; flashIndex = 0; flashFlipped = false; flashDeckKey = ''; selectedReferenceSet = '';
  }

  function renderSidebar() {
    $('#course-list').innerHTML = COURSE_ORDER.map(id => {
      const meta = CATALOG[id];
      const active = id === courseId;
      const color = meta.accent || palette[id] || '#77958a';
      return `<button class="course-button ${active?'active':''}" data-course="${id}" style="--course-color:${escapeHTML(color)}" ${active?'aria-current="page"':''}>
        <span class="course-color"></span><span class="course-copy"><span class="course-name">${escapeHTML(meta.title)}</span><span class="course-code">${escapeHTML(meta.code)} · ${meta.credits} credits</span></span>
      </button>`;
    }).join('');

    const c = currentCourse();
    const grouped = [
      { label:'COURSE', links:[{id:'overview',label:'Course overview',icon:'▦'}] }
    ];
    if (c?.notes?.length) grouped.push({ label:'STUDY', links:[{id:'notes',label:'Study notes',icon:'▤'}] });
    const revisionLinks = [];
    if (c?.terms?.length) {
      revisionLinks.push({id:'terms',label:'Key terms',icon:'Aa'});
      revisionLinks.push({id:'flashcards',label:'Flashcards',icon:'▱'});
    }
    if (c?.timeline?.length) revisionLinks.push({id:'timeline',label:'Timeline',icon:'↗'});
    if (c?.quiz?.length) revisionLinks.push({id:'quiz',label:'Quiz practice',icon:'✓'});
    if (revisionLinks.length) grouped.push({ label:'REVISION', links:revisionLinks });
    if (c?.referenceSets?.length) grouped.push({ label:'REFERENCE', links:[{id:'references',label:'Info Clusters',icon:'◫'}] });
    $('#section-nav').innerHTML = grouped.map(group => `<div class="nav-group"><div class="side-label">${group.label}</div>${group.links.map(item=>`<button class="section-link ${page===item.id?'active':''}" data-page="${item.id}"><span class="section-symbol">${item.icon}</span><span>${item.label}</span></button>`).join('')}</div>`).join('');
    $('#breadcrumb-course').textContent = CATALOG[courseId]?.title || 'Loading course';
    $('#global-search').placeholder = hasStudyMaterials(c) ? `Search ${c.code}` : 'Search course syllabus';
  }

  function setPage(nextPage, noteId) {
    const studyPages = ['notes','terms','timeline','quiz','flashcards','references'];
    if (studyPages.includes(nextPage) && !hasPageMaterials(nextPage)) nextPage = 'overview';
    page = nextPage;
    if (noteId) {
      activeNoteId = noteId;
      const selected = getNote(noteId);
      expandedChapters = new Set(selected?.chapterId ? [selected.chapterId] : []);
    }
    if (page === 'notes' && !activeNoteId) activeNoteId = noteOrder()[0]?.id || '';
    if (page === 'notes' && activeNoteId) {
      const active = getNote(activeNoteId);
      if (active?.chapterId) expandedChapters.add(active.chapterId);
    }
    $('#sidebar').classList.remove('open');
    $('#sidebar-shade').classList.remove('visible');
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function heading(kicker, title, description = '') {
    return `<header class="page-heading"><div class="page-kicker"><span class="dot"></span>${escapeHTML(kicker)}</div><h1>${escapeHTML(title)}</h1>${description?`<p>${escapeHTML(description)}</p>`:''}</header>`;
  }
  function renderLoading(message = 'Loading course materials…') {
    $('#page-content').innerHTML = `<div class="loading-state"><span class="loading-spinner"></span><p>${escapeHTML(message)}</p></div>`;
  }
  function renderEmpty(title, body) {
    const c = currentCourse();
    $('#page-content').innerHTML = `${heading(c?.code || '', c?.title || 'Study materials')}<div class="empty-state"><div class="empty-icon">▤</div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(body)}</p></div>`;
  }

  function chapterForSyllabusUnit(unit, chapters) {
    if (unit?.chapterId) {
      const exact = chapters.find(chapter => chapter.id === unit.chapterId);
      if (exact) return exact;
    }
    const titleKey = slug(unit?.title);
    return titleKey ? chapters.find(chapter => slug(chapter.title) === titleKey) || null : null;
  }

  function syllabusNoteForTopic(topic, chapter, c) {
    const noteId = chapter?.topicNoteMap?.[topic];
    if (!noteId || !chapter.noteIds?.includes(noteId)) return null;
    const note = getNote(noteId, c);
    return note?.chapterId === chapter.id ? note : null;
  }
  function renderOverview() {
    const c = currentCourse();
    if (!c) return renderLoading();
    const chapters = getChapters(c);
    const syllabus=(c.syllabus||[]).map((unit,i)=>{
      const chapter=chapterForSyllabusUnit(unit, chapters);
      const notes=chapter?.noteIds?.map(id=>getNote(id,c)).filter(Boolean)||[];
      const available=!!notes.length;
      return `<article class="syllabus-item syllabus-course-item ${available?'has-materials':'coming-soon'}">
        <button class="syllabus-toggle" type="button" data-syllabus-chapter="${escapeHTML(chapter?.id||'')}" aria-expanded="false">
          <span class="syllabus-num">${String(i+1).padStart(2,'0')}</span><strong>${escapeHTML(unit.title)}</strong>
          <small>${available?`${notes.length} study subchapters`:'Syllabus section'}</small><span class="chevron">${available?'→':'⌄'}</span>
        </button>
        <div class="syllabus-body"><div class="syllabus-topic-list">${unit.topics.map((topic,j)=>{
          const note=chapter?.topicNoteMap ? syllabusNoteForTopic(topic,chapter,c) : (notes.length===1?notes[0]:null);
          return `<button type="button" class="syllabus-topic" ${note?`data-syllabus-note="${escapeHTML(note.id)}"`:'disabled aria-disabled="true"'} data-syllabus-chapter="${escapeHTML(chapter?.id||'')}"><span>${String(j+1).padStart(2,'0')}</span>${escapeHTML(topic)}${note?'<b>Open notes →</b>':''}</button>`;
        }).join('')}</div>${available?`<button class="primary-button syllabus-open-notes" type="button" data-syllabus-chapter="${escapeHTML(chapter.id)}">Open ${escapeHTML(unit.title)} notes →</button>`:'<p class="syllabus-pending">Study notes for this syllabus section will be added gradually.</p>'}</div>
      </article>`;
    }).join('');
    const readings = Array.isArray(c.readings) && c.readings.length ? `<section class="content-section readings-home"><div class="section-heading"><div><h2>Recommended readings</h2><p>Books and references listed for this course.</p></div><span class="section-count">${c.readings.length} SOURCES</span></div><ol class="reading-list">${c.readings.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ol></section>` : '';
    $('#page-content').innerHTML = `${heading(`${c.code} · ${c.credits} CREDITS`,c.title,c.objective)}
      <div class="course-meta-row"><span class="meta-chip"><span class="chip-dot"></span>${hasStudyMaterials(c)?'STUDY MATERIALS AVAILABLE':'SYLLABUS LOADED'}</span><span class="meta-chip">FIRST YEAR · SECOND SEMESTER</span></div>
      <section class="content-section syllabus-home"><div class="section-heading"><div><h2>Course syllabus</h2><p>Choose a syllabus section to open its study material and subchapters.</p></div><span class="section-count">${c.syllabus?.length||0} SECTIONS</span></div><div class="syllabus-list">${syllabus}</div></section>${readings}`;
  }

  function renderNotes() {
    const c=currentCourse();
    if (!c?.notes?.length) return renderEmpty('Study notes are not available yet.','The course syllabus is available. Study notes and revision materials will be added as the course is covered.');
    const chapters=getChapters(c);
    const allNotes=noteOrder(c);
    if (!activeNoteId || !getNote(activeNoteId,c)) activeNoteId=allNotes[0]?.id || '';
    const active=getNote(activeNoteId,c);
    if (!active) return renderEmpty('No chapters yet.','Study chapters will appear here.');
    const pos=allNotes.findIndex(n=>n.id===activeNoteId);
    const prev=allNotes[pos-1], next=allNotes[pos+1];
    const tree=chapters.map((ch,i)=>{
      const notes=ch.noteIds.map(id=>getNote(id,c)).filter(Boolean);
      const open=expandedChapters.has(ch.id);
      return `<div class="chapter-tree-group ${open?'open':''}">
        <button class="chapter-tree-heading" data-chapter-toggle="${escapeHTML(ch.id)}" aria-expanded="${open}"><span class="chapter-tree-index">${String(i+1).padStart(2,'0')}</span><span class="chapter-tree-title">${escapeHTML(ch.title)}</span><span class="chapter-tree-count">${notes.length}</span><span class="tree-chevron">⌄</span></button>
        <div class="chapter-tree-children">${notes.map(n=>`<button class="note-index-button ${n.id===activeNoteId?'active':''}" data-note="${escapeHTML(n.id)}"><span class="subchapter-marker"></span><span><strong>${escapeHTML(n.title)}</strong><small>${escapeHTML(n.source||'Study note')}</small></span></button>`).join('')}</div>
      </div>`;
    }).join('');
    const sections=(active.sections||[]).map((s,i)=>`<section class="article-section" id="subtopic-${i}"><h3>${escapeHTML(s.title)}</h3>${s.body?`<p>${escapeHTML(s.body)}</p>`:''}${s.bullets?.length?`<ul>${s.bullets.map(b=>`<li>${escapeHTML(b)}</li>`).join('')}</ul>`:''}</section>`).join('');
    $('#page-content').innerHTML = `${heading(`${c.code} · ${chapterTitle(active.chapterId,c)}`, 'Study notes', 'Select a chapter, then a subchapter. Each note is divided into smaller sections for focused reading.')}
      <div class="notes-layout"><aside class="notes-index"><div class="index-heading"><span>CHAPTERS</span><span>${chapters.length}</span></div><div class="chapter-tree">${tree}</div></aside>
      <article class="notes-article"><div class="article-kicker">${escapeHTML(chapterTitle(active.chapterId,c))} <span>›</span> ${escapeHTML(active.source||'Study notes')} <span>·</span> ${String(pos+1).padStart(2,'0')} / ${String(allNotes.length).padStart(2,'0')}</div>
        <h2>${escapeHTML(active.title)}</h2><p class="article-intro">${escapeHTML(active.short||'')}</p>${sections}
        <div class="article-footer"><button type="button" data-note="${prev?.id||''}" ${prev?'':'disabled'}>← Previous subchapter</button><button type="button" data-note="${next?.id||''}" ${next?'':'disabled'}>Next subchapter →</button></div></article></div>`;
  }

  function chapterOptions(selected) {
    const c=currentCourse();
    return `<option value="all" ${selected==='all'?'selected':''}>All chapters</option>${getChapters(c).map(ch=>`<option value="${escapeHTML(ch.id)}" ${selected===ch.id?'selected':''}>${escapeHTML(ch.title)}</option>`).join('')}`;
  }
  function subchapterOptions(chapterId, selected) {
    const c=currentCourse();
    const chapters=getChapters(c);
    const notes=chapterId==='all' ? noteOrder(c) : (getChapter(chapterId,c)?.noteIds||[]).map(id=>getNote(id,c)).filter(Boolean);
    return `<option value="all" ${selected==='all'?'selected':''}>All subchapters</option>${notes.map(note=>`<option value="${escapeHTML(note.id)}" ${selected===note.id?'selected':''}>${escapeHTML(note.title)}</option>`).join('')}`;
  }
  function taxonomyControls(tool, extra='') {
    const state=filters[tool];
    const c=currentCourse();
    return `<div class="taxonomy-toolbar"><div class="taxonomy-course"><span class="taxonomy-course-code">${escapeHTML(c.code)}</span><span>${escapeHTML(c.title)}</span></div>
      <label class="taxonomy-field"><span>Chapter</span><select data-taxonomy-tool="${tool}" data-taxonomy-field="chapter">${chapterOptions(state.chapter)}</select></label>
      <label class="taxonomy-field"><span>Subchapter</span><select data-taxonomy-tool="${tool}" data-taxonomy-field="subchapter">${subchapterOptions(state.chapter,state.subchapter)}</select></label>${extra}</div>`;
  }
  function applyTaxonomy(items, state) {
    return items.filter(item => (state.chapter==='all'||item.chapterId===state.chapter) && (state.subchapter==='all'||item.subchapterId===state.subchapter));
  }
  function sortSelect(id, value, options) {
    return `<label class="sort-field"><span>Sort</span><select id="${id}">${options.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select></label>`;
  }

  function renderTerms() {
    const c=currentCourse(); const terms=c?.terms||[];
    if (!terms.length) return renderEmpty('No key terms added yet.','Key terms and concise definitions will appear here as the course notes are prepared.');
    let filtered=applyTaxonomy(terms,filters.terms).filter(t=>!termQuery||`${t.name} ${t.definition} ${t.category}`.toLowerCase().includes(termQuery));
    if (filters.terms.sort==='az') filtered.sort((a,b)=>a.name.localeCompare(b.name));
    if (filters.terms.sort==='za') filtered.sort((a,b)=>b.name.localeCompare(a.name));
    if (filters.terms.sort==='course') filtered.sort((a,b)=>terms.indexOf(a)-terms.indexOf(b));
    const totalPages=Math.max(1,Math.ceil(filtered.length/TERMS_PER_PAGE)); termPage=Math.min(termPage,totalPages);
    const visible=filtered.slice((termPage-1)*TERMS_PER_PAGE,termPage*TERMS_PER_PAGE);
    const controls=taxonomyControls('terms',sortSelect('term-sort',filters.terms.sort,[['az','A to Z'],['za','Z to A'],['course','Course order']]));
    const pagination=`<div class="pagination"><span>Showing ${filtered.length?((termPage-1)*TERMS_PER_PAGE+1):0}–${Math.min(termPage*TERMS_PER_PAGE,filtered.length)} of ${filtered.length}</span><div><button type="button" data-term-page="prev" ${termPage===1?'disabled':''}>← Previous</button><strong>Page ${termPage} / ${totalPages}</strong><button type="button" data-term-page="next" ${termPage===totalPages?'disabled':''}>Next →</button></div></div>`;
    $('#page-content').innerHTML=`${heading('REVISION · GLOSSARY','Key terms','Find a term, then reveal its definition. Filter by course syllabus section and subchapter.')}
      ${controls}<div class="toolbar"><label class="inline-search"><span>⌕</span><input id="term-search" type="search" placeholder="Search terms or definitions…" value="${escapeHTML(termQuery)}"></label><span class="result-count">${filtered.length} / ${terms.length} TERMS</span></div>
      <div class="term-grid content-section">${visible.map(t=>`<button class="term-card"><span class="term-category">${escapeHTML(t.category)}</span><strong>${escapeHTML(t.name)}</strong><small>REVEAL DEFINITION</small><span class="term-definition">${escapeHTML(t.definition)}</span><span class="term-context">${escapeHTML(chapterTitle(t.chapterId,c))} · ${escapeHTML(noteTitle(t.subchapterId,c))}</span></button>`).join('')||'<div class="empty-state"><h2>No matching terms</h2><p>Try another chapter, subchapter or search.</p></div>'}</div>${pagination}`;
  }

  function renderTimeline() {
    const c=currentCourse(); const events=c?.timeline||[];
    if (!events.length) return renderEmpty('No timeline entries added yet.','Important dates and developments will be added as this course is prepared.');
    let filtered=applyTaxonomy(events,filters.timeline);
    if (filters.timeline.place!=='all') filtered=filtered.filter(e=>e.place===filters.timeline.place);
    if (filters.timeline.sort==='oldest') filtered.sort((a,b)=>(a.dateOrder??a.order??0)-(b.dateOrder??b.order??0));
    if (filters.timeline.sort==='newest') filtered.sort((a,b)=>(b.dateOrder??b.order??0)-(a.dateOrder??a.order??0));
    if (filters.timeline.sort==='course') filtered.sort((a,b)=>(a.order??0)-(b.order??0));
    if (filters.timeline.sort==='az') filtered.sort((a,b)=>a.title.localeCompare(b.title));
    const places=['all',...new Set(events.map(e=>e.place))];
    const extra=`${sortSelect('timeline-sort',filters.timeline.sort,[['course','Course order'],['oldest','Oldest first'],['newest','Newest first'],['az','Event A to Z']])}<label class="sort-field"><span>Place</span><select id="timeline-place">${places.map(p=>`<option value="${escapeHTML(p)}" ${p===filters.timeline.place?'selected':''}>${p==='all'?'All places':escapeHTML(p)}</option>`).join('')}</select></label>`;
    $('#page-content').innerHTML=`${heading('REVISION · CHRONOLOGY','Timeline','Review events in the sequence used by the notes, or sort them by date. Narrow the timeline by chapter and subchapter.')}
      ${taxonomyControls('timeline',extra)}<div class="timeline-summary"><span>${filtered.length} events</span><span>${filters.timeline.chapter==='all'?'All chapters':escapeHTML(chapterTitle(filters.timeline.chapter,c))}</span></div>
      <div class="timeline-list">${filtered.map(e=>`<div class="timeline-event"><div class="timeline-date">${escapeHTML(e.date)}</div><span class="timeline-dot"></span><div class="timeline-content"><div class="timeline-text"><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.detail)}</p><small class="timeline-context">${escapeHTML(chapterTitle(e.chapterId,c))} · ${escapeHTML(noteTitle(e.subchapterId,c))}</small></div><span class="timeline-place">${escapeHTML(e.place)}</span></div></div>`).join('')||'<div class="empty-state"><h2>No events in this selection</h2><p>Choose a different chapter or subchapter.</p></div>'}</div>`;
  }

  function dateSortValue(item) {
    if (Number.isFinite(item.dateOrder)) return item.dateOrder;
    const match = String(item.date || '').match(/\d{3,4}/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  }

  function renderReferences() {
    const c=currentCourse(); const sets=c?.referenceSets||[];
    if (!sets.length) return renderEmpty('No reference sets added yet.','Principles, historical eras, models and other reference material will appear here as they are covered.');
    if (!sets.some(set=>set.id===selectedReferenceSet)) selectedReferenceSet=sets[0].id;
    const set=sets.find(item=>item.id===selectedReferenceSet);
    const hasDates=set.items.some(item=>item.date || Number.isFinite(item.dateOrder));
    if (!hasDates && filters.references.sort.startsWith('date-')) filters.references.sort='course';
    const sort=filters.references.sort;
    let items=applyTaxonomy(set.items.map(item=>({...item,chapterId:item.chapterId||set.chapterId,subchapterId:item.subchapterId||set.subchapterId||(set.type==='principles'?'peel':'eras')})),filters.references);
    if (sort==='az') items.sort((a,b)=>a.title.localeCompare(b.title));
    if (sort==='za') items.sort((a,b)=>b.title.localeCompare(a.title));
    if (sort==='date-oldest') items.sort((a,b)=>dateSortValue(a)-dateSortValue(b) || (a.order??a.number??0)-(b.order??b.number??0));
    if (sort==='date-newest') items.sort((a,b)=>dateSortValue(b)-dateSortValue(a) || (b.order??b.number??0)-(a.order??a.number??0));
    const isPrinciples=set.type==='principles';
    const referenceSortOptions=[['course','Original order'],['az','A to Z'],['za','Z to A'],...(hasDates?[['date-oldest','Chronological · oldest first'],['date-newest','Chronological · newest first']]:[])];
    $('#page-content').innerHTML=`${heading('INFO CLUSTERS','Info Clusters','Sortable collections of principles, eras, models and other structured reference material.')}
      ${taxonomyControls('references')}<div class="reference-toolbar"><label class="taxonomy-field"><span>Reference set</span><select id="reference-set">${sets.map(s=>`<option value="${escapeHTML(s.id)}" ${s.id===set.id?'selected':''}>${escapeHTML(s.title)}</option>`).join('')}</select></label>
      ${sortSelect('reference-sort',sort,referenceSortOptions)}
      <div class="reference-count">${items.length} ITEMS <span>·</span> ${escapeHTML(set.group)}</div></div>
      <div class="reference-intro"><strong>${escapeHTML(set.title)}</strong><p>${escapeHTML(set.description||'')}</p></div>
      <div class="reference-grid">${items.map(item=>isPrinciples?`<article class="reference-card principle-reference-card"><button type="button" class="reference-toggle"><span class="reference-index">PRINCIPLE ${item.number||item.order}</span><strong>${escapeHTML(item.title)}</strong><span class="reference-summary">${escapeHTML(item.summary)}</span><span class="reference-expand">Read full principle +</span></button><div class="reference-detail">${escapeHTML(item.detail)}</div></article>`:`<article class="reference-card era-reference-card"><button type="button" class="reference-toggle"><span class="reference-index">${escapeHTML(item.date||`ERA ${item.order}`)}</span><strong>${escapeHTML(item.title)}</strong><span class="reference-summary">${escapeHTML(item.description)}</span><span class="reference-points">${(item.points||[]).length} key features</span><span class="reference-expand">Show key features +</span></button><ul class="reference-detail">${(item.points||[]).map(point=>`<li>${escapeHTML(point)}</li>`).join('')}</ul></article>`).join('')}</div>`;
  }

  function quizPool() { return applyTaxonomy(currentCourse()?.quiz||[],filters.quiz); }
  function renderQuizSetup() {
    const c=currentCourse(); const pool=quizPool();
    const styleOptions=[['mixed','Mixed questions'],['mcq','Multiple choice'],['tf','True / false']];
    const extra=`<label class="sort-field"><span>Question type</span><select id="quiz-style">${styleOptions.map(([v,t])=>`<option value="${v}" ${quizStyle===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
    $('#page-content').innerHTML=`${heading('REVISION · ACTIVE RECALL','Quiz practice','Choose the chapter and subchapter you want to practise. Answers include explanations drawn from the class notes.')}
      ${taxonomyControls('quiz',extra)}
      <div class="quiz-setup"><div class="quiz-setup-main"><div class="page-kicker">${pool.length} QUESTIONS AVAILABLE</div><h2>Check what you remember.</h2><p>Questions are selected from the active course and narrowed to the chapter and subchapter chosen above.</p><div class="quiz-bank-breakdown">${escapeHTML(c.code)} <span>›</span> ${filters.quiz.chapter==='all'?'All chapters':escapeHTML(chapterTitle(filters.quiz.chapter,c))} <span>›</span> ${filters.quiz.subchapter==='all'?'All subchapters':escapeHTML(noteTitle(filters.quiz.subchapter,c))}</div></div>
      <div class="quiz-setup-side"><label class="field-label">Number of questions<select id="quiz-length">${[['10','10 questions'],['15','15 questions'],['20','20 questions'],['all','All available']].map(([v,t])=>`<option value="${v}" ${quizLength===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <div class="quiz-available">${pool.length} questions in this selection</div><div id="quiz-setup-feedback" aria-live="polite"></div><button class="primary-button" id="start-quiz" ${pool.length?'':'disabled'}>Start quiz →</button></div></div>`;
  }

  function shuffled(items) {
    const result=[...items];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function startQuiz() {
    const pool=quizPool();
    let selected=pool.filter(q=>quizStyle==='mixed'||(quizStyle==='tf'?q.type==='tf':q.type!=='tf'));
    quizQuestions=shuffled(selected);
    if(quizLength!=='all') quizQuestions=quizQuestions.slice(0,Number(quizLength));
    if(!quizQuestions.length){$('#quiz-setup-feedback').innerHTML='<div class="answer-feedback incorrect">No questions match this selection. Choose another chapter or question type.</div>';return;}
    quizIndex=0;quizAnswers=[];selectedAnswer=null;quizLocked=false;renderQuestion();
  }
  function renderQuestion() {
    const q=quizQuestions[quizIndex]; const isTF=q.type==='tf'; const choices=isTF?['True','False']:q.opts; const c=currentCourse();
    $('#page-content').innerHTML=`${heading(`${c.code} · ${chapterTitle(q.chapterId,c)}`,'Question practice','Choose one answer. Submit it to see the correct response and explanation.')}
      <section class="quiz-panel"><div class="quiz-progress-top"><span>QUESTION ${String(quizIndex+1).padStart(2,'0')} OF ${String(quizQuestions.length).padStart(2,'0')}</span><span>${Math.round(quizIndex/quizQuestions.length*100)}% COMPLETE</span></div><div class="progress-track"><div class="progress-fill" style="width:${quizIndex/quizQuestions.length*100}%"></div></div>
      <div class="question-context">${escapeHTML(noteTitle(q.subchapterId,c))} <span>·</span> ${isTF?'TRUE / FALSE':'MULTIPLE CHOICE'}</div><h2 class="quiz-question">${escapeHTML(q.q)}</h2>
      <div class="answer-list">${choices.map((choice,i)=>`<button class="answer-option" data-answer="${i}"><span class="option-letter">${isTF?(i===0?'T':'F'):String.fromCharCode(65+i)}</span><span>${escapeHTML(choice)}</span></button>`).join('')}</div>
      <div id="quiz-feedback"></div><div class="quiz-actions"><button class="secondary-button" id="quit-quiz">Exit quiz</button><div class="right-actions"><button class="primary-button" id="submit-answer" disabled>Submit answer</button><button class="primary-button hidden" id="next-question">${quizIndex===quizQuestions.length-1?'See results':'Next question →'}</button></div></div></section>`;
  }
  function submitAnswer() {
    if(selectedAnswer===null||quizLocked)return;
    const q=quizQuestions[quizIndex];const correct=q.type==='tf'?(q.a?0:1):q.a;const isCorrect=selectedAnswer===correct;quizLocked=true;
    quizAnswers.push({q,selected:selectedAnswer,correct,isCorrect});
    $$('.answer-option').forEach((button,i)=>{button.disabled=true;if(i===correct)button.classList.add('correct');else if(i===selectedAnswer)button.classList.add('wrong');});
    $('#quiz-feedback').innerHTML=`<div class="answer-feedback ${isCorrect?'':'incorrect'}"><strong>${isCorrect?'Correct.':'Not quite.'}</strong> ${escapeHTML(q.why)}</div>`;
    $('#submit-answer').classList.add('hidden');$('#next-question').classList.remove('hidden');
  }
  function showQuizResults() {
    const score=quizAnswers.filter(a=>a.isCorrect).length;const total=quizAnswers.length;const percent=total?Math.round(score/total*100):0;
    const review=quizAnswers.map((a,i)=>{const chosen=a.q.type==='tf'?['True','False'][a.selected]:a.q.opts[a.selected];const answer=a.q.type==='tf'?['True','False'][a.correct]:a.q.opts[a.correct];return `<div class="review-card"><strong>${i+1}. ${escapeHTML(a.q.q)}</strong><p>${a.isCorrect?'Correct.':`Your answer: ${escapeHTML(chosen)}. Correct answer: ${escapeHTML(answer)}. `}${escapeHTML(a.q.why)}</p></div>`;}).join('');
    $('#page-content').innerHTML=`${heading('QUIZ COMPLETE','Your result','Review each question and explanation before another round.')}
      <section class="quiz-result"><div class="result-score">${score} / ${total}</div><div class="result-note">${percent}% correct</div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="quiz-actions"><button class="secondary-button" id="review-toggle">Show answer review</button><button class="primary-button" id="retry-quiz">Try another round ↗</button></div><div class="review-list hidden" id="review-list">${review}</div></section>`;
  }

  function buildFlashDeck() {
    const c=currentCourse();const terms=applyTaxonomy(c?.terms||[],filters.flashcards);
    const sorted=[...terms];
    if(filters.flashcards.sort==='az')sorted.sort((a,b)=>a.name.localeCompare(b.name));
    else if(filters.flashcards.sort==='za')sorted.sort((a,b)=>b.name.localeCompare(a.name));
    else if(filters.flashcards.sort==='course')sorted.sort((a,b)=>(c.terms.indexOf(a)-c.terms.indexOf(b)));
    else return shuffled(sorted);
    return sorted;
  }
  function renderFlashcards(rebuild=false) {
    const c=currentCourse();const key=`${courseId}:${filters.flashcards.chapter}:${filters.flashcards.subchapter}:${filters.flashcards.sort}`;
    if(rebuild||flashDeckKey!==key){flashDeck=buildFlashDeck();flashIndex=0;flashFlipped=false;flashDeckKey=key;}
    if(!flashDeck.length)return renderEmpty('No flashcards in this selection.','Choose another chapter or subchapter. Cards are generated directly from the key-term data.');
    renderFlashcard();
  }
  function renderFlashcard() {
    const card=flashDeck[flashIndex];if(!card)return;
    const c=currentCourse();
    const extra=sortSelect('flashcard-sort',filters.flashcards.sort,[['shuffle','Shuffle'],['az','A to Z'],['za','Z to A'],['course','Course order']]);
    $('#page-content').innerHTML=`${heading('REVISION · ACTIVE RECALL','Flashcards','Try to recall the meaning before revealing it. Select a chapter or subchapter to make a smaller deck.')}
      ${taxonomyControls('flashcards',extra)}
      <div class="flashcard-wrap"><div class="flashcard-count"><span>CARD ${String(flashIndex+1).padStart(2,'0')} / ${String(flashDeck.length).padStart(2,'0')}</span><span>${escapeHTML(chapterTitle(card.chapterId,c))} · ${escapeHTML(noteTitle(card.subchapterId,c))}</span></div><div class="flash-progress"><div class="progress-fill" style="width:${(flashIndex+1)/flashDeck.length*100}%"></div></div>
      <div class="flashcard ${flashFlipped?'flipped':''}" id="flashcard" role="button" tabindex="0" aria-label="Flip flashcard"><div class="flashcard-category">${escapeHTML(card.category)}</div><div class="flashcard-side-label">${flashFlipped?'DEFINITION':'TERM'}</div><h2>${escapeHTML(flashFlipped?card.definition:card.name)}</h2><div class="flash-hint">Tap or press Enter to ${flashFlipped?'see the term':'reveal the definition'}</div></div>
      <div class="flash-controls"><button id="flash-prev">← Previous</button><button id="flash-shuffle">Shuffle deck</button><button id="flash-next">Next →</button></div></div>`;
  }

  function renderPage() {
    if(!currentCourse())return renderLoading();
    if(page==='overview')renderOverview();
    else if(page==='notes')renderNotes();
    else if(page==='terms')renderTerms();
    else if(page==='timeline')renderTimeline();
    else if(page==='quiz')renderQuizSetup();
    else if(page==='flashcards')renderFlashcards();
    else if(page==='references')renderReferences();
    else renderOverview();
  }
  function render() { renderSidebar();renderPage(); }

  function collectSearchResults(query) {
    const c=currentCourse();const q=query.toLowerCase().trim();if(!q||!c)return [];
    const results=[];
    (c.notes||[]).forEach(n=>{
      const text=[n.title,n.short,n.group,...(n.sections||[]).flatMap(s=>[s.title,s.body,...(s.bullets||[])])].join(' ');
      if(text.toLowerCase().includes(q))results.push({title:n.title,type:'STUDY SUBCHAPTER',context:`${chapterTitle(n.chapterId,c)} · ${n.source||''}`,action:()=>setPage('notes',n.id)});
    });
    (c.terms||[]).forEach(t=>{if(`${t.name} ${t.definition} ${t.category}`.toLowerCase().includes(q))results.push({title:t.name,type:'KEY TERM',context:`${chapterTitle(t.chapterId,c)} · ${noteTitle(t.subchapterId,c)}`,action:()=>{filters.terms.chapter=t.chapterId||'all';filters.terms.subchapter=t.subchapterId||'all';termQuery=t.name;setPage('terms');}});});
    (c.timeline||[]).forEach(e=>{if(`${e.date} ${e.title} ${e.place} ${e.detail}`.toLowerCase().includes(q))results.push({title:`${e.date} · ${e.title}`,type:'TIMELINE',context:`${chapterTitle(e.chapterId,c)} · ${noteTitle(e.subchapterId,c)}`,action:()=>{filters.timeline.chapter=e.chapterId||'all';filters.timeline.subchapter=e.subchapterId||'all';setPage('timeline');}});});
    (c.quiz||[]).forEach(item=>{if(item.q.toLowerCase().includes(q))results.push({title:item.q,type:'QUIZ QUESTION',context:`${chapterTitle(item.chapterId,c)} · ${noteTitle(item.subchapterId,c)}`,action:()=>{filters.quiz.chapter=item.chapterId||'all';filters.quiz.subchapter=item.subchapterId||'all';setPage('quiz');}});});
    (c.syllabus||[]).forEach((s,i)=>{if(`${s.title} ${s.topics.join(' ')}`.toLowerCase().includes(q))results.push({title:s.title,type:'SYLLABUS',context:'Course syllabus',action:()=>{setPage('overview');requestAnimationFrame(()=>{const items=$$('.syllabus-item');items[i]?.classList.add('open');items[i]?.querySelector('.syllabus-toggle')?.setAttribute('aria-expanded','true');items[i]?.scrollIntoView({behavior:'smooth',block:'center'});});}});});
    (c.referenceSets||[]).forEach(set=>set.items.forEach(item=>{if(JSON.stringify(item).toLowerCase().includes(q))results.push({title:item.title,type:'REFERENCE',context:set.title,action:()=>{selectedReferenceSet=set.id;setPage('references');}});}));
    return results.slice(0,30);
  }
  function openSearch(initial='') { $('#search-backdrop').classList.remove('hidden');$('#search-modal-input').value=initial;renderSearch(initial);$('#search-modal-input').focus(); }
  function closeSearch() { $('#search-backdrop').classList.add('hidden'); }
  function renderSearch(query) {
    searchItems=collectSearchResults(query);
    $('#search-results').innerHTML=searchItems.length?searchItems.map((item,i)=>`<button class="search-result" data-search-result="${i}"><span class="search-result-main"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.context||'')}</small></span><span class="search-result-type">${escapeHTML(item.type)}</span></button>`).join(''):`<div class="search-hint">${query.trim()?'No matching material in this course.':'Search notes, subchapters, terms, dates and questions.'}</div>`;
  }

  async function activateCourse(id) {
    if(!CATALOG[id])return;
    courseId=id;resetCourseState();render();
    try { await loadCourse(id);render(); }
    catch(error) { $('#page-content').innerHTML=`<div class="empty-state"><h2>Could not load this course</h2><p>${escapeHTML(error.message)} Check that the data folder remains beside index.html.</p></div>`; }
  }

  document.addEventListener('click', event => {
    const homeLink=event.target.closest('[data-home]');
    if(homeLink){event.preventDefault();setPage('overview');return;}
    const courseButton=event.target.closest('[data-course]');
    if(courseButton){activateCourse(courseButton.dataset.course);return;}
    const syllabusChapter=event.target.closest('[data-syllabus-chapter]');
    if(syllabusChapter && !syllabusChapter.classList.contains('syllabus-toggle') && !syllabusChapter.classList.contains('syllabus-topic')){const chapter=getChapter(syllabusChapter.dataset.syllabusChapter);if(chapter?.noteIds?.length)setPage('notes',chapter.noteIds[0]);return;}
    const pageButton=event.target.closest('[data-page]');
    if(pageButton){
      const chapter=pageButton.dataset.chapter;
      if(chapter){const first=getChapter(chapter)?.noteIds?.[0];setPage('notes',first);return;}
      setPage(pageButton.dataset.page,pageButton.dataset.note||undefined);return;
    }
    const noteButton=event.target.closest('[data-note]');
    if(noteButton&&noteButton.dataset.note){activeNoteId=noteButton.dataset.note;const note=getNote(activeNoteId);expandedChapters=new Set(note?.chapterId?[note.chapterId]:[]);renderNotes();return;}
    const chapterToggle=event.target.closest('[data-chapter-toggle]');
    if(chapterToggle){const id=chapterToggle.dataset.chapterToggle;if(expandedChapters.has(id))expandedChapters.clear();else expandedChapters=new Set([id]);renderNotes();return;}
    const syllabusNote=event.target.closest('[data-syllabus-note]');
    if(syllabusNote){const noteId=syllabusNote.dataset.syllabusNote;if(noteId)setPage('notes',noteId);return;}
    const syllabusButton=event.target.closest('.syllabus-toggle');
    if(syllabusButton){const item=syllabusButton.closest('.syllabus-item');const open=item.classList.toggle('open');syllabusButton.setAttribute('aria-expanded',String(open));return;}
    const termPageButton=event.target.closest('[data-term-page]');if(termPageButton){termPage=Math.max(1,termPage+(termPageButton.dataset.termPage==='next'?1:-1));renderTerms();return;}
    if(event.target.closest('.term-card')){event.target.closest('.term-card').classList.toggle('open');return;}
    if(event.target.closest('.reference-toggle')){event.target.closest('.reference-card').classList.toggle('open');return;}
    const answer=event.target.closest('[data-answer]');
    if(answer&&!quizLocked){selectedAnswer=Number(answer.dataset.answer);$$('.answer-option').forEach(button=>button.classList.toggle('selected',button===answer));$('#submit-answer').disabled=false;return;}
    if(event.target.closest('#start-quiz')){startQuiz();return;}
    if(event.target.closest('#submit-answer')){submitAnswer();return;}
    if(event.target.closest('#next-question')){quizIndex++;if(quizIndex<quizQuestions.length){selectedAnswer=null;quizLocked=false;renderQuestion();}else showQuizResults();return;}
    if(event.target.closest('#quit-quiz')||event.target.closest('#retry-quiz')){setPage('quiz');return;}
    if(event.target.closest('#review-toggle')){$('#review-list').classList.toggle('hidden');event.target.closest('#review-toggle').textContent=$('#review-list').classList.contains('hidden')?'Show answer review':'Hide answer review';return;}
    if(event.target.closest('#flashcard')){flashFlipped=!flashFlipped;renderFlashcard();return;}
    if(event.target.closest('#flash-prev')){flashIndex=(flashIndex-1+flashDeck.length)%flashDeck.length;flashFlipped=false;renderFlashcard();return;}
    if(event.target.closest('#flash-next')){flashIndex=(flashIndex+1)%flashDeck.length;flashFlipped=false;renderFlashcard();return;}
    if(event.target.closest('#flash-shuffle')){flashDeck=shuffled(flashDeck);flashIndex=0;flashFlipped=false;renderFlashcard();return;}
    if(event.target.closest('#mobile-menu')){$('#sidebar').classList.toggle('open');$('#sidebar-shade').classList.toggle('visible');return;}
    if(event.target.closest('#sidebar-shade')){$('#sidebar').classList.remove('open');$('#sidebar-shade').classList.remove('visible');return;}
    if(event.target.closest('#close-search')){closeSearch();return;}
    const searchResult=event.target.closest('[data-search-result]');
    if(searchResult){const item=searchItems[Number(searchResult.dataset.searchResult)];closeSearch();item?.action();return;}
    if(event.target===$('#search-backdrop'))closeSearch();
  });

  document.addEventListener('input', event => {
    if(event.target.id==='term-search'){
      termQuery=event.target.value.toLowerCase().trim();termPage=1;const cursor=event.target.selectionStart;renderTerms();const input=$('#term-search');input.focus();input.setSelectionRange(cursor,cursor);
    }
    if(event.target.id==='global-search')openSearch(event.target.value);
    if(event.target.id==='search-modal-input')renderSearch(event.target.value);
  });
  document.addEventListener('change', event => {
    const taxonomy=event.target.closest('[data-taxonomy-tool]');
    if(taxonomy){
      const tool=taxonomy.dataset.taxonomyTool;const field=taxonomy.dataset.taxonomyField;filters[tool][field]=taxonomy.value;
      if(field==='chapter')filters[tool].subchapter='all';
      if(tool==='flashcards')renderFlashcards(true);else if(tool==='terms'){termPage=1;renderTerms();}else if(tool==='timeline')renderTimeline();else if(tool==='references')renderReferences();else renderQuizSetup();
      return;
    }
    if(event.target.id==='term-sort'){filters.terms.sort=event.target.value;termPage=1;renderTerms();return;}
    if(event.target.id==='timeline-sort'){filters.timeline.sort=event.target.value;renderTimeline();return;}
    if(event.target.id==='timeline-place'){filters.timeline.place=event.target.value;renderTimeline();return;}
    if(event.target.id==='quiz-style'){quizStyle=event.target.value;renderQuizSetup();return;}
    if(event.target.id==='quiz-length'){quizLength=event.target.value;renderQuizSetup();return;}
    if(event.target.id==='flashcard-sort'){filters.flashcards.sort=event.target.value;renderFlashcards(true);return;}
    if(event.target.id==='reference-set'){selectedReferenceSet=event.target.value;renderReferences();return;}
    if(event.target.id==='reference-sort'){filters.references.sort=event.target.value;renderReferences();return;}
  });
  $('#global-search').addEventListener('focus',()=>openSearch($('#global-search').value));
  $('.search-box').addEventListener('click',()=>{if(document.activeElement!==$('#global-search'))openSearch('');});
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();openSearch();}
    if(event.key==='Escape'){closeSearch();$('#sidebar').classList.remove('open');$('#sidebar-shade').classList.remove('visible');}
    if(event.key==='Enter'&&document.activeElement.id==='flashcard'){event.preventDefault();flashFlipped=!flashFlipped;renderFlashcard();}
  });
  // Disable the page context menu and common DevTools shortcuts on desktop
const isDesktopMode = window.matchMedia(
  '(hover: hover) and (pointer: fine)'
).matches;

if (isDesktopMode) {
  // Disable right-click context menu
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  // Block common keyboard shortcuts for Developer Tools
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    const inspectShortcut =
      event.key === 'F12' ||
      ((event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        ['i', 'j', 'c'].includes(key)) ||
      (event.metaKey && event.altKey &&
        ['i', 'j', 'c'].includes(key));

    if (inspectShortcut) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

  render();
  loadCourse(courseId).then(render).catch(error=>{
    $('#page-content').innerHTML=`<div class="empty-state"><h2>Unable to load study materials</h2><p>${escapeHTML(error.message)} Keep the data folder alongside index.html.</p></div>`;
  });
})();
