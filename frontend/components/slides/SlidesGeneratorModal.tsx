"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Presentation,
  Loader2,
  X,
  ExternalLink,
  AlertCircle,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  generateSlidesOutline,
  createPresentation,
  type SlideOutline,
} from "@/lib/api-extended";

interface SlidesGeneratorModalProps {
  accessToken: string;
  taskTitle: string;
  taskNotes: string;
  taskSubtasks: string[];
  onClose: () => void;
}

type ModalState = "generating" | "preview" | "creating" | "done" | "error";

export function SlidesGeneratorModal({
  accessToken,
  taskTitle,
  taskNotes,
  taskSubtasks,
  onClose,
}: SlidesGeneratorModalProps) {
  const [state, setState] = useState<ModalState>("generating");
  const [outline, setOutline] = useState<SlideOutline | null>(null);
  const [presentationUrl, setPresentationUrl] = useState("");
  const [error, setError] = useState("");
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Auto-generate on mount
  useState(() => {
    handleGenerate();
  });

  async function handleGenerate() {
    setState("generating");
    setError("");
    try {
      const result = await generateSlidesOutline(accessToken, {
        task_title: taskTitle,
        task_notes: taskNotes,
        task_subtasks: taskSubtasks,
      });
      setOutline(result);
      setState("preview");
    } catch (err: any) {
      setError(err.message || "Failed to generate outline");
      setState("error");
    }
  }

  async function handleCreate() {
    if (!outline) return;
    setState("creating");
    setError("");
    try {
      const result = await createPresentation(accessToken, outline);
      setPresentationUrl(result.presentation_url);
      setState("done");
    } catch (err: any) {
      setError(err.message || "Failed to create presentation");
      setState("error");
    }
  }

  function handleEditSlideTitle(index: number, newTitle: string) {
    if (!outline) return;
    const updated = { ...outline };
    updated.slides = [...updated.slides];
    updated.slides[index] = { ...updated.slides[index], title: newTitle };
    setOutline(updated);
    setEditingSlide(null);
  }

  return (
    <div className="p-5 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
            <Presentation size={16} className="text-accent-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Create Presentation
            </h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              AI generates slides from your task context
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      {state === "generating" && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={28} className="text-accent-500 animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">
            Generating presentation outline...
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            Creating slides from &quot;{taskTitle}&quot;
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="h-12 w-12 rounded-xl bg-danger-500/10 flex items-center justify-center">
            <AlertCircle size={20} className="text-danger-500" />
          </div>
          <p className="text-sm text-danger-500 text-center">{error}</p>
          <Button variant="ghost" size="sm" onClick={handleGenerate}>
            Try Again
          </Button>
        </div>
      )}

      {state === "preview" && outline && (
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {/* Presentation title */}
          <div className="p-3 rounded-xl bg-accent-500/5 border border-accent-500/20">
            <p className="text-xs font-medium text-accent-500 uppercase tracking-wider mb-1">
              Presentation Title
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {outline.title}
            </p>
          </div>

          {/* Slides */}
          <div className="space-y-2">
            {outline.slides.map((slide, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium text-[var(--text-tertiary)] flex-shrink-0">
                      Slide {i + 1}
                    </span>
                    {editingSlide === i ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSlideTitle(i, editTitle);
                            if (e.key === "Escape") setEditingSlide(null);
                          }}
                          className="flex-1 text-sm bg-transparent border-b border-accent-400 text-[var(--text-primary)] outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditSlideTitle(i, editTitle)}
                          className="text-accent-500"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {slide.title}
                      </p>
                    )}
                  </div>
                  {editingSlide !== i && (
                    <button
                      onClick={() => {
                        setEditingSlide(i);
                        setEditTitle(slide.title);
                      }}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex-shrink-0"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
                {slide.bullets.length > 0 && (
                  <ul className="space-y-0.5 ml-3">
                    {slide.bullets.map((bullet, bi) => (
                      <li
                        key={bi}
                        className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5"
                      >
                        <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">
                          -
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              Regenerate
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Presentation size={13} />
              Create in Google Slides
            </Button>
          </div>
        </div>
      )}

      {state === "creating" && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={28} className="text-accent-500 animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">
            Creating presentation in Google Slides...
          </p>
        </div>
      )}

      {state === "done" && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="h-14 w-14 rounded-2xl bg-success-500/10 flex items-center justify-center">
            <Check size={24} className="text-success-500" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Presentation created!
          </p>
          <a
            href={presentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-accent-500 hover:text-accent-400 transition-colors"
          >
            <ExternalLink size={14} />
            Open in Google Slides
          </a>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

export default SlidesGeneratorModal;
