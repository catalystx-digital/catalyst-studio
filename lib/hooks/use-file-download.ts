import { useCallback } from 'react';

export function useFileDownload() {
  const downloadFile = useCallback((content: string, filename: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // Append, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, []);

  return downloadFile;
}