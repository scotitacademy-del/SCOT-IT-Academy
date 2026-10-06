import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import Students from "./Students";
import { studentApi, categoryApi, enquiryApi } from "../services/api";

jest.mock("../services/api", () => ({
  studentApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  categoryApi: { list: jest.fn() },
  enquiryApi: { list: jest.fn().mockResolvedValue({ data: [] }) },
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
  id: i + 1, studentId: `ST-${String(20 + i).padStart(3, "0")}`,
  name: `Learner ${i + 1}`, mobile: `90000000${String(i).padStart(2, "0")}`,
  comments: i === 4 ? "Discussed schedule" : "",
  staffPayout: i === 4 ? 50 : 0,
  netProfit: i === 4 ? 150 : 200,
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
  await act(async () => {
    const button = [...container.querySelectorAll("button")].find((b) => {
      const title = b.title || "";
      const ariaLabel = b.getAttribute("aria-label") || "";
      return b.textContent.trim() === text || title === text || ariaLabel.includes(text);
    });
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
  });
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
  expect(container.querySelector("tbody").textContent).toContain("ST-030");
  await click("Delete");
  expect(studentApi.delete).toHaveBeenCalledWith(11);
  expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  await change('[aria-label="Search students"]', "ST-024");
  expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(container.querySelector("tbody").textContent).toContain("Learner 5");
  await click("Download Excel");
  expect(XLSX.utils.json_to_sheet.mock.calls[0][0]).toEqual([
    expect.objectContaining({
      "Student ID": "ST-024",
      "Student Name": "Learner 5",
      "Join Date": joinDate,
      "Comments / Discussion": "Discussed schedule",
      "Staff Payout": 50,
      "Net Profit": 150,
    }),
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
  expect(container.querySelector('label[for="student-nextFollowUpDate"]')).toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe("");
  await click("+ Add Student");
  expect(container.querySelector("#student-studentId").value).toBe("");
});
test("student add form includes referral source and comments fields", async () => {
  await click("+ Add Student");
  expect(container.querySelector('select[name="referred_by"]')).not.toBeNull();
  expect(container.querySelector('textarea[name="comments"]')).not.toBeNull();
  expect(container.querySelector('input[name="staffPayout"]')).not.toBeNull();
  expect(container.querySelector('input[name="netProfit"]')).not.toBeNull();
  expect([...container.querySelectorAll("thead th")].map((cell) => cell.textContent).join(" ")).not.toMatch(/Staff Payout|Net Profit/);
});

test("student payout calculates net profit and is saved when creating a student", async () => {
  studentApi.create.mockImplementation(async (data) => ({
    data: { ...data, id: 20, studentId: "ST-040" },
  }));
  studentApi.update.mockResolvedValue({
    data: { staffPayout: 75, netProfit: 125 },
  });

  await click("+ Add Student");
  await change("#student-name", "New Learner");
  await change("#student-course", "Web");
  await change("#student-totalFee", "500");
  await change("#student-paidFee", "200");
  await change("#student-staffPayout", "50");
  await change("#student-joinDate", joinDate);

  expect(container.querySelector('input[name="netProfit"]').value).toBe("150");
  await click("Add Student");

  expect(studentApi.create).toHaveBeenCalledWith(
    expect.objectContaining({ staffPayout: 50, netProfit: 150 })
  );
  expect(container.querySelector("thead").textContent).not.toMatch(/Staff Payout|Net Profit/);
  await click("Download Excel");
  expect(XLSX.utils.json_to_sheet.mock.calls[0][0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ "Staff Payout": 50, "Net Profit": 150 }),
    ])
  );

  await change('[aria-label="Search students"]', "ST-040");
  await click("Edit");
  expect(container.querySelector('input[name="staffPayout"]').value).toBe("50");
  await change("#student-staffPayout", "75");

  expect(container.querySelector('input[name="netProfit"]').value).toBe("125");
  await click("Update Student");

  expect(studentApi.update).toHaveBeenCalledWith(
    20,
    expect.objectContaining({ staffPayout: 75, netProfit: 125 })
  );
});

test("referral source is shown in the table and updates when a student is edited", async () => {
  studentApi.list.mockResolvedValue({
    data: [{ ...students[0], referral_source: "Staff Referral" }],
  });
  studentApi.update.mockResolvedValue({
    data: { referred_by: "Website Lead" },
  });

  await act(async () => {
    root.unmount();
    root = createRoot(container);
    root.render(<Students />);
  });

  expect(container.querySelector("tbody").textContent).toContain("Staff Referral");
  await click("Edit");
  expect(container.querySelector('select[name="referred_by"]').value).toBe("Staff Referral");
  await change('select[name="referred_by"]', "Website Lead");
  await click("Update Student");

  expect(studentApi.update).toHaveBeenCalledWith(
    students[0].id,
    expect.objectContaining({ referred_by: "Website Lead" })
  );
  expect(container.querySelector("tbody").textContent).toContain("Website Lead");
});