(function () {
  const d = LG.dates;
  T.test('parseDate day-first text formats', () => {
    T.eq(d.parseDate('13-12-2025'), '2025-12-13');
    T.eq(d.parseDate('13.12.2025'), '2025-12-13');
    T.eq(d.parseDate('13/12/2025'), '2025-12-13');
    T.eq(d.parseDate('3-2-2025'), '2025-02-03');
    T.eq(d.parseDate('2025-12-13'), '2025-12-13');
  });
  T.test('parseDate rejects junk and impossible dates', () => {
    T.eq(d.parseDate('31-02-2025'), null);
    T.eq(d.parseDate('Date'), null);
    T.eq(d.parseDate(''), null);
  });
  T.test('parseDate Excel serial and Date', () => {
    T.eq(d.parseDate(45000), '2023-03-15');
    T.eq(d.parseDate(new Date(2025, 11, 13)), '2025-12-13');
  });
  T.test('formatDate and addDaysISO', () => {
    T.eq(d.formatDate('2025-12-13'), '13-12-2025');
    T.eq(d.addDaysISO('2025-12-31', 1), '2026-01-01');
  });
})();
