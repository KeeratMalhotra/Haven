"""Email notification utilities for ChronAI.

Provides reusable functions for sending formatted HTML emails via Gmail API,
including task deadline reminders, daily digest summaries, and weekly reviews.
"""

import asyncio
import base64
import html
import logging
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import settings

logger = logging.getLogger(__name__)


def _build_gmail_service(google_tokens: dict):
    """Build a Gmail API service using the user's OAuth tokens.

    Args:
        google_tokens: Dict containing access_token and/or refresh_token.

    Returns:
        Authorized Gmail API service instance.

    Raises:
        ValueError: If no tokens are available.
    """
    access_token = google_tokens.get("access_token", "")
    refresh_token = google_tokens.get("refresh_token", "")

    if not access_token and not refresh_token:
        raise ValueError("No tokens available to build Gmail service")

    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )

    return build("gmail", "v1", credentials=credentials)


def _send_email(service, to_email: str, subject: str, plain_text: str, html_body: str) -> bool:
    """Send an email via the Gmail API (synchronous - call via asyncio.to_thread).

    Args:
        service: Authorized Gmail API service.
        to_email: Recipient email address.
        subject: Email subject line.
        plain_text: Plain text fallback body.
        html_body: HTML body content.

    Returns:
        True if sent successfully, False otherwise.
    """
    msg = MIMEMultipart("alternative")
    msg["to"] = to_email
    msg["subject"] = subject
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return True


async def send_task_reminder(
    user_email: str, task_title: str, deadline: str, google_tokens: dict
) -> bool:
    """Send a task deadline reminder email via Gmail API.

    Sends a professional HTML email reminding the user about an upcoming
    task deadline with ChronAI branding and a link to the app.

    Args:
        user_email: The recipient email address.
        task_title: Title of the task approaching its deadline.
        deadline: Human-readable deadline string (e.g. "Tomorrow at 5:00 PM").
        google_tokens: Dict with access_token and/or refresh_token.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    try:
        service = _build_gmail_service(google_tokens)

        plain_text = (
            f"Task Reminder: {task_title}\n\n"
            f"Your task \"{task_title}\" is due {deadline}.\n\n"
            f"Open ChronAI to take action: {settings.FRONTEND_ORIGIN}"
        )

        safe_title = html.escape(task_title)
        safe_deadline = html.escape(deadline)

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin: 0; padding: 0; background-color: #0f0f14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    .container {{ max-width: 560px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background-color: #1a1a24; border-radius: 16px; padding: 36px; border: 1px solid #2a2a3a; }}
    .logo {{ color: #a78bfa; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 28px; }}
    .heading {{ color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 12px; }}
    .message {{ color: #b0b0c0; font-size: 15px; line-height: 1.7; margin-bottom: 28px; }}
    .task-badge {{ display: inline-block; background-color: #a78bfa15; border: 1px solid #a78bfa30; color: #a78bfa; padding: 6px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 8px; }}
    .deadline {{ color: #f59e0b; font-weight: 500; }}
    .btn {{ display: inline-block; background-color: #a78bfa; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; }}
    .footer {{ color: #666; font-size: 12px; margin-top: 28px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ChronAI</div>
      <div class="heading">Task Reminder</div>
      <div class="message">
        <span class="task-badge">{safe_title}</span>
        <p>This task is due <span class="deadline">{safe_deadline}</span>. Make sure to wrap it up before the deadline.</p>
      </div>
      <a href="{settings.FRONTEND_ORIGIN}" class="btn">Open ChronAI</a>
    </div>
    <div class="footer">
      <p>You received this because you have task reminders enabled in ChronAI.</p>
    </div>
  </div>
</body>
</html>"""

        await asyncio.to_thread(
            _send_email, service, user_email,
            f"ChronAI: {task_title} - Due {deadline}", plain_text, html_body,
        )
        logger.info(f"Task reminder email sent to {user_email} for '{task_title}'")
        return True
    except Exception as e:
        logger.error(
            "Failed to send task reminder email to %s for '%s': [%s] %s",
            user_email,
            task_title,
            type(e).__name__,
            e,
        )
        return False


