'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ViewerJoinBannerProps {
  onJoinClick: () => void;
}

export function ViewerJoinBanner({ onJoinClick }: ViewerJoinBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-amber-900 dark:text-amber-100 font-medium">
            Viewing. Want to join?
          </span>
        </div>
        <Button
          variant="primary"
          onClick={onJoinClick}
          className="flex-shrink-0"
        >
          Go...
        </Button>
      </div>
    </div>
  );
}
