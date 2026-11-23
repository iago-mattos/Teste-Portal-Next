import { Buffer } from "node:buffer";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * Gerador mínimo de .xlsx (Office Open XML) sem dependências: células com
 * texto, número ou fórmula (com valor já calculado), estilos fixos, larguras,
 * cabeçalho congelado e filtro automático.
 */

/* --------------------------------------------------------------- estilos -- */

const FONT = 'name val="Arial"';
const FONTS = [
  `<font><sz val="10"/><${FONT}/></font>`, // 0 normal
  `<font><b/><sz val="10"/><${FONT}/></font>`, // 1 negrito
  `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><${FONT}/></font>`, // 2 negrito branco
  `<font><b/><sz val="14"/><color rgb="FF1F2A44"/><${FONT}/></font>`, // 3 título
  `<font><sz val="9"/><color rgb="FF5D6472"/><${FONT}/></font>`, // 4 discreto
  `<font><b/><sz val="10"/><color rgb="FF17733A"/><${FONT}/></font>`, // 5 ok
  `<font><b/><sz val="10"/><color rgb="FFB42318"/><${FONT}/></font>`, // 6 falha
  `<font><b/><sz val="10"/><color rgb="FF8A5A00"/><${FONT}/></font>`, // 7 aviso
  `<font><b/><sz val="10"/><color rgb="FF3346A8"/><${FONT}/></font>`, // 8 info
  `<font><b/><sz val="10"/><color rgb="FF5D6472"/><${FONT}/></font>`, // 9 neutro
];

const solid = (rgb) =>
  `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  solid("FF1F2A44"), // 2 cabeçalho
  solid("FFE5F4EA"), // 3 ok
  solid("FFFDECEA"), // 4 falha
  solid("FFFFF3D6"), // 5 aviso
  solid("FFE9EDFC"), // 6 info
  solid("FFEEF0F3"), // 7 neutro
  solid("FFF5F6F8"), // 8 faixa de seção
];

const BORDERS = [
  "<border><left/><right/><top/><bottom/><diagonal/></border>",
  '<border><left style="thin"><color rgb="FFD9DDE3"/></left><right style="thin"><color rgb="FFD9DDE3"/></right><top style="thin"><color rgb="FFD9DDE3"/></top><bottom style="thin"><color rgb="FFD9DDE3"/></bottom><diagonal/></border>',
];

const TOP_WRAP = '<alignment vertical="top" wrapText="1"/>';
const CENTER = '<alignment horizontal="center" vertical="top" wrapText="1"/>';

/** Nome do estilo → [fonte, preenchimento, borda, alinhamento, formato]. */
const STYLE_DEFS = {
  default: [0, 0, 0, null],
  header: [2, 2, 1, '<alignment vertical="center" wrapText="1"/>'],
  cell: [0, 0, 1, TOP_WRAP],
  cellBold: [1, 0, 1, TOP_WRAP],
  cellMuted: [4, 0, 1, TOP_WRAP],
  number: [0, 0, 1, '<alignment horizontal="right" vertical="top"/>'],
  title: [3, 0, 0, null],
  subtitle: [4, 0, 0, '<alignment wrapText="1" vertical="top"/>'],
  label: [1, 0, 0, null],
  section: [1, 8, 1, '<alignment vertical="center"/>'],
  "status-ok": [5, 3, 1, CENTER],
  "status-fail": [6, 4, 1, CENTER],
  "status-warn": [7, 5, 1, CENTER],
  "status-info": [8, 6, 1, CENTER],
  "status-muted": [9, 7, 1, CENTER],
  percent: [1, 0, 1, '<alignment horizontal="right" vertical="top"/>', 9],
  numberBold: [1, 0, 1, '<alignment horizontal="right" vertical="top"/>'],
};
const STYLE_NAMES = Object.keys(STYLE_DEFS);
const styleIndex = (name) => {
  const index = STYLE_NAMES.indexOf(name ?? "cell");
  return index < 0 ? STYLE_NAMES.indexOf("cell") : index;
};

function stylesXml() {
  const xfs = STYLE_NAMES.map((name) => {
    const [font, fill, border, alignment, numFmt = 0] = STYLE_DEFS[name];
    const attrs = `numFmtId="${numFmt}"${numFmt ? ' applyNumberFormat="1"' : ""} fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${font ? ' applyFont="1"' : ""}${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${alignment ? ' applyAlignment="1"' : ""}`;
    return alignment ? `<xf ${attrs}>${alignment}</xf>` : `<xf ${attrs}/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join("")}</fonts>