async def send_daily_digest(
    user_email: str, tasks: list, events: list, google_tokens: dict
) -> bool:
    """Send a daily digest email with task and event summary via Gmail API.

    Sends a professional HTML email summarizing the user's tasks and
    calendar events for the day.

    Args:
        user_email: The recipient email address.
        tasks: List of task dicts (each with 'title' and optionally 'due').
        events: List of event dicts (each with 'summary' and optionally 'start').
        google_tokens: Dict with access_token and/or refresh_token.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    try:
        service = _build_gmail_service(google_tokens)

        # Build plain text version
        task_lines = ""
        for t in tasks[:10]:
            title = t.get("title", "Untitled")
            due = t.get("due", "")
            task_lines += f"  - {title}" + (f" (due {due})" if due else "") + "\n"

        event_lines = ""
        for ev in events[:10]:
            summary = ev.get("summary", "Untitled event")
            start = ev.get("start", "")
            event_lines += f"  - {summary}" + (f" at {start}" if start else "") + "\n"

        plain_text = (
            "Good morning! Here is your daily digest from ChronAI:\n\n"
            f"Tasks ({len(tasks)}):\n{task_lines or '  No pending tasks.'}\n\n"
            f"Events ({len(events)}):\n{event_lines or '  No events today.'}\n\n"
            f"Open ChronAI: {settings.FRONTEND_ORIGIN}"
        )

        # Build task HTML rows
        tasks_html = ""
        for t in tasks[:10]:
            title = html.escape(t.get("title", "Untitled"))
            due = html.escape(t.get("due", ""))
            due_badge = f'<span style="color:#f59e0b;font-size:12px;margin-left:8px;">due {due}</span>' if due else ""
            tasks_html += f'<div style="padding:10px 0;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:14px;">{title}{due_badge}</div>'

        if not tasks:
            tasks_html = '<div style="padding:10px 0;color:#666;font-size:14px;">No pending tasks</div>'

        # Build event HTML rows
        events_html = ""
        for ev in events[:10]:
            summary = html.escape(ev.get("summary", "Untitled event"))
            start = html.escape(ev.get("start", ""))
            time_badge = f'<span style="color:#a78bfa;font-size:12px;margin-left:8px;">{start}</span>' if start else ""
            events_html += f'<div style="padding:10px 0;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:14px;">{summary}{time_badge}</div>'

        if not events:
            events_html = '<div style="padding:10px 0;color:#666;font-size:14px;">No events today</div>'

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin: 0; padding: 0; background-color: #0f0f14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    .container {{ max-width: 560px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background-color: #1a1a24; border-radius: 16px; padding: 36px; border: 1px solid #2a2a3a; }}
    .logo {{ color: #a78bfa; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 28px; }}
    .heading {{ color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 6px; }}
    .subheading {{ color: #888; font-size: 13px; margin-bottom: 24px; }}
    .section-title {{ color: #a78bfa; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; margin-top: 24px; }}
    .btn {{ display: inline-block; background-color: #a78bfa; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 24px; }}
    .footer {{ color: #666; font-size: 12px; margin-top: 28px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ChronAI</div>
      <div class="heading">Your Daily Digest</div>
      <div class="subheading">Here is what is on your plate today.</div>

      <div class="section-title">Tasks ({len(tasks)})</div>
      {tasks_html}

      <div class="section-title">Events ({len(events)})</div>
      {events_html}

      <a href="{settings.FRONTEND_ORIGIN}" class="btn">Open ChronAI</a>
    </div>
    <div class="footer">
      <p>You received this daily digest from ChronAI.</p>
    </div>
  </div>
</body>
</html>"""

        await asyncio.to_thread(
            _send_email, service, user_email,
            "ChronAI: Your Daily Digest", plain_text, html_body,
        )
        logger.info(f"Daily digest email sent to {user_email}")
        return True
    except Exception as e:
        logger.error(
            "Failed to send daily digest email to %s: [%s] %s",
            user_email,
            type(e).__name__,
            e,
        )
        return False


