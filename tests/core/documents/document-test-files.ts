export interface GeneratedDocumentFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

const maximumGeneratedFileSize = 64 * 1024 * 1024;
const pdfHeader = Buffer.from("%PDF-1.4\n", "ascii");
const pdfTrailer = Buffer.from("\n%%EOF\n", "ascii");

export function createSizedPdfFile(
  size: number,
  name: string,
): GeneratedDocumentFile {
  if (!Number.isSafeInteger(size) || size < pdfHeader.length + pdfTrailer.length) {
    throw new Error("O tamanho do PDF gerado precisa acomodar header e trailer.");
  }
  if (size > maximumGeneratedFileSize) {
    throw new Error(
      `O helper Core limita arquivos gerados a ${maximumGeneratedFileSize} bytes para proteger a execucao.`,
    );
  }

  const buffer = Buffer.alloc(size, 0x20);
  pdfHeader.copy(buffer, 0);
  pdfTrailer.copy(buffer, size - pdfTrailer.length);
  return { name, mimeType: "application/pdf", buffer };
}

export function createEmptyPdfFile(): GeneratedDocumentFile {
  return {
    name: "core-empty.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  };
}

export function createDisallowedTextFile(): GeneratedDocumentFile {
  return {
    name: "core-extension-not-allowed.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("portal-core", "utf8"),
  };
}

export function createPngContentNamedAsPdf(): GeneratedDocumentFile {
  return {
    name: "core-content-mismatch.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  };
}

export function createCorruptedPdfFile(): GeneratedDocumentFile {
  return {
    name: "core-corrupted.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\ncorrupted-without-xref-or-eof", "ascii"),
  };
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function createValidPdfFile(
  marker: string,
  name = "core-valid.pdf",
): GeneratedDocumentFile {
  const content = `BT /F1 12 Tf 72 720 Td (${escapePdfText(marker)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body, "ascii"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;

  return { name, mimeType: "application/pdf", buffer: Buffer.from(body, "ascii") };
}

const onePixelJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==",
  "base64",
);

export function createValidJpegFile(
  marker: string,
  name = "core-valid.jpg",
): GeneratedDocumentFile {
  const comment = Buffer.from(marker, "utf8");
  const commentSegment = Buffer.concat([
    Buffer.from([0xff, 0xfe, (comment.length + 2) >> 8, (comment.length + 2) & 0xff]),
    comment,
  ]);
  const buffer = Buffer.concat([
    onePixelJpeg.subarray(0, -2),
    commentSegment,
    onePixelJpeg.subarray(-2),
  ]);
  return { name, mimeType: "image/jpeg", buffer };
}

export function createValidPngFile(
  name = "core-valid.png",
): GeneratedDocumentFile {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  };
}

export function withDocumentIdentity(
  file: GeneratedDocumentFile,
  name: string,
  mimeType: string,
): GeneratedDocumentFile {
  return { name, mimeType, buffer: file.buffer };
}
