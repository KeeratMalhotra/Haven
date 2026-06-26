"""Tests for the IST time-grounding helpers in app.utils.timectx."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.utils.timectx import IST, now_ist, resolve_relative, time_context_string


# A fixed reference: Saturday, 28 June 2025, 4:30 PM IST.
BASE = datetime(2025, 6, 28, 16, 30, tzinfo=ZoneInfo("Asia/Kolkata"))


class TestNowAndContext:
    def test_now_ist_is_timezone_aware(self):
        n = now_ist()
        assert n.tzinfo is not None
        assert n.utcoffset() == timedelta(hours=5, minutes=30)

    def test_time_context_string_mentions_ist_and_iso_date(self):
        ctx = time_context_string()
        assert "IST" in ctx
        assert "Asia/Kolkata" in ctx
        assert "UTC+5:30" in ctx
        # Contains an ISO date like 2025-06-28
        assert "Today is" in ctx


class TestResolveRelative:
    def test_today_with_24h_time(self):
        assert resolve_relative("today 18:00", base=BASE) == "2025-06-28T18:00:00+05:30"

    def test_tomorrow_with_24h_time(self):
        assert resolve_relative("tomorrow 15:00", base=BASE) == "2025-06-29T15:00:00+05:30"

    def test_tomorrow_with_12h_time(self):
        assert resolve_relative("tomorrow 6pm", base=BASE) == "2025-06-29T18:00:00+05:30"

    def test_time_only_defaults_to_today(self):
        # A time but no day -> assume today.
        assert resolve_relative("6pm", base=BASE) == "2025-06-28T18:00:00+05:30"

    def test_noon_and_midnight(self):
        assert resolve_relative("noon", base=BASE) == "2025-06-28T12:00:00+05:30"
        assert resolve_relative("midnight", base=BASE) == "2025-06-28T00:00:00+05:30"

    def test_next_weekday(self):
        # 28 June 2025 is a Saturday; next monday is 30 June.
        assert resolve_relative("next monday 10:00", base=BASE) == "2025-06-30T10:00:00+05:30"

    def test_weekday_with_am(self):
        assert resolve_relative("monday 9am", base=BASE) == "2025-06-30T09:00:00+05:30"

    def test_day_without_time_returns_none(self):
        # The headline behavior: "tomorrow" alone has NO time -> None.
        assert resolve_relative("tomorrow", base=BASE) is None

    def test_bare_weekday_without_time_returns_none(self):
        assert resolve_relative("monday", base=BASE) is None

    def test_unparseable_returns_none(self):
        assert resolve_relative("some random text", base=BASE) is None

    def test_empty_returns_none(self):
        assert resolve_relative("", base=BASE) is None

    def test_iso_passthrough_gets_ist_offset(self):
        out = resolve_relative("2025-06-28T09:00:00", base=BASE)
        assert out == "2025-06-28T09:00:00+05:30"

    def test_offset_is_always_ist(self):
        out = resolve_relative("tomorrow 9am", base=BASE)
        dt = datetime.fromisoformat(out)
        assert dt.utcoffset() == timedelta(hours=5, minutes=30)

    def test_default_base_is_now(self):
        # Without an explicit base, resolves against now_ist() (today).
        out = resolve_relative("9pm")
        assert out is not None
        dt = datetime.fromisoformat(out)
        assert dt.date() == now_ist().date()
        assert dt.hour == 21