def _markdown_to_html(markdown_text: str) -> str:
    """Convert basic markdown to HTML (headers, bullets, paragraphs, bold).

    Handles ## headings, - bullet lists, **bold**, and paragraph separation.
    All text content is HTML-escaped before formatting to prevent injection.

    Args:
        markdown_text: The markdown string to convert.

    Returns:
        HTML string with basic formatting.
    """
    lines = markdown_text.split("\n")
    html_parts: list[str] = []
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Headings
        if stripped.startswith("### "):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            safe = html.escape(stripped[4:])
            html_parts.append(f'<h3 style="color:#ffffff;font-size:15px;margin:18px 0 8px 0;">{safe}</h3>')
        elif stripped.startswith("## "):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            safe = html.escape(stripped[3:])
            html_parts.append(f'<h2 style="color:#ffffff;font-size:17px;margin:20px 0 10px 0;">{safe}</h2>')
        elif stripped.startswith("# "):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            safe = html.escape(stripped[2:])
            html_parts.append(f'<h1 style="color:#ffffff;font-size:20px;margin:24px 0 12px 0;">{safe}</h1>')
        elif stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                html_parts.append('<ul style="padding-left:20px;margin:8px 0;">')
                in_list = True
            content = stripped[2:]
            # Escape first, then apply bold formatting
            content = html.escape(content)
            content = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", content)
            html_parts.append(f'<li style="color:#e0e0e0;font-size:14px;margin:4px 0;">{content}</li>')
        elif stripped == "":
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append("<br>")
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            # Escape first, then apply bold formatting
            content = html.escape(stripped)
            content = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", content)
            html_parts.append(f'<p style="color:#b0b0c0;font-size:14px;line-height:1.7;margin:6px 0;">{content}</p>')

    if in_list:
        html_parts.append("</ul>")

    return "\n".join(html_parts)


async def send_weekly_review(
    user_email: str, review_content: str, google_tokens: dict
) -> bool:
    """Send a weekly review email via Gmail API.

    Formats the markdown review content from the ReviewAgent as an HTML email
    with ChronAI dark-theme branding.

    Args:
        user_email: The recipient email address.
        review_content: Markdown string from the ReviewAgent (weekly review).
        google_tokens: Dict with access_token and/or refresh_token.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    try:
        service = _build_gmail_service(google_tokens)

        # Plain text is the raw markdown
        plain_text = (
            "Your Weekly Review from ChronAI\n\n"
            f"{review_content}\n\n"
            f"Open ChronAI: {settings.FRONTEND_ORIGIN}"
        )

        # Convert markdown review to HTML
        review_html = _markdown_to_html(review_content)

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin: 0; padding: 0; background-color: #0f0f14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    .container {{ max-width: 560px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background-color: #1a1a24; border-radius: 16px; padding: 36px; border: 1px solid #2a2a3a; }}
    .logo {{ color: #a78bfa; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 28px; }}
    .heading {{ color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 6px; }}
    .subheading {{ color: #888; font-size: 13px; margin-bottom: 24px; }}
    .review-content {{ margin: 16px 0; }}
    .btn {{ display: inline-block; background-color: #a78bfa; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 24px; }}
    .footer {{ color: #666; font-size: 12px; margin-top: 28px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ChronAI</div>
      <div class="heading">Your Weekly Review</div>
      <div class="subheading">Here is how your week went.</div>
      <div class="review-content">
        {review_html}
      </div>
      <a href="{settings.FRONTEND_ORIGIN}" class="btn">Open ChronAI</a>
    </div>
    <div class="footer">
      <p>You received this weekly review from ChronAI.</p>
    </div>
  </div>
</body>
</html>"""

        await asyncio.to_thread(
            _send_email, service, user_email,
            "ChronAI: Your Weekly Review", plain_text, html_body,
        )
        logger.info(f"Weekly review email sent to {user_email}")
        return True
    except Exception as e:
        logger.error(
            "Failed to send weekly review email to %s: [%s] %s",
            user_email,
            type(e).__name__,
            e,
        )
        return False
