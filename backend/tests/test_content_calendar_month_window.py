"""The content calendar had never once rendered.

`GET /v1/hub/clients/{client_id}/calendar` 500'd on every call:

    asyncpg.exceptions.DataError: invalid input for query argument $2:
    '2026-09-01' ('str' object has no attribute 'toordinal')

36 events between 2026-08-29 and 09-01 on production, found in Sentry
(PYTHON-FASTAPI-1K). `$2::date` and `$3::date` make asyncpg infer DATE
parameters — confirmed against the live schema, which reports the statement's
parameter types as `{uuid,date,date}` — so binding an ISO `str` is refused by
the date codec. The cast reads as though it performs the conversion; it does
the opposite, it is what tells asyncpg to demand a date.

FOURTH INSTANCE OF THIS FAMILY IN THE SAME CODEBASE. The other three are
`pahchan_attendance.publish_attendance_to_payroll` (see
test_pahchan_publish_dates.py), `pahchan_attendance.request_regularisation`
("requesting a correction has never once worked"), the bank statement import
(2b864aa8) and the sales target (eae0b912). Every one presented as an opaque
500 with nothing on screen.

── THE SECOND HALF, WHICH IS NOT THE CRASH ────────────────────────────────────

The old code also raised bare ValueErrors straight out of the handler for input
a stranger can type in a query string:

    ?month=2026        → ValueError from month.split("-")   → 500
    ?month=2026-ab     → ValueError from int(mo)            → 500
    ?month=2026-13     → built the string "2026-14-01"      → 500, later and
                                                               harder to read

Each is now a 400 that quotes what was sent.
"""
import inspect
import re
from datetime import date

import pytest
from fastapi import HTTPException

import routers.hub_publish as hp


class TestTheWindowIsRealDates:
    """The regression. A `str` against `$2::date` is the whole bug."""

    @pytest.mark.parametrize("month", ["2026-09", "2026-01", "2026-02", None, ""])
    def test_both_ends_are_date_objects(self, month):
        start, end = hp._month_window(month)
        assert isinstance(start, date) and not isinstance(start, str)
        assert isinstance(end, date) and not isinstance(end, str)

    def test_the_handler_binds_the_helper_not_an_f_string(self):
        """⚠ THE GUARD THAT SURVIVES A REWRITE.

        The types above stay right only while the handler keeps using the
        helper. Re-introducing `start = f"{year}-{mo}-01"` would pass every
        type check above and 500 in production exactly as before.
        """
        src = inspect.getsource(hp.content_calendar)
        assert "_month_window(month)" in src, (
            "content_calendar no longer builds its window through _month_window"
        )
        assert not re.search(r'start\s*=\s*f["\']', src), (
            "the ISO-string window is back; asyncpg will refuse it against $2::date"
        )

    def test_the_window_is_half_open_and_rolls_the_year(self):
        assert hp._month_window("2026-09") == (date(2026, 9, 1), date(2026, 10, 1))
        # December is the one an off-by-one breaks, and it is why `end` is
        # computed rather than written as month+1.
        assert hp._month_window("2026-12") == (date(2026, 12, 1), date(2027, 1, 1))
        # February needs no leap-year knowledge because the window is half-open.
        assert hp._month_window("2024-02") == (date(2024, 2, 1), date(2024, 3, 1))

    def test_an_absent_month_is_the_current_one(self):
        today = date.today()
        for absent in (None, ""):
            start, end = hp._month_window(absent)
            assert start == today.replace(day=1), (
                "`?month=` with no value must mean this month, as omitting it does"
            )
            assert end > start


class TestBadInputIsA400ThatQuotesIt:
    @pytest.mark.parametrize("bad", ["2026", "2026-ab", "2026-13", "2026-00",
                                     "not-a-month", "2026-09-01", "-"])
    def test_refused_with_the_value_in_the_message(self, bad):
        with pytest.raises(HTTPException) as ex:
            hp._month_window(bad)
        assert ex.value.status_code == 400, (
            f"{bad!r} produced {ex.value.status_code}, not a 400 — a query "
            f"string a stranger can edit must not reach an unhandled 500"
        )
        assert bad in str(ex.value.detail), (
            "the refusal does not quote what was sent, so the caller cannot see "
            "which value was rejected"
        )
        assert "YYYY-MM" in str(ex.value.detail), "the refusal names no format"

    def test_month_thirteen_never_becomes_a_string(self):
        """`2026-13` used to build "2026-14-01" and fail somewhere else entirely.

        `date(2026, 13, 1)` raises here, at the edge, where the message can
        still name the input.
        """
        with pytest.raises(HTTPException):
            hp._month_window("2026-13")
