import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const outputPath = resolve(process.cwd(), 'test-assets/sample-orientation.pdf')

const pdfDoc = await PDFDocument.create()
const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

const pagePalettes = [
  {
    top: rgb(0.88, 0.2, 0.2),
    bottom: rgb(0.15, 0.3, 0.9),
    accent: rgb(0.92, 0.87, 0.25),
  },
  {
    top: rgb(0.12, 0.6, 0.28),
    bottom: rgb(0.64, 0.18, 0.68),
    accent: rgb(0.95, 0.5, 0.2),
  },
  {
    top: rgb(0.18, 0.42, 0.84),
    bottom: rgb(0.75, 0.25, 0.25),
    accent: rgb(0.2, 0.78, 0.7),
  },
]

for (let index = 0; index < pagePalettes.length; index += 1) {
  const pageNumber = index + 1
  const palette = pagePalettes[index]
  const page = pdfDoc.addPage([700, 900])

  page.drawText(`PAGE ${pageNumber} TOP`, {
    x: 230,
    y: 850,
    size: 28,
    font,
    color: palette.top,
  })

  page.drawText(`PAGE ${pageNumber} BOTTOM`, {
    x: 190,
    y: 30,
    size: 28,
    font,
    color: palette.bottom,
  })

  page.drawRectangle({
    x: 40,
    y: 760,
    width: 200,
    height: 100,
    color: palette.top,
  })

  page.drawText('TOP-LEFT', {
    x: 55,
    y: 800,
    size: 18,
    font,
    color: rgb(1, 1, 1),
  })

  page.drawRectangle({
    x: 40,
    y: 40,
    width: 230,
    height: 100,
    color: palette.bottom,
  })

  page.drawText('BOTTOM-LEFT', {
    x: 55,
    y: 80,
    size: 18,
    font,
    color: rgb(1, 1, 1),
  })

  page.drawRectangle({
    x: 430,
    y: 370,
    width: 220,
    height: 140,
    color: palette.accent,
  })

  page.drawText(`CARD ${pageNumber}`, {
    x: 470,
    y: 430,
    size: 20,
    font,
    color: rgb(0.08, 0.08, 0.08),
  })
}

const pdfBytes = await pdfDoc.save()
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, pdfBytes)

console.log(`Sample PDF generated at ${outputPath}`)
