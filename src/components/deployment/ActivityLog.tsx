/**
 * Activity Log Component - Shows deployment stage activities
 * Provides a collapsible log of chronological system events
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ActivityItem {
  id: string;
  icon: string;
  message: string;
  timestamp: Date;
  stage?: string;
}

interface ActivityLogProps {
  activities: ActivityItem[];
  className?: string;
}

export const ActivityLog = ({ activities, className = '' }: ActivityLogProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-accent/5 hover:bg-accent/10 transition-colors border-b border-border"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Activity Log
          </span>
          <span className="text-xs text-muted-foreground">
            ({activities.length} {activities.length === 1 ? 'item' : 'items'})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-h-[300px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No activities yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="px-4 py-2.5 hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0 mt-0.5">
                          {activity.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">
                            {activity.message}
                          </p>
                          {activity.stage && (
                            <span className="text-xs text-muted-foreground mt-1 inline-block">
                              {activity.stage}
                            </span>
                          )}
                        </div>
                        <time className="text-xs text-muted-foreground flex-shrink-0">
                          {activity.timestamp.toLocaleTimeString()}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
