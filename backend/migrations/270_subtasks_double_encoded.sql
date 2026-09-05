-- 270 — the 54 `tasks` rows whose `subtasks` is a jsonb STRING, not an array.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  1. WHAT THIS DOES
-- ═══════════════════════════════════════════════════════════════════════════
--
--     UPDATE public.tasks SET subtasks = '[]'::jsonb
--      WHERE jsonb_typeof(subtasks) = 'string' AND subtasks::text = '"[]"';
--
-- 54 rows. One column. No schema change, no other table.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  2. ⚠ THIS IS THE SHAPE THAT ONCE WIPED 24 PRODUCTION ATTACHMENTS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Writing `'[]'` into a column is exactly how that incident began — a masked
-- value that got saved back over real data. So the guard, not the update, is
-- the part of this migration worth reviewing.
--
-- ⚠ THE `WHERE` PINS TWO CONDITIONS, AND THE SECOND IS THE SAFETY ONE.
-- `jsonb_typeof(subtasks) = 'string'` alone would also match a double-encoded
-- row that holds REAL subtasks — `'"[{\"title\":…}]"'` is a string too — and
-- blanking one of those is precisely the attachments incident again.
-- `subtasks::text = '"[]"'` restricts the update to rows that are already
-- empty, so the worst case is a no-op rather than a loss.
--
-- Measured live 2026-09-05, immediately before writing this:
--
--     jsonb_typeof   rows   of which exactly '"[]"'
--     array           380   —
--     string           54   54          ← all of them, none holding data
--
-- 54 of 54. There is no row this can lose anything from today, and if one
-- appears between now and the run, the second condition leaves it alone and
-- the assertion at the bottom reports the shortfall rather than hiding it.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  3. WHY THESE ROWS EXIST, AND WHY THEY WILL NOT REPAIR THEMSELVES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Left over from before the encoder fix `db.py::_json_encoder` describes:
-- dumped once by a caller and once more by the jsonb codec. `_subtasks_of`
-- (server.py:2142) has handled both shapes since the 2026-08-24 repair, so
-- nothing is broken today — this is cleanup of the data that repair was
-- written to tolerate.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  4. WHAT IT UNBLOCKS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `jsonb_array_length(subtasks)` cannot be run over this table today without a
-- CASE guard, because it errors on a string. Any count of subtasks — a report,
-- a metric, a Dristi aggregate — has to know about the 54 or be wrong. After
-- this, the column is one shape.
--
-- ⚠ IT DOES NOT REMOVE THE NEED FOR `_subtasks_of`'s `str` BRANCH, and that
-- branch is NOT being deleted. Its docstring gives two independent reasons and
-- this migration answers only the first. The second stands: `_init_conn` WARNS
-- rather than raises when PgBouncer kills the codec handshake three times and
-- hands the connection out anyway, and a connection with no codec returns every
-- jsonb column as text. Deleting the branch on the strength of this migration
-- would reintroduce the original TypeError on exactly the unlucky connection
-- nobody can reproduce.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  5. BLAST RADIUS AND REVERSAL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠ Both Railway environments share one DATABASE_URL. This is a production
-- write and there is nowhere to try it first.
--
-- Reversal, should anybody want the old shape back:
--
--     UPDATE public.tasks SET subtasks = '"[]"'::jsonb
--      WHERE jsonb_typeof(subtasks) = 'array' AND subtasks = '[]'::jsonb;
--
-- ⚠ That inverse is WIDER than this migration — it would also convert rows
-- that were legitimately `[]` all along — which is a reason not to run it
-- casually, and a reason this note says so rather than presenting it as a
-- clean undo. There is nothing to restore in any case: `"[]"` and `[]` carry
-- the same meaning to every reader in the codebase, which is what makes this
-- safe in the first place.

BEGIN;

DO $$
DECLARE
    before_string int;
    changed       int;
    after_string  int;
BEGIN
    SELECT count(*) INTO before_string
      FROM public.tasks WHERE jsonb_typeof(subtasks) = 'string';

    UPDATE public.tasks
       SET subtasks = '[]'::jsonb
     WHERE jsonb_typeof(subtasks) = 'string'
       AND subtasks::text = '"[]"';
    GET DIAGNOSTICS changed = ROW_COUNT;

    SELECT count(*) INTO after_string
      FROM public.tasks WHERE jsonb_typeof(subtasks) = 'string';

    RAISE NOTICE 'subtasks: % string rows before, % repaired, % remaining',
                 before_string, changed, after_string;

    -- A remaining string row is NOT a failure — it is a double-encoded row
    -- holding real subtasks, which this migration deliberately refuses to
    -- touch. It must be reported loudly rather than passed over, because it
    -- needs a human to decide how to decode it.
    IF after_string > 0 THEN
        RAISE EXCEPTION
          'ROLLED BACK: % rows still hold subtasks as a jsonb string and are '
          'NOT the empty ''"[]"'' this migration repairs. They may contain real '
          'subtasks. Inspect them before proceeding: '
          'SELECT task_id, subtasks FROM public.tasks '
          'WHERE jsonb_typeof(subtasks) = ''string'';', after_string;
    END IF;
END $$;

COMMIT;
