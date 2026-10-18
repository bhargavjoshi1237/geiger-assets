import test from "node:test";
import assert from "node:assert/strict";

const chartData = await import("./analytics_chart_data.mjs").catch(() => ({}));

test("the File Type Mix donut keeps a selected slice and center item in sync", () => {
  const data = chartData.buildDonutData([
    { label: "Item views", value: 4 },
    { label: "Downloads", value: 2 },
  ]);

  assert.deepEqual(data, [
    { key: "slice0", name: "Item views", value: 4, opacity: 1 },
    { key: "slice1", name: "Downloads", value: 2, opacity: 0.76 },
  ]);
  assert.deepEqual(chartData.getDonutSelection(data, "slice1"), {
    activeIndex: 1,
    selected: data[1],
  });
  assert.equal(chartData.donutVariant("Visitor actions"), "fileMix");
  for (const title of [
    "Asset status",
    "Rights status",
    "Storage by media type",
    "Order status",
    "License status",
  ]) {
    assert.equal(chartData.donutVariant(title), "fileMix");
  }
});
