import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const pdfMock = vi.hoisted(() => {
  const mockRender = vi.fn(() => ({ promise: Promise.resolve() }))
  const mockGetPage = vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 800 * scale,
      height: 1000 * scale,
    }),
    render: mockRender,
  }))

  const mockPdfDoc = {
    numPages: 3,
    getPage: mockGetPage,
  }

  const mockGetDocument = vi.fn(() => ({
    promise: Promise.resolve(mockPdfDoc),
  }))

  return {
    mockRender,
    mockGetPage,
    mockGetDocument,
  }
})

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdfMock.mockGetDocument,
}))

describe('Milestone 1 viewer', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: vi.fn(() => ({
        fillRect: vi.fn(),
        setTransform: vi.fn(),
        clearRect: vi.fn(),
      })),
      configurable: true,
    })

    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: vi.fn(() => 'data:image/png;base64,mock-thumb'),
      configurable: true,
    })

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      value: 1000,
      configurable: true,
    })

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      value: 1200,
      configurable: true,
    })
  })

  it('shows an error for non-PDF uploads', async () => {
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['not a pdf'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [badFile] } })

    expect(await screen.findByText('Please upload a valid PDF file.')).toBeInTheDocument()
    expect(pdfMock.mockGetDocument).not.toHaveBeenCalled()
  })

  it('loads a PDF and triggers first-page rendering', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' })

    await user.upload(fileInput, pdfFile)

    await waitFor(() => {
      expect(pdfMock.mockGetDocument).toHaveBeenCalledTimes(1)
      expect(pdfMock.mockGetPage).toHaveBeenCalledWith(1)
      expect(pdfMock.mockRender).toHaveBeenCalled()
    })

    expect(await screen.findByText(/sample\.pdf/i)).toBeInTheDocument()
    expect(screen.getByLabelText('PDF page canvas')).toBeInTheDocument()
  })

  it('supports next/previous and jump-to-page navigation', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    const pageInput = await screen.findByRole('spinbutton')
    const nextButton = screen.getByRole('button', { name: 'Next' })
    const prevButton = screen.getByRole('button', { name: 'Prev' })

    await user.click(nextButton)
    expect(pageInput).toHaveValue(2)

    await user.click(prevButton)
    expect(pageInput).toHaveValue(1)

    fireEvent.change(pageInput, { target: { value: '3' } })
    expect(pageInput).toHaveValue(3)
    expect(nextButton).toBeDisabled()
  })

  it('updates zoom percentage when zoom controls are used', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    const zoomTag = await screen.findByText(/%/)
    const before = zoomTag.textContent

    await user.click(screen.getByRole('button', { name: '+' }))

    await waitFor(() => {
      expect(zoomTag.textContent).not.toBe(before)
    })

    const afterZoomIn = zoomTag.textContent
    await user.click(screen.getByRole('button', { name: '-' }))

    await waitFor(() => {
      expect(zoomTag.textContent).not.toBe(afterZoomIn)
    })
  })

  it('applies fit-width and fit-page scale presets', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    const zoomTag = await screen.findByText(/%/)

    await waitFor(() => {
      expect(zoomTag).toHaveTextContent('122%')
    })

    await user.click(screen.getByRole('button', { name: 'Fit Page' }))
    await waitFor(() => {
      expect(zoomTag).toHaveTextContent('118%')
    })

    await user.click(screen.getByRole('button', { name: 'Fit Width' }))
    await waitFor(() => {
      expect(zoomTag).toHaveTextContent('122%')
    })
  })

  it('navigates to selected page when a thumbnail is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    const pageInput = await screen.findByRole('spinbutton')
    const pageTwoThumb = await screen.findByRole('button', { name: /Page 2/i })

    await user.click(pageTwoThumb)

    expect(pageInput).toHaveValue(2)
  })
})
