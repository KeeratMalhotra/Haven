"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
} from "lucide-react";

export interface ResearchResult {
  title: string;
  summary: string;
  source_url: string;
  relevance_snippet: string;
}

interface TaskResearchPanelProps {
  results: ResearchResult[];
  loading: boolean;
  error?: string | null;
  disclaimer?: string | null;
}

function ResearchCard({ result }: { result: ResearchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 p-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <span className="mt-0.5 flex-shrink-0 text-[var(--text-tertiary)]">
          {expanded ? (
            <ChevronDown size={14} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.5} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
            {result.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
            {result.relevance_snippet}
          </p>
        </div>
        <Globe size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 pl-8 space-y-2">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {result.summary}
              </p>
              {result.source_url && (
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-500 hover:text-accent-400 transition-colors"
                  title="AI-suggested link - may not be a real page"
                >
                  <ExternalLink size={11} strokeWidth={1.5} />
                  <span className="truncate max-w-[200px]">{result.source_url}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">(AI-suggested)</span>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TaskResearchPanel({
  results,
  loading,
  error,
  disclaimer,
}: TaskResearchPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-accent-500" />
        <span className="text-sm text-[var(--text-tertiary)]">Researching...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-3 rounded-lg bg-danger-500/5 border border-danger-500/20">
        <p className="text-sm text-danger-500">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">
          No research results yet. Click &quot;Research&quot; to find relevant resources.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {disclaimer && (
        <div className="py-2 px-3 rounded-lg bg-warning-500/5 border border-warning-500/20 mb-2">
          <p className="text-xs text-[var(--text-tertiary)] italic">
            {disclaimer}
          </p>
        </div>
      )}
      {results.map((result, index) => (
        <ResearchCard key={index} result={result} />
      ))}
    </div>
  );
}
