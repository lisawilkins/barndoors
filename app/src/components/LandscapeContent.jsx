// Shared wrapper for landscape-shaped content (a wide calendar grid, a
// multi-column table) that needs more room than the app's default 800px
// reading width but shouldn't force the whole page wider. Width is fluid
// between 1000–1400px; below a 1000px viewport the outer div scrolls
// horizontally on its own, without dragging the page header or any
// surrounding controls into that scroll region. Print resets are
// unconditional so nothing here fights a page's own @page-driven print
// sizing. `className` extends the scroll boundary (e.g. `print:hidden` for
// content with its own separate print block); `innerClassName` styles the
// constrained box itself (background, padding, shadow, etc).
export default function LandscapeContent({ children, className = '', innerClassName = '' }) {
  return (
    <div className={`w-full overflow-x-auto print:overflow-visible ${className}`}>
      <div
        className={`mx-auto w-full min-w-[1000px] max-w-[1400px] print:min-w-0 print:max-w-none ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  )
}
