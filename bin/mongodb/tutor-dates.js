db.tutor_report.find().forEach(report => {
  let minDate = new Date();
  let maxDate = new Date('2023-01-01');
  report.perfs.forEach(perf => {
    const dates = perf.stats.dates;
    if (dates[0] < minDate) minDate = dates[0];
    if (dates[1] > maxDate) maxDate = dates[1];
  });
  db.tutor_report.updateOne({ _id: report._id }, { $set: { dates: [minDate, maxDate] } });
});
