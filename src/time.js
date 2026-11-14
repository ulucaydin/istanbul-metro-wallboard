const timeZone = 'Europe/Istanbul';

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone, weekday: 'short', day: 'numeric', month: 'short',
});
const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const publishedFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
});

export function clockParts(date) {
  const [hours, minutes, seconds] = clockFormat.format(date).split(':');
  return { time: hours + ':' + minutes, seconds, date: dateFormat.format(date) };
}

export function formatFetch(date) {
  return timestampFormat.format(new Date(date));
}

export function formatPublication(date) {
  return publishedFormat.format(new Date(date + 'T00:00:00Z'));
}
