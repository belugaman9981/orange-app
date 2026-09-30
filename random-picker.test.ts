import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { RandomPicker } from "./src/components/RandomPicker";
import { MAX_RANDOM_INPUT_LENGTH, parseRandomChoices, pickRandomChoice } from "./src/randomPicker";

test("choice parsing trims lines and removes blanks and case-insensitive duplicates", () => {
  assert.deepEqual(parseRandomChoices(" \r\n Tea \r\nCoffee\n tea\nCOFFEE\nWater "), { choices: ["Tea", "Coffee", "Water"], error: null });
  assert.deepEqual(parseRandomChoices(" \n\t "), { choices: [], error: null });
});

test("choice limits accept the boundary and reject overflow without drawing from a partial list", () => {
  const hundred = Array.from({ length: 100 }, (_, i) => `Choice ${i}`).join("\n");
  assert.equal(parseRandomChoices(hundred).choices.length, 100);
  assert.equal(parseRandomChoices(`${hundred}\nChoice 0`).choices.length, 100);
  const tooMany = parseRandomChoices(`${hundred}\nOne more`);
  assert.equal(tooMany.choices.length, 0);
  assert.match(tooMany.error!, /100 unique choices/);
  assert.equal(parseRandomChoices("a".repeat(MAX_RANDOM_INPUT_LENGTH)).error, null);
  assert.match(parseRandomChoices("a".repeat(MAX_RANDOM_INPUT_LENGTH + 1)).error!, /10,000 characters/);
});

test("random selection covers both ends and handles zero or one choices", () => {
  assert.equal(pickRandomChoice([]), null);
  assert.equal(pickRandomChoice(["Only"], () => 0.999), "Only");
  assert.equal(pickRandomChoice(["First", "Middle", "Last"], () => 0), "First");
  assert.equal(pickRandomChoice(["First", "Middle", "Last"], () => 0.5), "Middle");
  assert.equal(pickRandomChoice(["First", "Middle", "Last"], () => 0.999), "Last");
});

test("picker draws without repeats, stops at exhaustion and restores the pool on reset", () => {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(RandomPicker)); });
  const root = renderer!.root;
  const pick = () => root.findAllByType("button")[0];
  const reset = () => root.findAllByType("button")[1];
  const selection = () => root.findByProps({ className: "random-picker-selection" }).children[0];
  try {
    assert.equal(pick().props.disabled, true);
    assert.equal(reset().props.disabled, true);
    act(() => root.findByProps({ id: "random-picker-choices" }).props.onChange({ target: { value: "Red\nBlue\nred" } }));
    act(() => pick().props.onClick());
    const first = selection();
    act(() => pick().props.onClick());
    assert.notEqual(selection(), first);
    assert.equal(root.findByProps({ className: "muted random-picker-count" }).children[0], "0 of 2 remaining");
    assert.equal(pick().props.disabled, true);
    assert.match(JSON.stringify(root.findByProps({ role: "status" }).children.map((child) => typeof child === "string" ? child : child.children)), /Every choice/);
    act(() => reset().props.onClick());
    assert.equal(pick().props.disabled, false);
    assert.equal(root.findAllByProps({ className: "random-picker-selection" }).length, 0);
    assert.equal(root.findByProps({ className: "muted random-picker-count" }).children[0], "2 of 2 remaining");
  } finally {
    act(() => renderer!.unmount());
  }
});

test("editing or changing repeat mode invalidates results; repeat mode supports a single choice", () => {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(RandomPicker)); });
  const root = renderer!.root;
  const input = () => root.findByProps({ id: "random-picker-choices" });
  const pick = () => root.findAllByType("button")[0];
  try {
    act(() => input().props.onChange({ target: { value: "One" } }));
    act(() => pick().props.onClick());
    assert.equal(pick().props.disabled, true);
    act(() => root.findByProps({ id: "random-picker-no-repeats" }).props.onChange({ target: { checked: false } }));
    assert.equal(root.findAllByProps({ className: "random-picker-selection" }).length, 0);
    act(() => pick().props.onClick());
    act(() => pick().props.onClick());
    assert.equal(pick().props.disabled, false);
    assert.equal(root.findByProps({ className: "random-picker-selection" }).children[0], "One");
    act(() => input().props.onChange({ target: { value: "New" } }));
    assert.equal(root.findAllByProps({ className: "random-picker-selection" }).length, 0);
    act(() => input().props.onChange({ target: { value: Array.from({ length: 101 }, (_, i) => `Choice ${i}`).join("\n") } }));
    assert.equal(pick().props.disabled, true);
    assert.equal(input().props["aria-invalid"], true);
    assert.ok(root.findByProps({ role: "alert" }));
    act(() => input().props.onChange({ target: { value: "Fixed" } }));
    assert.equal(pick().props.disabled, false);
    assert.equal(root.findAllByProps({ role: "alert" }).length, 0);
  } finally {
    act(() => renderer!.unmount());
  }
});
