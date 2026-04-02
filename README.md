# xQuizMe

A browser-based quiz app that loads questions from an Excel file.

## Usage

1. Open `index.html` in a browser (no server required).
2. Upload an `.xlsx` or `.xls` file with your question bank.
3. Configure the number of questions, time limit, and passing score.
4. Click **Start Quiz**.

## Excel Format

| Column A | Column B | Column C | Column D | Column E | Column F |
|----------|----------|----------|----------|----------|----------|
| Question | Option A | Option B | Option C | Option D | Correct Answer |

- Row 1 is treated as a header and skipped.
- Columns B–E are shuffled randomly for each question.
- Column F must exactly match one of the option values.

## File Requirements

- Accepted formats: `.xlsx`, `.xls`
- Maximum file size: 10 MB

## Dependencies

All loaded from CDN — no install needed.

- [Bootstrap 5](https://getbootstrap.com/)
- [Font Awesome 6](https://fontawesome.com/)
- [SheetJS](https://sheetjs.com/)
