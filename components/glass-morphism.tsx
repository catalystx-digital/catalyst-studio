'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: number;
}

/**
 * Glass Morphism Card Component
 */
export function GlassCard({ 
  children, 
  className = '', 
  blur = 'md',
  // opacity = 0.1 // Reserved for future opacity control
}: GlassCardProps) {
  const blurClass = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  }[blur];

  // Glass effects are always enabled now
  const glassClasses = `${blurClass} bg-white/10 border border-white/20 shadow-2xl`;

  // Animations are always enabled now
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
      className={`${className} ${glassClasses} transition-all`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Panel Component
 * Provides slide-in animations for panels
 */
export function AnimatedPanel({
  children,
  direction = 'left',
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  delay?: number;
  className?: string;
}) {
  // Animations are always enabled now
  const variants = {
    hidden: {
      opacity: 0,
      x: direction === 'left' ? -50 : direction === 'right' ? 50 : 0,
      y: direction === 'top' ? -50 : direction === 'bottom' ? 50 : 0,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Floating Geometric Shape
 * Background decoration element
 */
export function FloatingShape({
  size = 100,
  color = 'orange',
  position = { top: '10%', left: '10%' },
  delay = 0,
}: {
  size?: number;
  color?: 'orange' | 'blue' | 'green';
  position?: { top?: string; left?: string; right?: string; bottom?: string };
  delay?: number;
}) {
  const bgColor = {
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
    blue: 'bg-gradient-to-br from-blue-400 to-blue-600',
    green: 'bg-gradient-to-br from-green-400 to-green-600',
  }[color];

  // Glass and animations are always enabled now
  return (
    <motion.div
      initial={{ scale: 0, rotate: 0 }}
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [45, 50, 45],
      }}
      transition={{
        duration: 10,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        ...position,
        zIndex: -1,
      }}
    >
      <div className={`w-full h-full ${bgColor} rounded-lg opacity-20`} />
    </motion.div>
  );
}

/**
 * Page Transition Wrapper
 * Provides smooth page transitions
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // Animations are always enabled now
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}