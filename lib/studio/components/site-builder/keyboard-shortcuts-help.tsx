import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Keyboard, GraduationCap } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
  onRestartTutorial?: () => void
}

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['F'], description: 'Fit view to all nodes' },
    { keys: ['+', '='], description: 'Zoom in' },
    { keys: ['-', '_'], description: 'Zoom out' },
    { keys: ['Arrow Keys'], description: 'Navigate component tree' },
    { keys: ['Tab'], description: 'Navigate to next component' },
    { keys: ['Shift', 'Tab'], description: 'Navigate to previous component' },
    { keys: ['Space', 'Drag'], description: 'Pan canvas' },
  ]},
  { category: 'Selection', items: [
    { keys: ['Click'], description: 'Select node' },
    { keys: ['Ctrl/Cmd', 'Click'], description: 'Add to selection' },
    { keys: ['Shift', 'Click'], description: 'Range selection' },
    { keys: ['Ctrl/Cmd', 'A'], description: 'Select all at current level' },
    { keys: ['Space'], description: 'Toggle selection' },
    { keys: ['Esc'], description: 'Clear selection' },
  ]},
  { category: 'Component Manipulation', items: [
    { keys: ['Enter'], description: 'Edit selected component' },
    { keys: ['Delete'], description: 'Delete selected (with confirmation)' },
    { keys: ['Backspace'], description: 'Delete selected (with confirmation)' },
    { keys: ['Alt', '↑'], description: 'Move component up' },
    { keys: ['Alt', '↓'], description: 'Move component down' },
    { keys: ['Ctrl/Cmd', 'N'], description: 'Add new component' },
  ]},
  { category: 'Clipboard', items: [
    { keys: ['Ctrl/Cmd', 'C'], description: 'Copy selected components' },
    { keys: ['Ctrl/Cmd', 'X'], description: 'Cut selected components' },
    { keys: ['Ctrl/Cmd', 'V'], description: 'Paste components' },
  ]},
  { category: 'History', items: [
    { keys: ['Ctrl/Cmd', 'Z'], description: 'Undo' },
    { keys: ['Ctrl/Cmd', 'Shift', 'Z'], description: 'Redo' },
    { keys: ['Ctrl/Cmd', 'Y'], description: 'Redo (alternative)' },
  ]},
  { category: 'Help', items: [
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ]},
]

export function KeyboardShortcutsHelp({ isOpen, onClose, onRestartTutorial }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gray-900/95 backdrop-blur-xl border-gray-700 text-white overflow-y-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-[#FF5500]" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Master these shortcuts to work faster in the sitemap builder
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 mt-6">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && <span className="text-gray-500 text-xs">+</span>}
                          <kbd className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-md font-mono">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="text-sm text-gray-400 ml-4">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
          {onRestartTutorial && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onRestartTutorial}
                className="text-xs"
              >
                <GraduationCap className="h-3 w-3 mr-2" />
                Restart Tutorial
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs">?</kbd> anytime to view this help
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}