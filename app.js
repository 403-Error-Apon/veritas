(() => {
  'use strict';

  const COURSE_ORDER = ['crm121', 'crm122', 'crm123', 'crm124', 'crm125'];
  const COURSES = window.STUDY_DATA || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  let courseId = 'crm123';
  let page = 'overview';
  let activeNoteId = '';
  let termQuery = '';
  let termCategory = 'All';
  let timelinePlace = 'All';
  let quizQuestions = [];
  let quizIndex = 0;
  let quizAnswers = [];
  let selectedAnswer = null;
  let quizLocked = false;
  let flashDeck = [];
  let flashIndex = 0;
  let flashFlipped = false;

  const currentCourse = () => COURSES[courseId];
  function renderSidebar() {
    const courseList = $('#course-list');
    courseList.innerHTML = COURSE_ORDER.map(id => {
      const c = COURSES[id];
      const active = id === courseId;
      const color = id === 'crm123' ? '#3f766e' : ({crm121:'#c08b4b',crm122:'#6884a1',crm124:'#8a7aa5',crm125:'#b27c63'}[id]);
      return `<button class="course-button ${active ? 'active' : ''}" data-course="${id}" style="--course-color:${color}" ${active ? 'aria-current="page"' : ''}>
        <span class="course-color"></span><span><span class="course-name">${escapeHTML(c.title)}</span><span class="course-code">${escapeHTML(c.code)} · ${c.credits} credits</span></span>
      </button>`;
    }).join('');

    const c = currentCourse();
    const links = [{id:'overview', label:'Course overview', icon:'▦'}];
    if (c.studyReady) {
      links.push(
        {id:'notes', label:'Study notes', icon:'▤'},
        {id:'terms', label:'Key terms', icon:'Aa'},
        {id:'timeline', label:'Timeline', icon:'↗'},
        {id:'principles', label:'Peel’s principles', icon:'Ⅸ'},
        {id:'eras', label:'Eras of policing', icon:'◷'},
        {id:'quiz', label:'Quiz practice', icon:'✓'},
        {id:'flashcards', label:'Flashcards', icon:'▱'}
      );
    }
    $('#section-nav').innerHTML = links.map(item => `<button class="section-link ${page === item.id ? 'active' : ''}" data-page="${item.id}"><span class="section-symbol">${item.icon}</span>${item.label}</button>`).join('');
    $('#breadcrumb-course').textContent = c.title;
  }

  function setPage(nextPage, noteId) {
    page = nextPage;
    if (noteId) activeNoteId = noteId;
    if (page !== 'overview' && !currentCourse().studyReady) page = 'overview';
    $('#sidebar').classList.remove('open');
    render();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function heading(kicker, title, description = '') {
    return `<div class="page-heading"><div class="page-kicker"><span class="dot"></span>${escapeHTML(kicker)}</div><h1>${escapeHTML(title)}</h1>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>`;
  }

  function renderOverview() {
    const c = currentCourse();
    const syllabusCount = c.syllabus.length;
    const termsCount = c.terms?.length || 0;
    const eventCount = c.timeline?.length || 0;
    const quizCount = c.quiz?.length || 0;
    const stats = c.studyReady
      ? [{v:c.notes.length,l:'Study chapters'},{v:termsCount,l:'Key terms'},{v:eventCount,l:'Timeline entries'},{v:quizCount,l:'Practice questions'}]
      : [{v:syllabusCount,l:'Syllabus sections'},{v:'—',l:'Study chapters'},{v:'—',l:'Key terms'},{v:'—',l:'Practice questions'}];

    const lectureCards = c.studyReady ? `
      <section class="content-section">
        <div class="section-heading"><div><h2>Lecture materials</h2><p>History of Policing · Class notes 01 and 02</p></div><span class="section-count">2 LECTURES</span></div>
        <div class="lecture-grid">
          <button class="lecture-card" data-page="notes" data-note="origins"><span class="lecture-number">01</span><span><strong>History of Policing I</strong><p>Origins, nightwatch systems, wardens, Peel’s principles, US policing and policing eras.</p></span><span class="lecture-arrow">↗</span></button>
          <button class="lecture-card" data-page="notes" data-note="kin"><span class="lecture-number">02</span><span><strong>History of Policing II</strong><p>Kin policing, Greek and Roman policing, England, county sheriffs and vigilance committees.</p></span><span class="lecture-arrow">↗</span></button>
        </div>
      </section>` : `
      <div class="empty-state content-section">
        <div class="empty-icon">▤</div><h2>Study notes will be added gradually</h2>
        <p>The course syllabus is loaded below. As we work through this course, its notes, terms, revision cards and quizzes will be added in its own course data file.</p>
      </div>`;

    const syllabus = c.syllabus.map((unit, i) => `
      <div class="syllabus-item">
        <button class="syllabus-toggle" type="button" aria-expanded="false"><span class="syllabus-num">${String(i+1).padStart(2,'0')}</span><strong>${escapeHTML(unit.title)}</strong><small>${unit.topics.length} topics</small><span class="chevron">⌄</span></button>
        <div class="syllabus-body"><ul>${unit.topics.map(topic => `<li>${escapeHTML(topic)}</li>`).join('')}</ul></div>
      </div>`).join('');

    const readings = c.readings?.length ? `<section class="content-section"><div class="section-heading"><div><h2>Suggested readings</h2><p>References listed in the semester syllabus.</p></div></div><div class="reading-list">${c.readings.map(x=>`<div class="reading-item">${escapeHTML(x)}</div>`).join('')}</div></section>` : '';

    $('#page-content').innerHTML = `
      ${heading(`${c.code} · ${c.credits} CREDITS`, c.title, c.objective)}
      <div class="course-meta-row"><span class="meta-chip"><span class="chip-dot"></span>${c.studyReady ? 'LECTURE NOTES ADDED' : 'SYLLABUS LOADED'}</span><span class="meta-chip">FIRST YEAR · SECOND SEMESTER</span></div>
      <div class="stats-grid">${stats.map(s=>`<div class="stat-card"><span class="stat-value">${s.v}</span><span class="stat-label">${s.l}</span></div>`).join('')}</div>
      ${lectureCards}
      <section class="content-section"><div class="section-heading"><div><h2>Course syllabus</h2><p>Open a section to see its topics.</p></div><span class="section-count">${syllabusCount} SECTIONS</span></div><div class="syllabus-list">${syllabus}</div></section>
      ${readings}`;
  }

  function renderNotes() {
    const c = currentCourse();
    if (!c.studyReady || !c.notes?.length) return renderEmpty('Study notes are not available for this course yet.', 'The syllabus is here. Lecture notes and revision materials will be added as we cover the course.');
    if (!c.notes.some(n=>n.id===activeNoteId)) activeNoteId = c.notes[0].id;
    const active = c.notes.find(n=>n.id===activeNoteId);
    const index = c.notes.map((n,i)=>`<button class="note-index-button ${n.id===activeNoteId?'active':''}" data-note="${n.id}"><span class="index-no">${String(i+1).padStart(2,'0')}</span><span><strong>${escapeHTML(n.title)}</strong><small>${escapeHTML(n.group)}</small></span></button>`).join('');
    const sections = active.sections.map(s=>`<section class="article-section"><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.body)}</p>${s.bullets?.length?`<ul>${s.bullets.map(b=>`<li>${escapeHTML(b)}</li>`).join('')}</ul>`:''}</section>`).join('');
    const pos = c.notes.findIndex(n=>n.id===activeNoteId);
    const prev = c.notes[pos-1], next = c.notes[pos+1];
    $('#page-content').innerHTML = `${heading('STUDY NOTES', 'History of Policing', 'Lecture material arranged by topic. Select a chapter to move through the notes.')}
      <div class="notes-layout"><aside class="notes-index"><div class="index-heading">CHAPTERS · ${c.notes.length}</div>${index}</aside>
      <article class="notes-article"><div class="article-kicker">${escapeHTML(active.group)} · ${String(pos+1).padStart(2,'0')} / ${String(c.notes.length).padStart(2,'0')}</div><h2>${escapeHTML(active.title)}</h2><p class="article-intro">${escapeHTML(active.short)}</p>${sections}
      <div class="article-footer"><button type="button" data-note="${prev?.id||''}" ${prev?'':'disabled'}>← Previous chapter</button><button type="button" data-note="${next?.id||''}" ${next?'':'disabled'}>Next chapter →</button></div></article></div>`;
  }

  function renderEmpty(title, body) {
    $('#page-content').innerHTML = `${heading(currentCourse().code, currentCourse().title)}<div class="empty-state"><div class="empty-icon">▤</div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(body)}</p></div>`;
  }

  function renderTerms() {
    const terms = currentCourse().terms || [];
    if (!terms.length) return renderEmpty('No key terms added yet.', 'Key terms and concise definitions will appear here as the course notes are prepared.');
    const categories = ['All', ...new Set(terms.map(t=>t.category))];
    const filtered = terms.filter(t=>(termCategory==='All'||t.category===termCategory) && (!termQuery || `${t.name} ${t.definition} ${t.category}`.toLowerCase().includes(termQuery)));
    $('#page-content').innerHTML = `${heading('REVISION TOOL', 'Key terms', 'Click a card to reveal its definition. Search by term or by part of a definition.')}
      <div class="toolbar"><label class="inline-search"><span>⌕</span><input id="term-search" type="search" placeholder="Find a term…" value="${escapeHTML(termQuery)}"></label><span class="result-count">${filtered.length} / ${terms.length} TERMS</span></div>
      <div class="filter-row" id="term-filters">${categories.map(cat=>`<button class="filter-pill ${termCategory===cat?'active':''}" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`).join('')}</div>
      <div class="term-grid content-section">${filtered.map(t=>`<button class="term-card"><span class="term-category">${escapeHTML(t.category)}</span><strong>${escapeHTML(t.name)}</strong><small>CLICK TO REVEAL</small><span class="term-definition">${escapeHTML(t.definition)}</span></button>`).join('') || '<div class="empty-state"><h2>No matching terms</h2><p>Try another search or category.</p></div>'}</div>`;
  }

  function renderTimeline() {
    const events = currentCourse().timeline || [];
    if (!events.length) return renderEmpty('No timeline entries added yet.', 'Important dates and developments will be collected here when this course is prepared.');
    const places = ['All', ...new Set(events.map(e=>e.place))];
    const filtered = events.filter(e=>timelinePlace==='All'||e.place===timelinePlace);
    $('#page-content').innerHTML = `${heading('CHRONOLOGICAL REVIEW', 'Timeline', 'Follow the historical dates and developments in sequence.')}
      <div class="toolbar"><div class="filter-row" id="timeline-filters">${places.map(p=>`<button class="filter-pill ${timelinePlace===p?'active':''}" data-place="${escapeHTML(p)}">${escapeHTML(p)}</button>`).join('')}</div><span class="result-count">${filtered.length} EVENTS</span></div>
      <div class="timeline-list">${filtered.map(e=>`<div class="timeline-event"><div class="timeline-date">${escapeHTML(e.date)}</div><span class="timeline-dot"></span><div class="timeline-content"><div class="timeline-text"><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.detail)}</p></div><span class="timeline-place">${escapeHTML(e.place)}</span></div></div>`).join('')}</div>`;
  }

  function renderPrinciples() {
    const principles = currentCourse().principles || [];
    if (!principles.length) return renderEmpty('Peel’s principles are not part of this course material.', 'This study tool is available in Introduction to Policing.');
    $('#page-content').innerHTML = `${heading('REFERENCE', 'Peel’s nine principles', 'Select each principle to reveal the full wording represented in the class notes.')}
      <div class="principle-grid">${principles.map((p,i)=>`<button class="principle-card"><div class="principle-head"><span class="principle-num">${i+1}</span><strong>${escapeHTML(p.title)}</strong></div><p class="principle-summary">${escapeHTML(p.summary)}</p><div class="principle-detail">${escapeHTML(p.detail)}</div></button>`).join('')}</div>`;
  }

  function renderEras() {
    const eras = currentCourse().eras || [];
    if (!eras.length) return renderEmpty('Era notes are not available for this course.', 'This reference section is available in Introduction to Policing.');
    $('#page-content').innerHTML = `${heading('HISTORICAL FRAMEWORK', 'Eras of policing', 'The periods and characteristics listed in the History of Policing lecture notes.')}
      <div class="era-grid">${eras.map(e=>`<article class="era-card"><div class="era-top"><span class="era-date">${escapeHTML(e.date)}</span></div><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.description)}</p><ul>${e.points.map(p=>`<li>${escapeHTML(p)}</li>`).join('')}</ul></article>`).join('')}</div>`;
  }

  function renderQuizSetup() {
    const c = currentCourse();
    const cats = ['All topics', ...new Set(c.quiz.map(q=>q.cat))];
    $('#page-content').innerHTML = `${heading('ACTIVE RECALL', 'Quiz practice', 'Choose a topic and question format. Each answer includes an explanation based on the lecture notes.')}
      <div class="quiz-setup"><div class="quiz-setup-main"><div class="page-kicker">${c.quiz.length} QUESTIONS IN THE BANK</div><h2>Test what you remember.</h2><p>Questions are drawn from both History of Policing lectures. The answer explanation appears immediately after you submit each response.</p></div>
      <div class="quiz-setup-side"><label class="field-label">Topic<select id="quiz-category">${cats.map((v,i)=>`<option value="${i===0?'all':escapeHTML(v)}">${escapeHTML(v)}</option>`).join('')}</select></label>
      <label class="field-label">Question format<select id="quiz-style"><option value="mixed">Mixed</option><option value="mcq">Multiple choice</option><option value="tf">True / false</option></select></label>
      <label class="field-label">Number of questions<select id="quiz-length"><option value="10">10 questions</option><option value="15">15 questions</option><option value="20">20 questions</option><option value="all">All available</option></select></label>
      <div id="quiz-setup-feedback" aria-live="polite"></div><button class="primary-button" id="start-quiz">Start quiz →</button></div></div>`;
  }

  function shuffled(items) {
    const result = [...items];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  }

  function startQuiz() {
    const pool = currentCourse().quiz;
    const category = $('#quiz-category').value;
    const style = $('#quiz-style').value;
    const limit = $('#quiz-length').value;
    let selected = pool.filter(q => (category==='all'||q.cat===category) && (style==='mixed'||(style==='tf' ? q.type==='tf' : q.type!=='tf')));
    quizQuestions = shuffled(selected);
    if (limit!=='all') quizQuestions = quizQuestions.slice(0,Number(limit));
    if (!quizQuestions.length) { $('#quiz-setup-feedback').innerHTML='<div class="answer-feedback incorrect">There are no questions for that topic and format combination yet. Choose Mixed or another topic.</div>'; return; }
    quizIndex = 0; quizAnswers = []; selectedAnswer = null; quizLocked = false;
    renderQuestion();
  }

  function renderQuestion() {
    const q = quizQuestions[quizIndex];
    const isTF = q.type === 'tf';
    const choices = isTF ? ['True','False'] : q.opts;
    $('#page-content').innerHTML = `${heading('QUIZ IN PROGRESS', 'Question practice', 'Select one answer, then submit to see the explanation.')}
      <section class="quiz-panel"><div class="quiz-progress-top"><span>QUESTION ${String(quizIndex+1).padStart(2,'0')} OF ${String(quizQuestions.length).padStart(2,'0')}</span><span>${Math.round(quizIndex/quizQuestions.length*100)}% COMPLETE</span></div><div class="progress-track"><div class="progress-fill" style="width:${quizIndex/quizQuestions.length*100}%"></div></div>
      <span class="question-type">${isTF?'TRUE / FALSE':'MULTIPLE CHOICE'} · ${escapeHTML(q.cat)}</span><h2 class="quiz-question">${escapeHTML(q.q)}</h2>
      <div class="answer-list">${choices.map((choice,i)=>`<button class="answer-option" data-answer="${i}"><span class="option-letter">${isTF?(i===0?'T':'F'):String.fromCharCode(65+i)}</span><span>${escapeHTML(choice)}</span></button>`).join('')}</div>
      <div id="quiz-feedback"></div><div class="quiz-actions"><button class="secondary-button" id="quit-quiz">Exit quiz</button><div class="right-actions"><button class="primary-button" id="submit-answer" disabled>Submit answer</button><button class="primary-button hidden" id="next-question">${quizIndex===quizQuestions.length-1?'See results':'Next question →'}</button></div></div></section>`;
  }

  function submitAnswer() {
    if (selectedAnswer===null||quizLocked) return;
    const q=quizQuestions[quizIndex];
    const correct=q.type==='tf' ? (q.a?0:1) : q.a;
    const isCorrect=selectedAnswer===correct;
    quizLocked=true;
    quizAnswers.push({q, selected:selectedAnswer, correct, isCorrect});
    $$('.answer-option').forEach((button,i)=>{
      button.disabled=true;
      if (i===correct) button.classList.add('correct');
      else if (i===selectedAnswer) button.classList.add('wrong');
    });
    $('#quiz-feedback').innerHTML=`<div class="answer-feedback ${isCorrect?'':'incorrect'}"><strong>${isCorrect?'Correct.':'Not quite.'}</strong> ${escapeHTML(q.why)}</div>`;
    $('#submit-answer').classList.add('hidden');
    $('#next-question').classList.remove('hidden');
  }

  function showQuizResults() {
    const score=quizAnswers.filter(a=>a.isCorrect).length;
    const total=quizAnswers.length;
    const percent=Math.round(score/total*100);
    const review=quizAnswers.map((a,i)=>{
      const chosen=a.q.type==='tf'?['True','False'][a.selected]:a.q.opts[a.selected];
      const answer=a.q.type==='tf'?['True','False'][a.correct]:a.q.opts[a.correct];
      return `<div class="review-card"><strong>${i+1}. ${escapeHTML(a.q.q)}</strong><p>${a.isCorrect?'Correct.':`Your answer: ${escapeHTML(chosen)}. Correct answer: ${escapeHTML(answer)}. `}${escapeHTML(a.q.why)}</p></div>`;
    }).join('');
    $('#page-content').innerHTML=`${heading('QUIZ COMPLETE', 'Your result', 'Review the explanations for the questions you answered.')}
      <section class="quiz-result"><div class="result-score">${score} / ${total}</div><div class="result-note">${percent}% correct</div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="quiz-actions"><button class="secondary-button" id="review-toggle">Show answer review</button><button class="primary-button" id="retry-quiz">Try another round ↗</button></div><div class="review-list hidden" id="review-list">${review}</div></section>`;
  }

  function renderFlashcards() {
    const terms=currentCourse().terms || [];
    if (!terms.length) return renderEmpty('No flashcards added yet.', 'Flashcards will be generated from the course key terms as the study material is prepared.');
    if (!flashDeck.length || flashDeck._course !== courseId) {
      flashDeck=shuffled(terms.map(t=>({front:t.name,back:t.definition,category:t.category})));
      flashDeck._course=courseId;
      flashIndex=0;
    }
    renderFlashcard();
  }

  function renderFlashcard() {
    const card=flashDeck[flashIndex];
    if (!card) return;
    $('#page-content').innerHTML=`${heading('ACTIVE RECALL', 'Flashcards', 'Try to recall the definition before turning the card over.')}
      <div class="flashcard-wrap"><div class="flashcard-count"><span>CARD ${String(flashIndex+1).padStart(2,'0')} / ${String(flashDeck.length).padStart(2,'0')}</span><span>${escapeHTML(card.category)}</span></div><div class="flash-progress"><div class="progress-fill" style="width:${(flashIndex+1)/flashDeck.length*100}%"></div></div>
      <div class="flashcard ${flashFlipped?'flipped':''}" id="flashcard" role="button" tabindex="0" aria-label="Flip flashcard"><div class="flashcard-category">${escapeHTML(card.category)}</div><div class="flashcard-side-label">${flashFlipped?'DEFINITION':'TERM'}</div><h2>${escapeHTML(flashFlipped?card.back:card.front)}</h2><div class="flash-hint">Click or press Enter to ${flashFlipped?'see the term':'reveal the definition'}</div></div>
      <div class="flash-controls"><button id="flash-prev">← Previous</button><button id="flash-shuffle">Shuffle cards</button><button id="flash-next">Next →</button></div></div>`;
  }

  function renderPage() {
    if (page==='overview') renderOverview();
    else if (page==='notes') renderNotes();
    else if (page==='terms') renderTerms();
    else if (page==='timeline') renderTimeline();
    else if (page==='principles') renderPrinciples();
    else if (page==='eras') renderEras();
    else if (page==='quiz') renderQuizSetup();
    else if (page==='flashcards') renderFlashcards();
    else renderOverview();
  }

  function render() {
    renderSidebar();
    renderPage();
    $('#global-search').placeholder = currentCourse().studyReady ? 'Search this course' : 'Search syllabus';
  }

  function collectSearchResults(query) {
    const c=currentCourse();
    const q=query.toLowerCase().trim();
    if (!q) return [];
    const results=[];
    c.notes?.forEach(n=>{
      const content=[n.title,n.short,...n.sections.flatMap(s=>[s.title,s.body,...(s.bullets||[])])].join(' ');
      if (content.toLowerCase().includes(q)) results.push({title:n.title,type:'STUDY NOTE',action:()=>setPage('notes',n.id)});
    });
    c.terms?.forEach(t=>{if (`${t.name} ${t.definition} ${t.category}`.toLowerCase().includes(q)) results.push({title:t.name,type:'KEY TERM',action:()=>{termQuery=t.name;termCategory='All';setPage('terms');}});});
    c.timeline?.forEach(t=>{if (`${t.date} ${t.title} ${t.place} ${t.detail}`.toLowerCase().includes(q)) results.push({title:`${t.date} · ${t.title}`,type:'TIMELINE',action:()=>{timelinePlace='All';setPage('timeline');}});});
    c.syllabus?.forEach((s,i)=>{if (`${s.title} ${s.topics.join(' ')}`.toLowerCase().includes(q)) results.push({title:s.title,type:'SYLLABUS',action:()=>{setPage('overview');requestAnimationFrame(()=>{const items=$$('.syllabus-item');items[i]?.classList.add('open');items[i]?.scrollIntoView({behavior:'smooth',block:'center'});});}});});
    return results.slice(0,18);
  }

  function openSearch(initial='') {
    $('#search-backdrop').classList.remove('hidden');
    $('#search-modal-input').value=initial;
    renderSearch(initial);
    $('#search-modal-input').focus();
  }
  function closeSearch() { $('#search-backdrop').classList.add('hidden'); }
  function renderSearch(query) {
    const items=collectSearchResults(query);
    $('#search-results').innerHTML=items.length?items.map((item,i)=>`<button class="search-result" data-search-result="${i}"><strong>${escapeHTML(item.title)}</strong><small>${item.type}</small></button>`).join(''):`<div class="search-hint">${query.trim()?'No matching material in this course.':'Type to search study notes, terms and the syllabus.'}</div>`;
  }

  // Main interactions use delegation so the rendered study panels stay lightweight.
  document.addEventListener('click', event => {
    const courseButton=event.target.closest('[data-course]');
    if (courseButton) {
      courseId=courseButton.dataset.course; page='overview'; activeNoteId=''; termQuery=''; termCategory='All'; timelinePlace='All'; flashDeck=[]; flashFlipped=false; render(); return;
    }
    const pageButton=event.target.closest('[data-page]');
    if (pageButton) { setPage(pageButton.dataset.page, pageButton.dataset.note || undefined); return; }
    const noteButton=event.target.closest('[data-note]');
    if (noteButton && noteButton.dataset.note) { activeNoteId=noteButton.dataset.note; renderNotes(); $$('.note-index-button').forEach(b=>b.classList.toggle('active',b.dataset.note===activeNoteId)); return; }

    if (event.target.closest('.syllabus-toggle')) {
      const item=event.target.closest('.syllabus-item');
      const open=item.classList.toggle('open');
      item.querySelector('.syllabus-toggle').setAttribute('aria-expanded',String(open)); return;
    }
    if (event.target.closest('.term-card')) { event.target.closest('.term-card').classList.toggle('open'); return; }
    if (event.target.closest('.principle-card')) { event.target.closest('.principle-card').classList.toggle('open'); return; }
    const category=event.target.closest('[data-category]');
    if (category) { termCategory=category.dataset.category; renderTerms(); return; }
    const place=event.target.closest('[data-place]');
    if (place) { timelinePlace=place.dataset.place; renderTimeline(); return; }

    const answer=event.target.closest('[data-answer]');
    if (answer && !quizLocked) {
      selectedAnswer=Number(answer.dataset.answer);
      $$('.answer-option').forEach(b=>b.classList.toggle('selected',b===answer));
      $('#submit-answer').disabled=false; return;
    }
    if (event.target.closest('#start-quiz')) { startQuiz(); return; }
    if (event.target.closest('#submit-answer')) { submitAnswer(); return; }
    if (event.target.closest('#next-question')) {
      quizIndex++;
      if (quizIndex<quizQuestions.length) { selectedAnswer=null; quizLocked=false; renderQuestion(); }
      else showQuizResults();
      return;
    }
    if (event.target.closest('#quit-quiz')) { setPage('quiz'); return; }
    if (event.target.closest('#retry-quiz')) { setPage('quiz'); return; }
    if (event.target.closest('#review-toggle')) { $('#review-list').classList.toggle('hidden'); event.target.closest('#review-toggle').textContent=$('#review-list').classList.contains('hidden')?'Show answer review':'Hide answer review'; return; }

    if (event.target.closest('#flashcard')) { flashFlipped=!flashFlipped; renderFlashcard(); return; }
    if (event.target.closest('#flash-prev')) { flashIndex=(flashIndex-1+flashDeck.length)%flashDeck.length; flashFlipped=false; renderFlashcard(); return; }
    if (event.target.closest('#flash-next')) { flashIndex=(flashIndex+1)%flashDeck.length; flashFlipped=false; renderFlashcard(); return; }
    if (event.target.closest('#flash-shuffle')) { flashDeck=shuffled(flashDeck); flashIndex=0; flashFlipped=false; renderFlashcard(); return; }
    if (event.target.closest('#mobile-menu')) { $('#sidebar').classList.toggle('open'); return; }
    if (event.target.closest('#close-search')) { closeSearch(); return; }
    const result=event.target.closest('[data-search-result]');
    if (result) {
      const results=collectSearchResults($('#search-modal-input').value);
      const chosen=results[Number(result.dataset.searchResult)];
      closeSearch(); chosen?.action(); return;
    }
    if (event.target===$('#search-backdrop')) closeSearch();
  });

  document.addEventListener('input', event => {
    if (event.target.id==='term-search') { termQuery=event.target.value.toLowerCase().trim(); const cursor=event.target.selectionStart; renderTerms(); const input=$('#term-search'); input.focus(); input.setSelectionRange(cursor,cursor); }
    if (event.target.id==='global-search') { openSearch(event.target.value); }
    if (event.target.id==='search-modal-input') renderSearch(event.target.value);
  });
  $('#global-search').addEventListener('focus',()=>openSearch($('#global-search').value));
  $('.search-box').addEventListener('click',()=>{ if (document.activeElement!==$('#global-search')) openSearch(''); });
  document.addEventListener('keydown', event => {
    if (event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); openSearch(); }
    if (event.key==='Escape') { closeSearch(); $('#sidebar').classList.remove('open'); }
    if (event.key==='Enter' && document.activeElement.id==='flashcard') { flashFlipped=!flashFlipped; renderFlashcard(); }
  });

  render();
})();
