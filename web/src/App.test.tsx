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

const annotationId = (
  sequence: number,
): `${string}-${string}-${string}-${string}-${string}` =>
  `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`

describe('Milestone 2 viewer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()

    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation((() => {
      let nextId = 0
      return () => annotationId(++nextId)
    })())

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

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      value: vi.fn(() => ({
        width: 800,
        height: 1000,
        left: 0,
        top: 0,
        right: 800,
        bottom: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })),
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

  it('creates a rectangle annotation from drag input', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: 'Rectangle' }))

    const overlay = await screen.findByTestId('annotation-overlay')
    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 140 })
    fireEvent.pointerMove(window, { clientX: 260, clientY: 320 })
    fireEvent.pointerUp(window, { clientX: 260, clientY: 320 })

    const annotation = await screen.findByTestId(annotationId(1))
    expect(annotation).toHaveAttribute('data-annotation-type', 'rectangle')
    expect(annotation).toHaveAttribute('data-width', '160')
    expect(annotation).toHaveAttribute('data-height', '180')
  })

  it('moves a selected annotation', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: 'Rectangle' }))

    const overlay = await screen.findByTestId('annotation-overlay')
    fireEvent.pointerDown(overlay, { clientX: 80, clientY: 120 })
    fireEvent.pointerMove(window, { clientX: 200, clientY: 220 })
    fireEvent.pointerUp(window, { clientX: 200, clientY: 220 })

    await user.click(screen.getByRole('button', { name: 'Select' }))
    const annotation = await screen.findByTestId(annotationId(1))

    fireEvent.pointerDown(annotation, { clientX: 120, clientY: 140 })
    fireEvent.pointerMove(window, { clientX: 180, clientY: 190 })
    fireEvent.pointerUp(window, { clientX: 180, clientY: 190 })

    await waitFor(() => {
      expect(annotation).toHaveAttribute('data-x', '140')
      expect(annotation).toHaveAttribute('data-y', '170')
    })
  })

  it('resizes a selected annotation with handles', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: 'Rectangle' }))

    const overlay = await screen.findByTestId('annotation-overlay')
    fireEvent.pointerDown(overlay, { clientX: 70, clientY: 90 })
    fireEvent.pointerMove(window, { clientX: 170, clientY: 170 })
    fireEvent.pointerUp(window, { clientX: 170, clientY: 170 })

    await user.click(screen.getByRole('button', { name: 'Select' }))
    const handle = await screen.findByTestId(`handle-${annotationId(1)}-se`)

    fireEvent.pointerDown(handle, { clientX: 170, clientY: 170 })
    fireEvent.pointerMove(window, { clientX: 230, clientY: 250 })
    fireEvent.pointerUp(window, { clientX: 230, clientY: 250 })

    const annotation = await screen.findByTestId(annotationId(1))
    expect(annotation).toHaveAttribute('data-width', '160')
    expect(annotation).toHaveAttribute('data-height', '160')
  })

  it('deletes the selected annotation with the keyboard', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: 'Rectangle' }))
    const overlay = await screen.findByTestId('annotation-overlay')
    fireEvent.pointerDown(overlay, { clientX: 80, clientY: 120 })
    fireEvent.pointerMove(window, { clientX: 180, clientY: 220 })
    fireEvent.pointerUp(window, { clientX: 180, clientY: 220 })

    await user.click(screen.getByRole('button', { name: 'Select' }))
    const annotation = await screen.findByTestId(annotationId(1))
    fireEvent.pointerDown(annotation, { clientX: 100, clientY: 140 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 140 })

    fireEvent.keyDown(window, { key: 'Delete' })

    await waitFor(() => {
      expect(screen.queryByTestId(annotationId(1))).not.toBeInTheDocument()
    })
  })
})
