import { splitSqlStatements } from '../src/lib/sql-split.js';

describe('splitSqlStatements', () => {
  it('splits on top-level semicolons and drops comments', () => {
    const sql = `-- header\ncreate table a (id int); /* block; comment */\ninsert into a values (1);\n`;
    expect(splitSqlStatements(sql)).toEqual([
      'create table a (id int)',
      'insert into a values (1)',
    ]);
  });

  it('keeps semicolons inside dollar-quoted bodies and string literals', () => {
    const sql = `create function f() returns trigger language plpgsql as $$\nbegin\n  raise exception 'no; never';\nend;\n$$;\nselect 'a;b';`;
    const out = splitSqlStatements(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("raise exception 'no; never';\nend;\n$$");
    expect(out[1]).toBe("select 'a;b'");
  });

  it('handles tagged dollar quotes and escaped quotes', () => {
    const sql = `select $fn$ a; b $fn$; select 'it''s; fine';`;
    expect(splitSqlStatements(sql)).toEqual(['select $fn$ a; b $fn$', "select 'it''s; fine'"]);
  });

  it('returns a trailing statement without a semicolon', () => {
    expect(splitSqlStatements('select 1')).toEqual(['select 1']);
    expect(splitSqlStatements('  \n')).toEqual([]);
  });
});
