"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Check,
  X,
  Reply,
  Loader2,
  Inbox,
  Send,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  scanGmailInbox,
  replyToEmail,
  type GmailActionItem,
} from "@/lib/api-extended";

interface GmailScanModalProps {
  accessToken: string;
  onAccept: (item: GmailActionItem) => void;
  onClose: () => void;
}

type ModalState = "idle" | "scanning" | "results" | "error";

export function GmailScanModal({
  accessToken,
  onAccept,
  onClose,
}: GmailScanModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [items, setItems] = useState<GmailActionItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<GmailActionItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [error, setError] = useState("");

  const handleScan = async () => {
    setState("scanning");
    setError("");
    try {
      const result = await scanGmailInbox(accessToken);
      setItems(result.action_items);
      setState("results");
    } catch (err: any) {
      setError(err.message || "Failed to scan inbox");
      setState("error");
    }
  };

  const handleAccept = (item: GmailActionItem) => {
    setAccepted((prev) => new Set(prev).add(item.email_id));
    onAccept(item);
  };

  const handleDismiss = (emailId: string) => {
    setDismissed((prev) => new Set(prev).add(emailId));
  };

  const handleReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setReplySending(true);
    try {
      await replyToEmail(accessToken, replyTarget.source_email_id, replyText);
      setReplySuccess(true);
      setTimeout(() => {
        setReplyTarget(null);
        setReplyText("");
        setReplySuccess(false);
      }, 2000);
    } catch {
      // Show inline error
    }
    setReplySending(false);
  };

  const visibleItems = items.filter(
    (item) => !dismissed.has(item.email_id)
  );

  return (
    <div className="p-5 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
            <Mail size={16} className="text-accent-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
              Scan Inbox
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
              AI extracts action items from your recent emails
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      {state === "idle" && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="h-14 w-14 rounded-2xl bg-accent-500/10 flex items-center justify-center">
            <Inbox size={24} className="text-accent-500" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] text-center max-w-xs">
            Scan your inbox to find emails that need action. AI will suggest
            tasks based on email content.
          </p>
          <Button onClick={handleScan}>
            <Mail size={14} />
            Scan My Inbox
          </Button>
        </div>
      )}

      {state === "scanning" && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={28} className="text-accent-500 animate-spin" />
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
            Scanning your inbox...
          </p>
          <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
            Reading emails and extracting action items
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="h-12 w-12 rounded-xl bg-danger-500/10 flex items-center justify-center">
            <AlertCircle size={20} className="text-danger-500" />
          </div>
          <p className="text-sm text-danger-500 text-center">{error}</p>
          <Button variant="ghost" size="sm" onClick={handleScan}>
            Try Again
          </Button>
        </div>
      )}

      {state === "results" && (
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Check size={24} className="text-success-500" />
              <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
                {items.length === 0
                  ? "No action items found in your recent emails."
                  : "All items handled!"}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item) => (
                <motion.div
                  key={item.email_id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] truncate">
                        {item.suggested_title}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] truncate mt-0.5">
                        From: {item.email_from}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] truncate">
                        Subject: {item.email_subject}
                      </p>
                    </div>
                  </div>
                  {item.suggested_notes && (
                    <p className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] line-clamp-2">
                      {item.suggested_notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {accepted.has(item.email_id) ? (
                      <span className="flex items-center gap-1 text-xs text-success-500">
                        <Check size={12} />
                        Added as task
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAccept(item)}
                      >
                        <Check size={12} />
                        Accept
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(item.email_id)}
                    >
                      <X size={12} />
                      Dismiss
                    </Button>
                    {accepted.has(item.email_id) && item.source_email_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyTarget(item);
                          setReplyText("");
                          setReplySuccess(false);
                        }}
                      >
                        <Reply size={12} />
                        Reply
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Reply panel */}
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 p-3 rounded-xl border border-accent-500/30 bg-accent-500/5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                Reply to: {replyTarget.email_from}
              </p>
              <button
                onClick={() => setReplyTarget(null)}
                className="text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4]"
              >
                <X size={12} />
              </button>
            </div>
            {replySuccess ? (
              <p className="text-xs text-success-500 flex items-center gap-1">
                <Check size={12} /> Reply sent successfully
              </p>
            ) : (
              <>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={!replyText.trim() || replySending}
                  >
                    {replySending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    {replySending ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GmailScanModal;
