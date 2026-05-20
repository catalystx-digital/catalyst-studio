import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'site-builder-tutorial-completed'

export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check localStorage on mount
    const completed = localStorage.getItem(STORAGE_KEY)
    setIsFirstVisit(completed !== 'true')
    setIsLoading(false)
  }, [])

  const markCompleted = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsFirstVisit(false)
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setIsFirstVisit(true)
  }, [])

  return {
    isFirstVisit,
    isLoading,
    markCompleted,
    reset,
  }
}
