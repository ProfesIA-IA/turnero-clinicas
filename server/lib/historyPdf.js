import PDFDocument from 'pdfkit';

const BLUE = '#1a73e8';
const INK = '#3c4043';
const MUTED = '#70757a';
const LINE = '#dadce0';
const CARD = '#f8f9fa';

export function buildHistoryPdf({ patient, notes, settings, images }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tz = settings?.timezone || 'America/Argentina/Buenos_Aires';
    const left = 40;
    const width = doc.page.width - 80;

    doc.rect(0, 0, doc.page.width, 78).fill(BLUE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(settings?.name || 'Clínica', left, 22, { width });
    doc.font('Helvetica').fontSize(11).text('Historia clínica', left, 46, { width });

    let y = 98;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(patient.name || 'Paciente', left, y, { width });
    y = doc.y + 4;
    const contact = [patient.phone, patient.email].filter(Boolean).join('  ·  ') || 'Sin datos de contacto';
    doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(contact, left, y, { width });
    y = doc.y + 18;

    if (!notes.length) {
      doc.fillColor(MUTED).fontSize(12).text('Sin entradas.', left, y);
      doc.end();
      return;
    }

    for (const note of notes) {
      const heading = [note.service?.name || 'Atención', note.professional?.name].filter(Boolean).join(' · ');
      const turno = note.appointment?.starts_at ? `Turno ${formatWhen(note.appointment.starts_at, tz)} · ` : '';
      const meta = `${turno}Cargada ${formatWhen(note.created_at, tz)}`;
      const lines = [];
      if (note.details) lines.push(String(note.details));
      for (const item of note.custom_values || []) {
        if (item.value === '' || item.value === false || item.value == null) continue;
        const value = item.field_type === 'checkbox' ? 'Sí' : String(item.value);
        lines.push(`${item.label}: ${value}`);
      }
      const body = lines.join('\n');
      const fileNames = (note.files || []).map((file) => file.original_name).filter(Boolean);
      const pics = (note.files || []).map((file) => images.get(file.id)).filter(Boolean);
      const textHeight = doc.heightOfString(body || ' ', { width: width - 24 });
      const block = 36 + textHeight + (fileNames.length ? 16 : 0) + pics.length * 110 + 24;
      if (y + Math.min(block, 180) > doc.page.height - 56) {
        doc.addPage();
        y = 40;
      }
      doc.roundedRect(left, y, width, 8).fill(BLUE);
      const top = y;
      y += 16;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(heading, left + 12, y, { width: width - 24 });
      y = doc.y + 2;
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(meta, left + 12, y, { width: width - 24 });
      y = doc.y + 8;
      if (body) {
        doc.fillColor(INK).fontSize(11).text(body, left + 12, y, { width: width - 24 });
        y = doc.y + 8;
      }
      for (const image of pics) {
        if (y + 100 > doc.page.height - 56) {
          doc.addPage();
          y = 40;
        }
        try {
          doc.image(image, left + 12, y, { fit: [180, 100] });
          y += 108;
        } catch {
          // formato no soportado por el PDF
        }
      }
      if (fileNames.length) {
        doc.fillColor(MUTED).fontSize(9).text(`Archivos: ${fileNames.join(', ')}`, left + 12, y, { width: width - 24 });
        y = doc.y + 8;
      }
      const height = y - top + 8;
      doc.roundedRect(left, top, width, height).lineWidth(1).strokeColor(LINE).stroke();
      doc.rect(left, top, width, 4).fill(BLUE);
      y = top + height + 12;
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
        `Powered by ProfesIA  ·  ${i + 1} / ${pages.count}`,
        left,
        doc.page.height - 28,
        { width, align: 'center' }
      );
    }
    doc.end();
  });
}

function formatWhen(value, tz) {
  try {
    return new Date(value).toLocaleString('es-AR', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
