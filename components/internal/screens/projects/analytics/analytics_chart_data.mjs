const SERIES_OPACITY = [1, 0.76, 0.56, 0.38, 0.24];
const FILE_MIX_DONUT_TITLES = new Set([
  "Gallery engagement",
  "Visitor actions",
  "Asset status",
  "Rights status",
  "Storage by media type",
  "Order status",
  "License status",
]);

export function donutVariant(title) {
  return FILE_MIX_DONUT_TITLES.has(title) ? "fileMix" : undefined;
}

export function buildDonutData(rows) {
  return rows.map((row, index) => ({
    key: `slice${index}`,
    name: row.label,
    value: row.value,
    opacity: SERIES_OPACITY[index % SERIES_OPACITY.length],
  }));
}

export function getDonutSelection(data, selectedKey) {
  const activeIndex = Math.max(data.findIndex((row) => row.key === selectedKey), 0);
  return { activeIndex, selected: data[activeIndex] };
}
