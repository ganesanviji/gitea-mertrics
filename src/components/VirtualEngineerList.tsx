import { memo, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import type { EngineerStats } from '../types';
import { EngineerCard } from './EngineerCard';

interface VirtualEngineerListProps {
  engineers: EngineerStats[];
  totalEngineers: number;
}

// Memoized cell — only re-renders when engineer data changes, not on scroll
const Cell = memo(({
  columnIndex,
  rowIndex,
  style,
  data,
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: { engineers: EngineerStats[]; cols: number; total: number };
}) => {
  const index = rowIndex * data.cols + columnIndex;
  if (index >= data.engineers.length) return null;
  const eng = data.engineers[index];

  return (
    <div style={{ ...style, padding: '8px' }}>
      <EngineerCard stats={eng} totalEngineers={data.total} />
    </div>
  );
});

Cell.displayName = 'VirtualCell';

const CARD_HEIGHT = 320; // px — fixed height per card row

export function VirtualEngineerList({ engineers, totalEngineers }: VirtualEngineerListProps) {
  const getColumnCount = useCallback((width: number) => {
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 640) return 2;
    return 1;
  }, []);

  if (engineers.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        No engineers match your search.
      </div>
    );
  }

  // For small lists (< 12), don't virtualise — no overhead benefit
  if (engineers.length < 12) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {engineers.map((eng) => (
          <EngineerCard key={eng.user.login} stats={eng} totalEngineers={totalEngineers} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ height: Math.min(engineers.length * CARD_HEIGHT, 800) }}>
      <AutoSizer
        renderProp={({ width = 0, height = 0 }) => {
          const cols = getColumnCount(width);
          const rows = Math.ceil(engineers.length / cols);
          const colWidth = cols > 0 ? width / cols : width;

          return (
            <Grid
              columnCount={cols}
              columnWidth={colWidth}
              height={height}
              rowCount={rows}
              rowHeight={CARD_HEIGHT}
              width={width}
              itemData={{ engineers, cols, total: totalEngineers }}
              overscanRowCount={2}
            >
              {Cell}
            </Grid>
          );
        }}
      />
    </div>
  );
}
