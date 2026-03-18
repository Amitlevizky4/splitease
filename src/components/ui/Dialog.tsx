import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-xl',
            'bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2',
            'md:-translate-x-1/2 md:-translate-y-1/2',
            'w-full md:max-w-lg max-h-[85vh] overflow-y-auto',
            'animate-slide-up md:animate-fade-in',
            'focus:outline-none'
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <DialogPrimitive.Title className="text-lg font-semibold text-charcoal">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="p-1 rounded-full hover:bg-gray-100 transition-colors">
              <X size={20} className="text-charcoal-light" />
            </DialogPrimitive.Close>
          </div>
          <div className="p-4">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
