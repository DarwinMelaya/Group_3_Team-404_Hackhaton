import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isHarvest,
  todayInMarinduque,
  validateHarvest,
  type HarvestInput,
} from "../src/lib/harvest.ts";

const valid: HarvestInput = {
  crop: "Banana",
  quantity: "150",
  price: "25",
  harvestDate: "2026-10-29",
  municipality: "Boac",
  barangay: "Demo barangay",
  storage: "Shaded and ventilated",
  priority: "Standard",
};
test("accepts complete harvest, including zero asking price", () => {
  assert.equal(validateHarvest(valid, "2026-10-29"), null);
  assert.equal(validateHarvest({ ...valid, price: "0" }, "2026-10-29"), null);
});
test("rejects missing, negative, nonfinite and excessive quantities/prices", () => {
  for (const quantity of ["", "0", "-1", "Infinity", "1000001"])
    assert.ok(validateHarvest({ ...valid, quantity }, "2026-10-29"));
  for (const price of ["", "-1", "NaN", "1000001"])
    assert.ok(validateHarvest({ ...valid, price }, "2026-10-29"));
});
test("rejects invalid calendar dates, future dates and missing location", () => {
  for (const harvestDate of ["2026-02-30", "2026-10-30", "29/10/2026"])
    assert.ok(validateHarvest({ ...valid, harvestDate }, "2026-10-29"));
  assert.ok(validateHarvest({ ...valid, barangay: "  " }, "2026-10-29"));
  assert.ok(
    validateHarvest(
      { ...valid, municipality: "Outside Marinduque" },
      "2026-10-29",
    ),
  );
});
test("uses Philippine date across UTC midnight boundary", () => {
  assert.equal(
    todayInMarinduque(new Date("2026-10-28T18:00:00Z")),
    "2026-10-29",
  );
});
test("rejects malformed local storage records", () => {
  assert.equal(isHarvest(null), false);
  assert.equal(isHarvest({ id: "x", quantity: 3, price: 5 }), false);
});
