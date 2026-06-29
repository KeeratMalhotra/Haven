"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Briefcase,
  ClipboardCheck,
  MapPin,
  Sparkles,
  ArrowLeft,
  Check,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";

import { BUILT_IN_TEMPLATES, type Template, type TemplateTask } from "@/lib/templates";
import { generateTemplate } from "@/lib/api-extended";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Icon lookup map
const ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  Briefcase,
  ClipboardCheck,
  MapPin,
  Sparkles,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Sparkles;
}

interface TemplateLibraryProps {
  accessToken: string;
  onUseTemplate: (tasks: TemplateTask[]) => void;
  onClose: () => void;
}

type ViewState = "grid" | "preview" | "custom" | "success";

export function TemplateLibrary({
  accessToken,
  onUseTemplate,
  onClose,
}: TemplateLibraryProps) {
  const [view, setView] = useState<ViewState>("grid");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");
  const [generatedTemplate, setGeneratedTemplate] = useState<Template | null>(null);
  const [tasksCreatedCount, setTasksCreatedCount] = useState(0);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setView("preview");
  };

  const handleUseTemplate = (template: Template) => {
    onUseTemplate(template.tasks);
    setTasksCreatedCount(template.tasks.length);
    setView("success");
  };

  const handleGenerateCustom = async () => {
    if (!customGoal.trim()) return;
    setCustomLoading(true);
    setCustomError("");

    try {
      const result = await generateTemplate(accessToken, customGoal.trim());
      const template: Template = {
        id: result.id,
        title: result.title,
        description: result.description,
        icon: result.icon || "Sparkles",
        category: result.category || "Custom",
        tasks: result.tasks,
      };
      setGeneratedTemplate(template);
      setSelectedTemplate(template);
      setView("preview");
    } catch (err) {
      setCustomError(
        err instanceof Error ? err.message : "Failed to generate template. Please try again."
      );
    } finally {
      setCustomLoading(false);
    }
  };

  const handleBack = () => {
    if (view === "preview") {
      setView(generatedTemplate && selectedTemplate?.id === generatedTemplate.id ? "custom" : "grid");
      setSelectedTemplate(null);
    } else if (view === "custom") {
      setView("grid");
    } else {
      setView("grid");
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-rose-500";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-indigo-500";
      default:
        return "text-[var(--text-tertiary)] dark:text-[#847e76]";
    }
  };

  return (
    <div className="p-5 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {view !== "grid" && view !== "success" && (
            <button
              onClick={handleBack}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
              {view === "grid" && "Template Library"}
              {view === "preview" && selectedTemplate?.title}
              {view === "custom" && "Create Custom Template"}
              {view === "success" && "Tasks Created!"}
            </h2>
            {view === "grid" && (
              <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76] mt-0.5">
                Pre-built workflows to get you started fast
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* Grid View */}
        {view === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Built-in templates grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {BUILT_IN_TEMPLATES.map((template) => {
                const Icon = getIcon(template.icon);
                return (
                  <Card
                    key={template.id}
                    hover
                    className="cursor-pointer"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
                        <Icon size={18} className="text-accent-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] mb-0.5">
                          {template.title}
                        </h3>
                        <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] line-clamp-2 mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {template.tasks.length} tasks
                          </Badge>
                          <Badge variant="info">{template.category}</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Custom template section */}
            <div className="border-t border-[var(--border)] pt-4">
              <button
                onClick={() => setView("custom")}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--border)] hover:border-accent-500/50 hover:bg-accent-500/5 transition-colors"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500/20 to-purple-500/20">
                  <Sparkles size={18} className="text-accent-500" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                    Create Custom Template
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                    Describe your goal and AI will generate a task plan
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* Preview View */}
        {view === "preview" && selectedTemplate && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] mb-4">
              {selectedTemplate.description}
            </p>

            {/* Task list preview */}
            <div className="space-y-2 mb-5">
              {selectedTemplate.tasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                >
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-accent-500/10 flex items-center justify-center text-[10px] font-bold text-accent-500">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] truncate">
                        {task.title}
                      </p>
                      <span
                        className={`text-[10px] font-semibold uppercase ${priorityColor(task.priority)}`}
                      >
                        {task.priority !== "none" && task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] line-clamp-1">
                      {task.notes}
                    </p>
                    {task.due_days_from_now > 0 && (
                      <span className="text-[10px] text-[var(--text-tertiary)] dark:text-[#847e76] mt-1 inline-block">
                        Due in {task.due_days_from_now} day{task.due_days_from_now !== 1 ? "s" : ""}
                      </span>
                    )}
                    {task.due_days_from_now === 0 && (
                      <span className="text-[10px] text-accent-500 mt-1 inline-block">
                        Due today
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Use Template Button */}
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
              <Button size="sm" onClick={() => handleUseTemplate(selectedTemplate)}>
                <Check size={14} />
                Use Template ({selectedTemplate.tasks.length} tasks)
              </Button>
            </div>
          </motion.div>
        )}

        {/* Custom Template View */}
        {view === "custom" && (
          <motion.div
            key="custom"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] mb-4">
              Describe your goal and AI will create a step-by-step task plan for you.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1.5 block">
                  What do you want to accomplish?
                </label>
                <textarea
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerateCustom();
                    }
                  }}
                  placeholder="e.g., Plan a wedding, Learn a new programming language, Start a podcast..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
                />
              </div>

              {customError && (
                <p className="text-xs text-danger-500">{customError}</p>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateCustom}
                  disabled={!customGoal.trim() || customLoading}
                >
                  {customLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success View */}
        {view === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="h-14 w-14 rounded-full bg-success-500/10 flex items-center justify-center mb-4"
            >
              <Check size={24} className="text-success-500" />
            </motion.div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] mb-1">
              {tasksCreatedCount} tasks created!
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76] mb-5">
              Your template has been applied to your task list.
            </p>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TemplateLibrary;
