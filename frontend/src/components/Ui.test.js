import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveTable } from "./Ui";

global.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("mapped columns retain mobile labels and working actions", () => {
  const click = jest.fn();
  act(() => root.render(<ResponsiveTable>
    <thead><tr>{["Name", "Fee", "Action"].map(label => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{["Sample student"].map(name => <tr key={name}>{[name, "₹100"].map(value => <td key={value}>{value}</td>)}<td><button onClick={click}>Edit</button></td></tr>)}</tbody>
  </ResponsiveTable>));
  expect([...container.querySelectorAll(".mobile-cell-label")].map(node => node.textContent)).toEqual(["Name", "Fee", "Action"]);
  act(() => container.querySelector("button").click());
  expect(click).toHaveBeenCalledTimes(1);
  expect(container.querySelector("table").getAttribute("role")).toBe("table");
});

test("loading and empty states span the mobile card without a false column label", () => {
  act(() => root.render(<ResponsiveTable><thead><tr><th>Name</th><th>Action</th></tr></thead><tbody><tr><td colSpan={2}>No students found</td></tr></tbody></ResponsiveTable>));
  expect(container.querySelector(".mobile-full-cell").textContent).toBe("No students found");
  expect(container.querySelector(".mobile-cell-label")).toBeNull();
});
