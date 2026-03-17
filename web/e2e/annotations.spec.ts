import { expect, test, type Locator, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const samplePdfPath = resolve(process.cwd(), 'test-assets/sample-orientation.pdf')

const waitForViewerReady = async (page: Page) => {
  await expect(page.locator('.canvas-viewport canvas')).toBeVisible()
  await expect(page.locator('.render-badge')).toHaveCount(0)
}

const openSamplePdf = async (page: Page) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(samplePdfPath)
  await waitForViewerReady(page)
  await expect(page.locator('.thumb img').first()).toBeVisible({ timeout: 10000 })
}

const dragOnOverlay = async (
  page: Page,
  overlay: Locator,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps = 8,
) => {
  const box = await overlay.boundingBox()

  if (!box) {
    throw new Error('Annotation overlay is not visible')
  }

  await page.mouse.move(box.x + start.x, box.y + start.y)
  await page.mouse.down()
  await page.mouse.move(box.x + end.x, box.y + end.y, { steps })
  await page.mouse.up()
}

test('multiple text notes render together', async ({ page }) => {
  await openSamplePdf(page)

  const overlay = page.getByTestId('annotation-overlay')

  await page.getByRole('button', { name: 'Note' }).click()
  await dragOnOverlay(page, overlay, { x: 120, y: 150 }, { x: 360, y: 210 })

  await dragOnOverlay(page, overlay, { x: 140, y: 260 }, { x: 360, y: 430 })

  await dragOnOverlay(page, overlay, { x: 110, y: 500 }, { x: 380, y: 620 })

  await expect(page.locator('.viewer-area')).toHaveScreenshot('annotations-notes.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('selection handles remain visible after resizing', async ({ page }) => {
  await openSamplePdf(page)

  const overlay = page.getByTestId('annotation-overlay')

  await page.getByRole('button', { name: 'Note' }).click()
  await dragOnOverlay(page, overlay, { x: 180, y: 220 }, { x: 360, y: 390 })

  await page.locator('[data-annotation-type="note"]').first().click()

  const handle = page.locator('.annotation-handle').last()
  const handleBox = await handle.boundingBox()

  if (!handleBox) {
    throw new Error('Resize handle is not visible')
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 90, handleBox.y + 110, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('.viewer-area')).toHaveScreenshot('annotations-selection-handles.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('text note overlays render stably', async ({ page }) => {
  await openSamplePdf(page)

  const overlay = page.getByTestId('annotation-overlay')

  await page.getByRole('button', { name: 'Note' }).click()
  await dragOnOverlay(page, overlay, { x: 420, y: 180 }, { x: 620, y: 320 })

  await page.locator('.annotation-note-content').first().dblclick()
  const noteInput = page.getByLabel('Note text')
  await noteInput.fill('Review this section')
  await noteInput.blur()

  await dragOnOverlay(page, overlay, { x: 140, y: 560 }, { x: 320, y: 690 })

  await expect(page.locator('.viewer-area')).toHaveScreenshot('annotations-note-only.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})
