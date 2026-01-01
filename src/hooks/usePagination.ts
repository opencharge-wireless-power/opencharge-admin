import { useMemo, useState } from "react"

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  // keep page valid if list shrinks (filters/range change)
  if (page > totalPages) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setTimeout(() => setPage(totalPages), 0)
  }

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    pageItems,
    totalItems: items.length,
    canPrev: page > 1,
    canNext: page < totalPages,
    next: () => setPage((p) => Math.min(totalPages, p + 1)),
    prev: () => setPage((p) => Math.max(1, p - 1)),
    reset: () => setPage(1),
  }
}