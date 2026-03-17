import { expect, test, type Page } from '@playwright/test'
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

test('viewer and thumbnail orientation are not flipped', async ({ page }) => {
  await openSamplePdf(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-orientation.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await expect(page.locator('.thumbs-panel')).toHaveScreenshot('thumbs-orientation.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('zoom controls keep rendering stable', async ({ page }) => {
  await openSamplePdf(page)

  await page.getByRole('button', { name: '+' }).click()
  await waitForViewerReady(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-zoom-in.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.getByRole('button', { name: '-' }).click()
  await waitForViewerReady(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-zoom-reset.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('fit mode changes are visually correct', async ({ page }) => {
  await openSamplePdf(page)

  await page.getByRole('button', { name: 'Fit Page' }).click()
  await waitForViewerReady(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-fit-page.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.getByRole('button', { name: 'Fit Width' }).click()
  await waitForViewerReady(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-fit-width.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('navigating pages updates main canvas and thumbnails', async ({ page }) => {
  await openSamplePdf(page)

  await page.getByRole('button', { name: 'Next' }).click()
  await waitForViewerReady(page)
  await page.getByRole('button', { name: 'Page 3 thumbnail' }).click()
  await waitForViewerReady(page)

  await expect(page.locator('.viewer-area')).toHaveScreenshot('viewer-page-3.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await expect(page.locator('.thumbs-panel')).toHaveScreenshot('thumbs-page-3-active.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})
