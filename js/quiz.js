/* ─── State ──────────────────────────────────────────────────────── */
let questions = [];
let quizQuestions = [];
let current = 0;
let score = 0;
let selectedAnswer = null;
let userAnswers = [];
let timerInterval;
let timeLeft;
let answered = false;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* ─── Security ───────────────────────────────────────────────────── */
const ALLOWED_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                           // .xls
]);
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function validateFile(file) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext))  return 'Only .xlsx and .xls files are allowed.';
    if (!ALLOWED_MIME_TYPES.has(file.type)) return 'Invalid file type. Only Excel files are allowed.';
    if (file.size > MAX_FILE_SIZE)     return 'File is too large. Maximum size is 10 MB.';
    return null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function $(id) { return document.getElementById(id); }

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

/* ─── File Upload ────────────────────────────────────────────────── */
function initUploadZone() {
    const zone = $('uploadZone');
    const input = $('excelFile');

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) setFile(file, input);
    });

    input.addEventListener('change', () => {
        if (input.files[0]) setFile(input.files[0], input);
    });
}

function setFile(file, input) {
    const error = validateFile(file);
    if (error) {
        showAlert(error);
        return;
    }

    const zone = $('uploadZone');
    const display = $('fileNameDisplay');
    const icon = zone.querySelector('.upload-icon');

    // Update DataTransfer so input.files reflects the dropped file
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    zone.classList.add('file-selected');
    icon.className = 'fas fa-file-excel upload-icon';
    display.classList.remove('hidden');

    // Use DOM construction to avoid XSS via a crafted filename
    display.textContent = '';
    const checkIcon = document.createElement('i');
    checkIcon.className = 'fas fa-check-circle';
    display.appendChild(checkIcon);
    display.appendChild(document.createTextNode(' ' + file.name));
}

/* ─── Excel Parsing ──────────────────────────────────────────────── */
function parseExcel(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const parsed = json.slice(1).map(row => ({
                question: row[0],
                options: shuffle([row[1], row[2], row[3], row[4]].filter(Boolean)),
                answer: row[5]
            })).filter(q => q.question && q.answer);

            resolve(parsed);
        };

        reader.readAsArrayBuffer(file);
    });
}

/* ─── Quiz Start ─────────────────────────────────────────────────── */
async function startQuiz() {
    const file = $('excelFile').files[0];
    if (!file) {
        showAlert('Please upload an Excel file before starting.');
        return;
    }

    questions = await parseExcel(file);

    if (questions.length === 0) {
        showAlert('No valid questions found in the file. Check the format.');
        return;
    }

    const count = Math.min(parseInt($('questionCount').value) || 5, questions.length);
    quizQuestions = shuffle(questions).slice(0, count);

    current = 0;
    score = 0;
    userAnswers = new Array(quizQuestions.length).fill(null);

    hide('setup');
    show('quiz');
    hide('result');

    startTimer();
    loadQuestion();
}

/* ─── Timer ──────────────────────────────────────────────────────── */
function startTimer() {
    const minutes = parseInt($('timer').value) || 1;
    timeLeft = minutes * 60;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft < 0) finishQuiz();
    }, 1000);
}

function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    $('timerText').textContent = `${min}:${sec.toString().padStart(2, '0')}`;

    const el = $('timerDisplay');
    el.classList.remove('warning', 'danger');
    if (timeLeft <= 30)       el.classList.add('danger');
    else if (timeLeft <= 60)  el.classList.add('warning');
}

/* ─── Question Loading ───────────────────────────────────────────── */
function loadQuestion() {
    const q = quizQuestions[current];
    selectedAnswer = null;
    answered = false;

    $('questionCounter').textContent = `Question ${current + 1} of ${quizQuestions.length}`;
    $('question').textContent = q.question;
    $('feedback').innerHTML = '';

    renderAnswers(q.options);
    updateProgress();
    updateActionButton();
}

function renderAnswers(options) {
    const container = $('answers');
    container.innerHTML = '';

    options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'answer-option';
        div.dataset.value = opt;

        const letterDiv = document.createElement('div');
        letterDiv.className = 'answer-letter';
        letterDiv.textContent = LETTERS[i];

        const textDiv = document.createElement('div');
        textDiv.className = 'answer-text';
        textDiv.textContent = opt;

        div.appendChild(letterDiv);
        div.appendChild(textDiv);
        div.addEventListener('click', () => selectAnswer(div, opt));
        container.appendChild(div);
    });
}