<fills count="${FILLS.length}">${FILLS.join("")}</fills>
<borders count="${BORDERS.length}">${BORDERS.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/* ---------------------------------------------------------------- células -- */

// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function escapeXml(value) {
  return String(value)
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function columnLetter(index) {
  let letters = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function cellXml(cell, ref) {
  if (cell === null || cell === undefined) return "";
  const spec = typeof cell === "object" ? cell : { v: cell };
  const style = ` s="${styleIndex(spec.s)}"`;
  if (spec.f) {
    const value =
      typeof spec.v === "number"
        ? `<v>${spec.v}</v>`
        : spec.v !== undefined
          ? `<v>${escapeXml(spec.v)}</v>`
          : "";
    const type = typeof spec.v === "number" || spec.v === undefined ? "" : ' t="str"';
    return `<c r="${ref}"${style}${type}><f>${escapeXml(spec.f)}</f>${value}</c>`;
  }
  if (typeof spec.v === "number" && Number.isFinite(spec.v)) {
    return `<c r="${ref}"${style}><v>${spec.v}</v></c>`;
  }
  const text = String(spec.v ?? "").slice(0, 32_000);
  if (!text) return `<c r="${ref}"${style}/>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(sheet) {
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = (row.cells ?? row)
        .map((cell, columnIndex) =>
          cellXml(cell, `${columnLetter(columnIndex)}${rowIndex + 1}`),
        )
        .join("");
      const height = row.height ? ` ht="${row.height}" customHeight="1"` : "";
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    })
    .join("");
  const cols = (sheet.columns ?? [])
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const freeze = sheet.freezeRow
    ? `<pane ySplit="${sheet.freezeRow}" xSplit="${sheet.freezeColumn ?? 0}" topLeftCell="${columnLetter(sheet.freezeColumn ?? 0)}${sheet.freezeRow + 1}" activePane="bottomRight" state="frozen"/>`
    : "";
  const lastColumn = columnLetter(Math.max(0, (sheet.columns?.length ?? 1) - 1));
  const filter = sheet.autoFilterRow
    ? `<autoFilter ref="A${sheet.autoFilterRow}:${lastColumn}${sheet.rows.length}"/>`
    : "";
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"${sheet.zoom ? ` zoomScale="${sheet.zoom}"` : ""}>${freeze}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="13"/>
${cols ? `<cols>${cols}</cols>` : ""}
<sheetData>${rows}</sheetData>
${filter}${merges}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

/* ------------------------------------------------------------------- zip -- */

function zip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuffer = Buffer.from(name, "utf8");
    const content = Buffer.from(data, "utf8");
    const compressed = deflateRawSync(content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // hora/data
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

/* -------------------------------------------------------------- workbook -- */

/**
 * sheets: [{ name, rows: [[cell] | { cells, height }], columns: [larguras],
 * freezeRow, freezeColumn, autoFilterRow, merges }]
 * cell: valor simples ou { v, s: estilo, f: fórmula }.
 */
export function buildXlsx({ sheets, title }) {
  const sheetEntries = sheets.map((sheet, index) => ({
    ...sheet,
    file: `xl/worksheets/sheet${index + 1}.xml`,
    id: index + 1,
  }));
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
${sheetEntries.map((sheet) => `<Override PartName="/${sheet.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
    },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(title ?? "")}</dc:title>
<dc:creator>Playwright · casos-de-teste</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created>
</cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheetEntries.map((sheet) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${sheet.id}" r:id="rId${sheet.id}"/>`).join("")}</sheets>
<definedNames>${sheetEntries
        .filter((sheet) => sheet.autoFilterRow)
        .map(
          (sheet) =>
            `<definedName name="_xlnm._FilterDatabase" localSheetId="${sheet.id - 1}" hidden="1">'${escapeXml(sheet.name)}'!$A$${sheet.autoFilterRow}:$${columnLetter(sheet.columns.length - 1)}$${sheet.rows.length}</definedName>`,
        )
        .join("")}${sheetEntries
        .filter((sheet) => sheet.printTitleRow)
        .map(
          (sheet) =>
            `<definedName name="_xlnm.Print_Titles" localSheetId="${sheet.id - 1}">'${escapeXml(sheet.name)}'!$${sheet.printTitleRow}:$${sheet.printTitleRow}</definedName>`,
        )
        .join("")}</definedNames>
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetEntries.map((sheet) => `<Relationship Id="rId${sheet.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.id}.xml"/>`).join("\n")}
<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: "xl/styles.xml", data: stylesXml() },
    ...sheetEntries.map((sheet) => ({ name: sheet.file, data: sheetXml(sheet) })),
  ];
  return zip(files);
}
