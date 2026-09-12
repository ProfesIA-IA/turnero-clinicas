export function generateSlots({ windows, busy, durationMin, intervalMin, earliestMin = 0 }) {
  const slots = [];
  const duration = Number(durationMin);
  const step = Number(intervalMin) || duration;

  for (const window of windows) {
    const start = Number(window.startMin);
    const end = Number(window.endMin);
    for (let t = start; t + duration <= end; t += step) {
      if (t < earliestMin) continue;
      const slotEnd = t + duration;
      const overlaps = busy.some((block) => t < Number(block.endMin) && slotEnd > Number(block.startMin));
      if (overlaps) continue;
      slots.push({ startMin: t, endMin: slotEnd });
    }
  }

  return slots;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}
