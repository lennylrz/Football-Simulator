import { type ReactNode, useState } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  /** right-aligned, sorts highest first */
  num?: boolean;
  /** stretches and truncates */
  wide?: boolean;
  title?: string;
  value: (row: T) => number | string;
  show?: (row: T) => ReactNode;
}

/** A table whose columns sort when their header is clicked (again to reverse). */
export function SortTable<T>({
  rows, columns, initial, rowKey, rowClass, onRow,
}: {
  rows: T[];
  columns: Column<T>[];
  initial: string;
  rowKey: (row: T) => string | number;
  rowClass?: (row: T) => string;
  onRow?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>(() => ({ key: initial, desc: !!columns.find((c) => c.key === initial)?.num }));
  const col = columns.find((c) => c.key === sort.key) ?? columns[0];
  const sorted = rows.slice().sort((a, b) => {
    const x = col.value(a);
    const y = col.value(b);
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sort.desc ? -d : d;
  });
  const click = (c: Column<T>) => setSort((s) => (s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: !!c.num }));
  return (
    <table className="tbl">
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              title={c.title ?? `Sort by ${c.label}`}
              className={`click ${c.num ? 'n' : ''} ${c.key === sort.key ? `sort ${sort.desc ? '' : 'asc'}` : ''}`}
              onClick={() => click(c)}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={rowKey(r)} className={rowClass?.(r) ?? ''} onClick={onRow && (() => onRow(r))}>
            {columns.map((c) => (
              <td key={c.key} className={c.num ? 'n' : c.wide ? 'ellip' : ''}>{c.show ? c.show(r) : c.value(r)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
