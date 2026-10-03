import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import Students from "./Students";
import { studentApi, categoryApi } from "../services/api";

jest.mock("../services/api", () => ({
  studentApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  categoryApi: { list: jest.fn() },
}));
jest.mock("xlsx", () => ({
  utils: { json_to_sheet: jest.fn(() => ({})), book_new: jest.fn(() => ({})), book_append_sheet: jest.fn() },
  writeFile: jest.fn(),
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
const now = new Date();
const joinDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const students = Array.from({ length: 11 }, (_, i) => ({
  id: i + 1, studentId: `SCOT-${String(20 + i).padStart(3, "0")}`,
  name: `Learner ${i + 1}`, mobile: `90000000${String(i).padStart(2, "0")}`,
  course: "Web", category: "Development", totalFee: 1000, paidFee: 200, joinDate, status: "Active",
}));
async function change(selector, value) {
  await act(async () => {
    const el = container.querySelector(selector);
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function click(text) {
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent.trim() === text || b.title === text).click());
}
beforeEach(async () => {
  jest.clearAllMocks();
  XLSX.utils.json_to_sheet.mockReturnValue({});
  XLSX.utils.book_new.mockReturnValue({});
  categoryApi.list.mockResolvedValue({ data: ["Development"] });
  studentApi.list.mockResolvedValue({ data: students });
  studentApi.delete.mockResolvedValue({});
  jest.spyOn(window, "confirm").mockReturnValue(true);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<Students />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });

test("pagination, deletion, search and Excel retain the saved student IDs", async () => {
  expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  await click("Next");
  expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(container.querySelector("tbody").textContent).toContain("SCOT-030");
  await click("Delete");
  expect(studentApi.delete).toHaveBeenCalledWith(11);
  expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  await change('[aria-label="Search students"]', "SCOT-024");
  expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(container.querySelector("tbody").textContent).toContain("Learner 5");
  await click("Download Excel");
  expect(XLSX.utils.json_to_sheet.mock.calls[0][0]).toEqual([
    expect.objectContaining({ "Student ID": "SCOT-024", "Student Name": "Learner 5", "Join Date": joinDate }),
  ]);
  expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
  expect(container.querySelector(".mobile-cell-label").textContent).toBe("Student ID");
});

test("Overall filters include historical records and modal preserves saved ID and accessibility", async () => {
  studentApi.list.mockResolvedValue({ data: [...students, { ...students[0], id: 50, studentId: "OLD-900", name: "Historical learner", mobile: "8888888888", joinDate: "2024-01-10" }] });
  await act(async () => { root.unmount(); root = createRoot(container); root.render(<Students />); });
  expect([...container.querySelector("#student-year").options].map(o => o.value)).toContain("2024");
  await change("#student-year", "ALL");
  await change("#student-month", "ALL");
  await change('[aria-label="Search students"]', "OLD-900");
  await click("Edit");
  expect(container.querySelector('[role="dialog"]').getAttribute("aria-label")).toBe("Edit student");
  expect(container.querySelector("#student-studentId").value).toBe("OLD-900");
  expect(container.querySelector('label[for="student-nextFollowUpDate"]')).not.toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe("");
  await click("+ Add Student");
  expect(container.querySelector("#student-studentId").value).toBe("");
});