function selectAnswer(el, value) {
    if (answered) return;

    document.querySelectorAll('.answer-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    selectedAnswer = value;
}

/* ─── Progress ───────────────────────────────────────────────────── */
function updateProgress() {
    const pct = (current / quizQuestions.length) * 100;
    $('progressBar').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', pct);
}

/* ─── Action Button ──────────────────────────────────────────────── */
function updateActionButton() {
    const btn = $('actionBtn');
    btn.className = 'btn btn-action';

    if (!answered) {
        btn.innerHTML = `<i class="fas fa-check"></i> Check Answer`;
    } else if (current === quizQuestions.length - 1) {
        btn.innerHTML = `<i class="fas fa-flag-checkered"></i> Submit Quiz`;
        btn.classList.add('submit-btn');
    } else {
        btn.innerHTML = `<i class="fas fa-arrow-right"></i> Next Question`;
        btn.classList.add('next-btn');
    }
}

function handleAction() {
    if (!answered) {
        checkAnswer();
        return;
    }
    if (current === quizQuestions.length - 1) {
        finishQuiz();
    } else {
        current++;
        loadQuestion();
    }
}

/* ─── Check Answer ───────────────────────────────────────────────── */
function checkAnswer() {
    if (!selectedAnswer) {
        showAlert('Please select an answer before continuing.');
        return;
    }

    const correct = quizQuestions[current].answer;
    userAnswers[current] = selectedAnswer;
    answered = true;

    const isCorrect = selectedAnswer === correct;
    if (isCorrect) score++;

    // Style answer options
    document.querySelectorAll('.answer-option').forEach(opt => {
        opt.classList.add('disabled');
        const val = opt.dataset.value;
        if (val === correct)              opt.classList.add('correct');
        else if (val === selectedAnswer)  opt.classList.add('incorrect');
    });

    // Show feedback
    const feedbackDiv = $('feedback');
    if (isCorrect) {
        feedbackDiv.innerHTML = `
            <div class="feedback-box correct-feedback">
                <i class="fas fa-check-circle"></i> Correct! Well done.
            </div>`;
    } else {
        feedbackDiv.innerHTML = `
            <div class="feedback-box incorrect-feedback">
                <i class="fas fa-times-circle"></i>
                Incorrect. The correct answer is: <strong>${escapeHtml(correct)}</strong>
            </div>`;
    }

    updateActionButton();
}

/* ─── Exit Quiz ──────────────────────────────────────────────────── */
function exitQuiz() {
    if (!confirm('Are you sure you want to exit? Your progress will be lost.')) return;
    clearInterval(timerInterval);
    hide('quiz');
    show('setup');
}

/* ─── Finish Quiz ────────────────────────────────────────────────── */
function finishQuiz() {
    clearInterval(timerInterval);
    hide('quiz');

    const total   = quizQuestions.length;
    const pct     = (score / total) * 100;
    const pass    = parseInt($('passPercent').value) || 70;
    const passed  = pct >= pass;

    // Build review HTML
    let reviewHTML = '';
    quizQuestions.forEach((q, i) => {
        const user      = userAnswers[i];
        const correct   = q.answer;
        const isCorrect = user === correct;
        const cls       = isCorrect ? 'review-correct' : 'review-incorrect';

        reviewHTML += `
            <div class="review-item ${cls}">
                <div class="review-question">
                    <i class="fas fa-${isCorrect ? 'check-circle text-success' : 'times-circle text-danger'}"></i>
                    Q${i + 1}: ${escapeHtml(q.question)}
                </div>
                <div class="review-answers">
                    <span class="review-pill ${isCorrect ? 'your-correct' : 'your-incorrect'}">
                        <i class="fas fa-user"></i> ${escapeHtml(user || 'No answer')}
                    </span>
                    ${!isCorrect ? `<span class="review-pill correct-answer"><i class="fas fa-check"></i> ${escapeHtml(correct)}</span>` : ''}
                </div>
            </div>`;
    });

    const resultEl = $('result');
    show('result');
    resultEl.innerHTML = `
        <div class="result-card mb-4">
            <div class="result-badge ${passed ? 'pass' : 'fail'}">
                <i class="fas fa-${passed ? 'trophy' : 'times-circle'}"></i>
                ${passed ? 'PASSED' : 'FAILED'}
            </div>
            <div class="score-display">${pct.toFixed(1)}%</div>
            <p class="score-label">${score} out of ${total} correct &nbsp;·&nbsp; Passing Score: ${pass}%</p>
            <button class="btn-restart" onclick="resetQuiz()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>

        <div class="mt-4">
            <div class="review-header">
                <i class="fas fa-clipboard-list text-primary"></i> Exam Review
            </div>
            ${reviewHTML}
        </div>`;
}

/* ─── Reset ──────────────────────────────────────────────────────── */
function resetQuiz() {
    location.reload();
}

/* ─── Utility ────────────────────────────────────────────────────── */
function showAlert(msg) {
    // Replace native alert with a temporary inline message if possible
    const existing = document.querySelector('.quiz-alert');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'quiz-alert feedback-box incorrect-feedback mb-3';
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;

    // Insert before the start button or action button
    const btn = $('actionBtn') || document.querySelector('.btn-start');
    if (btn) btn.parentElement.insertBefore(el, btn);

    setTimeout(() => el.remove(), 3500);
}

/* ─── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initUploadZone);
